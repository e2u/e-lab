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

  // 3. Collect Output Coils & Loads
  const outputDevices: { device: Device; symbol?: SymbolInst }[] = [];
  const contactSymbols: { symbol: SymbolInst; device: Device }[] = [];

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
      const sym = symbols.find((s) => s.deviceId === dev.id && (s.variant === "coil" || s.variant === "body" || !s.variant));
      outputDevices.push({ device: dev, symbol: sym });
    }
  }

  // Collect contact symbols
  for (const sym of symbols) {
    const dev = devices.find((d) => d.id === sym.deviceId);
    if (!dev) continue;
    if (
      dev.kind === "pb-no" ||
      dev.kind === "pb-nc" ||
      dev.kind === "estop" ||
      dev.kind === "estop-nc" ||
      dev.kind === "estop-no" ||
      dev.kind === "limit-no" ||
      dev.kind === "limit-nc" ||
      dev.kind === "temp-no" ||
      dev.kind === "temp-nc" ||
      dev.kind === "pressure-no" ||
      dev.kind === "pressure-nc" ||
      dev.kind === "flow-no" ||
      dev.kind === "flow-nc" ||
      dev.kind === "float" ||
      dev.kind === "foot" ||
      dev.kind === "foot-no" ||
      dev.kind === "foot-nc" ||
      dev.kind === "prox" ||
      dev.kind === "photo" ||
      dev.kind === "toggle" ||
      dev.kind.startsWith("toggle-") ||
      dev.kind === "selector-2" ||
      dev.kind === "selector-3" ||
      dev.kind === "breaker-1p" ||
      (dev.kind === "overload" && sym.variant !== "main") ||
      ((dev.kind === "contactor" || dev.kind === "relay" || dev.kind.startsWith("timer-") || dev.kind.startsWith("starter-")) &&
        (sym.variant === "aux-no" || sym.variant === "aux-nc" || sym.variant === "aux-no2" || sym.variant === "aux-nc2" || sym.variant === "no" || sym.variant === "nc"))
    ) {
      contactSymbols.push({ symbol: sym, device: dev });
    }
  }

  // If no contact symbols found but devices exist, add contacts directly from devices
  if (contactSymbols.length === 0) {
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
        contactSymbols.push({
          symbol: { id: `sym_${dev.id}`, deviceId: dev.id, variant: "body", x: 0, y: 0, rot: 0 },
          device: dev,
        });
      }
    }
  }

  // Helper to create a LadderContactElement
  const makeContactElement = (dev: Device, sym?: SymbolInst, customVariant?: string): LadderContactElement => {
    const variant = customVariant || sym?.variant;
    const closed = isContactClosed(dev, variant, snapshot, held, process);
    const rt = snapshot.runtime[dev.id];
    let address = "";
    if (dev.kind === "overload") address = variant === "aux-no" || variant === "no" ? "97-98" : "95-96";
    else if (dev.kind === "pb-nc" || dev.kind === "estop" || dev.kind === "estop-nc") address = "1-2";
    else if (dev.kind === "pb-no") address = "3-4";
    else if (variant?.includes("no")) address = "13-14";
    else if (variant?.includes("nc")) address = "21-22";

    return {
      id: sym?.id || `cnt_${dev.id}_${variant || "c"}`,
      deviceId: dev.id,
      symbolId: sym?.id,
      device: dev,
      label: dev.tag || dev.kind,
      address,
      isClosed: closed,
      isLive: isLeftRailLive && closed,
      kind: dev.kind,
      variant,
      contactType: getContactType(dev.kind, variant),
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

    // Find cross references: where are aux contacts of this coil used?
    const crossRefs: string[] = [];
    contactSymbols.forEach((cs) => {
      if (cs.device.id === dev.id) {
        const cType = cs.symbol.variant?.includes("nc") ? "NC" : "NO";
        crossRefs.push(`[${cs.device.tag}] ${cType}`);
      }
    });

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
      crossRefs: crossRefs.length > 0 ? crossRefs : undefined,
    };
  };

  // 4. Build Structured Rungs
  const rungs: LadderRung[] = [];
  let rungCounter = 1;

  // Categorize contacts
  const stopContacts: LadderContactElement[] = [];
  const overloadNcContacts: LadderContactElement[] = [];
  const overloadNoContacts: LadderContactElement[] = [];
  const startContacts: LadderContactElement[] = [];
  const sealInContacts: LadderContactElement[] = [];
  const interlockContacts: LadderContactElement[] = [];
  const sensorAndSwitchContacts: LadderContactElement[] = [];

  contactSymbols.forEach(({ symbol, device }) => {
    const elem = makeContactElement(device, symbol);
    if (device.kind === "overload") {
      if (symbol.variant === "aux-no" || symbol.variant === "no") {
        overloadNoContacts.push(elem);
      } else {
        overloadNcContacts.push(elem);
      }
    } else if (device.kind === "pb-nc" || device.kind === "estop" || device.kind === "estop-nc" || device.kind === "estop-no" || device.kind === "foot-nc") {
      stopContacts.push(elem);
    } else if (device.kind === "pb-no" || device.kind === "foot-no") {
      startContacts.push(elem);
    } else if (
      (device.kind === "contactor" || device.kind === "relay" || device.kind.startsWith("starter-") || device.kind.startsWith("timer-")) &&
      (symbol.variant === "aux-no" || symbol.variant === "no" || symbol.variant === "aux-no2")
    ) {
      sealInContacts.push(elem);
    } else if (
      (device.kind === "contactor" || device.kind === "relay" || device.kind.startsWith("starter-")) &&
      (symbol.variant === "aux-nc" || symbol.variant === "nc" || symbol.variant === "aux-nc2")
    ) {
      interlockContacts.push(elem);
    } else {
      sensorAndSwitchContacts.push(elem);
    }
  });

  // Find categorized output devices
  const contactors = outputDevices.filter((o) => o.device.kind === "contactor" || o.device.kind.startsWith("starter-"));
  const controlRelays = outputDevices.filter((o) => o.device.kind === "relay");
  const timers = outputDevices.filter((o) => o.device.kind.startsWith("timer-") || o.device.kind === "counter");
  const pilotLamps = outputDevices.filter((o) => o.device.kind === "lamp");
  const alarmsAndHorns = outputDevices.filter((o) => o.device.kind === "alarm" || o.device.kind === "horn" || o.device.kind === "solenoid" || o.device.kind === "heater" || o.device.kind === "fan");

  // A. Contactors Rungs (Motor Starters & Latches)
  contactors.forEach((contactorItem, idx) => {
    const { device, symbol } = contactorItem;
    const coil = makeCoilElement(device, symbol);
    const rungItems: LadderRungItem[] = [];

    // Series Stop/Safety contacts
    if (overloadNcContacts.length > 0) {
      const ol = overloadNcContacts[idx] || overloadNcContacts[0];
      rungItems.push({ type: "contact", element: ol });
    }
    if (stopContacts.length > 0) {
      const sp = stopContacts[idx] || stopContacts[0];
      rungItems.push({ type: "contact", element: sp });
    }

    // Interlock contacts (e.g. NC contact of opposing contactor)
    const matchingInterlock = interlockContacts.find((c) => c.deviceId !== device.id);
    if (matchingInterlock) {
      rungItems.push({ type: "contact", element: matchingInterlock });
    }

    // Parallel Branch (Start PB || Aux NO Seal-In)
    const branches: LadderBranch[] = [];
    const startPb = startContacts[idx] || (startContacts.length > 0 ? startContacts[0] : undefined);
    if (startPb) {
      branches.push({
        id: `br_start_${device.id}`,
        contacts: [startPb],
        isConducting: startPb.isClosed,
      });
    }

    const matchingSealIn = sealInContacts.find((c) => c.deviceId === device.id) || (sealInContacts.length > idx ? sealInContacts[idx] : undefined);
    if (matchingSealIn) {
      branches.push({
        id: `br_seal_in_${device.id}`,
        contacts: [matchingSealIn],
        isConducting: matchingSealIn.isClosed,
      });
    } else {
      // Create virtual seal-in matching the contactor
      const sealIn = makeContactElement(device, undefined, "aux-no");
      branches.push({
        id: `br_seal_in_${device.id}`,
        contacts: [sealIn],
        isConducting: sealIn.isClosed,
      });
    }

    if (branches.length > 1) {
      const parallelConducting = branches.some((b) => b.isConducting);
      rungItems.push({
        type: "parallel",
        group: {
          id: `par_start_seal_${device.id}`,
          branches,
          isConducting: parallelConducting,
        },
      });
    } else if (branches.length === 1) {
      branches[0].contacts.forEach((c) => rungItems.push({ type: "contact", element: c }));
    }

    const isConducted = isLeftRailLive && rungItems.every((item) => {
      if (item.type === "contact") return item.element.isClosed;
      if (item.type === "parallel") return item.group.isConducting;
      return true;
    });

    const startLabel = startPb?.label || "Start";
    const stopLabel = stopContacts[0]?.label || "Stop";

    rungs.push({
      id: `rung_${rungCounter}`,
      rungNumber: rungCounter++,
      title: `${device.tag.toUpperCase()} START / STOP & SEAL-IN LATCH`,
      comment: `Press ${startLabel} to energize ${device.tag} coil; ${device.tag}-NO maintains latch until ${stopLabel} or Overload trips.`,
      items: rungItems,
      coils: [coil],
      isEnergized: isConducted,
      leftRailLive: isLeftRailLive,
      rightRailLive: isRightRailLive,
    });
  });

  // B. Control Relays Rungs
  controlRelays.forEach(({ device, symbol }, idx) => {
    const coil = makeCoilElement(device, symbol);
    const rungItems: LadderRungItem[] = [];

    // Trigger input (pushbutton, switch, or sensor)
    let triggerInput = sensorAndSwitchContacts.shift();
    if (!triggerInput && startContacts.length > contactors.length + idx) {
      triggerInput = startContacts[contactors.length + idx];
    }
    if (!triggerInput) {
      triggerInput = makeContactElement(device, undefined, "aux-no");
      triggerInput.label = `CTRL (${device.tag})`;
    }
    rungItems.push({ type: "contact", element: triggerInput });

    // Seal-in if matching aux-no exists
    const matchingSeal = sealInContacts.find((c) => c.deviceId === device.id);
    if (matchingSeal) {
      rungItems.push({
        type: "parallel",
        group: {
          id: `par_relay_${device.id}`,
          branches: [
            { id: `b1_${device.id}`, contacts: [triggerInput], isConducting: triggerInput.isClosed },
            { id: `b2_${device.id}`, contacts: [matchingSeal], isConducting: matchingSeal.isClosed },
          ],
          isConducting: triggerInput.isClosed || matchingSeal.isClosed,
        },
      });
    }

    const isConducted = isLeftRailLive && rungItems.every((item) => {
      if (item.type === "contact") return item.element.isClosed;
      if (item.type === "parallel") return item.group.isConducting;
      return true;
    });

    rungs.push({
      id: `rung_${rungCounter}`,
      rungNumber: rungCounter++,
      title: `${device.tag.toUpperCase()} CONTROL RELAY LOGIC`,
      items: rungItems,
      coils: [coil],
      isEnergized: isConducted,
      leftRailLive: isLeftRailLive,
      rightRailLive: isRightRailLive,
    });
  });

  // C. Timers and Counters Rungs
  timers.forEach(({ device, symbol }) => {
    const coil = makeCoilElement(device, symbol);
    const rungItems: LadderRungItem[] = [];

    // Trigger contact from primary contactor or switch
    if (contactors.length > 0) {
      const auxContact = makeContactElement(contactors[0].device, undefined, "aux-no");
      auxContact.address = "13-14";
      auxContact.label = `${contactors[0].device.tag} (NO)`;
      rungItems.push({ type: "contact", element: auxContact });
    } else if (sensorAndSwitchContacts.length > 0) {
      rungItems.push({ type: "contact", element: sensorAndSwitchContacts.shift()! });
    } else {
      const trg = makeContactElement(device, undefined, "aux-no");
      trg.label = `ENABLE (${device.tag})`;
      rungItems.push({ type: "contact", element: trg });
    }

    const isConducted = isLeftRailLive && rungItems.every((item) => {
      if (item.type === "contact") return item.element.isClosed;
      if (item.type === "parallel") return item.group.isConducting;
      return true;
    });

    const presetSec = (device.params.delayMs || 5000) / 1000;

    rungs.push({
      id: `rung_${rungCounter}`,
      rungNumber: rungCounter++,
      title: `${device.tag.toUpperCase()} TIMER DELAY (${presetSec}s)`,
      comment: `Energized when control contact closes; timer times out after ${presetSec}s.`,
      items: rungItems,
      coils: [coil],
      isEnergized: isConducted,
      leftRailLive: isLeftRailLive,
      rightRailLive: isRightRailLive,
    });
  });

  // D. Pilot Lamps Rungs (Indicators)
  pilotLamps.forEach(({ device, symbol }, idx) => {
    const lampCoil = makeCoilElement(device, symbol);
    const rungItems: LadderRungItem[] = [];

    const tagLower = (device.tag || "").toLowerCase();
    const colorLower = (device.params.color || "").toLowerCase();
    const isFaultOrTrip = tagLower.includes("trip") || tagLower.includes("fault") || tagLower.includes("err") || (colorLower.includes("red") && overloadNoContacts.length > 0);

    if (isFaultOrTrip && (overloadNoContacts.length > 0 || overloadNcContacts.length > 0)) {
      // Trip lamp driven by Overload 97-98 NO contact
      const olNo = overloadNoContacts[0] || makeContactElement(overloadNcContacts[0]?.device || devices.find((d) => d.kind === "overload")!, undefined, "aux-no");
      olNo.address = "97-98";
      olNo.label = `${olNo.device.tag} (TRIP)`;
      rungItems.push({ type: "contact", element: olNo });
    } else if (contactors.length > 0) {
      const targetContactor = contactors[idx % contactors.length];
      const auxContact = makeContactElement(targetContactor.device, undefined, "aux-no");
      auxContact.address = "43-44";
      auxContact.label = `${targetContactor.device.tag} (NO)`;
      rungItems.push({ type: "contact", element: auxContact });
    } else if (controlRelays.length > 0) {
      const targetRelay = controlRelays[idx % controlRelays.length];
      const auxContact = makeContactElement(targetRelay.device, undefined, "aux-no");
      auxContact.label = `${targetRelay.device.tag} (NO)`;
      rungItems.push({ type: "contact", element: auxContact });
    } else if (sensorAndSwitchContacts.length > 0) {
      rungItems.push({ type: "contact", element: sensorAndSwitchContacts.shift()! });
    }

    const isConducted = isLeftRailLive && rungItems.every((item) => {
      if (item.type === "contact") return item.element.isClosed;
      if (item.type === "parallel") return item.group.isConducting;
      return true;
    });

    rungs.push({
      id: `rung_${rungCounter}`,
      rungNumber: rungCounter++,
      title: `${device.tag.toUpperCase()} STATUS INDICATOR`,
      comment: isFaultOrTrip ? "Illuminates when thermal overload relay trips." : `Illuminates when associated control circuit is energized.`,
      items: rungItems,
      coils: [lampCoil],
      isEnergized: isConducted,
      leftRailLive: isLeftRailLive,
      rightRailLive: isRightRailLive,
    });
  });

  // E. Alarms, Horns, Solenoids, Heaters, Fans
  alarmsAndHorns.forEach(({ device, symbol }) => {
    const coil = makeCoilElement(device, symbol);
    const rungItems: LadderRungItem[] = [];

    if (sensorAndSwitchContacts.length > 0) {
      rungItems.push({ type: "contact", element: sensorAndSwitchContacts.shift()! });
    } else if (overloadNoContacts.length > 0) {
      rungItems.push({ type: "contact", element: overloadNoContacts.shift()! });
    } else if (contactors.length > 0) {
      const aux = makeContactElement(contactors[0].device, undefined, "aux-no");
      aux.label = `${contactors[0].device.tag} (NO)`;
      rungItems.push({ type: "contact", element: aux });
    }

    const isConducted = isLeftRailLive && rungItems.every((item) => {
      if (item.type === "contact") return item.element.isClosed;
      if (item.type === "parallel") return item.group.isConducting;
      return true;
    });

    rungs.push({
      id: `rung_${rungCounter}`,
      rungNumber: rungCounter++,
      title: `${device.tag.toUpperCase()} OUTPUT CONTROL`,
      items: rungItems,
      coils: [coil],
      isEnergized: isConducted,
      leftRailLive: isLeftRailLive,
      rightRailLive: isRightRailLive,
    });
  });

  // F. Remaining Sensor & Switch Contacts (Control Inputs / Monitors)
  if (sensorAndSwitchContacts.length > 0) {
    while (sensorAndSwitchContacts.length > 0) {
      const batch = sensorAndSwitchContacts.splice(0, 4);
      const rungItems: LadderRungItem[] = batch.map((cnt) => ({
        type: "contact",
        element: cnt,
      }));
      const isConducted = isLeftRailLive && batch.every((c) => c.isClosed);

      rungs.push({
        id: `rung_${rungCounter}`,
        rungNumber: rungCounter++,
        title: `AUXILIARY SENSORS & SWITCHES (${batch.map((b) => b.label).join(", ")})`,
        items: rungItems,
        coils: [],
        isEnergized: isConducted,
        leftRailLive: isLeftRailLive,
        rightRailLive: isRightRailLive,
      });
    }
  }

  // Fallback if circuit is completely blank
  if (rungs.length === 0) {
    rungs.push({
      id: `rung_1`,
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
