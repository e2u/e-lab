import type { Device, DeviceKind } from "../types";

export type LadderContactType =
  | "no"           // Normally Open Contact -[ ]-
  | "nc"           // Normally Closed Contact -[\]-
  | "pb-no"        // Push Button NO (Start)
  | "pb-nc"        // Push Button NC (Stop)
  | "estop"        // Emergency Stop NC (Palm Button)
  | "estop-no"     // Emergency Stop NO (Palm Button)
  | "overload"     // Thermal Overload Trip Contact 95-96
  | "toggle"       // Toggle / Main Switch
  | "selector"     // Selector Switch Contact
  | "limit-no"     // Limit Switch NO
  | "limit-nc"     // Limit Switch NC
  | "temp-no"      // Temperature Switch NO
  | "temp-nc"      // Temperature Switch NC
  | "pressure-no"  // Pressure Switch NO
  | "pressure-nc"  // Pressure Switch NC
  | "float"        // Float / Liquid Level Switch NO
  | "float-nc"     // Float / Liquid Level Switch NC
  | "flow-no"      // Flow Switch NO
  | "flow-nc"      // Flow Switch NC
  | "foot-no"      // Foot Switch NO
  | "foot-nc"      // Foot Switch NC
  | "prox"         // Proximity Sensor
  | "photo"        // Photoelectric Sensor
  | "timer-no"     // Timer NO (Timing Closed NO - NOTS / Timing Open NO - NOTO)
  | "timer-nc"     // Timer NC (Timing Closed NC - NCTC / Timing Open NC - NCTO)
  | "timer-contact";// Timer Contact NO/NC

export type LadderCoilType =
  | "coil"         // Contactor / Control Relay Coil -( )-
  | "timer-on"     // On-Delay Timer -( TON )-
  | "timer-off"    // Off-Delay Timer -( TOF )-
  | "counter"      // Counter -( CTU )-
  | "lamp"         // Pilot Light / Lamp -( L )- / -( ⊗ )-
  | "alarm"        // Alarm / Buzzer -( ALM )-
  | "horn"         // Horn -( HORN )-
  | "solenoid"     // Solenoid Valve -( SOL )-
  | "heater"       // Electric Heater -( HTR )-
  | "fan";         // Cooling Fan -( FAN )-

export interface LadderElement {
  id: string;              // Unique element ID
  deviceId: string;        // Reference to logical Device
  symbolId?: string;       // Reference to original SymbolInst if any
  device: Device;          // Device instance
  label: string;           // Display tag / name (e.g., "M1", "SB1", "KM1", "HL1")
  address?: string;        // Industrial terminal/address (e.g. "13-14", "1-2", "A1-A2", "95-96", "X1-X2")
  isClosed: boolean;       // Real-time contact closed / coil energized
  isLive: boolean;         // Real-time potential / power flowing through
  kind: DeviceKind;
  variant?: string;
  subType?: string;
}

export interface LadderContactElement extends LadderElement {
  contactType: LadderContactType;
  actuated?: boolean;
}

export interface LadderCoilElement extends LadderElement {
  coilType: LadderCoilType;
  crossRefs?: string[];    // Cross-references to contacts on other rungs, e.g. ["Rung 1 (NO)", "Rung 2 (NO)"]
}

export interface LadderBranch {
  id: string;
  contacts: LadderContactElement[];
  isConducting: boolean;
}

export interface LadderParallelGroup {
  id: string;
  branches: LadderBranch[];
  isConducting: boolean;
}

export type LadderRungItem =
  | { type: "contact"; element: LadderContactElement }
  | { type: "parallel"; group: LadderParallelGroup };

export interface LadderRung {
  id: string;
  rungNumber: number;
  title?: string;
  comment?: string;
  items: LadderRungItem[];
  coils: LadderCoilElement[];
  isEnergized: boolean;   // Whole rung is energized (power reaches output coil)
  leftRailLive: boolean;
  rightRailLive: boolean;
}

export interface LadderPowerBranch {
  id: string;
  title: string;
  mains?: Device;
  disconnect?: Device;
  breaker?: Device;
  fuses?: Device;
  contactor?: Device;
  overload?: Device;
  motor?: Device;
  transformer?: Device;
  ground?: Device;
  isRunning: boolean;
  isEnergized: boolean;
  speedRpm?: number;
  voltage?: number;
  power?: number;
}

export interface LadderTransformerBranch {
  id: string;
  title: string;
  transformer: Device;
  mains?: Device;
  primaryVoltage?: number;
  secondaryVoltage?: number;
  fuses?: Device;
  ground?: Device;
  isEnergized: boolean;
}

export interface LadderDiagramModel {
  title: string;
  leftRailLabel: string;   // e.g. "L1 / X1 (120VAC)"
  rightRailLabel: string;  // e.g. "L2 / X2 / N (0V)"
  leftRailVoltage?: string;
  rightRailVoltage?: string;
  isLeftRailLive: boolean;
  isRightRailLive: boolean;
  rungs: LadderRung[];
  powerBranches: LadderPowerBranch[];
  transformerBranch?: LadderTransformerBranch;
}
