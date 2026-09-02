import type { Circuit, Device, PortRef, SymbolInst, Wire } from "../types";
import { GRID } from "../types";
import { uid } from "../ids";
import { addJunction, addWire } from "../circuitBuilder";
import { terminalWorld } from "../geometry";
import { variantDef } from "../catalog";

export interface AutoLayoutOptions {
  powerStartX?: number;
  powerStartY?: number;
  controlStartX?: number;
  controlStartY?: number;
  rungSpacingY?: number;
  useNetLabelsForPower?: boolean;
}

interface ClassifiedCircuit {
  powerMains: SymbolInst[];
  powerBreakers: SymbolInst[];
  powerFuses: SymbolInst[];
  powerContactors: SymbolInst[];
  powerOverloads: SymbolInst[];
  powerMotors: SymbolInst[];
  powerGrounds: SymbolInst[];

  transformer?: SymbolInst;
  dcSupply?: SymbolInst;

  controlProtections: SymbolInst[]; // Overload 95-96, E-Stops, control fuses
  controlStops: SymbolInst[];       // PB-NC stops
  controlStarts: SymbolInst[];      // PB-NO starts, Selectors, Sensors
  controlAuxNO: SymbolInst[];       // KM 13-14 latch contacts, 43-44
  controlAuxNC: SymbolInst[];       // KM 21-22 interlock contacts
  controlCoils: SymbolInst[];       // KM / KA / KT coils
  controlIndicators: SymbolInst[];  // Lamps
  controlAlarms: SymbolInst[];      // Horns, Alarms
  controlOther: SymbolInst[];       // Any other control symbols
}

interface NetEndpoint {
  symbolId: string;
  term: string;
}

/**
 * Automatically lays out an electrical circuit according to standard electrical schematic rules:
 * 1. High-voltage power circuit separated at the top/left in a clean horizontal bus.
 * 2. Control power supply (transformer / DC supply) positioned between power and control logic.
 * 3. Control circuits arranged horizontally in ladder rungs with standard flow:
 *    Protections -> Stop Buttons -> [Start Buttons // Latch Aux-NO] -> Interlocks -> Coils / Loads.
 * 4. Parallel branches (latch contacts, parallel loads) aligned with dedicated T-junctions on the rung.
 * 5. Common return bus (X2 / 0V) spanning the bottom with vertical drop connections.
 * 6. All coordinates strictly aligned to the grid with orthogonal Manhattan wiring.
 */
export function autoLayoutCircuit(
  circuit: Circuit,
  options: AutoLayoutOptions = {},
): Circuit {
  const result: Circuit = {
    devices: JSON.parse(JSON.stringify(circuit.devices)),
    symbols: [],
    wires: [],
    groups: circuit.groups ? JSON.parse(JSON.stringify(circuit.groups)) : [],
  };

  const getDev = (sym: SymbolInst | { deviceId: string }): Device | undefined => {
    return result.devices.find((d) => d.id === sym.deviceId);
  };

  // 1. Identify original nets (connected components of non-junction ports)
  const nets = extractOriginalNets(circuit);

  // 2. Classify all symbols by electrical role
  const classified: ClassifiedCircuit = {
    powerMains: [],
    powerBreakers: [],
    powerFuses: [],
    powerContactors: [],
    powerOverloads: [],
    powerMotors: [],
    powerGrounds: [],
    controlProtections: [],
    controlStops: [],
    controlStarts: [],
    controlAuxNO: [],
    controlAuxNC: [],
    controlCoils: [],
    controlIndicators: [],
    controlAlarms: [],
    controlOther: [],
  };

  const activeSymbols = circuit.symbols.filter((s) => {
    const dev = circuit.devices.find((d) => d.id === s.deviceId);
    if (!dev) return false;
    if (dev.kind === "junction") return false; // junctions will be recreated for optimal topology
    return true;
  });

  for (const s of activeSymbols) {
    const dev = getDev(s);
    if (!dev) continue;

    const symClone: SymbolInst = {
      ...s,
      tagOffset: undefined,
      jog: undefined,
    } as any;

    const k = dev.kind;
    const v = s.variant || "body";

    // Power Mains
    if (k === "mains-3ph" || k === "mains-1ph") {
      classified.powerMains.push(symClone);
    }
    // Power Breakers & Isolators
    else if (k === "breaker-3p" || k === "isolator" || k === "rcd") {
      classified.powerBreakers.push(symClone);
    }
    // Fuses
    else if (k === "fuse") {
      if (v === "body" && activeSymbols.filter((sym) => getDev(sym)?.kind === "fuse").length > 1) {
        classified.powerFuses.push(symClone);
      } else {
        classified.controlProtections.push(symClone);
      }
    }
    // Contactor main power contacts
    else if (k === "contactor" && (v === "main" || v === "main-fwd" || v === "main-rev" || v === "main-delta" || v === "main-star")) {
      classified.powerContactors.push(symClone);
    }
    // Contactor coils
    else if ((k === "contactor" || k === "relay" || k === "timer-on" || k === "timer-off" || k === "counter") && (v === "coil" || !v || v === "body")) {
      classified.controlCoils.push(symClone);
    }
    // Auxiliary NO contacts (e.g. 13-14, 43-44)
    else if (v === "aux-no" || v === "aux-no2" || v === "no" || v === "delayed-no" || v === "inst-no") {
      if (k === "overload") {
        classified.controlProtections.push(symClone);
      } else {
        classified.controlAuxNO.push(symClone);
      }
    }
    // Auxiliary NC contacts (e.g. 21-22, 31-32)
    else if (v === "aux-nc" || v === "aux-nc2" || v === "nc" || v === "delayed-nc" || v === "inst-nc") {
      if (k === "overload") {
        classified.controlProtections.push(symClone);
      } else {
        classified.controlAuxNC.push(symClone);
      }
    }
    // Overload Relay
    else if (k === "overload") {
      if (v === "body") {
        classified.powerOverloads.push(symClone);
      } else {
        classified.controlProtections.push(symClone);
      }
    }
    // Motors
    else if (k === "motor-3ph" || k === "motor-1ph" || k === "motor-dc" || k === "heater-3ph") {
      classified.powerMotors.push(symClone);
    }
    // Grounds
    else if (k === "ground") {
      classified.powerGrounds.push(symClone);
    }
    // Power Transformers
    else if (k === "transformer") {
      classified.transformer = symClone;
    }
    // DC Supply
    else if (k === "dc-supply") {
      classified.dcSupply = symClone;
    }
    // E-Stops
    else if (k === "estop" || k === "estop-nc") {
      classified.controlProtections.push(symClone);
    }
    // Stop buttons
    else if (k === "pb-nc" || k === "foot-nc") {
      classified.controlStops.push(symClone);
    }
    // Start buttons, selectors, sensors
    else if (
      k === "pb-no" ||
      k === "foot-no" ||
      k.startsWith("selector-") ||
      k.startsWith("toggle-") ||
      k.startsWith("limit-") ||
      k.startsWith("temp-") ||
      k.startsWith("pressure-") ||
      k.startsWith("flow-") ||
      k === "float" ||
      k === "prox" ||
      k === "photo"
    ) {
      classified.controlStarts.push(symClone);
    }
    // Lamps / Indicators
    else if (k === "lamp") {
      classified.controlIndicators.push(symClone);
    }
    // Alarms / Horns / Buzzers
    else if (k === "alarm" || k === "horn") {
      classified.controlAlarms.push(symClone);
    }
    // Net labels and other accessories
    else {
      classified.controlOther.push(symClone);
    }
  }

  // 3. Lay out High Voltage / Power Circuit (動力迴路)
  const powerY = options.powerStartY ?? 3;
  let powerX = options.powerStartX ?? 4;

  // 3.1 Mains Supply (e.g. Mains-3ph)
  for (const mains of classified.powerMains) {
    mains.x = powerX;
    mains.y = powerY;
    mains.rot = 0;
    result.symbols.push(mains);
    powerX += 8;
  }

  // 3.2 Breaker / Isolator
  for (const brk of classified.powerBreakers) {
    brk.x = powerX;
    brk.y = powerY;
    brk.rot = 0;
    result.symbols.push(brk);
    powerX += 10;
  }

  // 3.3 Power Contactors (Main contacts)
  for (let i = 0; i < classified.powerContactors.length; i++) {
    const kmMain = classified.powerContactors[i];
    kmMain.x = powerX;
    kmMain.y = i === 0 ? powerY : powerY + 8; // Parallel branch for reverse contactor
    kmMain.rot = 0;
    result.symbols.push(kmMain);
  }
  if (classified.powerContactors.length > 0) {
    powerX += 8;
  }

  // 3.4 Overload Relay (Main body)
  for (const ovr of classified.powerOverloads) {
    ovr.x = powerX;
    ovr.y = powerY;
    ovr.rot = 0;
    result.symbols.push(ovr);
    powerX += 10;
  }

  // 3.5 Motors
  for (const motor of classified.powerMotors) {
    motor.x = powerX + 3;
    motor.y = powerY;
    motor.rot = 270;
    result.symbols.push(motor);
    powerX += 10;
  }

  // 4. Lay out Transformer / Control Power Source
  let transX = 16;
  let transY = 12;
  if (classified.transformer) {
    classified.transformer.x = transX;
    classified.transformer.y = transY;
    classified.transformer.rot = 90;
    result.symbols.push(classified.transformer);
  } else if (classified.dcSupply) {
    classified.dcSupply.x = transX;
    classified.dcSupply.y = transY;
    classified.dcSupply.rot = 0;
    result.symbols.push(classified.dcSupply);
  }

  // 5. Lay out Control Circuit Rungs (控制迴路階梯分佈)
  const rungStartX = options.controlStartX ?? 24;
  let currentRungY = options.controlStartY ?? 19;
  const rungSpacing = options.rungSpacingY ?? 7;

  // Group control chains by load
  const remainingProtections = [...classified.controlProtections];
  const remainingStops = [...classified.controlStops];
  const remainingStarts = [...classified.controlStarts];
  const remainingAuxNO = [...classified.controlAuxNO];
  const remainingAuxNC = [...classified.controlAuxNC];
  const remainingCoils = [...classified.controlCoils];
  const remainingIndicators = [...classified.controlIndicators];
  const remainingAlarms = [...classified.controlAlarms];

  // Rung 1: Master Start-Stop control line
  const primaryCoil = remainingCoils.shift();
  if (primaryCoil) {
    let rungX = rungStartX;

    // Overload 95-96 / E-Stop
    const prot = remainingProtections.find((p) => {
      const d = getDev(p);
      return d?.kind === "overload" && (p.variant === "aux-nc" || p.variant === "nc");
    }) || remainingProtections.shift();

    if (prot) {
      const idx = remainingProtections.indexOf(prot);
      if (idx >= 0) remainingProtections.splice(idx, 1);
      prot.x = rungX;
      prot.y = currentRungY;
      prot.rot = 0;
      result.symbols.push(prot);
      rungX += 6;
    }

    // Stop button
    const stop = remainingStops.shift();
    if (stop) {
      stop.x = rungX;
      stop.y = currentRungY;
      stop.rot = 0;
      result.symbols.push(stop);
      rungX += 6;
    }

    // Start button & Parallel Latch Contact
    const start = remainingStarts.shift();
    if (start) {
      start.x = rungX + 2;
      start.y = currentRungY;
      start.rot = 0;
      result.symbols.push(start);

      // Find matching aux-no for latching
      const latch = remainingAuxNO.shift();
      if (latch) {
        latch.x = start.x;
        latch.y = currentRungY + 2; // Offset vertically by 2 units for standard parallel block
        latch.rot = 0;
        result.symbols.push(latch);
      }
      rungX += 8;
    }

    // Interlock contact (if any)
    const ilock = remainingAuxNC.shift();
    if (ilock) {
      ilock.x = rungX + 2;
      ilock.y = currentRungY;
      ilock.rot = 0;
      result.symbols.push(ilock);
      rungX += 6;
    }

    // Output Coil (KM1 A1-A2)
    primaryCoil.x = 50;
    primaryCoil.y = currentRungY;
    primaryCoil.rot = 0;
    result.symbols.push(primaryCoil);
  }

  // Subsequent Rungs for additional Coils (e.g. KM2 Reverse, KT1 Timer)
  for (const coil of remainingCoils) {
    currentRungY += rungSpacing;
    let rX = rungStartX + 6;

    const startBtn = remainingStarts.shift();
    if (startBtn) {
      startBtn.x = rX + 2;
      startBtn.y = currentRungY;
      startBtn.rot = 0;
      result.symbols.push(startBtn);

      const latch = remainingAuxNO.shift();
      if (latch) {
        latch.x = startBtn.x;
        latch.y = currentRungY + 2;
        latch.rot = 0;
        result.symbols.push(latch);
      }
      rX += 8;
    }

    const ilock = remainingAuxNC.shift();
    if (ilock) {
      ilock.x = rX + 2;
      ilock.y = currentRungY;
      ilock.rot = 0;
      result.symbols.push(ilock);
      rX += 6;
    }

    coil.x = 50;
    coil.y = currentRungY;
    coil.rot = 0;
    result.symbols.push(coil);
  }

  // Rung for Running Indicators (Green Lamp HL1)
  const nonFaultLamps = remainingIndicators.filter((l) => getDev(l)?.params?.color !== "red");
  for (const lamp of nonFaultLamps) {
    const idx = remainingIndicators.indexOf(lamp);
    if (idx >= 0) remainingIndicators.splice(idx, 1);

    currentRungY += 4;
    lamp.x = 50;
    lamp.y = currentRungY;
    lamp.rot = 0;
    result.symbols.push(lamp);

    const auxInd = remainingAuxNO.shift();
    if (auxInd) {
      auxInd.x = rungStartX + 8;
      auxInd.y = currentRungY;
      auxInd.rot = 0;
      result.symbols.push(auxInd);
    }
  }

  // Rung for Fault / Alarm (e.g. Overload Aux-NO 97-98 -> Red Lamp / Alarm Horn)
  const faultProt = remainingProtections.find((p) => {
    const d = getDev(p);
    return d?.kind === "overload" && (p.variant === "aux-no" || p.variant === "no");
  }) || remainingProtections.shift();

  if (faultProt || remainingAlarms.length > 0 || remainingIndicators.length > 0) {
    currentRungY += 5;
    if (faultProt) {
      faultProt.x = rungStartX;
      faultProt.y = currentRungY;
      faultProt.rot = 0;
      result.symbols.push(faultProt);
    }

    let alarmY = currentRungY;
    for (const alm of remainingAlarms) {
      alm.x = 50;
      alm.y = alarmY;
      alm.rot = 0;
      result.symbols.push(alm);
      alarmY += 3;
    }

    for (const rLamp of remainingIndicators) {
      rLamp.x = 50;
      rLamp.y = alarmY;
      rLamp.rot = 0;
      result.symbols.push(rLamp);
      alarmY += 3;
    }
    if (alarmY > currentRungY) currentRungY = alarmY;
  }

  // Power Ground PE (placed at bottom)
  const returnBusY = currentRungY + 3;
  for (const gnd of classified.powerGrounds) {
    gnd.x = 8;
    gnd.y = returnBusY;
    gnd.rot = 0;
    result.symbols.push(gnd);
  }

  // Remaining miscellaneous control symbols (Comment, Title-block, Net-labels)
  let otherY = returnBusY + 4;
  for (const oth of classified.controlOther) {
    const dev = getDev(oth);
    if (dev?.kind === "title-block") {
      oth.x = 60;
      oth.y = returnBusY + 6;
      oth.rot = 0;
    } else if (dev?.kind === "comment") {
      oth.x = 4;
      oth.y = otherY;
      oth.rot = 0;
      otherY += 4;
    } else {
      oth.x = rungStartX;
      oth.y = otherY;
      oth.rot = 0;
      otherY += 3;
    }
    result.symbols.push(oth);
  }

  // 6. Regenerate Clean Orthogonal Wires with Manhattan T-Junctions
  routeOrthogonalCleanWires(result, nets, circuit, returnBusY);

  // Strictly align all symbols to integer grid units
  for (const s of result.symbols) {
    s.x = Math.round(s.x);
    s.y = Math.round(s.y);
  }

  return result;
}

/**
 * Extracts connected nets from the original circuit.
 * Junctions are treated as routing nodes and collapsed so that each net is a set of device terminal endpoints.
 */
function extractOriginalNets(circuit: Circuit): NetEndpoint[][] {
  interface PortKey {
    symbolId: string;
    term: string;
  }

  const adj = new Map<string, PortKey[]>();
  const addEdge = (p1: PortKey, p2: PortKey) => {
    const k1 = `${p1.symbolId}:${p1.term}`;
    const k2 = `${p2.symbolId}:${p2.term}`;
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push(p2);
    adj.get(k2)!.push(p1);
  };

  for (const w of circuit.wires) {
    addEdge(w.a, w.b);
  }

  const visited = new Set<string>();
  const nets: NetEndpoint[][] = [];

  for (const k of adj.keys()) {
    if (visited.has(k)) continue;
    const net: NetEndpoint[] = [];
    const queue = [k];
    visited.add(k);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const [symId, term] = curr.split(":");
      const dev = circuit.devices.find((d) => d.id === circuit.symbols.find((s) => s.id === symId)?.deviceId);
      if (dev && dev.kind !== "junction") {
        net.push({ symbolId: symId, term });
      }
      for (const neighbor of adj.get(curr) || []) {
        const nk = `${neighbor.symbolId}:${neighbor.term}`;
        if (!visited.has(nk)) {
          visited.add(nk);
          queue.push(nk);
        }
      }
    }

    if (net.length > 1) {
      nets.push(net);
    }
  }

  return nets;
}

/**
 * Routes orthogonal wires with standard T-junction placement.
 */
function routeOrthogonalCleanWires(
  result: Circuit,
  nets: NetEndpoint[][],
  originalCircuit: Circuit,
  returnBusY: number,
) {
  for (const net of nets) {
    const activeEndpoints = net.filter((p) => result.symbols.some((s) => s.id === p.symbolId));
    if (activeEndpoints.length < 2) continue;

    // Direct 2-terminal connection
    if (activeEndpoints.length === 2) {
      const [p1, p2] = activeEndpoints;
      addWire(result, p1.symbolId, p1.term, p2.symbolId, p2.term);
      continue;
    }

    // 3+ terminal nets: Group by geometric topology (e.g. Return rail, Latch input/output, or Power Phase)
    const points = activeEndpoints
      .map((p) => {
        const pt = terminalWorld(result, p);
        return pt ? { p, x: Math.round(pt.x / GRID), y: Math.round(pt.y / GRID) } : null;
      })
      .filter((item): item is { p: NetEndpoint; x: number; y: number } => item !== null);

    if (points.length < 2) continue;

    // Check if this is the Common Return Net (e.g. X2 / Ground / Neutral)
    const isReturnNet = points.some((pt) => {
      const dev = result.devices.find((d) => d.id === result.symbols.find((s) => s.id === pt.p.symbolId)?.deviceId);
      return (
        (dev?.kind === "transformer" && (pt.p.term === "X2" || pt.p.term === "2")) ||
        (dev?.kind === "ground") ||
        (dev?.kind === "dc-supply" && (pt.p.term === "-" || pt.p.term === "0V" || pt.p.term === "COM"))
      );
    });

    if (isReturnNet) {
      // Create a clean horizontal Return Bus at returnBusY
      const minX = Math.min(...points.map((pt) => pt.x));
      const maxX = Math.max(...points.map((pt) => pt.x));

      // Connect all points vertically to the return bus line with T-junctions
      const busJunctions: { jSym: SymbolInst; x: number }[] = [];

      for (const pt of points) {
        if (pt.y === returnBusY) {
          // Already on the return bus
          continue;
        }
        // Place T-junction directly on the return bus below the component
        const j = addJunction(result, pt.x, returnBusY);
        busJunctions.push({ jSym: j.symbol, x: pt.x });
        // Drop vertical wire from component to the return bus junction
        addWire(result, pt.p.symbolId, pt.p.term, j.symbol, "1");
      }

      // Chain bus junctions horizontally along the bus line
      busJunctions.sort((a, b) => a.x - b.x);
      for (let i = 0; i < busJunctions.length - 1; i++) {
        addWire(result, busJunctions[i].jSym, "1", busJunctions[i + 1].jSym, "1");
      }

      // If transformer X2 or ground is at minX, connect to first junction
      const sourcePt = points.find((pt) => pt.y < returnBusY && pt.x <= minX + 2);
      if (sourcePt && busJunctions.length > 0 && sourcePt.x < busJunctions[0].x) {
        // connect source to first junction
        // already connected via vertical drop
      }
      continue;
    }

    // Check if this is a Parallel Latch Input / Output or Series Branch
    // For general multi-terminal control nets, pick the principal node (e.g. Stop PB out or Start PB in)
    // and create a T-junction on the main rung
    const rungY = points[0].y;
    const sameRungPoints = points.filter((pt) => pt.y === rungY);

    if (sameRungPoints.length >= 2) {
      // Junction on the main line
      const jX = sameRungPoints[0].x;
      const j = addJunction(result, jX, rungY);

      for (const pt of points) {
        addWire(result, pt.p.symbolId, pt.p.term, j.symbol, "1");
      }
    } else {
      // Find optimal orthogonal junction point (e.g. median coordinates snapped to grid)
      const avgX = Math.round(points.reduce((sum, pt) => sum + pt.x, 0) / points.length);
      const avgY = Math.round(points.reduce((sum, pt) => sum + pt.y, 0) / points.length);

      const j = addJunction(result, avgX, avgY);
      for (const pt of points) {
        addWire(result, pt.p.symbolId, pt.p.term, j.symbol, "1");
      }
    }
  }
}
