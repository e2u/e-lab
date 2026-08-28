import type { Circuit, Device, DeviceKind, ProcessVars, SimSnapshot, SymbolInst } from "../types";
import type {
  LadderBranch,
  LadderCoilElement,
  LadderCoilType,
  LadderContactElement,
  LadderContactType,
  LadderDiagramModel,
  LadderPowerBranch,
  LadderRung,
  LadderRungItem,
  LadderTransformerBranch,
} from "./ladderTypes";

/**
 * Evaluates whether a contact is closed in the current simulation state.
 */
export function isContactClosed(
  device: Device,
  variant: string | undefined,
  snapshot: SimSnapshot,
  held: string[],
  process: ProcessVars,
): boolean {
  const rt = snapshot.runtime[device.id];
  const isHeld = held.includes(device.id);

  switch (device.kind) {
    case "pb-no":
    case "foot-no":
      return isHeld;
    case "pb-nc":
    case "foot-nc":
    case "foot":
      return !isHeld;
    case "estop":
    case "estop-nc":
      return !(rt?.actuated ?? false);
    case "estop-no":
      return rt?.actuated ?? false;
    case "overload":
      if (variant === "aux-no" || variant === "no") return rt?.tripped ?? false;
      return !(rt?.tripped ?? false); // 95-96 NC contact
    case "contactor":
    case "relay":
      if (variant === "aux-no" || variant === "aux-no2" || variant === "no") {
        return (rt?.energized ?? false) || (device.params.welded ?? false);
      }
      if (variant === "aux-nc" || variant === "aux-nc2" || variant === "nc") {
        return !(rt?.energized ?? false) && !(device.params.welded ?? false);
      }
      return rt?.energized ?? false;
    case "timer-on":
      if (variant === "aux-no" || variant === "no") return rt?.done ?? false;
      if (variant === "aux-nc" || variant === "nc") return !(rt?.done ?? false);
      return rt?.done ?? false;
    case "timer-off":
      if (variant === "aux-no" || variant === "no") return !(rt?.done ?? false);
      if (variant === "aux-nc" || variant === "nc") return rt?.done ?? false;
      return rt?.done ?? false;
    case "counter":
      if (variant === "aux-no" || variant === "no") return rt?.done ?? false;
      if (variant === "aux-nc" || variant === "nc") return !(rt?.done ?? false);
      return rt?.done ?? false;
    case "limit-no":
      return Boolean(process.limitHit);
    case "limit-nc":
      return !process.limitHit;
    case "prox":
      return Boolean(process.proxHit);
    case "photo":
      return Boolean(process.photoHit);
    case "temp-no":
      return (process.temperature ?? 25) >= (device.params.setpoint ?? 50);
    case "temp-nc":
      return (process.temperature ?? 25) < (device.params.setpoint ?? 50);
    case "pressure-no":
      return (process.pressure ?? 0) >= (device.params.setpoint ?? 5);
    case "pressure-nc":
      return (process.pressure ?? 0) < (device.params.setpoint ?? 5);
    case "flow-no":
      return (process.flow ?? 0) >= (device.params.setpoint ?? 10);
    case "flow-nc":
      return (process.flow ?? 0) < (device.params.setpoint ?? 10);
    case "float":
      return variant === "nc"
        ? (process.level ?? 0) < (device.params.setpoint ?? 50)
        : (process.level ?? 0) >= (device.params.setpoint ?? 50);
    case "toggle":
    case "toggle-spst":
    case "toggle-dpst":
      return (rt?.actuated ?? false) || (rt?.on ?? false);
    case "toggle-spdt":
    case "toggle-dpdt":
    case "toggle-4pdt":
      return variant === "pos2" ? !(rt?.actuated ?? false) : (rt?.actuated ?? false);
    case "selector-2":
      return (rt?.position ?? 0) === 1;
    case "selector-3":
      return variant === "pos2" ? (rt?.position ?? 0) === 2 : (rt?.position ?? 0) === 1;
    case "breaker-1p":
    case "breaker-3p":
    case "isolator":
    case "rcd":
      return (rt?.on ?? false) && !(rt?.tripped ?? false);
    case "fuse":
      return !(rt?.tripped ?? false);
    default:
      return true;
  }
}

/**
 * Maps DeviceKind and variant to LadderContactType.
 */
function getContactType(kind: DeviceKind, variant?: string): LadderContactType {
  switch (kind) {
    case "pb-no":
      return "pb-no";
    case "pb-nc":
      return "pb-nc";
    case "estop":
    case "estop-nc":
      return "estop";
    case "estop-no":
      return "estop-no";
    case "overload":
      if (variant === "aux-no" || variant === "no" || variant === "97-98") return "no";
      return "overload";
    case "limit-no":
      return "limit-no";
    case "limit-nc":
      return "limit-nc";
    case "temp-no":
      return "temp-no";
    case "temp-nc":
      return "temp-nc";
    case "pressure-no":
      return "pressure-no";
    case "pressure-nc":
      return "pressure-nc";
    case "flow-no":
      return "flow-no";
    case "flow-nc":
      return "flow-nc";
    case "float":
      return variant === "nc" ? "float-nc" : "float";
    case "foot-no":
      return "foot-no";
    case "foot-nc":
    case "foot":
      return "foot-nc";
    case "prox":
      return "prox";
    case "photo":
      return "photo";
    case "selector-2":
    case "selector-3":
      return "selector";
    case "toggle":
    case "toggle-spst":
    case "toggle-spdt":
    case "toggle-dpst":
    case "toggle-dpdt":
    case "toggle-4pdt":
    case "breaker-1p":
    case "fuse":
      return "toggle";
    case "timer-on":
    case "timer-off":
      if (variant === "aux-nc" || variant === "nc") return "timer-nc";
      return "timer-no";
    case "contactor":
    case "relay":
    default:
      if (variant?.includes("nc")) return "nc";
      return "no";
  }
}

/**
 * Maps output device kinds to LadderCoilType.
 */
function getCoilType(kind: DeviceKind): LadderCoilType {
  switch (kind) {
    case "timer-on":
      return "timer-on";
    case "timer-off":
      return "timer-off";
    case "counter":
      return "counter";
    case "lamp":
      return "lamp";
    case "alarm":
      return "alarm";
    case "horn":
      return "horn";
    case "solenoid":
      return "solenoid";
    case "heater":
      return "heater";
    case "fan":
      return "fan";
    case "contactor":
    case "relay":
    default:
      return "coil";
  }
}

/**
 * Generates the complete Ladder Diagram Model from the current circuit and simulation state.
 */
export function buildLadderDiagram(
  circuit: Circuit,
  snapshot: SimSnapshot,
  held: string[],
  process: ProcessVars,
  docName?: string,
): LadderDiagramModel {
  const { devices, symbols } = circuit;

  // 1. Identify Power Rails & Transformer
  const transformer = devices.find((d) => d.kind === "transformer");
  const mains = devices.find((d) => d.kind === "mains-3ph");
  const dcSupply = devices.find((d) => d.kind === "dc-supply");

  let leftRailLabel = "L1 (120VAC)";
  let rightRailLabel = "L2 / N (0V)";
  let leftRailVoltage = "120V";
  let isLeftRailLive = true;
  const isRightRailLive = true;

  if (transformer) {
    const tTag = transformer.tag || "TC1";
    leftRailLabel = `${tTag} (X1) [120V]`;
    rightRailLabel = `${tTag} (X2) [0V/GND]`;
    leftRailVoltage = "120VAC";
    isLeftRailLive = snapshot.runtime[transformer.id]?.energized ?? true;
  } else if (dcSupply) {
    const dcTag = dcSupply.tag || "DC1";
    leftRailLabel = `${dcTag} (+24V)`;
    rightRailLabel = `${dcTag} (0V COM)`;
    leftRailVoltage = "24VDC";
    isLeftRailLive = snapshot.runtime[dcSupply.id]?.energized ?? true;
  } else if (mains) {
    const v = mains.params.voltage ?? 480;
    const mTag = mains.tag || "L1";
    leftRailLabel = `${mTag} (${v}V)`;
    rightRailLabel = mains.params.supplyType === "delta" ? `L2 (${v}V)` : `N (0V)`;
    leftRailVoltage = `${v}V`;
    isLeftRailLive = snapshot.runtime[mains.id]?.energized ?? true;
  }

  // 2. Build 3-Phase Power Distribution Branches (if any mains / 3p breaker / motor exist)
  const powerBranches: LadderPowerBranch[] = [];
  const disconnect = devices.find((d) => d.kind === "isolator");
  const breaker3p = devices.find((d) => d.kind === "breaker-3p" || d.kind === "rcd");
  const fuses = devices.find((d) => d.kind === "fuse");
  const contactor = devices.find(
    (d) =>
      d.kind === "contactor" ||
      d.kind === "starter-dol" ||
      d.kind === "starter-fwd" ||
      d.kind === "starter-rev" ||
      d.kind === "starter-rev-combo",
  );
  const overload = devices.find((d) => d.kind === "overload");
  const motor3p = devices.find((d) => d.kind === "motor-3ph");
  const motor1p = devices.find((d) => d.kind === "motor-1ph");
  const motorDc = devices.find((d) => d.kind === "motor-dc");
  const ground = devices.find((d) => d.kind === "ground");

  if (mains || motor3p || motor1p || breaker3p || disconnect) {
    const activeMotor = motor3p || motor1p || motorDc;
    const motorRt = activeMotor ? snapshot.runtime[activeMotor.id] : undefined;
    const disconnectRt = disconnect ? snapshot.runtime[disconnect.id] : undefined;
    const breakerRt = breaker3p ? snapshot.runtime[breaker3p.id] : undefined;
    const fusesRt = fuses ? snapshot.runtime[fuses.id] : undefined;
    const overloadRt = overload ? snapshot.runtime[overload.id] : undefined;
    const contactorRt = contactor ? snapshot.runtime[contactor.id] : undefined;

    const isDisconnectClosed = disconnectRt ? Boolean(disconnectRt.on && !disconnectRt.tripped) : true;
    const isBreakerClosed = breakerRt ? Boolean(breakerRt.on && !breakerRt.tripped) : true;
    const isFusesIntact = fusesRt ? !fusesRt.tripped : true;
    const isOverloadTripped = overloadRt ? Boolean(overloadRt.tripped) : false;
    const isContactorClosed = contactorRt ? Boolean(contactorRt.energized || contactorRt.on) : Boolean(motorRt && (motorRt.energized || Math.abs(motorRt.rpm) > 0.1));

    powerBranches.push({
      id: "pwr_main_branch",
      title: "3-PHASE POWER & MOTOR MAIN CIRCUIT",
      mains,
      disconnect,
      breaker: breaker3p,
      fuses,
      contactor,
      overload,
      motor: activeMotor,
      ground,
      isDisconnectClosed,
      isBreakerClosed,
      isFusesIntact,
      isOverloadTripped,
      isContactorClosed,
      isRunning: Boolean(motorRt && Math.abs(motorRt.rpm) > 0.1),
      isEnergized: Boolean(motorRt?.energized),
      speedRpm: motorRt?.rpm,
      voltage: mains?.params.voltage ?? 480,
      power: activeMotor?.params.power ?? 5.5,
    });
  }

  // 2.5 Build Independent Control Power Transformer Branch (if present)
  let transformerBranch: LadderTransformerBranch | undefined = undefined;
  if (transformer) {
    const priV = transformer.params.primaryVoltage ??
      (transformer.params.primaryVolts ? Number(transformer.params.primaryVolts) :
        (transformer.params.ratio ? Number(transformer.params.ratio.split("/")[0]) : (mains?.params.voltage ?? 480)));
    const secV = transformer.params.secondaryVoltage ??
      (transformer.params.secondaryVolts ? Number(transformer.params.secondaryVolts) :
        (transformer.params.ratio ? Number(transformer.params.ratio.split("/")[1]) : 120));

    transformerBranch = {
      id: "cpt_branch",
      title: "CONTROL POWER TRANSFORMER (CPT) - STEP-DOWN SUPPLY",
      transformer,
      mains,
      primaryVoltage: isNaN(priV) ? 480 : priV,
      secondaryVoltage: isNaN(secV) ? 120 : secV,
      fuses,
      ground,
      isEnergized: snapshot.runtime[transformer.id]?.energized ?? true,
    };
  }

  // 3. Collect Output Coils & Loads and Contact Units
  const outputDevices: { device: Device; symbol?: SymbolInst }[] = [];
  const allSymbols = symbols;

  for (const dev of devices) {
    if (
      dev.kind === "contactor" ||
      dev.kind === "relay" ||
      dev.kind === "timer-on" ||
      dev.kind === "timer-off" ||
      dev.kind === "counter" ||
      dev.kind === "lamp" ||
      dev.kind === "alarm" ||
      dev.kind === "horn" ||
      dev.kind === "solenoid" ||
      dev.kind === "heater" ||
      dev.kind === "fan" ||
      dev.kind.startsWith("starter-")
    ) {
      const sym = allSymbols.find((s) => s.deviceId === dev.id && (s.variant === "coil" || s.variant === "body" || !s.variant));
      outputDevices.push({ device: dev, symbol: sym });
    }
  }

  // Helper to create a LadderContactElement
  const makeContactElement = (
    dev: Device,
    sym?: SymbolInst,
    customVariant?: string,
    customAddress?: string,
    customContactType?: LadderContactType,
  ): LadderContactElement => {
    const variant = customVariant || sym?.variant;
    const closed = isContactClosed(dev, variant, snapshot, held, process);
    const rt = snapshot.runtime[dev.id];
    let address = customAddress || "";
    if (!address) {
      if (dev.kind === "overload") address = variant === "aux-no" || variant === "no" || variant === "97-98" ? "97-98" : "95-96";
      else if (dev.kind === "pb-nc" || dev.kind === "estop" || dev.kind === "estop-nc") address = "1-2";
      else if (dev.kind === "pb-no") address = "3-4";
      else if (variant === "aux-no2") address = "43-44";
      else if (variant === "aux-nc2") address = "31-32";
      else if (variant?.includes("no")) address = "13-14";
      else if (variant?.includes("nc")) address = "21-22";
    }

    let label = dev.tag || dev.kind;
    if (dev.kind === "overload" && (variant === "aux-no" || variant === "no" || address === "97-98")) {
      label = `${dev.tag || "OL"} (NO)`;
    }

    return {
      id: sym?.id || `cnt_${dev.id}_${variant || "c"}_${address}`,
      deviceId: dev.id,
      symbolId: sym?.id,
      device: dev,
      label,
      address,
      isClosed: closed,
      isLive: isLeftRailLive && closed,
      kind: dev.kind,
      variant,
      contactType: customContactType || getContactType(dev.kind, variant),
      actuated: rt?.actuated,
    };
  };

  // Helper to create a LadderCoilElement
  const makeCoilElement = (dev: Device, sym?: SymbolInst): LadderCoilElement => {
    const rt = snapshot.runtime[dev.id];
    const isLitOrEnergized = Boolean(rt?.energized || rt?.lit || (dev.kind === "contactor" && rt?.on));
    let address = "A1-A2";
    if (dev.kind === "lamp") address = "X1-X2";
    else if (dev.kind === "horn" || dev.kind === "alarm") address = "+ -";

    return {
      id: sym?.id || `coil_${dev.id}`,
      deviceId: dev.id,
      symbolId: sym?.id,
      device: dev,
      label: dev.tag || dev.kind,
      address,
      isClosed: isLitOrEnergized,
      isLive: isLitOrEnergized,
      kind: dev.kind,
      variant: sym?.variant || "coil",
      coilType: getCoilType(dev.kind),
    };
  };

  // Structure for discovered contacts
  interface DiscoveredContact {
    id: string;
    deviceId: string;
    symbolId?: string;
    device: Device;
    symbol?: SymbolInst;
    variant?: string;
    address: string;
    contactType: LadderContactType;
    termA: string;
    termB: string;
  }

  // 4. Extract all Contact Units from Circuit Symbols and Devices
  const contactUnits: DiscoveredContact[] = [];

  for (const sym of allSymbols) {
    const dev = devices.find((d) => d.id === sym.deviceId);
    if (!dev) continue;

    if (dev.kind === "overload") {
      if (sym.variant === "body") {
        contactUnits.push({
          id: `${sym.id}_95_96`,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-nc",
          address: "95-96",
          contactType: "overload",
          termA: "95",
          termB: "96",
        });
        contactUnits.push({
          id: `${sym.id}_97_98`,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-no",
          address: "97-98",
          contactType: "no",
          termA: "97",
          termB: "98",
        });
      } else if (sym.variant === "aux-no" || sym.variant === "no") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-no",
          address: "97-98",
          contactType: "no",
          termA: "97",
          termB: "98",
        });
      } else if (sym.variant === "aux-nc" || sym.variant === "nc") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-nc",
          address: "95-96",
          contactType: "overload",
          termA: "95",
          termB: "96",
        });
      }
    } else if (
      dev.kind === "contactor" ||
      dev.kind === "relay" ||
      dev.kind.startsWith("starter-")
    ) {
      if (sym.variant === "aux-no" || sym.variant === "no") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-no",
          address: "13-14",
          contactType: "no",
          termA: "13",
          termB: "14",
        });
      } else if (sym.variant === "aux-nc" || sym.variant === "nc") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-nc",
          address: "21-22",
          contactType: "nc",
          termA: "21",
          termB: "22",
        });
      } else if (sym.variant === "aux-no2") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-no2",
          address: "43-44",
          contactType: "no",
          termA: "43",
          termB: "44",
        });
      } else if (sym.variant === "aux-nc2") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-nc2",
          address: "31-32",
          contactType: "nc",
          termA: "31",
          termB: "32",
        });
      }
    } else if (dev.kind === "timer-on" || dev.kind === "timer-off" || dev.kind === "counter") {
      if (sym.variant === "aux-nc" || sym.variant === "nc") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-nc",
          address: "21-22",
          contactType: "timer-nc",
          termA: "3",
          termB: "4",
        });
      } else if (sym.variant === "aux-no" || sym.variant === "no") {
        contactUnits.push({
          id: sym.id,
          deviceId: dev.id,
          symbolId: sym.id,
          device: dev,
          symbol: sym,
          variant: "aux-no",
          address: "13-14",
          contactType: "timer-no",
          termA: "1",
          termB: "2",
        });
      }
    } else if (dev.kind === "pb-no" || dev.kind === "foot-no") {
      contactUnits.push({
        id: sym.id,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "body",
        address: "3-4",
        contactType: dev.kind as LadderContactType,
        termA: "3",
        termB: "4",
      });
    } else if (dev.kind === "pb-nc" || dev.kind === "foot-nc" || dev.kind === "foot") {
      contactUnits.push({
        id: sym.id,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "body",
        address: "1-2",
        contactType: dev.kind as LadderContactType,
        termA: "1",
        termB: "2",
      });
    } else if (dev.kind === "estop" || dev.kind === "estop-nc") {
      contactUnits.push({
        id: sym.id,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "body",
        address: "1-2",
        contactType: "estop",
        termA: "11",
        termB: "12",
      });
    } else if (dev.kind === "estop-no") {
      contactUnits.push({
        id: sym.id,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "body",
        address: "13-14",
        contactType: "estop-no",
        termA: "13",
        termB: "14",
      });
    } else if (dev.kind === "selector-2") {
      contactUnits.push({
        id: `${sym.id}_1`,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "pos1",
        address: "1-2",
        contactType: "selector",
        termA: "1",
        termB: "2",
      });
      contactUnits.push({
        id: `${sym.id}_2`,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "pos2",
        address: "3-4",
        contactType: "selector",
        termA: "3",
        termB: "4",
      });
    } else if (dev.kind === "selector-3") {
      contactUnits.push({
        id: `${sym.id}_fwd`,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "fwd",
        address: "C-F",
        contactType: "selector",
        termA: "COM",
        termB: "FWD",
      });
      contactUnits.push({
        id: `${sym.id}_rev`,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: "rev",
        address: "C-R",
        contactType: "selector",
        termA: "COM",
        termB: "REV",
      });
    } else if (
      dev.kind === "limit-no" ||
      dev.kind === "limit-nc" ||
      dev.kind === "temp-no" ||
      dev.kind === "temp-nc" ||
      dev.kind === "pressure-no" ||
      dev.kind === "pressure-nc" ||
      dev.kind === "flow-no" ||
      dev.kind === "flow-nc" ||
      dev.kind === "float" ||
      dev.kind === "prox" ||
      dev.kind === "photo" ||
      dev.kind === "toggle" ||
      dev.kind.startsWith("toggle-") ||
      dev.kind === "breaker-1p" ||
      dev.kind === "fuse"
    ) {
      contactUnits.push({
        id: sym.id,
        deviceId: dev.id,
        symbolId: sym.id,
        device: dev,
        symbol: sym,
        variant: sym.variant || "body",
        address: "1-2",
        contactType: getContactType(dev.kind, sym.variant),
        termA: "1",
        termB: "2",
      });
    }
  }

  // Fallback: If devices exist without symbols, create contact units
  if (contactUnits.length === 0) {
    for (const dev of devices) {
      if (
        dev.kind === "pb-no" ||
        dev.kind === "pb-nc" ||
        dev.kind === "estop" ||
        dev.kind === "estop-nc" ||
        dev.kind === "limit-no" ||
        dev.kind === "limit-nc" ||
        dev.kind === "temp-no" ||
        dev.kind === "temp-nc" ||
        dev.kind === "pressure-no" ||
        dev.kind === "pressure-nc" ||
        dev.kind === "flow-no" ||
        dev.kind === "flow-nc" ||
        dev.kind === "float" ||
        dev.kind === "overload" ||
        dev.kind === "toggle" ||
        dev.kind.startsWith("toggle-") ||
        dev.kind === "selector-2" ||
        dev.kind === "selector-3"
      ) {
        contactUnits.push({
          id: `sym_${dev.id}`,
          deviceId: dev.id,
          device: dev,
          variant: "body",
          address: dev.kind === "overload" ? "95-96" : "1-2",
          contactType: getContactType(dev.kind, "body"),
          termA: dev.kind === "overload" ? "95" : "1",
          termB: dev.kind === "overload" ? "96" : "2",
        });
      }
    }
  }

  // 5. Build Union-Find Net Graph from Schematic Wires
  const parent = new Map<string, string>();
  const addNode = (n: string) => {
    if (!parent.has(n)) parent.set(n, n);
  };
  const findNode = (n: string): string => {
    addNode(n);
    const p = parent.get(n)!;
    if (p !== n) {
      const r = findNode(p);
      parent.set(n, r);
      return r;
    }
    return n;
  };
  const unionNode = (a: string, b: string) => {
    const ra = findNode(a);
    const rb = findNode(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const symToDev = new Map<string, Device>();
  for (const s of allSymbols) {
    const d = devices.find((dev) => dev.id === s.deviceId);
    if (d) symToDev.set(s.id, d);
  }

  // Initialize nodes for all symbol terminals and device terminals
  for (const s of allSymbols) {
    const d = symToDev.get(s.id);
    if (!d) continue;
    // Link symbol terminals to device terminals
    ["1", "2", "3", "4", "5", "6", "11", "12", "13", "14", "21", "22", "31", "32", "43", "44", "95", "96", "97", "98", "A1", "A2", "X1", "X2", "U", "V", "W", "L1", "L2", "L3", "T1", "T2", "T3", "COM", "FWD", "REV", "PLUS", "MINUS", "+", "-"].forEach((term) => {
      unionNode(`${s.id}:${term}`, `${d.id}:${term}`);
    });
  }

  // Connect schematic wires
  for (const w of circuit.wires) {
    if (w.broken) continue;
    const keyA = `${w.a.symbolId}:${w.a.term}`;
    const keyB = `${w.b.symbolId}:${w.b.term}`;
    unionNode(keyA, keyB);

    const devA = symToDev.get(w.a.symbolId);
    const devB = symToDev.get(w.b.symbolId);
    if (devA) unionNode(`${devA.id}:${w.a.term}`, keyA);
    if (devB) unionNode(`${devB.id}:${w.b.term}`, keyB);
  }

  // Connect junctions (all terminals of a junction belong to the same net)
  for (const s of allSymbols) {
    const d = symToDev.get(s.id);
    if (d?.kind === "junction") {
      const base = `${s.id}:1`;
      ["2", "3", "4"].forEach((t) => unionNode(base, `${s.id}:${t}`));
    }
  }

  // Connect Net Labels with matching tags
  const netLabelGroups = new Map<string, string[]>();
  for (const s of allSymbols) {
    const d = symToDev.get(s.id);
    if (d?.kind === "net-label") {
      const tagNorm = (d.tag || "").trim().toLowerCase();
      if (tagNorm) {
        const list = netLabelGroups.get(tagNorm) || [];
        list.push(`${s.id}:1`);
        list.push(`${d.id}:1`);
        netLabelGroups.set(tagNorm, list);
      }
    }
  }
  for (const group of netLabelGroups.values()) {
    for (let i = 1; i < group.length; i++) {
      unionNode(group[0], group[i]);
    }
  }

  // 6. Identify Left (Hot Control) and Right (Return / Neutral) Rail Net Sets
  const leftRailNets = new Set<string>();
  const rightRailNets = new Set<string>();

  if (transformer) {
    leftRailNets.add(findNode(`${transformer.id}:X1`));
    leftRailNets.add(findNode(`${transformer.id}:S1`));
    rightRailNets.add(findNode(`${transformer.id}:X2`));
    rightRailNets.add(findNode(`${transformer.id}:S2`));
  }
  if (dcSupply) {
    leftRailNets.add(findNode(`${dcSupply.id}:+`));
    leftRailNets.add(findNode(`${dcSupply.id}:PLUS`));
    rightRailNets.add(findNode(`${dcSupply.id}:-`));
    rightRailNets.add(findNode(`${dcSupply.id}:MINUS`));
  }
  if (mains) {
    leftRailNets.add(findNode(`${mains.id}:L1`));
    rightRailNets.add(findNode(`${mains.id}:N`));
    rightRailNets.add(findNode(`${mains.id}:L2`));
    rightRailNets.add(findNode(`${mains.id}:PE`));
  }

  // Net label aliases for Hot (Left) and Return (Right)
  for (const [tagNorm, nodes] of netLabelGroups.entries()) {
    if (/^(a1|x1|l1|24v\+|hot|\+|v\+|120v|24v|p1|vcc)$/.test(tagNorm)) {
      nodes.forEach((n) => leftRailNets.add(findNode(n)));
    }
    if (/^(a2|x2|n|com|0v|gnd|-|v-|p2|pe|g)$/.test(tagNorm)) {
      nodes.forEach((n) => rightRailNets.add(findNode(n)));
    }
  }

  // 7. Graph Pathfinder: Trace Control Paths from Left Rail to Output Loads
  interface ContactEdge {
    contact: DiscoveredContact;
    fromNet: string;
    toNet: string;
  }

  const contactEdges: ContactEdge[] = [];
  for (const cu of contactUnits) {
    const keyA = `${cu.symbolId || cu.deviceId}:${cu.termA}`;
    const keyB = `${cu.symbolId || cu.deviceId}:${cu.termB}`;
    const netA = findNode(keyA);
    const netB = findNode(keyB);

    // Also check alternative terminal names
    let altNetA = netA;
    let altNetB = netB;
    if (cu.termA === "3" && cu.termB === "4") {
      altNetA = findNode(`${cu.symbolId || cu.deviceId}:1`);
      altNetB = findNode(`${cu.symbolId || cu.deviceId}:2`);
    } else if (cu.termA === "13" && cu.termB === "14") {
      altNetA = findNode(`${cu.symbolId || cu.deviceId}:1`);
      altNetB = findNode(`${cu.symbolId || cu.deviceId}:2`);
    }

    const finalNetA = netA !== netB ? netA : altNetA;
    const finalNetB = netA !== netB ? netB : altNetB;

    if (finalNetA !== finalNetB) {
      contactEdges.push({ contact: cu, fromNet: finalNetA, toNet: finalNetB });
      contactEdges.push({ contact: cu, fromNet: finalNetB, toNet: finalNetA });
    }
  }

  // DFS to find simple paths connecting Left Rail to target load net
  const findPathsToLoad = (targetNet: string): DiscoveredContact[][] => {
    const results: DiscoveredContact[][] = [];
    const visitedNets = new Set<string>();
    const currentPath: DiscoveredContact[] = [];

    const dfs = (currNet: string, depth: number) => {
      if (depth > 12) return;
      if (currNet === targetNet) {
        if (currentPath.length > 0) results.push([...currentPath]);
        return;
      }
      visitedNets.add(currNet);

      for (const edge of contactEdges) {
        if (edge.fromNet === currNet && !visitedNets.has(edge.toNet)) {
          // Avoid using the same contact multiple times in one path
          if (!currentPath.some((c) => c.id === edge.contact.id)) {
            currentPath.push(edge.contact);
            dfs(edge.toNet, depth + 1);
            currentPath.pop();
          }
        }
      }
      visitedNets.delete(currNet);
    };

    for (const startNet of leftRailNets) {
      dfs(startNet, 0);
    }

    return results;
  };

  // Helper to convert traced paths into structured LadderRungItems (series + parallel)
  const pathsToRungItems = (paths: DiscoveredContact[][]): LadderRungItem[] => {
    if (paths.length === 0) return [];

    const contactToElem = (c: DiscoveredContact) =>
      makeContactElement(c.device, c.symbol, c.variant, c.address, c.contactType);

    if (paths.length === 1) {
      return paths[0].map((c) => ({ type: "contact", element: contactToElem(c) }));
    }

    // Multiple paths: find common prefix and suffix
    const first = paths[0];
    let prefixLen = 0;
    while (prefixLen < first.length) {
      const candidateId = first[prefixLen].id;
      const allMatch = paths.every((p) => p[prefixLen] && p[prefixLen].id === candidateId);
      if (allMatch) prefixLen++;
      else break;
    }

    let suffixLen = 0;
    while (suffixLen < first.length - prefixLen) {
      const candidateId = first[first.length - 1 - suffixLen].id;
      const allMatch = paths.every(
        (p) => p[p.length - 1 - suffixLen] && p[p.length - 1 - suffixLen].id === candidateId
      );
      if (allMatch) suffixLen++;
      else break;
    }

    const prefixContacts = first.slice(0, prefixLen).map(contactToElem);
    const suffixContacts = first.slice(first.length - suffixLen).map(contactToElem);

    // Extract middle parallel branches
    const branchMap = new Map<string, LadderBranch>();
    paths.forEach((p, idx) => {
      const middle = p.slice(prefixLen, p.length - suffixLen);
      if (middle.length > 0) {
        const branchContacts = middle.map(contactToElem);
        const branchKey = branchContacts.map((c) => `${c.id}:${c.address}`).join(",");
        if (!branchMap.has(branchKey)) {
          branchMap.set(branchKey, {
            id: `br_${idx}_${branchKey}`,
            contacts: branchContacts,
            isConducting: branchContacts.every((c) => c.isClosed),
          });
        }
      }
    });

    const branches = Array.from(branchMap.values());
    const items: LadderRungItem[] = [];

    prefixContacts.forEach((c) => items.push({ type: "contact", element: c }));
    if (branches.length > 1) {
      items.push({
        type: "parallel",
        group: {
          id: `par_${first[0]?.deviceId || "grp"}`,
          branches,
          isConducting: branches.some((b) => b.isConducting),
        },
      });
    } else if (branches.length === 1) {
      branches[0].contacts.forEach((c) => items.push({ type: "contact", element: c }));
    }
    suffixContacts.forEach((c) => items.push({ type: "contact", element: c }));

    return items;
  };

  // 8. Build Structured Rungs
  const rungs: LadderRung[] = [];
  const usedContactIds = new Set<string>();

  // Process Output Devices (Coils, Relays, Lamps, Alarms, Solenoids, etc.)
  outputDevices.forEach(({ device, symbol }) => {
    const coil = makeCoilElement(device, symbol);
    let rungItems: LadderRungItem[] = [];

    // Find inlet/hot terminal of the load
    const term1 = device.kind === "lamp" || device.kind === "alarm" || device.kind === "horn" || device.kind === "heater" ? "1" : "A1";
    const term2 = device.kind === "lamp" || device.kind === "alarm" || device.kind === "horn" || device.kind === "heater" ? "2" : "A2";

    const net1 = findNode(`${symbol?.id || device.id}:${term1}`);
    const net2 = findNode(`${symbol?.id || device.id}:${term2}`);

    let targetHotNet = net1;
    if (rightRailNets.has(net1)) targetHotNet = net2;
    else if (rightRailNets.has(net2)) targetHotNet = net1;

    // Try tracing exact schematic wiring path
    const paths = findPathsToLoad(targetHotNet);
    if (paths.length === 0 && targetHotNet !== net2) {
      // Also try alternate terminal if not connected to return
      const altPaths = findPathsToLoad(net2);
      if (altPaths.length > 0) paths.push(...altPaths);
    }

    if (paths.length > 0) {
      rungItems = pathsToRungItems(paths);
      paths.forEach((p) => p.forEach((c) => usedContactIds.add(c.id)));
    } else {
      // Fallback: Use heuristic default for unwired devices
      if (device.kind === "contactor" || device.kind.startsWith("starter-")) {
        const ol = contactUnits.find((c) => c.device.kind === "overload" && (c.address === "95-96" || c.variant === "aux-nc"));
        const sp = contactUnits.find((c) => c.device.kind === "pb-nc" || c.device.kind === "estop" || c.device.kind === "estop-nc");
        const st = contactUnits.find((c) => c.device.kind === "pb-no");
        const seal = contactUnits.find((c) => c.deviceId === device.id && (c.variant === "aux-no" || c.address === "13-14")) || {
          id: `seal_${device.id}`,
          deviceId: device.id,
          device,
          variant: "aux-no",
          address: "13-14",
          contactType: "no" as const,
          termA: "13",
          termB: "14",
        };

        if (ol) rungItems.push({ type: "contact", element: makeContactElement(ol.device, ol.symbol, ol.variant, ol.address, ol.contactType) });
        if (sp) rungItems.push({ type: "contact", element: makeContactElement(sp.device, sp.symbol, sp.variant, sp.address, sp.contactType) });

        const branches: LadderBranch[] = [];
        if (st) {
          const stElem = makeContactElement(st.device, st.symbol, st.variant, st.address, st.contactType);
          branches.push({ id: `br_st_${device.id}`, contacts: [stElem], isConducting: stElem.isClosed });
        }
        const sealElem = makeContactElement(seal.device, seal.symbol, seal.variant, seal.address, seal.contactType);
        branches.push({ id: `br_seal_${device.id}`, contacts: [sealElem], isConducting: sealElem.isClosed });

        if (branches.length > 1) {
          rungItems.push({
            type: "parallel",
            group: {
              id: `par_${device.id}`,
              branches,
              isConducting: branches.some((b) => b.isConducting),
            },
          });
        } else if (branches.length === 1) {
          branches[0].contacts.forEach((c) => rungItems.push({ type: "contact", element: c }));
        }
      } else if (device.kind === "lamp") {
        const tagLower = (device.tag || "").toLowerCase();
        const colorLower = (device.params.color || "").toLowerCase();
        const isFault = tagLower.includes("trip") || tagLower.includes("fault") || tagLower.includes("overload") || colorLower.includes("red");
        const matchingOlNo = contactUnits.find((c) => c.device.kind === "overload" && (c.address === "97-98" || c.variant === "aux-no"));

        if (isFault && matchingOlNo) {
          rungItems.push({ type: "contact", element: makeContactElement(matchingOlNo.device, matchingOlNo.symbol, "aux-no", "97-98", "no") });
        } else {
          const matchingContact = contactUnits.find((c) => !usedContactIds.has(c.id));
          if (matchingContact) {
            rungItems.push({ type: "contact", element: makeContactElement(matchingContact.device, matchingContact.symbol, matchingContact.variant, matchingContact.address, matchingContact.contactType) });
            usedContactIds.add(matchingContact.id);
          }
        }
      }
    }

    const isConducted = isLeftRailLive && (rungItems.length === 0 || rungItems.every((item) => {
      if (item.type === "contact") return item.element.isClosed;
      if (item.type === "parallel") return item.group.isConducting;
      return true;
    }));

    let rungTitle = `${device.tag.toUpperCase()} OUTPUT CONTROL`;
    if (device.kind === "contactor" || device.kind.startsWith("starter-")) {
      rungTitle = `${device.tag.toUpperCase()} START / STOP & SEAL-IN LATCH`;
    } else if (device.kind === "lamp") {
      rungTitle = `${device.tag.toUpperCase()} STATUS INDICATOR`;
    } else if (device.kind === "relay") {
      rungTitle = `${device.tag.toUpperCase()} CONTROL RELAY LOGIC`;
    } else if (device.kind.startsWith("timer-")) {
      rungTitle = `${device.tag.toUpperCase()} TIMER DELAY`;
    } else if (device.kind === "alarm" || device.kind === "horn") {
      rungTitle = `${device.tag.toUpperCase()} ALARM & ANNUNCIATOR`;
    }

    rungs.push({
      id: `rung_${device.id}`,
      rungNumber: 0,
      title: rungTitle,
      comment: `Controls ${device.tag || device.kind} operation based on schematic interlocks.`,
      items: rungItems,
      coils: [coil],
      isEnergized: isConducted,
      leftRailLive: isLeftRailLive,
      rightRailLive: isRightRailLive,
    });
  });

  // 9. Auxiliary / Unassigned Sensor & Switch Contacts Rungs
  const remainingContacts = contactUnits.filter((c) => !usedContactIds.has(c.id) && c.address !== "95-96");
  if (remainingContacts.length > 0) {
    let auxIdx = 1;
    while (remainingContacts.length > 0) {
      const batch = remainingContacts.splice(0, 4);
      const rungItems: LadderRungItem[] = batch.map((cu) => ({
        type: "contact",
        element: makeContactElement(cu.device, cu.symbol, cu.variant, cu.address, cu.contactType),
      }));
      const isConducted = isLeftRailLive && rungItems.every((it) => (it.type === "contact" ? it.element.isClosed : true));

      rungs.push({
        id: `rung_aux_${batch.map((b) => b.deviceId).join("_") || auxIdx++}`,
        rungNumber: 0,
        title: `AUXILIARY CONTACTS (${batch.map((b) => b.device.tag || b.device.kind).join(", ")})`,
        items: rungItems,
        coils: [],
        isEnergized: isConducted,
        leftRailLive: isLeftRailLive,
        rightRailLive: isRightRailLive,
      });
    }
  }

  // Apply custom rung order if defined in Circuit
  if (Array.isArray(circuit.ladderRungOrder) && circuit.ladderRungOrder.length > 0) {
    const orderMap = new Map<string, number>();
    circuit.ladderRungOrder.forEach((id, idx) => orderMap.set(id, idx));
    rungs.sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return idxA - idxB;
    });
  }

  // Renumber rungs sequentially
  rungs.forEach((rung, idx) => {
    rung.rungNumber = idx + 1;
  });

  // Cross-reference indexing on coils
  rungs.forEach((rung) => {
    rung.coils.forEach((coil) => {
      const refs: string[] = [];
      rungs.forEach((r) => {
        if (r.id !== rung.id) {
          const hasRef = r.items.some((it) => {
            if (it.type === "contact" && it.element.deviceId === coil.deviceId) return true;
            if (it.type === "parallel") {
              return it.group.branches.some((b) => b.contacts.some((c) => c.deviceId === coil.deviceId));
            }
            return false;
          });
          if (hasRef) refs.push(`Rung ${r.rungNumber}`);
        }
      });
      if (refs.length > 0) coil.crossRefs = refs;
    });
  });

  // Fallback if circuit is completely blank
  if (rungs.length === 0) {
    rungs.push({
      id: `rung_blank`,
      rungNumber: 1,
      title: "BLANK LADDER RUNG",
      comment: "Add contacts and coils in the schematic to generate ladder rungs.",
      items: [],
      coils: [],
      isEnergized: false,
      leftRailLive: isLeftRailLive,
      rightRailLive: isRightRailLive,
    });
  }

  const titleBlockProj = circuit.devices.find((d) => d.kind === "title-block")?.params.projectName;
  const finalTitle = titleBlockProj || docName || "INDUSTRIAL LADDER DIAGRAM";

  return {
    title: finalTitle,
    leftRailLabel,
    rightRailLabel,
    leftRailVoltage,
    isLeftRailLive,
    isRightRailLive,
    rungs,
    powerBranches,
    transformerBranch,
  };
}
