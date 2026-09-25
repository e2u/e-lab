export const GRID = 22;
export const COLS = 168;
export const ROWS = 216;

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export type Rot = 0 | 90 | 180 | 270;

/** Language code for UI localization */
export type Lang = "en" | "zh";

/** One run of text inside a rail cell. NC runs are underlined. */
export interface RailTextSegment {
  text: string;
  isNC?: boolean;
}

/** One cross-reference or line-number cell on a vertical rail. */
export interface RailCellContent {
  text: string;
  /** Which side of the rail column the text grows toward. */
  side: "left" | "right";
  /** Underline the whole text (normally closed contact). */
  isNC?: boolean;
  style?: "bold" | "italic";
  /** When set, paint these runs instead of `text`, so only some digits are underlined. */
  segments?: RailTextSegment[];
}

/** UI Theme */
export type Theme = "dark" | "light";

/** Layout display mode: standard freeform schematic vs. industrial ladder logic */
export type LayoutMode = "schematic" | "ladder";

export type DeviceKind =
  | "mains-3ph"
  | "dc-supply"
  | "transformer"
  | "breaker-1p"
  | "breaker-2p"
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
  | "pb-illum-no"
  | "pb-illum-nc"
  | "selector-2"
  | "selector-3"
  | "selector-hoa"
  | "selector-key"
  | "door-nc"
  | "pull-cord"
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
  | "float-no"
  | "float-nc"
  | "temp-no"
  | "temp-nc"
  | "pressure-no"
  | "pressure-nc"
  | "flow-no"
  | "flow-nc"
  | "prox"
  | "prox-no"
  | "prox-nc"
  | "photo"
  | "photo-no"
  | "photo-nc"
  | "contactor"
  | "relay"
  | "ssr"
  | "safety-relay"
  | "phase-relay"
  | "relay-uv"
  | "relay-ov"
  | "ptc"
  | "timer-on"
  | "timer-off"
  | "timer-ss-on"
  | "timer-ss-off"
  | "timer-flash"
  | "timer-pulse"
  | "timer-star-delta"
  | "counter"
  | "lamp"
  | "alarm"
  | "horn"
  | "fan"
  | "heater"
  | "solenoid"
  | "capacitor"
  | "motor-3ph"
  | "motor-1ph"
  | "motor-dc"
  | "gen-ac"
  | "gen-dc"
  | "starter-dol"
  | "starter-fwd"
  | "starter-rev"
  | "starter-rev-combo"
  | "vfd"
  | "psu-24v"
  | "voltmeter"
  | "ammeter"
  | "ammeter-series"
  | "ground"
  | "net-label"
  | "net-terminal"
  | "term-block"
  | "busbar"
  | "title-block"
  | "comment"
  | "rail-l"
  | "rail-n"
  | "rail-break"
  | "junction";

export type PotentialKind = "L1" | "L2" | "L3" | "N" | "PE" | "DC+" | "DC-" | "X1" | "X2";

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
  primaryVoltage?: number;
  secondaryVoltage?: number;
  primaryVolts?: string;
  secondaryVolts?: string;
  primaryConn?: "delta" | "wye";
  secondaryConn?: "delta" | "wye";
  supplyType?: "wye" | "delta";
  voltage?: number;
  maxCurrent?: number;
  power?: number;
  clampedWireId?: string;
  primeMover?: boolean;
  shaftWith?: string;
  welded?: boolean;
  projectName?: string;
  projectNo?: string;
  rev?: string;
  sheetNum?: string;
  sheetTotal?: string;
  description?: string;
  designedBy?: string;
  date?: string;
  scale?: number;
  text?: string;
  targetDeviceId?: string;
  /** Comment bound to a symbol group instead of a single device. */
  targetGroupId?: string;
  fontSize?: number;
  bgColor?: string;
  borderColor?: string;
  showLeaderLine?: boolean;
  width?: number;
  height?: number;
  /** Omit this comment from print. Still shown (translucent) in Edit/Run. */
  hideOnPrint?: boolean;
  /** Omit this device's tag from print. Still shown (translucent) in Edit/Run. */
  hideTag?: boolean;
  /** Net Terminal pairs (screws per side). Clamped 2..12. Omitted → 4. */
  pinCount?: number;
  /** Manual line-number text keyed by grid row. Present keys replace the Y-scan. */
  railLineOverrides?: Record<string, string>;
  /** Top or bottom grid row of a line rail or cross-ref rail. Both set → the span is manual. */
  railY0?: number;
  railY1?: number;
  /** Manual cross-reference cells keyed by grid row. Present keys replace the search. */
  railCrossOverrides?: Record<string, RailCellContent[]>;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  tag: string;
  params: DeviceParams;
}

export interface TagOffset {
  dx: number;
  dy: number;
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
  /** Offset for draggable component tag/label in grid units. */
  tagOffset?: TagOffset;
  /** Hide this symbol's tag on print only. Independent of other symbols on the same device. */
  hideTag?: boolean;
  /** Hide this symbol's terminal numbers/labels on the schematic. */
  hideTerminals?: boolean;
}

export interface PortRef {
  symbolId: string;
  term: string;
  /** Attached to a control-rail end square. That wire may turn; every other rail tap stays horizontal. */
  railPin?: "y0" | "y1";
}

export interface WireJog {
  axis?: "x" | "y";
  pos?: number;
  x?: number;
  y?: number;
}

export interface Wire {
  id: string;
  a: PortRef;
  b: PortRef;
  broken?: boolean;
  jog?: WireJog;
  /** Optional text shown beside the wire on the schematic. */
  label?: string;
  /** Progress along the wire route (0 to 1). Defaults to 0.5 (midpoint). */
  labelT?: number;
  /** Perpendicular offset from the wire path in grid units. */
  labelOffset?: TagOffset;
  /** User-hidden or user-dragged copies of this wire's number. */
  labelMarks?: WireLabelMark[];
}

export interface WireLabelMark {
  /** Progress along this wire (0 to 1). */
  t: number;
  /** Hide the auto/pinned copy nearest this t. */
  hidden?: boolean;
}

export interface SymbolGroup {
  id: string;
  memberIds: string[];
  name?: string;
  color?: string;
  /** Omit this group from print output. Still shown (translucent) in Edit/Run. */
  hideOnPrint?: boolean;
}

export interface Circuit {
  devices: Device[];
  symbols: SymbolInst[];
  wires: Wire[];
  groups?: SymbolGroup[];
  ladderRungOrder?: string[];
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
  short?: boolean;
  meterValue?: number;
  meterUnit?: "V" | "A";
}

export interface WireLive {
  live: boolean;
  kind: PotentialKind | null;
  dir: 1 | -1 | 0;
  short?: boolean;
}

export interface MeterDataPoint {
  time: number;
  value: number;
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
export type EditSubMode = "editing" | "wiring";

export interface CatalogSubgroup {
  id: string;
  groupId: string;
  label: string;
  labelEn: string;
}

export interface CatalogGroup {
  id: string;
  label: string;
  labelEn: string;
  subgroups?: readonly CatalogSubgroup[];
}

export interface CatalogItem {
  id: string;
  kind: DeviceKind;
  variant: string;
  group: string;
  subgroupId?: string;
  label: string;
  labelEn: string;
  prefix: string;
  creates: "device" | "attach";
  defaultRot?: Rot;
  defaultFlipX?: boolean;
  defaultFlipY?: boolean;
  defaultParams?: Partial<DeviceParams>;
}
