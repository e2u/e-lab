export const GRID = 22;
export const COLS = 168;
export const ROWS = 216;

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export type Rot = 0 | 90 | 180 | 270;

/** Language code for UI localization */
export type Lang = "en" | "zh";

export type DeviceKind =
  | "mains-3ph"
  | "dc-supply"
  | "transformer"
  | "breaker-1p"
  | "breaker-3p"
  | "rcd"
  | "fuse"
  | "isolator"
  | "overload"
  | "pb-no"
  | "pb-nc"
  | "estop"
  | "estop-nc"
  | "estop-no"
  | "selector-2"
  | "selector-3"
  | "toggle"
  | "toggle-spst"
  | "toggle-spdt"
  | "toggle-dpst"
  | "toggle-dpdt"
  | "toggle-4pdt"
  | "limit-no"
  | "limit-nc"
  | "foot"
  | "foot-no"
  | "foot-nc"
  | "float"
  | "temp-no"
  | "temp-nc"
  | "pressure-no"
  | "pressure-nc"
  | "flow-no"
  | "flow-nc"
  | "prox"
  | "photo"
  | "contactor"
  | "relay"
  | "timer-on"
  | "timer-off"
  | "counter"
  | "lamp"
  | "alarm"
  | "horn"
  | "fan"
  | "heater"
  | "solenoid"
  | "motor-3ph"
  | "motor-1ph"
  | "motor-dc"
  | "gen-ac"
  | "gen-dc"
  | "starter-dol"
  | "starter-fwd"
  | "starter-rev"
  | "starter-rev-combo"
  | "net-label"
  | "junction";

export type PotentialKind = "L1" | "L2" | "L3" | "N" | "PE" | "DC+" | "DC-";

export interface Potential {
  sourceId: string;
  kind: PotentialKind;
}

export interface TerminalDef {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface DeviceParams {
  color?: string;
  delayMs?: number;
  preset?: number;
  setpoint?: number;
  ratio?: string;
  primaryVolts?: string;
  secondaryVolts?: string;
  primaryConn?: "delta" | "wye";
  secondaryConn?: "delta" | "wye";
  primeMover?: boolean;
  shaftWith?: string;
  welded?: boolean;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  tag: string;
  params: DeviceParams;
}

export interface SymbolInst {
  id: string;
  deviceId: string;
  variant: string;
  x: number;
  y: number;
  rot: Rot;
  /** Local X mirror (left-right when rot is 0). */
  flipX?: boolean;
  /** Local Y mirror (up-down when rot is 0). */
  flipY?: boolean;
}

export interface PortRef {
  symbolId: string;
  term: string;
}

export interface WireJog {
  axis: "x" | "y";
  pos: number;
}

export interface Wire {
  id: string;
  a: PortRef;
  b: PortRef;
  broken?: boolean;
  jog?: WireJog;
  /** Optional text shown beside the wire on the schematic. */
  label?: string;
}

export interface SymbolGroup {
  id: string;
  memberIds: string[];
  name?: string;
  color?: string;
}

export interface Circuit {
  devices: Device[];
  symbols: SymbolInst[];
  wires: Wire[];
  groups?: SymbolGroup[];
}

export interface ProcessVars {
  temperature: number;
  pressure: number;
  level: number;
  flow: number;
  limitHit: boolean;
  proxHit: boolean;
  photoHit: boolean;
}

export interface DeviceRuntime {
  energized: boolean;
  energizedAlt: boolean;
  actuated: boolean;
  on: boolean;
  tripped: boolean;
  position: number;
  elapsedMs: number;
  count: number;
  done: boolean;
  rpm: number;
  direction: 1 | -1 | 0;
  lit: boolean;
  prevEnergized: boolean;
  prevPulse: boolean;
  starDelta: "star" | "delta" | null;
}

export interface WireLive {
  live: boolean;
  kind: PotentialKind | null;
  dir: 1 | -1 | 0;
}

export interface Fault {
  level: "warn" | "error";
  message: string;
  msgKey?: string;
  msgParams?: Record<string, string | number>;
  deviceId?: string;
}

export interface SimSnapshot {
  runtime: Record<string, DeviceRuntime>;
  potentials: Record<string, Potential | null>;
  wires: Record<string, WireLive>;
  faults: Fault[];
  timeMs: number;
}

export type Mode = "edit" | "run";

export interface CatalogItem {
  id: string;
  kind: DeviceKind;
  variant: string;
  group: string;
  label: string;
  labelEn: string;
  prefix: string;
  creates: "device" | "attach";
  defaultRot?: Rot;
}
