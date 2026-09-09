import { create } from "zustand";
import { catalogItem, KINDS, suggestNetLabelTag, variantDef } from "./catalog";
import { addDevice, addJunction, addSymbol, deleteWireAndCleanJunctions, findJunctionAt, isJunctionSymbol, mergeWires, pruneOrphanJunctions, removeJunction, splitWireAt } from "./circuitBuilder";
import { loadExampleJson } from "./examples/index";
import templateData from "./examples/blank-template.json";
import { alignEntities, expandIds, groupSymbols, pruneGroups, rotateSelection, selectionHasGroup, ungroupSymbols, unionBounds } from "./groups";
import { EXAMPLES } from "./examples";
import { allWireRoutes, findWireAtPoint, getConnectedWireIds, nearestOnPolyline, parseWireLabelKey, pickJunctionPositionOnWire, portsEqual, snapOnSegment, symbolBounds, terminalWorld, toggleWorldFlip, wireHasEnds, wireRoute, wireLabelPos } from "./geometry";
import { clone, nextTag, sanitizeCircuitIds, uid, uniqueId } from "./ids";
import {
  downloadJson,
  hashFromDoc,
  listSaves,
  makeDoc,
  parseDoc,
  putSave,
  removeSave,
  startupDoc,
  writeDraft,
  type SavedLab,
} from "./persist";
import { defaultRuntime, emptySnapshot, tick } from "./sim/engine";
import { buildLadderDiagram } from "./ladder/ladderLayout";
import { autoLayoutCircuit, type AutoLayoutOptions } from "./layout/autoLayout";
import { GRID, COLS, ROWS, type Circuit, type DeviceParams, type EditSubMode, type Lang, type LayoutMode, type MeterDataPoint, type Mode, type PortRef, type ProcessVars, type Rot, type SimSnapshot, type Theme, type Wire, type WireJog } from "./types";
import {getLang as getLanguage, setLang as setLanguage, t, tOr} from "./i18n";
import {
  trackCircuitPause,
  trackCircuitReset,
  trackCircuitRun,
  trackCircuitStep,
  trackComponentDeleted,
  trackComponentPlaced,
  trackExampleLoaded,
  trackExportJson,
  trackLadderView,
  trackLangChange,
  trackOpenJson,
  trackSaveToLibrary,
  trackShareLinkCreated,
  trackThemeChange,
} from "./analytics";

function readLang(): Lang {
  return getLanguage();
}

function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  try {
    const val = localStorage.getItem("elab.theme");
    if (val === "light" || val === "dark") return val;
  } catch {}
  return "light";
}

function readLayoutMode(): LayoutMode {
  if (typeof localStorage === "undefined") return "schematic";
  try {
    const val = localStorage.getItem("elab.layoutMode");
    if (val === "ladder" || val === "schematic") return val;
  } catch {}
  return "schematic"; // Default to schematic
}

function readZoom(): number {
  if (typeof localStorage === "undefined") return 1;
  try {
    const val = localStorage.getItem("elab.zoom");
    if (val) {
      const n = parseFloat(val);
      return isNaN(n) ? 1 : Math.max(0.25, Math.min(1.5, n));
    }
  } catch {
    return 1;
  }
  // Adaptive default on first run based on screen resolution
  if (typeof window !== "undefined") {
    if (window.innerWidth <= 768 || window.innerHeight <= 550) return 0.5;
    if (window.innerWidth <= 1280 || window.innerHeight <= 720) return 0.5;
    if (window.innerWidth <= 1440 || window.innerHeight <= 850) return 0.75;
  }
  return 1;
}

const DEFAULT_PALETTE_WIDTH = 220;
const DEFAULT_SIDE_WIDTH = 260;
export const MIN_PALETTE_WIDTH = 160;
export const MAX_PALETTE_WIDTH = 500;
export const MIN_SIDE_WIDTH = 200;
export const MAX_SIDE_WIDTH = 600;

function readSidebarState(): {
  paletteOpen: boolean;
  sideOpen: boolean;
  paletteWidth: number;
  sideWidth: number;
} {
  if (typeof localStorage === "undefined") {
    return {
      paletteOpen: true,
      sideOpen: true,
      paletteWidth: DEFAULT_PALETTE_WIDTH,
      sideWidth: DEFAULT_SIDE_WIDTH,
    };
  }
  try {
    const p = localStorage.getItem("elab.sidebar.paletteOpen");
    const s = localStorage.getItem("elab.sidebar.sideOpen");
    const pw = localStorage.getItem("elab.sidebar.paletteWidth");
    const sw = localStorage.getItem("elab.sidebar.sideWidth");

    const parsedPw = pw !== null ? parseInt(pw, 10) : NaN;
    const parsedSw = sw !== null ? parseInt(sw, 10) : NaN;

    return {
      paletteOpen: p !== null ? p === "true" : true,
      sideOpen: s !== null ? s === "true" : true,
      paletteWidth:
        !isNaN(parsedPw) && parsedPw >= MIN_PALETTE_WIDTH && parsedPw <= MAX_PALETTE_WIDTH
          ? parsedPw
          : DEFAULT_PALETTE_WIDTH,
      sideWidth:
        !isNaN(parsedSw) && parsedSw >= MIN_SIDE_WIDTH && parsedSw <= MAX_SIDE_WIDTH
          ? parsedSw
          : DEFAULT_SIDE_WIDTH,
    };
  } catch {
    return {
      paletteOpen: true,
      sideOpen: true,
      paletteWidth: DEFAULT_PALETTE_WIDTH,
      sideWidth: DEFAULT_SIDE_WIDTH,
    };
  }
}

// Check settings for showing ladder diagram menu
function readShowLadderMenu(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const val = localStorage.getItem("elab.showLadderMenu");
    // Default to visible (true), only hidden when explicitly set to false
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

// Check settings for showing wire number labels on the schematic
function readShowWireLabels(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const val = localStorage.getItem("elab.showWireLabels");
    // Default to visible (true), only hidden when explicitly set to false
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export interface Selection {
  type: "symbol" | "wire" | "wire-label";
  id: string;
}

export interface WireLabelSelection {
  type: "wire-label";
  wireId: string;
}

export interface LabState {
  circuit: Circuit;
  snapshot: SimSnapshot;
  mode: Mode;
  editSubMode: EditSubMode;
  running: boolean;
  held: string[];
  process: ProcessVars;
  selected: Selection | null;
  selectedIds: string[];
  selectedWireIds: string[];
  clipboard: Circuit | null;
  placing: string | null;
  placingRot: Rot;
  placingFlipX: boolean;
  placingFlipY: boolean;
  wiringFrom: PortRef | null;
  history: Circuit[];
  future: Circuit[];
  timeMs: number;
  hoverPort: PortRef | null;
  docName: string;
  notice: string | null;
  savesTick: number;
  lang: Lang;
  theme: Theme;
  layoutMode: LayoutMode;
  showLadderMenu: boolean; // Controls whether to show ladder diagram menu
  showWireLabels: boolean; // Sheet option: render wire number labels on the schematic
  hiddenWireLabels: Set<string>; // Wire IDs whose labels should be hidden
  isDirty: boolean;
  paletteOpen: boolean;
  sideOpen: boolean;
  paletteWidth: number;
  sideWidth: number;
  zoom: number;
  printOpen: boolean;
  tutorialOpen: boolean;
  tutorialStepIndex: number;
  tutorialVersion: "pc" | "mobile";
  meterHistory: Record<string, MeterDataPoint[]>;

  setMode: (mode: Mode) => void;
  setEditSubMode: (subMode: EditSubMode) => void;
  toggleEditSubMode: () => void;
  setRunning: (running: boolean) => void;
  step: () => void;
  resetSim: () => void;
  setProcess: (patch: Partial<ProcessVars>) => void;
  setPlacing: (id: string | null) => void;
  setPlacingRot: (rot: Rot) => void;
  rotatePlacing: (dir?: 1 | -1) => void;
  flipPlacing: (axis?: "h" | "v") => void;
  setHoverPort: (port: PortRef | null) => void;
  select: (sel: Selection | null, isolate?: boolean) => void;
  selectToggle: (id: string) => void;
  selectIds: (ids: string[], additive?: boolean) => void;
  selectWireToggle: (id: string) => void;
  selectWireIds: (ids: string[], additive?: boolean) => void;
  toggleWireLabelHidden: (wireId: string) => void;
  hideWireLabels: (wireIds: string[]) => void;
  hideWireLabelInstance: (wireId: string, t: number) => void;
  showWireLabelInstances: (wireId: string) => void;
  pinWireLabel: (wireId: string, fromT: number, toT: number) => void;
  showAllWireLabels: () => void;
  mergeSelectedWires: () => void;
  selectAll: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  rotateSelected: (dir?: 1 | -1) => void;
  flipSelected: (axis: "h" | "v") => void;
  nudgeSelected: (dx: number, dy: number) => void;
  alignSelected: (edge: "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter" | "distribute-h" | "distribute-v") => void;
  autoLayout: (options?: AutoLayoutOptions) => void;
  snapSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  placeAt: (x: number, y: number, extraParams?: Partial<DeviceParams>) => void;
  quickAttachClampMeter: (wireId: string) => void;
  addCommentForSymbol: (symbolId: string) => void;
  addCommentForGroup: (groupId: string) => void;
  scaleSymbol: (symbolId: string, scale: number, x?: number, y?: number) => void;
  moveSymbol: (id: string, x: number, y: number) => void;
  moveGroup: (
    updates: { id: string; x: number; y: number }[],
    wireUpdates?: { id: string; jog: WireJog }[],
  ) => void;
  clickPort: (port: PortRef) => void;
  addJunctionAndConnect: (gx: number, gy: number) => void;
  connectToWire: (wireId: string, world: { x: number; y: number }) => void;
  setWireJog: (id: string, jog: WireJog) => void;
  pointerDevice: (deviceId: string, down: boolean) => void;
  toggleIo: (deviceId: string, field: "on" | "tripped" | "actuated" | "prime") => void;
  cyclePosition: (deviceId: string) => void;
  updateDevice: (
    deviceId: string,
    patch: {
      tag?: string;
      params?: Partial<DeviceParams>;
      color?: string;
      delayMs?: number;
      preset?: number;
      setpoint?: number;
      ratio?: string;
      primaryVolts?: string;
      secondaryVolts?: string;
      primaryConn?: "delta" | "wye";
      secondaryConn?: "delta" | "wye";
      supplyType?: "wye" | "delta";
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
      targetGroupId?: string;
      fontSize?: number;
      bgColor?: string;
      borderColor?: string;
      showLeaderLine?: boolean;
      width?: number;
      height?: number;
      hideOnPrint?: boolean;
      hideTag?: boolean;
    },
  ) => void;
  setSymbolVariant: (symbolId: string, variant: string) => void;
  rebind: (symbolId: string, deviceId: string) => void;
  deleteSelected: () => void;
  loadExample: (id: string) => void;
  loadBlankTemplate: (skipConfirm?: boolean) => void;
  newBoard: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  loadCircuit: (circuit: Circuit, name?: string, process?: ProcessVars) => void;
  setDocName: (name: string) => void;
  setNotice: (notice: string | null) => void;
  setSymbolTagOffset: (id: string, offset?: { dx: number; dy: number } | null) => void;
  resetSymbolTagOffset: (id: string) => void;
  setWireLabelOffset: (id: string, offset?: { dx: number; dy: number } | null) => void;
  resetWireLabelOffset: (id: string) => void;
  updateWire: (id: string, patch: Partial<Wire>) => void;
  updateConnectedWires: (wireId: string, patch: Partial<Wire>) => void;
  getConnectedWireIds: (wireId: string) => Set<string>;
  straightenWire: (id: string) => void;
  addJunctionOnWire: (id: string, worldPos?: { x: number; y: number }) => void;
  addJunctionAt: (gx: number, gy: number) => void;
  updateGroup: (groupId: string, patch: { color?: string; name?: string; hideOnPrint?: boolean }) => void;
  toggleWireBroken: (id: string) => void;
  toggleDeviceWelded: (id: string) => void;
  clearFaults: () => void;
  saveToLibrary: (name?: string) => void;
  loadSave: (id: string) => void;
  deleteSave: (id: string) => void;
  exportFile: () => void;
  importDoc: (raw: unknown) => void;
  copyShareLink: () => Promise<void>;
  persistDraft: () => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLayoutMode: (layoutMode: LayoutMode) => void;
  toggleLayoutMode: () => void;
  reorderLadderRungs: (fromIndex: number, toIndex: number) => void;
  setPaletteOpen: (open: boolean) => void;
  setSideOpen: (open: boolean) => void;
  setPaletteWidth: (width: number) => void;
  setSideWidth: (width: number) => void;
  resetPanelWidths: () => void;
  togglePalette: () => void;
  toggleSide: () => void;
  setShowLadderMenu: (show: boolean) => void;
  toggleShowLadderMenu: () => void;
  setShowWireLabels: (show: boolean) => void;
  autoLabelWires: () => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  zoomFit: () => void;
  openPrint: () => void;
  closePrint: () => void;
  openTutorial: (version?: "pc" | "mobile") => void;
  closeTutorial: () => void;
  setTutorialStep: (index: number) => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  clearMeterHistory: (deviceId?: string) => void;
  restartTutorial: () => void;
  setTutorialVersion: (version: "pc" | "mobile") => void;
}

const defaultProcess = (): ProcessVars => ({
  temperature: 75,
  pressure: 1,
  level: 20,
  flow: 0,
  limitHit: false,
  proxHit: false,
  photoHit: false,
});

function lastDeviceOfKind(circuit: Circuit, kind: Circuit["devices"][0]["kind"], selectedSymbol?: string | null): string | null {
  if (selectedSymbol) {
    const sym = circuit.symbols.find((s) => s.id === selectedSymbol);
    const dev = sym && circuit.devices.find((d) => d.id === sym.deviceId);
    if (dev && dev.kind === kind) return dev.id;
  }
  const matches = circuit.devices.filter((d) => d.kind === kind);
  return matches.length ? matches[matches.length - 1].id : null;
}

function mergeRuntime(circuit: Circuit, prev: SimSnapshot["runtime"]): SimSnapshot["runtime"] {
  const next = emptySnapshot(circuit).runtime;
  for (const d of circuit.devices) {
    if (prev[d.id]) next[d.id] = { ...next[d.id], ...prev[d.id] };
  }
  return next;
}

function formatMMDDYYYY(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Line-side AC/DC power sources whose connected nets use 10x wire numbers. */
const HV_SOURCE_KINDS = new Set<string>(["mains-3ph", "gen-ac", "gen-dc"]);

function isHvSourceTerminal(kind: string, term: string): boolean {
  if (kind === "mains-3ph") return term === "L1" || term === "L2" || term === "L3" || term === "N";
  if (kind === "gen-ac") return term === "U" || term === "V" || term === "W" || term === "N";
  if (kind === "gen-dc") return term === "+" || term === "-";
  return false;
}

function isControlOnlyVariant(variant: string): boolean {
  return variant === "coil" || variant.startsWith("aux") || variant.startsWith("delayed") || variant.startsWith("inst");
}

/**
 * Terminals on a symbol that belong to the power path.
 * HV numbering may cross these terminals of the *same symbol*, but must not
 * jump to a coil/aux symbol of the same device or to a transformer secondary.
 */
function hvBridgeTerminals(kind: string, variant: string, termIds: string[]): string[] {
  if (isControlOnlyVariant(variant)) return [];
  switch (kind) {
    case "transformer":
      return termIds.filter((id) => id === "H1" || id === "H2" || id === "H3" || id === "H4");
    case "isolator":
    case "breaker-1p":
    case "breaker-3p":
    case "rcd":
    case "fuse":
    case "motor-3ph":
    case "motor-1ph":
    case "motor-dc":
    case "heater":
    case "fan":
      return termIds;
    case "overload":
      return variant === "body" || variant === "main" ? termIds : [];
    case "contactor":
      return variant === "main" ? termIds : [];
    case "starter-dol":
    case "starter-fwd":
    case "starter-rev":
    case "starter-rev-combo":
      return termIds.filter((id) =>
        id === "L1" || id === "L2" || id === "L3" || id === "N" ||
        id === "T1" || id === "T2" || id === "T3" || id === "TN"
      );
    default:
      return [];
  }
}

function portKey(p: PortRef): string {
  return `${p.symbolId}:${p.term}`;
}

/**
 * Wires on the high-voltage power path: start at mains/generator terminals,
 * follow nets, and cross series power devices (isolator, breaker, contactor
 * main, overload, …). Stops at transformer X1/X2 and control-only symbols.
 */
function collectHvWireIds(circuit: Circuit, wires: Wire[]): Set<string> {
  const symbolById = new Map(circuit.symbols.map((s) => [s.id, s]));
  const deviceById = new Map(circuit.devices.map((d) => [d.id, d]));

  const wiresByPort = new Map<string, Wire[]>();
  const addPortWire = (p: PortRef, w: Wire) => {
    const key = portKey(p);
    const list = wiresByPort.get(key);
    if (list) list.push(w);
    else wiresByPort.set(key, [w]);
  };
  for (const w of wires) {
    addPortWire(w.a, w);
    addPortWire(w.b, w);
  }

  const hvWireIds = new Set<string>();
  const visitedPorts = new Set<string>();
  const queue: PortRef[] = [];

  const enqueue = (p: PortRef) => {
    const key = portKey(p);
    if (visitedPorts.has(key)) return;
    visitedPorts.add(key);
    queue.push(p);
  };

  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      if (HV_SOURCE_KINDS.has(dev.kind) && isHvSourceTerminal(dev.kind, p.term)) {
        enqueue(p);
      }
    }
  }

  while (queue.length) {
    const port = queue.shift()!;
    for (const w of wiresByPort.get(portKey(port)) ?? []) {
      hvWireIds.add(w.id);
      enqueue(w.a);
      enqueue(w.b);
    }

    const sym = symbolById.get(port.symbolId);
    if (!sym) continue;
    const dev = deviceById.get(sym.deviceId);
    if (!dev) continue;
    const v = variantDef(dev.kind, sym.variant);
    for (const term of hvBridgeTerminals(dev.kind, sym.variant, v.terminals.map((t) => t.id))) {
      enqueue({ symbolId: sym.id, term });
    }
  }

  return hvWireIds;
}

const HV_PHASE_RANK: Record<string, number> = {
  L1: 0, U: 0,
  L2: 1, V: 1,
  L3: 2, W: 2,
  N: 3,
};

const POLE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["L1", "T1"],
  ["L2", "T2"],
  ["L3", "T3"],
  ["N", "TN"],
  ["1", "2"],
  ["3", "4"],
  ["5", "6"],
  ["11", "12"],
  ["13", "14"],
  ["21", "22"],
  ["31", "32"],
  ["43", "44"],
  ["95", "96"],
  ["97", "98"],
  ["15", "16"],
  ["15", "18"],
  ["COM", "FWD"],
  ["COM2", "REV"],
];

function isSeriesPowerDevice(kind: string, variant: string): boolean {
  if (isControlOnlyVariant(variant)) return false;
  switch (kind) {
    case "isolator":
    case "breaker-1p":
    case "breaker-3p":
    case "rcd":
    case "fuse":
      return true;
    case "overload":
      return variant === "body" || variant === "main";
    case "contactor":
      return variant === "main";
    case "starter-dol":
    case "starter-fwd":
    case "starter-rev":
    case "starter-rev-combo":
      return true;
    default:
      return false;
  }
}

/** Other-end terminals of the same contact pole (not aliases of `term`). */
function poleMates(kind: string, variant: string, term: string, allowed: Set<string>): string[] {
  const v = variantDef(kind, variant);
  if (!allowed.has(term)) return [];
  const terms = v.terminals.filter((t) => allowed.has(t.id));
  const me = terms.find((t) => t.id === term);
  if (!me) return [];

  const parent = new Map<string, string>();
  for (const t of terms) parent.set(t.id, t.id);
  const findT = (id: string): string => {
    let cur = parent.get(id) ?? id;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, parent.get(next) ?? next);
      cur = parent.get(cur)!;
    }
    return cur;
  };
  const unionT = (a: string, b: string) => {
    const ra = findT(a);
    const rb = findT(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (terms[i].x === terms[j].x && terms[i].y === terms[j].y) unionT(terms[i].id, terms[j].id);
    }
  }
  for (const [a, b] of POLE_PAIRS) {
    if (parent.has(a) && parent.has(b)) unionT(a, b);
  }

  const pinKey = (t: { x: number; y: number }) => `${t.x},${t.y}`;
  const pinRep = new Map<string, string>();
  for (const t of terms) {
    if (!pinRep.has(pinKey(t))) pinRep.set(pinKey(t), t.id);
  }
  const mates = terms.filter((t) => findT(t.id) === findT(term) && (t.x !== me.x || t.y !== me.y));
  if (mates.length === 0 && pinRep.size === 2) {
    const other = [...pinRep.values()].find((id) => {
      const ot = terms.find((t) => t.id === id)!;
      return ot.x !== me.x || ot.y !== me.y;
    });
    if (other) {
      const pin = terms.find((t) => t.id === other)!;
      return terms.filter((t) => t.x === pin.x && t.y === pin.y).map((t) => t.id);
    }
  }
  return mates.map((t) => t.id);
}

function otherPoleTerms(kind: string, variant: string, term: string): string[] {
  if (!isSeriesPowerDevice(kind, variant)) return [];
  const v = variantDef(kind, variant);
  return poleMates(kind, variant, term, new Set(hvBridgeTerminals(kind, variant, v.terminals.map((t) => t.id))));
}

function isControlSeriesDevice(kind: string, variant: string): boolean {
  if (kind === "contactor" || kind === "relay" || kind === "timer-on" || kind === "timer-off") {
    return variant.startsWith("aux") || variant.startsWith("delayed") || variant.startsWith("inst");
  }
  if (kind === "overload") return variant.startsWith("aux");
  if (kind === "fuse" || kind === "breaker-1p") return true;
  switch (kind) {
    case "pb-no":
    case "pb-nc":
    case "estop":
    case "estop-nc":
    case "estop-no":
    case "selector-2":
    case "selector-3":
    case "toggle":
    case "toggle-spst":
    case "toggle-spdt":
    case "toggle-dpst":
    case "toggle-dpdt":
    case "toggle-4pdt":
    case "limit-no":
    case "limit-nc":
    case "foot":
    case "foot-no":
    case "foot-nc":
    case "float":
    case "temp-no":
    case "temp-nc":
    case "pressure-no":
    case "pressure-nc":
    case "flow-no":
    case "flow-nc":
    case "prox":
    case "prox-no":
    case "prox-nc":
    case "photo":
    case "photo-no":
    case "photo-nc":
      return true;
    default:
      return false;
  }
}

function controlPoleTerms(kind: string, variant: string, term: string): string[] {
  if (!isControlSeriesDevice(kind, variant)) return [];
  const v = variantDef(kind, variant);
  return poleMates(kind, variant, term, new Set(v.terminals.map((t) => t.id)));
}

function isControlSourceTerminal(kind: string, term: string): boolean {
  if (kind === "transformer") return term === "X1";
  if (kind === "dc-supply") return term === "+" || term === "POS" || term === "1";
  return false;
}

function isCoilA1(kind: string, variant: string, term: string): boolean {
  if (term !== "A1") return false;
  return (
    kind === "contactor" ||
    kind === "relay" ||
    kind === "timer-on" ||
    kind === "timer-off" ||
    kind === "counter" ||
    kind.startsWith("starter")
  );
}

/**
 * Control nets in schematic order: finish each X1→coil path (top to bottom)
 * before numbering leftover branches (lamps, alarms).
 */
function collectControlNetOrder(
  circuit: Circuit,
  wires: Wire[],
  find: (i: number) => number,
  isHvRoot: (root: number) => boolean,
): number[] {
  const symbolById = new Map(circuit.symbols.map((s) => [s.id, s]));
  const deviceById = new Map(circuit.devices.map((d) => [d.id, d]));
  const wireIndex = new Map(wires.map((w, i) => [w.id, i]));

  const wiresByPort = new Map<string, Wire[]>();
  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const key = portKey(p);
      const list = wiresByPort.get(key);
      if (list) list.push(w);
      else wiresByPort.set(key, [w]);
    }
  }

  const rootAt = (p: PortRef): number | null => {
    const w = wiresByPort.get(portKey(p))?.[0];
    if (!w) return null;
    const idx = wireIndex.get(w.id);
    return idx === undefined ? null : find(idx);
  };

  const portsByRoot = new Map<number, PortRef[]>();
  for (const w of wires) {
    const idx = wireIndex.get(w.id);
    if (idx === undefined) continue;
    const root = find(idx);
    const list = portsByRoot.get(root) ?? [];
    list.push(w.a, w.b);
    portsByRoot.set(root, list);
  }

  type Edge = { otherRoot: number; y: number; x: number };

  const seriesEdgesFrom = (root: number): Edge[] => {
    const seen = new Set<number>();
    const edges: Edge[] = [];
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      for (const term of controlPoleTerms(dev.kind, sym.variant, p.term)) {
        const other = rootAt({ symbolId: sym.id, term });
        if (other === null || other === root || seen.has(other) || isHvRoot(other)) continue;
        seen.add(other);
        edges.push({ otherRoot: other, y: sym.y, x: sym.x });
      }
    }
    return edges;
  };

  const netHasCoilA1 = (root: number): boolean => {
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (dev && isCoilA1(dev.kind, sym.variant, p.term)) return true;
    }
    return false;
  };

  const coilReach = new Map<number, boolean>();
  const reachesCoil = (root: number, visiting = new Set<number>()): boolean => {
    if (visiting.size === 0 && coilReach.has(root)) return coilReach.get(root)!;
    if (visiting.has(root)) return false;
    visiting.add(root);
    let found = netHasCoilA1(root);
    if (!found) {
      for (const e of seriesEdgesFrom(root)) {
        if (reachesCoil(e.otherRoot, visiting)) {
          found = true;
          break;
        }
      }
    }
    visiting.delete(root);
    if (visiting.size === 0) coilReach.set(root, found);
    return found;
  };

  const sources: { root: number; y: number; x: number }[] = [];
  const sourceSeen = new Set<number>();
  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev || !isControlSourceTerminal(dev.kind, p.term)) continue;
      const root = rootAt(p);
      if (root === null || isHvRoot(root) || sourceSeen.has(root)) continue;
      sourceSeen.add(root);
      sources.push({ root, y: sym.y, x: sym.x });
    }
  }
  sources.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

  const order: number[] = [];
  const seen = new Set<number>();

  const walk = (root: number, preferCoil: boolean) => {
    if (isHvRoot(root)) return;
    if (!seen.has(root)) {
      seen.add(root);
      order.push(root);
    }
    let next = seriesEdgesFrom(root).filter((e) => !seen.has(e.otherRoot) && !isHvRoot(e.otherRoot));
    if (preferCoil) next = next.filter((e) => reachesCoil(e.otherRoot));
    next.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
    for (const e of next) walk(e.otherRoot, preferCoil);
  };

  for (const s of sources) walk(s.root, true);
  for (const s of sources) walk(s.root, false);
  return order;
}

type HvNetMeta = { phase: number; stage: number; onMotorPath: boolean };

/**
 * Rank each HV net for numbering: stage = devices crossed from the source
 * (DISC column, then CB, then KM…), phase = L1/L2/L3/N.
 */
function collectHvNetMeta(
  circuit: Circuit,
  wires: Wire[],
  find: (i: number) => number,
): Map<number, HvNetMeta> {
  const symbolById = new Map(circuit.symbols.map((s) => [s.id, s]));
  const deviceById = new Map(circuit.devices.map((d) => [d.id, d]));
  const wireIndex = new Map(wires.map((w, i) => [w.id, i]));

  const wiresByPort = new Map<string, Wire[]>();
  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const key = portKey(p);
      const list = wiresByPort.get(key);
      if (list) list.push(w);
      else wiresByPort.set(key, [w]);
    }
  }

  type Q = { port: PortRef; phase: number; stage: number };
  const queue: Q[] = [];
  const best = new Map<string, HvNetMeta>();
  const netMeta = new Map<number, HvNetMeta>();

  const enqueue = (port: PortRef, phase: number, stage: number) => {
    const key = portKey(port);
    const prev = best.get(key);
    if (prev && prev.stage <= stage) return;
    best.set(key, { phase, stage, onMotorPath: false });
    queue.push({ port, phase, stage });
  };

  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      if (!HV_SOURCE_KINDS.has(dev.kind) || !isHvSourceTerminal(dev.kind, p.term)) continue;
      enqueue(p, HV_PHASE_RANK[p.term] ?? 0, 0);
    }
  }

  while (queue.length) {
    const { port, phase, stage } = queue.shift()!;
    const cur = best.get(portKey(port));
    if (!cur || cur.stage < stage) continue;

    for (const w of wiresByPort.get(portKey(port)) ?? []) {
      const idx = wireIndex.get(w.id);
      if (idx !== undefined) {
        const root = find(idx);
        const prev = netMeta.get(root);
        if (!prev || stage < prev.stage || (stage === prev.stage && phase < prev.phase)) {
          netMeta.set(root, { phase, stage, onMotorPath: false });
        }
      }
      const other = portKey(w.a) === portKey(port) ? w.b : w.a;
      enqueue(other, phase, stage);
    }

    const sym = symbolById.get(port.symbolId);
    if (!sym) continue;
    const dev = deviceById.get(sym.deviceId);
    if (!dev) continue;
    for (const term of otherPoleTerms(dev.kind, sym.variant, port.term)) {
      enqueue({ symbolId: sym.id, term }, phase, stage + 1);
    }
  }

  const rootAt = (p: PortRef): number | null => {
    const w = wiresByPort.get(portKey(p))?.[0];
    if (!w) return null;
    const idx = wireIndex.get(w.id);
    return idx === undefined ? null : find(idx);
  };

  const portsByRoot = new Map<number, PortRef[]>();
  for (const w of wires) {
    const idx = wireIndex.get(w.id);
    if (idx === undefined) continue;
    const root = find(idx);
    const list = portsByRoot.get(root) ?? [];
    list.push(w.a, w.b);
    portsByRoot.set(root, list);
  }

  const netHasMotor = (root: number): boolean => {
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (dev && (dev.kind === "motor-3ph" || dev.kind === "motor-1ph" || dev.kind === "motor-dc")) return true;
    }
    return false;
  };

  const seriesPowerNeighbors = (root: number): number[] => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      for (const term of otherPoleTerms(dev.kind, sym.variant, p.term)) {
        const other = rootAt({ symbolId: sym.id, term });
        if (other === null || other === root || seen.has(other)) continue;
        seen.add(other);
        out.push(other);
      }
    }
    return out;
  };

  const motorMemo = new Map<number, boolean>();
  const reachesMotor = (root: number, visiting = new Set<number>()): boolean => {
    if (visiting.size === 0 && motorMemo.has(root)) return motorMemo.get(root)!;
    if (visiting.has(root)) return false;
    visiting.add(root);
    let found = netHasMotor(root);
    if (!found) {
      const stage = netMeta.get(root)?.stage ?? 99;
      for (const other of seriesPowerNeighbors(root)) {
        const os = netMeta.get(other)?.stage ?? 99;
        if (os > stage && reachesMotor(other, visiting)) {
          found = true;
          break;
        }
      }
    }
    visiting.delete(root);
    if (visiting.size === 0) motorMemo.set(root, found);
    return found;
  };

  for (const [root, meta] of netMeta) {
    netMeta.set(root, { ...meta, onMotorPath: reachesMotor(root) });
  }

  return netMeta;
}

export function createBlankTemplateCircuit(): Circuit {
  const c = clone(templateData.circuit as unknown as Circuit);
  sanitizeCircuitIds(c);
  return c;
}

export function createBlankTemplateProcess(): ProcessVars {
  return templateData.process ? { ...defaultProcess(), ...templateData.process } : defaultProcess();
}

// Initialize from URL share hash, saved draft, or fallback to default template
const boot = startupDoc(createBlankTemplateCircuit, t("doc.untitled"));
sanitizeCircuitIds(boot.circuit);
const sidebarBoot = readSidebarState();

const initialLayoutMode = readLayoutMode();

export const useLab = create<LabState>((set, get) => ({
  circuit: boot.circuit,
  snapshot: emptySnapshot(boot.circuit),
  mode: initialLayoutMode === "ladder" ? "run" : "edit",
  editSubMode: "editing",
  running: initialLayoutMode === "ladder",
  held: [],
  process: boot.process ?? defaultProcess(),
  selected: null,
  selectedIds: [],
  selectedWireIds: [],
  clipboard: null,
  placing: null,
  placingRot: 0,
  placingFlipX: false,
  placingFlipY: false,
  wiringFrom: null,
  history: [],
  future: [],
  timeMs: 0,
  hoverPort: null,
  docName: boot.name ?? t("doc.untitled"),
  notice: null,
  savesTick: 0,
  lang: readLang(),
  theme: readTheme(),
  layoutMode: initialLayoutMode,
  showLadderMenu: readShowLadderMenu(), // Controls whether to show ladder diagram menu
  showWireLabels: readShowWireLabels(), // Sheet option: render wire number labels
  hiddenWireLabels: new Set(),
  isDirty: false,
  paletteOpen: sidebarBoot.paletteOpen,
  sideOpen: sidebarBoot.sideOpen,
  paletteWidth: sidebarBoot.paletteWidth,
  sideWidth: sidebarBoot.sideWidth,
  zoom: readZoom(),
  printOpen: false,
  tutorialOpen: false,
  tutorialStepIndex: 0,
  tutorialVersion: "pc",
  meterHistory: {},

  pushHistory: () => {
    const { history, circuit } = get();
    
    // When switching layout modes or performing operations, ensure ladderRungOrder is synchronized with rung IDs
    const normalizedCircuit = { ...circuit };
    if (normalizedCircuit.ladderRungOrder && Array.isArray(normalizedCircuit.ladderRungOrder)) {
      // Filter out rung IDs that no longer exist in the circuit (prevent stale IDs)
      const existingDeviceIds = new Set([
        ...circuit.symbols.map(s => s.deviceId),
        ...circuit.devices.map(d => d.id)
      ]);
      
      normalizedCircuit.ladderRungOrder = normalizedCircuit.ladderRungOrder.filter(id => {
        if (!id.startsWith("rung_")) return false;
        
        // Extract device id from rung_id
        const parts = id.split("_");
        if (parts.length < 2) return true; // Keep unknown formats
        
        const deviceId = parts[1];
        return existingDeviceIds.has(deviceId);
      });
    }
    
    set({ history: [...history.slice(-40), clone(normalizedCircuit)], future: [] });
  },

  setMode: (mode) => {
    const { circuit } = get();
    if (mode === "run") {
      trackCircuitRun({
        symbolCount: circuit.symbols.length,
        wireCount: circuit.wires.length,
        deviceCount: circuit.devices.length,
      });
    }
    set({
      mode,
      placing: null,
      wiringFrom: null,
      running: mode === "run",
      snapshot: emptySnapshot(circuit),
      timeMs: 0,
      held: [],
      meterHistory: {},
    });
  },
  setEditSubMode: (subMode) => {
    set({
      editSubMode: subMode,
      ...(subMode === "editing" ? { wiringFrom: null, hoverPort: null } : {}),
    });
  },
  toggleEditSubMode: () => {
    const next = get().editSubMode === "editing" ? "wiring" : "editing";
    get().setEditSubMode(next);
  },
  setRunning: (running) => {
    if (running) {
      const { circuit } = get();
      trackCircuitRun({
        symbolCount: circuit.symbols.length,
        wireCount: circuit.wires.length,
        deviceCount: circuit.devices.length,
      });
    } else {
      trackCircuitPause();
    }
    set({ running });
  },
  step: () => {
    trackCircuitStep();
    const s = get();
    const nextTimeMs = s.timeMs + 50;
    const snap = tick(
      s.circuit,
      s.snapshot.runtime,
      { held: new Set(s.held), process: s.process },
      50,
      nextTimeMs,
    );

    // Record historical data points for all voltmeter and ammeter devices
    const nextHistory = { ...s.meterHistory };
    const currentTimeSec = Math.round((nextTimeMs / 1000) * 10) / 10;
    let hasMeters = false;
    for (const d of s.circuit.devices) {
      if (d.kind === "voltmeter" || d.kind === "ammeter") {
        hasMeters = true;
        const val = snap.runtime[d.id]?.meterValue ?? 0;
        const prev = nextHistory[d.id] ?? [];
        // Keep up to 300 data points (e.g. 15 seconds at 50ms interval)
        nextHistory[d.id] = [...prev.slice(-299), { time: currentTimeSec, value: val }];
      }
    }

    set({
      snapshot: snap,
      timeMs: nextTimeMs,
      meterHistory: hasMeters ? nextHistory : s.meterHistory,
    });
  },
  resetSim: () => {
    trackCircuitReset();
    const { circuit } = get();
    set({
      snapshot: emptySnapshot(circuit),
      timeMs: 0,
      held: [],
      meterHistory: {},
    });
  },
  clearMeterHistory: (deviceId) => {
    if (deviceId) {
      const next = { ...get().meterHistory };
      delete next[deviceId];
      set({ meterHistory: next });
    } else {
      set({ meterHistory: {} });
    }
  },
  setProcess: (patch) => {
    const next = { ...get().process, ...patch };
    set({ process: next });
    get().persistDraft();
  },
  setPlacing: (id) => {
    let defaultRot: Rot = 0;
    let defaultFlipX = false;
    let defaultFlipY = false;
    if (id) {
      try {
        const item = catalogItem(id);
        defaultRot = item.defaultRot ?? 0;
        defaultFlipX = Boolean(item.defaultFlipX);
        defaultFlipY = Boolean(item.defaultFlipY);
      } catch {}
    }
    set({
      placing: id,
      placingRot: defaultRot,
      placingFlipX: defaultFlipX,
      placingFlipY: defaultFlipY,
      wiringFrom: null,
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
    });
  },
  setPlacingRot: (rot) => set({ placingRot: rot }),
  rotatePlacing: (dir = 1) => {
    const cur = get().placingRot ?? 0;
    const step = dir === 1 ? 90 : 270;
    const next = (((cur + step) % 360) as Rot);
    set({ placingRot: next });
  },
  flipPlacing: (axis = "h") => {
    const rot = get().placingRot ?? 0;
    const localX = rot === 0 || rot === 180;
    let flipX = Boolean(get().placingFlipX);
    let flipY = Boolean(get().placingFlipY);
    if (axis === "h") {
      if (localX) flipX = !flipX;
      else flipY = !flipY;
    } else if (localX) {
      flipY = !flipY;
    } else {
      flipX = !flipX;
    }
    set({ placingFlipX: flipX, placingFlipY: flipY });
  },
  setHoverPort: (port) => set({ hoverPort: port }),
  select: (sel, isolate = false) => {
    if (!sel) {
      set({ selected: null, selectedIds: [], selectedWireIds: [], placing: null, wiringFrom: null });
      return;
    }
    if (sel.type === "wire") {
      set({
        selected: sel,
        selectedIds: [],
        selectedWireIds: [sel.id],
        placing: null,
        wiringFrom: null,
      });
      return;
    }
    if (sel.type === "wire-label") {
      set({
        selected: sel,
        selectedIds: [],
        selectedWireIds: [],
        placing: null,
        wiringFrom: null,
      });
      return;
    }
    set({
      selected: sel,
      selectedIds: isolate ? [sel.id] : expandIds(get().circuit, [sel.id]),
      selectedWireIds: [],
      placing: null,
      wiringFrom: null,
    });
  },
  selectToggle: (id) => {
    const { circuit, selectedIds } = get();
    const chunk = expandIds(circuit, [id]);
    const cur = new Set(selectedIds);
    const allIn = chunk.every((x) => cur.has(x));
    if (allIn) chunk.forEach((x) => cur.delete(x));
    else chunk.forEach((x) => cur.add(x));
    const next = circuit.symbols.map((s) => s.id).filter((x) => cur.has(x));
    set({
      selected: next.length ? { type: "symbol", id: next[next.length - 1] } : null,
      selectedIds: next,
      selectedWireIds: [],
      placing: null,
      wiringFrom: null,
    });
  },
  selectIds: (ids, additive = false) => {
    const { circuit, selectedIds } = get();
    const chunk = expandIds(circuit, ids);
    const cur = new Set(additive ? selectedIds : []);
    for (const id of chunk) cur.add(id);
    const next = circuit.symbols.map((s) => s.id).filter((x) => cur.has(x));
    set({
      selected: next.length ? { type: "symbol", id: next[next.length - 1] } : null,
      selectedIds: next,
      selectedWireIds: [],
      placing: null,
      wiringFrom: null,
    });
  },
  selectWireToggle: (id) => {
    const { circuit, selectedWireIds } = get();
    const cur = new Set(selectedWireIds ?? []);
    if (cur.has(id)) {
      cur.delete(id);
    } else {
      cur.add(id);
    }
    const next = circuit.wires.map((w) => w.id).filter((x) => cur.has(x));
    set({
      selected: next.length ? { type: "wire", id: next[next.length - 1] } : null,
      selectedWireIds: next,
      selectedIds: [],
      placing: null,
      wiringFrom: null,
    });
  },
  selectWireIds: (ids, additive = false) => {
    const { circuit, selectedWireIds } = get();
    const cur = new Set(additive ? (selectedWireIds ?? []) : []);
    for (const id of ids) cur.add(id);
    const next = circuit.wires.map((w) => w.id).filter((x) => cur.has(x));
    set({
      selected: next.length ? { type: "wire", id: next[next.length - 1] } : null,
      selectedWireIds: next,
      selectedIds: [],
      placing: null,
      wiringFrom: null,
    });
  },
  mergeSelectedWires: () => {
    if (get().mode !== "edit") return;
    const { circuit, selectedWireIds, mode } = get();
    if (!selectedWireIds || selectedWireIds.length !== 2) return;
    const [w1, w2] = selectedWireIds;
    get().pushHistory();
    const next = clone(circuit);
    const res = mergeWires(next, w1, w2);
    if (!res) return;
    set({
      circuit: next,
      snapshot: mode === "edit" ? emptySnapshot(next) : get().snapshot,
      selected: { type: "symbol", id: res.junction.id },
      selectedIds: [res.junction.id],
      selectedWireIds: [],
      isDirty: true,
      notice: t("notice.wiresMerged"),
    });
  },

  toggleWireLabelHidden: (wireId) => {
    const { hiddenWireLabels } = get();
    const next = new Set(hiddenWireLabels);
    if (next.has(wireId)) {
      next.delete(wireId);
    } else {
      next.add(wireId);
    }
    set({ hiddenWireLabels: next });
  },

  hideWireLabels: (wireIds) => {
    const { hiddenWireLabels } = get();
    const next = new Set(hiddenWireLabels);
    for (const id of wireIds) next.add(id);
    set({ hiddenWireLabels: next });
  },

  hideWireLabelInstance: (wireId, t) => {
    const { circuit } = get();
    const w = circuit.wires.find((x) => x.id === wireId);
    if (!w) return;
    get().pushHistory();
    const next = clone(circuit);
    const target = next.wires.find((x) => x.id === wireId);
    if (!target) return;
    const marks = [...(target.labelMarks ?? [])];
    const i = marks.findIndex((m) => Math.abs(m.t - t) < 0.04);
    if (i >= 0) marks[i] = { ...marks[i], hidden: true };
    else marks.push({ t, hidden: true });
    target.labelMarks = marks;
    set({ circuit: next, isDirty: true, selected: null });
  },

  showWireLabelInstances: (wireId) => {
    const { circuit } = get();
    const w = circuit.wires.find((x) => x.id === wireId);
    if (!w?.labelMarks?.length) return;
    get().pushHistory();
    const next = clone(circuit);
    const target = next.wires.find((x) => x.id === wireId);
    if (!target) return;
    target.labelMarks = (target.labelMarks ?? []).filter((m) => !m.hidden);
    if (!target.labelMarks.length) delete target.labelMarks;
    set({ circuit: next, isDirty: true });
  },

  pinWireLabel: (wireId, fromT, toT) => {
    const { circuit } = get();
    const idx = circuit.wires.findIndex((x) => x.id === wireId);
    if (idx < 0) return;
    const w = circuit.wires[idx];
    const marks = [...(w.labelMarks ?? [])];
    const pin = marks.find((m) => !m.hidden && Math.abs(m.t - fromT) < 0.04);
    if (pin) {
      pin.t = toT;
    } else {
      const origin = marks.find((m) => Math.abs(m.t - fromT) < 0.04);
      if (origin) origin.hidden = true;
      else marks.push({ t: fromT, hidden: true });
      marks.push({ t: toT });
    }
    const wires = circuit.wires.slice();
    wires[idx] = { ...w, labelMarks: marks };
    set({ circuit: { ...circuit, wires }, isDirty: true });
  },

  showAllWireLabels: () => {
    set({ hiddenWireLabels: new Set() });
  },
  groupSelected: () => {
    const { circuit, selectedIds } = get();
    if (selectedIds.length < 2) return;
    get().pushHistory();
    const next = clone(circuit);
    const g = groupSymbols(next, selectedIds);
    if (!g) return;
    set({
      circuit: next,
      selectedIds: g.memberIds,
      selected: { type: "symbol", id: g.memberIds[0] },
      notice: t("notice.groupCreated", { count: g.memberIds.length }),
      isDirty: true,
    });
  },
  ungroupSelected: () => {
    const { circuit, selectedIds } = get();
    if (!selectionHasGroup(circuit, selectedIds)) return;
    get().pushHistory();
    const next = clone(circuit);
    ungroupSymbols(next, selectedIds);
    set({ circuit: next, notice: t("notice.ungrouped"), isDirty: true });
  },
  selectAll: () => {
    const ids = get().circuit.symbols.map((s) => s.id);
    set({
      selected: ids.length ? { type: "symbol", id: ids[ids.length - 1] } : null,
      selectedIds: ids,
      selectedWireIds: [],
      placing: null,
      wiringFrom: null,
    });
  },

  placeAt: (x, y, extraParams) => {
    const { placing, placingRot, circuit, selected } = get();
    if (!placing) return;
    const item = catalogItem(placing);
    const rotToUse = placingRot ?? item.defaultRot ?? 0;
    const flipXToUse = get().placingFlipX ?? item.defaultFlipX;
    const flipYToUse = get().placingFlipY ?? item.defaultFlipY;
    get().pushHistory();
    const next = clone(circuit);
    const gx = Math.round(x);
    const gy = Math.round(y);
    if (item.creates === "attach") {
      let host = lastDeviceOfKind(next, item.kind, selected?.type === "symbol" ? selected.id : null);
      if (!host) {
        const created = addDevice(
          next,
          item.kind,
          nextTag(next.devices.map((d) => d.tag), item.prefix),
          item.variant,
          gx,
          gy,
          extraParams ?? {},
          rotToUse,
          flipXToUse,
          flipYToUse,
        );
        host = created.device.id;
      } else {
        addSymbol(next, host, item.variant, gx, gy, rotToUse, flipXToUse, flipYToUse);
      }
      const placed = next.symbols[next.symbols.length - 1];
      trackComponentPlaced(item.kind, item.group, next.symbols.length);
      set({
        circuit: next,
        selected: { type: "symbol", id: placed.id },
        selectedIds: [placed.id],
        placing: null,
        placingRot: 0,
        placingFlipX: false,
        placingFlipY: false,
        wiringFrom: null,
        snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
        isDirty: true,
      });
      return;
    }
    const defaultParams: DeviceParams =
      item.kind === "lamp"
        ? { color: "green" }
        : item.kind === "timer-on" || item.kind === "timer-off"
          ? { delayMs: 2000 }
          : item.kind === "counter"
            ? { preset: 5 }
            : item.kind === "float"
              ? { setpoint: 50 }
            : item.kind === "temp-no" || item.kind === "temp-nc"
              ? { setpoint: 140 }
              : item.kind === "pressure-no" || item.kind === "pressure-nc"
                ? { setpoint: 4 }
                : item.kind === "flow-no" || item.kind === "flow-nc"
                  ? { setpoint: 40 }
                  : item.kind === "transformer"
                    ? { primaryVoltage: 480, secondaryVoltage: 120, ratio: "480/120" }
                    : item.kind === "mains-3ph"
                      ? { supplyType: item.variant === "delta" ? "delta" : "wye", voltage: 480, maxCurrent: 400 }
                      : item.kind === "motor-3ph" ||
                        item.kind === "starter-dol" ||
                        item.kind === "starter-fwd" ||
                        item.kind === "starter-rev" ||
                        item.kind === "starter-rev-combo"
                        ? { power: 5.5 }
                        : item.kind === "motor-1ph"
                          ? { power: 1.5 }
                          : item.kind === "motor-dc"
                            ? { power: 0.75 }
                            : item.kind === "title-block"
                              ? {
                                  projectName: "MOTOR CONTROL CIRCUIT",
                                  projectNo: "DWG-001",
                                  rev: "A",
                                  sheetNum: "1",
                                  sheetTotal: "1",
                                  description: "SCHEMATIC DIAGRAM",
                                  designedBy: "ENGINEER",
                                  date: formatMMDDYYYY(),
                                  scale: 1,
                                }
                              : item.kind === "comment"
                                ? {
                                    text: t("comment.defaultText"),
                                    showLeaderLine: true,
                                    bgColor: "#fef9c3",
                                    fontSize: 12,
                                    width: 6,
                                    height: 3,
                                  }
                              : {};

    if (item.kind === "ammeter" && !extraParams?.clampedWireId) {
      const detected = findWireAtPoint(next, (gx + 2) * GRID, (gy + 2) * GRID, GRID * 2.5);
      if (detected) {
        defaultParams.clampedWireId = detected.id;
      }
    }

    const created = addDevice(
      next,
      item.kind,
      item.kind === "net-label"
        ? suggestNetLabelTag(next, selected?.type === "symbol" ? selected.id : null)
        : nextTag(next.devices.map((d) => d.tag), item.prefix),
      item.variant,
      gx,
      gy,
      { ...defaultParams, ...extraParams },
      rotToUse,
      flipXToUse,
      flipYToUse,
    );
    trackComponentPlaced(item.kind, item.group, next.symbols.length);
    set({
      circuit: next,
      selected: { type: "symbol", id: created.symbol.id },
      selectedIds: [created.symbol.id],
      placing: null,
      placingRot: 0,
      placingFlipX: false,
      placingFlipY: false,
      wiringFrom: null,
      snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
      isDirty: true,
    });
  },

  quickAttachClampMeter: (wireId: string) => {
    const { circuit } = get();
    const wire = circuit.wires.find((w) => w.id === wireId);
    if (!wire) return;
    get().pushHistory();
    const next = clone(circuit);
    const aSym = next.symbols.find((s) => s.id === wire.a.symbolId);
    const bSym = next.symbols.find((s) => s.id === wire.b.symbolId);
    let gx = 10;
    let gy = 10;
    if (aSym && bSym) {
      gx = Math.round((aSym.x + bSym.x) / 2);
      gy = Math.round((aSym.y + bSym.y) / 2);
    } else if (aSym) {
      gx = aSym.x + 3;
      gy = aSym.y;
    }
    const created = addDevice(
      next,
      "ammeter",
      nextTag(next.devices.map((d) => d.tag), "CM"),
      "body",
      gx,
      gy,
      { clampedWireId: wireId },
      0,
    );
    set({
      circuit: next,
      selected: { type: "symbol", id: created.symbol.id },
      selectedIds: [created.symbol.id],
      placing: null,
      wiringFrom: null,
      snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
      isDirty: true,
    });
  },

  addCommentForSymbol: (symbolId: string) => {
    const { circuit } = get();
    const sym = circuit.symbols.find((s) => s.id === symbolId);
    if (!sym) return;
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev) return;
    get().pushHistory();
    const next = clone(circuit);
    const v = variantDef(dev.kind, sym.variant);
    const gx = Math.round(sym.x + (v?.w ?? 4) + 1);
    const gy = Math.round(sym.y);
    const created = addDevice(
      next,
      "comment",
      nextTag(next.devices.map((d) => d.tag), "REM"),
      "body",
      gx,
      gy,
      {
        text: `${dev.tag} 備註說明`,
        targetDeviceId: dev.id,
        showLeaderLine: true,
        bgColor: "#fef9c3",
        fontSize: 12,
        width: 6,
        height: 3,
      },
      0,
    );
    set({
      circuit: next,
      selected: { type: "symbol", id: created.symbol.id },
      selectedIds: [created.symbol.id],
      placing: null,
      wiringFrom: null,
      sideOpen: true,
      snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
      isDirty: true,
    });
  },

  addCommentForGroup: (groupId) => {
    const { circuit } = get();
    const g = (circuit.groups ?? []).find((x) => x.id === groupId);
    if (!g) return;
    get().pushHistory();
    const next = clone(circuit);
    const ng = (next.groups ?? []).find((x) => x.id === groupId);
    if (!ng) return;
    const box = unionBounds(next, ng.memberIds);
    const gx = Math.round((box?.x ?? 0) + (box?.w ?? 4) + 1);
    const gy = Math.round(box?.y ?? 0);
    const label = (ng.name ?? "").trim() || t("lib.group");
    const created = addDevice(
      next,
      "comment",
      nextTag(next.devices.map((d) => d.tag), "REM"),
      "body",
      gx,
      gy,
      {
        text: t("comment.groupDefaultText", { name: label }),
        targetGroupId: ng.id,
        showLeaderLine: true,
        bgColor: "#fef9c3",
        fontSize: 12,
        width: 6,
        height: 3,
      },
      0,
    );
    if (!ng.memberIds.includes(created.symbol.id)) ng.memberIds.push(created.symbol.id);
    set({
      circuit: next,
      selected: { type: "symbol", id: created.symbol.id },
      selectedIds: [created.symbol.id],
      placing: null,
      wiringFrom: null,
      sideOpen: true,
      snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
      isDirty: true,
    });
  },

  scaleSymbol: (symbolId, scale, x, y) => {
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === symbolId);
    if (!sym) return;
    if (x !== undefined) sym.x = Math.round(x);
    if (y !== undefined) sym.y = Math.round(y);
    const dev = next.devices.find((d) => d.id === sym.deviceId);
    if (dev) {
      if (!dev.params) dev.params = {};
      dev.params.scale = scale;
    }
    set({ circuit: next, isDirty: true });
  },

  moveSymbol: (id, x, y) => {
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === id);
    if (!sym) return;
    const rx = Math.round(x);
    const ry = Math.round(y);
    sym.x = rx;
    sym.y = ry;
    const dev = next.devices.find((d) => d.id === sym.deviceId);
    if (dev && dev.kind === "ammeter") {
      const detected = findWireAtPoint(next, (rx + 2) * GRID, (ry + 2) * GRID, GRID * 2.5);
      dev.params = { ...dev.params, clampedWireId: detected?.id };
    }
    set({ circuit: next, isDirty: true });
  },
  moveGroup: (updates, wireUpdates) => {
    const next = clone(get().circuit);
    const movedIds = new Set(updates.map((u) => u.id));
    const deltas = new Map<string, { dx: number; dy: number }>();
    for (const u of updates) {
      const sym = next.symbols.find((s) => s.id === u.id);
      if (sym) {
        const rx = Math.round(u.x);
        const ry = Math.round(u.y);
        deltas.set(u.id, { dx: rx - sym.x, dy: ry - sym.y });
        sym.x = rx;
        sym.y = ry;
        const dev = next.devices.find((d) => d.id === sym.deviceId);
        if (dev && dev.kind === "ammeter") {
          const detected = findWireAtPoint(next, (rx + 2) * GRID, (ry + 2) * GRID, GRID * 2.5);
          dev.params = { ...dev.params, clampedWireId: detected?.id };
        }
      }
    }
    if (wireUpdates && wireUpdates.length > 0) {
      for (const wu of wireUpdates) {
        const w = next.wires.find((x) => x.id === wu.id);
        if (w) {
          if (!wu.jog) {
            w.jog = undefined;
          } else {
            const rx = wu.jog.x !== undefined ? Math.round(wu.jog.x / GRID) * GRID : undefined;
            const ry = wu.jog.y !== undefined ? Math.round(wu.jog.y / GRID) * GRID : undefined;
            const rpos = wu.jog.pos !== undefined ? Math.round(wu.jog.pos / GRID) * GRID : undefined;
            const jogObj: WireJog = {
              axis: wu.jog.axis ?? (rx !== undefined ? "x" : "y"),
              pos: wu.jog.axis === "y" ? (ry ?? rpos ?? 0) : (rx ?? rpos ?? 0),
            };
            if (rx !== undefined) jogObj.x = rx;
            if (ry !== undefined) jogObj.y = ry;
            w.jog = jogObj;
          }
        }
      }
    } else {
      for (const w of next.wires) {
        if (w.jog && movedIds.has(w.a.symbolId) && movedIds.has(w.b.symbolId)) {
          const da = deltas.get(w.a.symbolId);
          const db = deltas.get(w.b.symbolId);
          if (da && db && Math.abs(da.dx - db.dx) < 1e-4 && Math.abs(da.dy - db.dy) < 1e-4) {
            if (w.jog.x !== undefined) {
              w.jog.x = Math.round((w.jog.x + da.dx * GRID) / GRID) * GRID;
            }
            if (w.jog.y !== undefined) {
              w.jog.y = Math.round((w.jog.y + da.dy * GRID) / GRID) * GRID;
            }
            if (w.jog.axis === "x") {
              w.jog.pos = Math.round(((w.jog.x ?? w.jog.pos ?? 0) + (w.jog.x !== undefined ? 0 : da.dx * GRID)) / GRID) * GRID;
            } else if (w.jog.axis === "y") {
              w.jog.pos = Math.round(((w.jog.y ?? w.jog.pos ?? 0) + (w.jog.y !== undefined ? 0 : da.dy * GRID)) / GRID) * GRID;
            }
          }
        }
      }
    }
    set({ circuit: next, isDirty: true });
  },

  setWireJog: (id, jog) => {
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    if (!jog) {
      w.jog = undefined;
    } else {
      const rx = jog.x !== undefined ? Math.round(jog.x / GRID) * GRID : undefined;
      const ry = jog.y !== undefined ? Math.round(jog.y / GRID) * GRID : undefined;
      const rpos = jog.pos !== undefined ? Math.round(jog.pos / GRID) * GRID : undefined;

      const oldJogX = w.jog?.x ?? (w.jog?.axis === "x" ? w.jog.pos : undefined);
      const oldJogY = w.jog?.y ?? (w.jog?.axis === "y" ? w.jog.pos : undefined);

      let newJogX = rx ?? (jog.axis === "x" ? rpos : undefined);
      let newJogY = ry ?? (jog.axis === "y" ? rpos : undefined);

      if (newJogX === undefined && jog.axis === "y") {
        newJogX = oldJogX;
      }
      if (newJogY === undefined && jog.axis === "x") {
        newJogY = oldJogY;
      }

      const jogObj: WireJog = {
        axis: jog.axis ?? (newJogX !== undefined ? "x" : "y"),
        pos: jog.axis === "y" ? (newJogY ?? rpos ?? 0) : (newJogX ?? rpos ?? 0),
      };
      if (newJogX !== undefined) jogObj.x = newJogX;
      if (newJogY !== undefined) jogObj.y = newJogY;
      w.jog = jogObj;
    }
    set({ circuit: next, isDirty: true });
  },

  clickPort: (port) => {
    if (get().mode !== "edit") return;
    const from = get().wiringFrom;
    if (!from) {
      set({ wiringFrom: port, placing: null });
      return;
    }
    if (portsEqual(from, port)) {
      set({ wiringFrom: null });
      return;
    }
    if (get().circuit.wires.some((w) => wireHasEnds(w, from, port))) {
      set({ wiringFrom: null });
      return;
    }
    get().pushHistory();
    const next = clone(get().circuit);
    next.wires.push({
      id: uid("w"),
      a: from,
      b: port,
    });
    set({ circuit: next, wiringFrom: null, isDirty: true });
  },

  addJunctionAndConnect: (gx, gy) => {
    if (get().mode !== "edit") return;
    const from = get().wiringFrom;
    if (!from) return;
    const circuit = get().circuit;
    get().pushHistory();
    const next = clone(circuit);
    const rx = Math.round(gx);
    const ry = Math.round(gy);
    let j = findJunctionAt(next, rx, ry);
    if (!j) {
      j = addJunction(next, rx, ry).symbol;
    }
    const jPort: PortRef = { symbolId: j.id, term: "1" };
    if (!portsEqual(from, jPort) && !next.wires.some((w) => wireHasEnds(w, from, jPort))) {
      next.wires.push({
        id: uid("w"),
        a: from,
        b: jPort,
      });
    }
    set({ circuit: next, wiringFrom: jPort, isDirty: true });
  },

  connectToWire: (wireId, world) => {
    if (get().mode !== "edit") return;
    const from = get().wiringFrom;
    if (!from) return;
    const circuit = get().circuit;
    const w = circuit.wires.find((item) => item.id === wireId);
    if (!w) return;
    const pts = allWireRoutes(circuit).get(wireId) ?? wireRoute(circuit, w.a, w.b, w.jog);
    const near = nearestOnPolyline(pts, world);
    if (!near || near.d > 24) return;
    const snapped = snapOnSegment(pts[near.index], pts[near.index + 1], { x: near.x, y: near.y });
    const gx = Math.round(snapped.x / GRID);
    const gy = Math.round(snapped.y / GRID);
    get().pushHistory();
    const next = clone(circuit);
    const port = splitWireAt(next, wireId, gx, gy);
    if (!port) return;
    if (!portsEqual(from, port) && !next.wires.some((item) => wireHasEnds(item, from, port))) {
      next.wires.push({ id: uid("w"), a: from, b: port });
    }
    set({ circuit: next, wiringFrom: null, isDirty: true });
  },

  pointerDevice: (deviceId, down) => {
    const dev = get().circuit.devices.find((d) => d.id === deviceId);
    if (!dev) return;
    if (get().mode !== "run") return;
    const isMomentaryType =
      dev.kind === "pb-no" ||
      dev.kind === "pb-nc" ||
      dev.kind === "foot" ||
      dev.kind === "foot-no" ||
      dev.kind === "foot-nc";
    const isLimit = dev.kind === "limit-no" || dev.kind === "limit-nc";
    if (isMomentaryType || isLimit) {
      const held = new Set(get().held);
      const tag = dev.tag.trim();

      if (isLimit && tag) {
        const sameTagLimits = get().circuit.devices.filter(
          (d) => (d.kind === "limit-no" || d.kind === "limit-nc") && d.tag.trim() === tag
        );
        if (sameTagLimits.length === 2) {
          const [d1, d2] = sameTagLimits;
          const isOppositeKinds =
            (d1.kind === "limit-no" && d2.kind === "limit-nc") ||
            (d1.kind === "limit-nc" && d2.kind === "limit-no");
          if (isOppositeKinds) {
            if (down) {
              held.add(d1.id);
              held.add(d2.id);
            } else {
              held.delete(d1.id);
              held.delete(d2.id);
            }
          } else {
            const other = d1.id === deviceId ? d2 : d1;
            if (down) {
              held.add(deviceId);
              held.delete(other.id);
            } else {
              held.delete(deviceId);
            }
          }
        } else {
          if (down) held.add(deviceId);
          else held.delete(deviceId);
        }
      } else {
        const sameTagDevs = tag
          ? get().circuit.devices.filter((d) => isMomentaryType && d.tag.trim() === tag)
          : [dev];
        for (const d of sameTagDevs) {
          if (down) held.add(d.id);
          else held.delete(d.id);
        }
      }
      set({ held: [...held] });
    }
  },

  toggleIo: (deviceId, field) => {
    const dev = get().circuit.devices.find((d) => d.id === deviceId);
    if (!dev) return;
    if (field === "prime") {
      const next = clone(get().circuit);
      const d = next.devices.find((x) => x.id === deviceId);
      if (d) d.params.primeMover = !d.params.primeMover;
      set({ circuit: next });
      return;
    }
    const curSnap = get().snapshot ?? emptySnapshot(get().circuit);
    const runtime = { ...curSnap.runtime };
    const rt = { ...(runtime[deviceId] ?? defaultRuntime(dev.kind)) };
    if (field === "on") {
      rt.on = !rt.on;
      runtime[deviceId] = rt;
    }
    if (field === "tripped") {
      rt.tripped = !rt.tripped;
      runtime[deviceId] = rt;
    }
    if (field === "actuated") {
      const isLimit = dev.kind === "limit-no" || dev.kind === "limit-nc";
      const tag = dev.tag.trim();
      if (isLimit && tag) {
        const sameTagLimits = get().circuit.devices.filter(
          (d) => (d.kind === "limit-no" || d.kind === "limit-nc") && d.tag.trim() === tag
        );
        if (sameTagLimits.length === 2) {
          const [d1, d2] = sameTagLimits;
          const isOppositeKinds =
            (d1.kind === "limit-no" && d2.kind === "limit-nc") ||
            (d1.kind === "limit-nc" && d2.kind === "limit-no");
          if (isOppositeKinds) {
            const nextAct = !rt.actuated;
            const rt1 = { ...(runtime[d1.id] ?? defaultRuntime(d1.kind)), actuated: nextAct };
            const rt2 = { ...(runtime[d2.id] ?? defaultRuntime(d2.kind)), actuated: nextAct };
            runtime[d1.id] = rt1;
            runtime[d2.id] = rt2;
          } else if (d1.kind === "limit-no" && d2.kind === "limit-no") {
            const other = d1.id === deviceId ? d2 : d1;
            const nextAct = !rt.actuated;
            const rtCur = { ...(runtime[deviceId] ?? defaultRuntime(dev.kind)), actuated: nextAct };
            const rtOther = {
              ...(runtime[other.id] ?? defaultRuntime(other.kind)),
              actuated: nextAct ? false : (runtime[other.id]?.actuated ?? false),
            };
            runtime[deviceId] = rtCur;
            runtime[other.id] = rtOther;
          } else {
            const other = d1.id === deviceId ? d2 : d1;
            const nextAct = !rt.actuated;
            const rtCur = { ...(runtime[deviceId] ?? defaultRuntime(dev.kind)), actuated: nextAct };
            const rtOther = {
              ...(runtime[other.id] ?? defaultRuntime(other.kind)),
              actuated: !nextAct,
            };
            runtime[deviceId] = rtCur;
            runtime[other.id] = rtOther;
          }
        } else {
          rt.actuated = !rt.actuated;
          runtime[deviceId] = rt;
        }
      } else {
        rt.actuated = !rt.actuated;
        runtime[deviceId] = rt;
      }
    }
    set({ snapshot: { ...curSnap, runtime } });
  },

  cyclePosition: (deviceId) => {
    const dev = get().circuit.devices.find((d) => d.id === deviceId);
    if (!dev) return;
    const max = dev.kind === "selector-3" ? 3 : 2;
    const runtime = { ...get().snapshot.runtime };
    const rt = { ...(runtime[deviceId] ?? emptySnapshot(get().circuit).runtime[deviceId]) };
    rt.position = (rt.position + 1) % max;
    runtime[deviceId] = rt;
    set({ snapshot: { ...get().snapshot, runtime } });
  },

  updateDevice: (deviceId, patch) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const d = next.devices.find((x) => x.id === deviceId);
    if (!d) return;
    if (!d.params) d.params = {};
    if (patch.params) {
      d.params = { ...d.params, ...patch.params };
    }
    if (patch.tag !== undefined) d.tag = patch.tag;
    if (patch.color) d.params.color = patch.color;
    if (patch.delayMs !== undefined) d.params.delayMs = patch.delayMs;
    if (patch.preset !== undefined) d.params.preset = patch.preset;
    if (patch.setpoint !== undefined) d.params.setpoint = patch.setpoint;
    if (patch.ratio !== undefined) d.params.ratio = patch.ratio;
    if (patch.primaryVolts !== undefined) d.params.primaryVolts = patch.primaryVolts;
    if (patch.secondaryVolts !== undefined) d.params.secondaryVolts = patch.secondaryVolts;
    if (patch.primaryConn !== undefined) d.params.primaryConn = patch.primaryConn;
    if (patch.secondaryConn !== undefined) d.params.secondaryConn = patch.secondaryConn;
    if (patch.supplyType !== undefined) {
      d.params.supplyType = patch.supplyType;
      if (d.kind === "mains-3ph") {
        for (const s of next.symbols) {
          if (s.deviceId === deviceId) {
            s.variant = patch.supplyType;
          }
        }
      }
    }
    if (patch.shaftWith !== undefined) d.params.shaftWith = patch.shaftWith;
    if (patch.welded !== undefined) d.params.welded = patch.welded;
    if (patch.projectName !== undefined) d.params.projectName = patch.projectName;
    if (patch.projectNo !== undefined) d.params.projectNo = patch.projectNo;
    if (patch.rev !== undefined) d.params.rev = patch.rev;
    if (patch.sheetNum !== undefined) d.params.sheetNum = patch.sheetNum;
    if (patch.sheetTotal !== undefined) d.params.sheetTotal = patch.sheetTotal;
    if (patch.description !== undefined) d.params.description = patch.description;
    if (patch.designedBy !== undefined) d.params.designedBy = patch.designedBy;
    if (patch.date !== undefined) d.params.date = patch.date;
    if (patch.scale !== undefined) d.params.scale = patch.scale;
    if (patch.text !== undefined) d.params.text = patch.text;
    if (patch.targetDeviceId !== undefined) {
      d.params.targetDeviceId = patch.targetDeviceId || undefined;
      if (patch.targetDeviceId) d.params.targetGroupId = undefined;
    }
    if (patch.targetGroupId !== undefined) {
      d.params.targetGroupId = patch.targetGroupId || undefined;
      if (patch.targetGroupId) d.params.targetDeviceId = undefined;
    }
    if (patch.fontSize !== undefined) d.params.fontSize = patch.fontSize;
    if (patch.bgColor !== undefined) d.params.bgColor = patch.bgColor;
    if (patch.borderColor !== undefined) d.params.borderColor = patch.borderColor;
    if (patch.showLeaderLine !== undefined) d.params.showLeaderLine = patch.showLeaderLine;
    if (patch.hideOnPrint !== undefined) d.params.hideOnPrint = patch.hideOnPrint;
    if (patch.hideTag !== undefined) d.params.hideTag = patch.hideTag;
    if (patch.width !== undefined) d.params.width = patch.width;
    if (patch.height !== undefined) d.params.height = patch.height;
    set({ circuit: next, isDirty: true });
    get().persistDraft();
  },

  setSymbolVariant: (symbolId, variant) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === symbolId);
    if (!sym) return;
    const oldVariant = sym.variant;
    sym.variant = variant;
    const d = next.devices.find((x) => x.id === sym.deviceId);
    if (d) {
      if (d.kind === "mains-3ph" && (variant === "wye" || variant === "delta")) {
        d.params.supplyType = variant;
      }
      // Remap terminal ports on connected wires if variant changed
      const oldTerms = KINDS[d.kind]?.variants[oldVariant]?.terminals;
      const newTerms = KINDS[d.kind]?.variants[variant]?.terminals;
      if (oldTerms && newTerms && oldTerms.length === newTerms.length) {
        const termMap = new Map<string, string>();
        for (let i = 0; i < oldTerms.length; i++) {
          termMap.set(oldTerms[i].id, newTerms[i].id);
        }
        for (const w of next.wires) {
          if (w.a.symbolId === sym.id && termMap.has(w.a.term)) {
            w.a.term = termMap.get(w.a.term)!;
          }
          if (w.b.symbolId === sym.id && termMap.has(w.b.term)) {
            w.b.term = termMap.get(w.b.term)!;
          }
        }
      }
    }
    set({
      circuit: next,
      snapshot: get().mode === "edit" ? emptySnapshot(next) : get().snapshot,
      isDirty: true,
    });
  },

  rebind: (symbolId, deviceId) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === symbolId);
    if (!sym) return;
    sym.deviceId = deviceId;
    set({ circuit: next, isDirty: true });
  },

  deleteSelected: () => {
    const { selected, selectedIds, selectedWireIds, circuit, mode } = get();
    if (selected?.type === "wire-label") {
      const parsed = parseWireLabelKey(selected.id);
      if (parsed) get().hideWireLabelInstance(parsed.wireId, parsed.t);
      return;
    }
    const wireIdsToDelete =
      selectedWireIds && selectedWireIds.length > 0
        ? selectedWireIds
        : selected?.type === "wire"
        ? [selected.id]
        : [];
    if (!selected && !selectedIds.length && !wireIdsToDelete.length) return;
    get().pushHistory();
    const next = clone(circuit);
    if (wireIdsToDelete.length > 0) {
      for (const wId of wireIdsToDelete) {
        deleteWireAndCleanJunctions(next, wId);
      }
    } else {
      const ids = new Set(selectedIds.length ? selectedIds : selected ? [selected.id] : []);
      const junctionIds: string[] = [];
      const nonJunctionIds: string[] = [];
      for (const id of ids) {
        if (isJunctionSymbol(next, id)) {
          junctionIds.push(id);
        } else {
          nonJunctionIds.push(id);
        }
      }

      if (nonJunctionIds.length > 0) {
        const nonJuncSet = new Set(nonJunctionIds);
        next.wires = next.wires.filter((w) => !nonJuncSet.has(w.a.symbolId) && !nonJuncSet.has(w.b.symbolId));
        const removed = next.symbols.filter((s) => nonJuncSet.has(s.id));
        next.symbols = next.symbols.filter((s) => !nonJuncSet.has(s.id));
        for (const sym of removed) {
          const dev = circuit.devices.find((d) => d.id === sym.deviceId);
          trackComponentDeleted(dev?.kind);
          const leftovers = next.symbols.some((s) => s.deviceId === sym.deviceId);
          if (!leftovers) next.devices = next.devices.filter((d) => d.id !== sym.deviceId);
        }
      }

      for (const jId of junctionIds) {
        if (next.symbols.some((s) => s.id === jId)) {
          removeJunction(next, jId);
          trackComponentDeleted("junction");
        }
      }

      pruneOrphanJunctions(next);
      pruneGroups(next);
    }
    set({
      circuit: next,
      snapshot: mode === "edit" ? emptySnapshot(next) : get().snapshot,
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
      isDirty: true,
    });
  },

  loadExample: async (id) => {
    // Special case: none means load blank template
    if (id === "none") {
      get().pushHistory();
      get().loadBlankTemplate(true);
      return;
    }
    
    // Try to load from JSON module first (works in both dev and GitHub Pages)
    const jsonData = await loadExampleJson(id);
    
    if (jsonData && jsonData.circuit) {
      get().pushHistory();
      sanitizeCircuitIds(jsonData.circuit);
      
      // Handle different JSON formats (some use 'title', some use 'name')
      const docName = jsonData.title || jsonData.name || id;
      trackExampleLoaded(id, docName);
      trackOpenJson({ source: "example", symbolCount: jsonData.circuit.symbols?.length, name: docName });
      
      set({
        circuit: jsonData.circuit,
        snapshot: emptySnapshot(jsonData.circuit),
        selected: null,
        selectedIds: [],
        selectedWireIds: [],
        placing: null,
        wiringFrom: null,
        timeMs: 0,
        held: [],
        running: false,
        mode: "edit",
        docName: docName,
        process: jsonData.process ? { ...defaultProcess(), ...jsonData.process } : get().process,
        isDirty: false,
      });
      return;
    }

    // Fallback to built-in examples for backward compatibility
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    get().pushHistory();
    const circuit = ex.build();
    sanitizeCircuitIds(circuit);
    set({
      circuit,
      snapshot: emptySnapshot(circuit),
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
      placing: null,
      wiringFrom: null,
      timeMs: 0,
      held: [],
      running: false,
      mode: "edit",
      docName: ex.title,
      isDirty: false,
    });
  },

  loadBlankTemplate: (skipConfirm = false) => {
    if (!skipConfirm && get().isDirty && typeof window !== "undefined") {
      const confirmDiscard = t("msg.confirmDiscard") || "Current diagram will be lost. Continue?";
      if (!window.confirm(confirmDiscard)) {
        return;
      }
    }
    const c = createBlankTemplateCircuit();
    
    get().pushHistory();
    set({
      circuit: c,
      snapshot: emptySnapshot(c),
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
      placing: null,
      wiringFrom: null,
      timeMs: 0,
      held: [],
      running: false,
      mode: "edit",
      docName: t("doc.untitled"),
      process: createBlankTemplateProcess(),
      isDirty: false,
    });
  },

  newBoard: () => {
    get().loadBlankTemplate();
  },

  undo: () => {
    const { history, circuit, future } = get();
    if (!history.length) return;
    const prev = history[history.length - 1];
    set({
      history: history.slice(0, -1),
      future: [clone(circuit), ...future],
      circuit: prev,
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
      isDirty: true,
    });
  },
  redo: () => {
    const { future, circuit, history } = get();
    if (!future.length) return;
    const nxt = future[0];
    set({
      future: future.slice(1),
      history: [...history, clone(circuit)],
      circuit: nxt,
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
      isDirty: true,
    });
  },

  loadCircuit: (circuit, name, process) => {
    sanitizeCircuitIds(circuit);
    set({
      circuit,
      snapshot: emptySnapshot(circuit),
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
      placing: null,
      wiringFrom: null,
      timeMs: 0,
      held: [],
      running: false,
      mode: "edit",
      docName: name ?? get().docName,
      process: process ?? get().process,
      isDirty: false,
    });
  },
  setDocName: (name) => set({ docName: name, isDirty: true }),
  setNotice: (notice) => set({ notice }),

  setSymbolTagOffset: (id, offset) => {
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === id);
    if (!sym) return;
    if (!offset || (Math.abs(offset.dx) < 1e-4 && Math.abs(offset.dy) < 1e-4)) {
      delete sym.tagOffset;
    } else {
      sym.tagOffset = {
        dx: Number(offset.dx.toFixed(3)),
        dy: Number(offset.dy.toFixed(3)),
      };
    }
    set({ circuit: next, isDirty: true });
  },
  resetSymbolTagOffset: (id) => {
    const circuit = get().circuit;
    const sym = circuit.symbols.find((s) => s.id === id);
    if (!sym || !sym.tagOffset) return;
    get().pushHistory();
    const next = clone(circuit);
    const target = next.symbols.find((s) => s.id === id);
    if (target) {
      delete target.tagOffset;
    }
    set({ circuit: next, isDirty: true });
  },
  setWireLabelOffset: (id, offset) => {
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    if (!offset || (Math.abs(offset.dx) < 1e-4 && Math.abs(offset.dy) < 1e-4)) {
      delete w.labelT;
      delete w.labelOffset;
    } else {
      w.labelT = 0.5; // Default to midpoint
      w.labelOffset = offset;
    }
    set({ circuit: next, isDirty: true });
  },
  resetWireLabelOffset: (id) => {
    const circuit = get().circuit;
    const w = circuit.wires.find((x) => x.id === id);
    if (!w || (w.labelT === undefined && w.labelOffset === undefined)) return;
    get().pushHistory();
    const next = clone(circuit);
    const target = next.wires.find((x) => x.id === id);
    if (target) {
      delete target.labelT;
      delete target.labelOffset;
    }
    set({ circuit: next, isDirty: true });
  },

  updateWire: (id, patch) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    Object.assign(w, patch);
    set({ circuit: next, isDirty: true });
  },
  updateConnectedWires: (wireId, patch) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const connectedIds = getConnectedWireIds(next, wireId);
    for (const id of connectedIds) {
      const w = next.wires.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
    }
    set({ circuit: next, isDirty: true });
  },
  getConnectedWireIds: (wireId) => {
    return getConnectedWireIds(get().circuit, wireId);
  },
  straightenWire: (id) => {
    const circuit = get().circuit;
    const w = circuit.wires.find((x) => x.id === id);
    if (!w || !w.jog) return;
    get().pushHistory();
    const next = clone(circuit);
    const target = next.wires.find((x) => x.id === id);
    if (target) {
      delete target.jog;
    }
    set({ circuit: next, isDirty: true });
  },
  addJunctionOnWire: (id, worldPos) => {
    if (get().mode !== "edit") return;
    const circuit = get().circuit;
    const w = circuit.wires.find((x) => x.id === id);
    if (!w) return;
    const pos = pickJunctionPositionOnWire(circuit, id, worldPos);
    if (!pos) return;
    get().pushHistory();
    const next = clone(circuit);
    const port = splitWireAt(next, id, pos.x, pos.y);
    if (!port) return;
    set({
      circuit: next,
      selected: { type: "symbol", id: port.symbolId },
      selectedIds: [port.symbolId],
      isDirty: true,
    });
  },
  addJunctionAt: (gx, gy) => {
    if (get().mode !== "edit") return;
    get().pushHistory();
    const next = clone(get().circuit);
    const jDev = {
      id: uid("dev"),
      kind: "junction" as const,
      tag: `J${next.symbols.filter((s) => isJunctionSymbol(next, s.id)).length + 1}`,
      params: {},
    };
    const jSym = {
      id: uid("sym"),
      deviceId: jDev.id,
      variant: "body",
      x: Math.round(gx),
      y: Math.round(gy),
      rot: 0 as const,
    };
    next.devices.push(jDev);
    next.symbols.push(jSym);
    set({
      circuit: next,
      selected: { type: "symbol", id: jSym.id },
      selectedIds: [jSym.id],
      isDirty: true,
    });
  },
  updateGroup: (groupId, patch) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const g = (next.groups ?? []).find((x) => x.id === groupId);
    if (!g) return;
    if (patch.color !== undefined) g.color = patch.color;
    if (patch.name !== undefined) g.name = patch.name;
    if (patch.hideOnPrint !== undefined) g.hideOnPrint = patch.hideOnPrint;
    set({ circuit: next, isDirty: true });
  },
  toggleWireBroken: (id) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    w.broken = !w.broken;
    set({ circuit: next, isDirty: true });
  },
  toggleDeviceWelded: (id) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const d = next.devices.find((x) => x.id === id);
    if (!d) return;
    d.params.welded = !d.params.welded;
    set({ circuit: next, isDirty: true });
  },
  clearFaults: () => {
    get().pushHistory();
    const next = clone(get().circuit);
    for (const w of next.wires) w.broken = false;
    for (const d of next.devices) d.params.welded = false;
    set({ circuit: next, notice: t("notice.clearedFaults"), isDirty: true });
  },

  saveToLibrary: (name) => {
    const s = get();
    const title = (name ?? s.docName).trim() || t("doc.untitled");
    const save: SavedLab = {
      id: uid("lab"),
      name: title,
      savedAt: Date.now(),
      doc: makeDoc(s.circuit, title, s.process),
    };
    putSave(save);
    trackSaveToLibrary(title);
    set({ docName: title, savesTick: s.savesTick + 1, notice: t("notice.savedDoc", { title }), isDirty: false });
  },
  loadSave: (id) => {
    const found = listSaves().find((s) => s.id === id);
    if (!found) return;
    get().pushHistory();
    trackOpenJson({ source: "local_save", symbolCount: found.doc.circuit?.symbols?.length, name: found.name });
    get().loadCircuit(found.doc.circuit, found.name, found.doc.process);
    set({ notice: t("notice.loadSave", { name: found.name }), isDirty: false });
  },
  deleteSave: (id) => {
    removeSave(id);
    set({ savesTick: get().savesTick + 1, notice: t("notice.deleteSave") });
  },
  exportFile: () => {
    const s = get();
    const name = s.docName.trim() || "elab-circuit";
    trackExportJson({
      symbolCount: s.circuit.symbols.length,
      deviceCount: s.circuit.devices.length,
      hasName: Boolean(s.docName.trim()),
    });
    downloadJson(makeDoc(s.circuit, name, s.process), `${name}.json`);
    set({ notice: t("notice.exportJson"), isDirty: false });
  },
  importDoc: (raw) => {
    const doc = parseDoc(raw);
    if (!doc) {
      set({ notice: t("msg.fileFormatError") });
      return;
    }
    trackOpenJson({
      source: "file",
      symbolCount: doc.circuit.symbols.length,
      name: doc.name,
    });
    get().pushHistory();
    get().loadCircuit(doc.circuit, doc.name ?? tOr("msg.unnamedDiagram", "Untitled Diagram"), doc.process);
    set({ notice: t("notice.importFile") });
  },
  copyShareLink: async () => {
    const s = get();
    trackShareLinkCreated({ symbolCount: s.circuit.symbols.length });
    const hash = hashFromDoc(makeDoc(s.circuit, s.docName, s.process));
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, "", hash);
    try {
      await navigator.clipboard.writeText(url);
      set({ notice: t("notice.shareCopied") });
    } catch {
      set({ notice: t("notice.shareFailed") });
    }
  },
  persistDraft: () => {
    const s = get();
    writeDraft(makeDoc(s.circuit, s.docName, s.process));
  },

  rotateSelected: (dir = 1) => {
    const { selected, selectedIds, circuit } = get();
    const ids = selectedIds.length
      ? selectedIds
      : selected?.type === "symbol"
        ? [selected.id]
        : [];
    if (!ids.length) return;
    const res = rotateSelection(circuit, ids, dir);
    if (!res || (!res.symbolUpdates.length && !res.wireJogUpdates.length)) return;

    get().pushHistory();
    const next = clone(circuit);
    for (const update of res.symbolUpdates) {
      const sym = next.symbols.find((x) => x.id === update.id);
      if (sym) {
        sym.x = update.x;
        sym.y = update.y;
        sym.rot = update.rot;
      }
    }
    for (const update of res.wireJogUpdates) {
      const w = next.wires.find((x) => x.id === update.id);
      if (w) {
        w.jog = update.jog;
      }
    }
    set({ circuit: next, isDirty: true });
  },

  autoLayout: (options) => {
    const { circuit } = get();
    if (!circuit.symbols.length) return;
    get().pushHistory();
    const next = autoLayoutCircuit(circuit, options);
    
    // Auto-label wires after layout to ensure connected wires have same label
    const labeledNext = clone(next);
    const wires = labeledNext.wires;
    const n = wires.length;
    if (n > 0) {
      const parent = Array.from({ length: n }, (_, i) => i);
      function find(i: number): number {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      }
      function union(i: number, j: number) {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) {
          parent[rootI] = rootJ;
        }
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const w1 = wires[i];
          const w2 = wires[j];
          if (
            portsEqual(w1.a, w2.a) ||
            portsEqual(w1.a, w2.b) ||
            portsEqual(w1.b, w2.a) ||
            portsEqual(w1.b, w2.b)
          ) {
            union(i, j);
          }
        }
      }

      const components = new Map<number, string>();
      let netCounter = 1;

      // Collect all existing tags and terminal labels to avoid collisions
      const reservedTags = new Set<string>();
      labeledNext.devices.forEach(d => {
        if (d.tag.trim()) reservedTags.add(d.tag.trim());
      });
      labeledNext.symbols.forEach(s => {
        const dev = labeledNext.devices.find(d => d.id === s.deviceId);
        if (dev) {
          const v = variantDef(dev.kind, s.variant);
          v.terminals.forEach(t => {
            if (t.label.trim()) reservedTags.add(t.label.trim());
          });
        }
      });

      wires.forEach((w, i) => {
        const root = find(i);
        if (!components.has(root)) {
          let label = `${netCounter++}`;
          while (reservedTags.has(label)) {
            label = `${netCounter++}`;
          }
          components.set(root, label);
        }
        w.label = components.get(root)!;
      });
    }
    
    set({
      circuit: labeledNext,
      snapshot: emptySnapshot(labeledNext),
      selected: null,
      selectedIds: [],
      selectedWireIds: [],
      isDirty: true,
      notice: t("toolbar.autoLayout") || "Auto Layout Completed",
    });
  },

  flipSelected: (axis) => {
    const { selected, selectedIds, circuit } = get();
    const ids = selectedIds.length
      ? selectedIds
      : selected?.type === "symbol"
        ? [selected.id]
        : [];
    if (!ids.length) return;
    if (selectionHasGroup(circuit, ids)) return;
    get().pushHistory();
    const next = clone(circuit);
    for (const id of ids) {
      const sym = next.symbols.find((x) => x.id === id);
      if (!sym || isJunctionSymbol(next, id)) continue;
      toggleWorldFlip(sym, axis);
    }
    set({ circuit: next, isDirty: true });
  },

  nudgeSelected: (dx, dy) => {
    const { selected, selectedIds, selectedWireIds, circuit } = get();
    const ids = selectedIds.length ? selectedIds : selected?.type === "symbol" ? [selected.id] : [];
    const wireIds = selectedWireIds.length ? selectedWireIds : selected?.type === "wire" ? [selected.id] : [];
    if (!ids.length && wireIds.length > 0) {
      get().pushHistory();
      const next = clone(circuit);
      for (const wireId of wireIds) {
        const w = next.wires.find((wire) => wire.id === wireId);
        if (!w) continue;
        const pts = wireRoute(next, w.a, w.b, w.jog);
        if (dx !== 0) {
          let curX = w.jog?.x ?? (w.jog?.axis === "x" ? w.jog.pos : undefined);
          if (curX === undefined) {
            for (let i = 0; i < pts.length - 1; i++) {
              if (Math.abs(pts[i].x - pts[i + 1].x) < 0.8 && Math.abs(pts[i].y - pts[i + 1].y) > 0.8) {
                curX = Math.round(pts[i].x / GRID) * GRID;
                break;
              }
            }
            if (curX === undefined && pts.length >= 2) {
              curX = Math.round(((pts[0].x + pts[pts.length - 1].x) / 2) / GRID) * GRID;
            }
          }
          const nextX = Math.round(((curX ?? 0) + dx * GRID) / GRID) * GRID;
          const oldY = w.jog?.y ?? (w.jog?.axis === "y" ? w.jog.pos : undefined);
          const jogObj: WireJog = {
            axis: "x",
            pos: nextX,
            x: nextX,
          };
          if (oldY !== undefined) jogObj.y = oldY;
          w.jog = jogObj;
        }
        if (dy !== 0) {
          let curY = w.jog?.y ?? (w.jog?.axis === "y" ? w.jog.pos : undefined);
          if (curY === undefined) {
            for (let i = 0; i < pts.length - 1; i++) {
              if (Math.abs(pts[i].y - pts[i + 1].y) < 0.8 && Math.abs(pts[i].x - pts[i + 1].x) > 0.8) {
                curY = Math.round(pts[i].y / GRID) * GRID;
                break;
              }
            }
            if (curY === undefined && pts.length >= 2) {
              curY = Math.round(((pts[0].y + pts[pts.length - 1].y) / 2) / GRID) * GRID;
            }
          }
          const nextY = Math.round(((curY ?? 0) + dy * GRID) / GRID) * GRID;
          const oldX = w.jog?.x ?? (w.jog?.axis === "x" ? w.jog.pos : undefined);
          const jogObj: WireJog = {
            axis: "y",
            pos: nextY,
            y: nextY,
          };
          if (oldX !== undefined) jogObj.x = oldX;
          w.jog = jogObj;
        }
      }
      set({ circuit: next, isDirty: true });
      return;
    }
    if (!ids.length) return;
    get().pushHistory();
    const next = clone(circuit);
    const movedIds = new Set(ids);
    for (const id of ids) {
      const sym = next.symbols.find((s) => s.id === id);
      if (!sym) continue;
      sym.x += dx;
      sym.y += dy;
    }
    for (const w of next.wires) {
      if (w.jog && movedIds.has(w.a.symbolId) && movedIds.has(w.b.symbolId)) {
        if (w.jog.x !== undefined) {
          w.jog.x += dx * GRID;
        }
        if (w.jog.y !== undefined) {
          w.jog.y += dy * GRID;
        }
        if (w.jog.axis === "x") {
          w.jog.pos = (w.jog.pos ?? 0) + dx * GRID;
        } else if (w.jog.axis === "y") {
          w.jog.pos = (w.jog.pos ?? 0) + dy * GRID;
        }
      }
    }
    set({ circuit: next, isDirty: true });
  },

  alignSelected: (edge) => {
    const { circuit, selected, selectedIds } = get();
    const ids = selectedIds.length ? selectedIds : selected?.type === "symbol" ? [selected.id] : [];
    if (ids.length < 2) return;
    const res = alignEntities(circuit, ids, edge);
    if (!res || (!res.symbolUpdates.length && !res.wireJogUpdates.length)) return;

    get().pushHistory();
    const next = clone(circuit);
    for (const update of res.symbolUpdates) {
      const sym = next.symbols.find((s) => s.id === update.id);
      if (sym) {
        sym.x = update.x;
        sym.y = update.y;
      }
    }
    for (const update of res.wireJogUpdates) {
      const w = next.wires.find((x) => x.id === update.id);
      if (w) {
        w.jog = update.jog;
      }
    }
    set({ circuit: next, isDirty: true });
  },

  snapSelected: () => {
    const { selected, selectedIds, selectedWireIds, circuit } = get();
    const ids = selectedIds.length ? selectedIds : selected?.type === "symbol" ? [selected.id] : [];
    const wireIds = selectedWireIds.length ? selectedWireIds : selected?.type === "wire" ? [selected.id] : [];
    if (!ids.length && !wireIds.length) return;
    get().pushHistory();
    const next = clone(circuit);
    if (!ids.length && wireIds.length > 0) {
      for (const wireId of wireIds) {
        const w = next.wires.find((x) => x.id === wireId);
        if (w?.jog) {
          if (w.jog.x !== undefined) w.jog.x = Math.round(w.jog.x / GRID) * GRID;
          if (w.jog.y !== undefined) w.jog.y = Math.round(w.jog.y / GRID) * GRID;
          if (w.jog.pos !== undefined) w.jog.pos = Math.round(w.jog.pos / GRID) * GRID;
        }
      }
      set({ circuit: next, isDirty: true });
      return;
    }
    const movedIds = new Set(ids);
    const deltas = new Map<string, { dx: number; dy: number }>();
    for (const id of ids) {
      const sym = next.symbols.find((s) => s.id === id);
      if (!sym) continue;
      const nx = Math.round(sym.x);
      const ny = Math.round(sym.y);
      deltas.set(id, { dx: nx - sym.x, dy: ny - sym.y });
      sym.x = nx;
      sym.y = ny;
    }
    for (const w of next.wires) {
      if (w.jog && movedIds.has(w.a.symbolId) && movedIds.has(w.b.symbolId)) {
        const da = deltas.get(w.a.symbolId);
        const db = deltas.get(w.b.symbolId);
        if (da && db && Math.abs(da.dx - db.dx) < 1e-4 && Math.abs(da.dy - db.dy) < 1e-4) {
          if (w.jog.x !== undefined) {
            w.jog.x = Math.round((w.jog.x + da.dx * GRID) / GRID) * GRID;
          }
          if (w.jog.y !== undefined) {
            w.jog.y = Math.round((w.jog.y + da.dy * GRID) / GRID) * GRID;
          }
          if (w.jog.axis === "x") {
            w.jog.pos = Math.round(((w.jog.x ?? w.jog.pos ?? 0) + (w.jog.x !== undefined ? 0 : da.dx * GRID)) / GRID) * GRID;
          } else if (w.jog.axis === "y") {
            w.jog.pos = Math.round(((w.jog.y ?? w.jog.pos ?? 0) + (w.jog.y !== undefined ? 0 : da.dy * GRID)) / GRID) * GRID;
          }
        }
      }
    }
    set({ circuit: next, isDirty: true });
  },

  duplicateSelected: () => {
    get().copySelected();
    get().pasteClipboard();
  },

  copySelected: () => {
    const { circuit, selected, selectedIds } = get();
    const ids = selectedIds.length
      ? selectedIds
      : selected?.type === "symbol"
        ? [selected.id]
        : [];
    if (!ids.length) return;
    const idSet = new Set(ids);
    const symbols = circuit.symbols.filter((s) => idSet.has(s.id)).map((s) => clone(s));
    const deviceIds = new Set(symbols.map((s) => s.deviceId));
    const devices = circuit.devices.filter((d) => deviceIds.has(d.id)).map((d) => clone(d));
    const wires = circuit.wires
      .filter((w) => idSet.has(w.a.symbolId) && idSet.has(w.b.symbolId))
      .map((w) => clone(w));
    const groups = (circuit.groups ?? [])
      .filter((g) => g.memberIds.length >= 2 && g.memberIds.every((id) => idSet.has(id)))
      .map((g) => clone(g));
    set({ clipboard: { devices, symbols, wires, groups }, notice: t("notice.copiedSymbols", { count: symbols.length }) });
  },

  pasteClipboard: () => {
    const { clipboard, circuit } = get();
    if (!clipboard || !clipboard.symbols.length) return;
    get().pushHistory();
    const next = clone(circuit);
    if (!next.groups) next.groups = [];
    const used = new Set<string>([
      ...next.devices.map((d) => d.id),
      ...next.symbols.map((s) => s.id),
      ...next.wires.map((w) => w.id),
      ...next.groups.map((g) => g.id),
    ]);
    const devMap = new Map<string, string>();
    const symMap = new Map<string, string>();
    for (const d of clipboard.devices) {
      const nid = uniqueId("d", used);
      devMap.set(d.id, nid);
      next.devices.push({
        ...clone(d),
        id: nid,
        tag: d.kind === "net-label" || d.kind === "junction"
          ? d.tag
          : nextTag(next.devices.map((x) => x.tag), d.tag.replace(/\d+$/, "") || d.tag),
      });
    }
    for (const s of clipboard.symbols) {
      const deviceId = devMap.get(s.deviceId);
      if (!deviceId) continue;
      const nid = uniqueId("s", used);
      symMap.set(s.id, nid);
      next.symbols.push({
        ...clone(s),
        id: nid,
        deviceId,
        x: s.x + 2,
        y: s.y + 2,
      });
    }
    for (const w of clipboard.wires) {
      const a = symMap.get(w.a.symbolId);
      const b = symMap.get(w.b.symbolId);
      if (!a || !b) continue;
      let jog: WireJog | undefined = undefined;
      if (w.jog) {
        const rx = w.jog.x !== undefined ? w.jog.x + 2 * GRID : undefined;
        const ry = w.jog.y !== undefined ? w.jog.y + 2 * GRID : undefined;
        const rpos =
          w.jog.pos !== undefined
            ? w.jog.pos + 2 * GRID
            : w.jog.axis === "y"
              ? (ry ?? 0)
              : (rx ?? 0);
        jog = {
          axis: w.jog.axis,
          pos: rpos,
          x: rx,
          y: ry,
        };
      }
      next.wires.push({
        ...clone(w),
        id: uniqueId("w", used),
        a: { symbolId: a, term: w.a.term },
        b: { symbolId: b, term: w.b.term },
        jog,
      });
    }
    const groupMap = new Map<string, string>();
    for (const g of clipboard.groups ?? []) {
      const memberIds = g.memberIds.map((id) => symMap.get(id)).filter((id): id is string => Boolean(id));
      if (memberIds.length < 2) continue;
      const nid = uniqueId("g", used);
      groupMap.set(g.id, nid);
      next.groups.push({
        id: nid,
        memberIds,
        color: g.color,
        name: g.name,
        hideOnPrint: g.hideOnPrint,
      });
    }
    for (const d of clipboard.devices) {
      const nid = devMap.get(d.id);
      if (!nid) continue;
      const nd = next.devices.find((x) => x.id === nid);
      if (!nd || nd.kind !== "comment" || !nd.params.targetGroupId) continue;
      nd.params.targetGroupId = groupMap.get(nd.params.targetGroupId);
    }
    const newIds = [...symMap.values()];
    set({
      circuit: next,
      selected: newIds.length ? { type: "symbol", id: newIds[0] } : null,
      selectedIds: newIds,
      snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
      isDirty: true,
    });
  },

  setLang: (lang) => {
    trackLangChange(lang);
    setLanguage(lang);
    set({ lang, notice: lang === "zh" ? t("notice.lang.zh") : t("notice.lang.en") });
  },

  setTheme: (theme) => {
    trackThemeChange(theme);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.theme", theme);
      }
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", theme);
      }
    } catch {}
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },

  setLayoutMode: (layoutMode) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.layoutMode", layoutMode);
      }
    } catch {}
    if (layoutMode === "ladder") {
      trackLadderView({ source: "toggle", symbolCount: get().circuit?.symbols?.length });
      get().setMode("run");
    }
    set({ layoutMode });
  },

  toggleLayoutMode: () => {
    const next = get().layoutMode === "schematic" ? "ladder" : "schematic";
    get().setLayoutMode(next);
    
    // Automatically clean up ladderRungOrder when switching to schematic mode (not needed in schematic mode)
    if (next === "schematic") {
      const current = get().circuit;
      if (current.ladderRungOrder && Array.isArray(current.ladderRungOrder)) {
        get().pushHistory();
        set({
          circuit: {
            ...clone(current),
            ladderRungOrder: undefined // Clear ladderRungOrder in schematic mode
          },
          isDirty: true
        });
      }
    }
  },

  reorderLadderRungs: (fromIndex, toIndex) => {
    const { circuit, snapshot, held, process, docName } = get();
    const model = buildLadderDiagram(circuit, snapshot, held, process, docName);
    const rungs = model.rungs;
    if (fromIndex < 0 || fromIndex >= rungs.length || toIndex < 0 || toIndex >= rungs.length) return;
    if (fromIndex === toIndex) return;

    get().pushHistory();

    const order = rungs.map((r) => r.id);
    const [movedId] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, movedId);

    const nextCircuit: Circuit = {
      ...circuit,
      ladderRungOrder: order,
    };

    set({ circuit: nextCircuit, isDirty: true });
  },

  setPaletteOpen: (open) => {
    try {
      localStorage.setItem("elab.sidebar.paletteOpen", String(open));
    } catch {}
    set({ paletteOpen: open });
  },

  setSideOpen: (open) => {
    try {
      localStorage.setItem("elab.sidebar.sideOpen", String(open));
    } catch {}
    set({ sideOpen: open });
  },

  setPaletteWidth: (width) => {
    const clamped = Math.max(MIN_PALETTE_WIDTH, Math.min(MAX_PALETTE_WIDTH, Math.round(width)));
    try {
      localStorage.setItem("elab.sidebar.paletteWidth", String(clamped));
    } catch {}
    set({ paletteWidth: clamped });
  },

  setSideWidth: (width) => {
    const clamped = Math.max(MIN_SIDE_WIDTH, Math.min(MAX_SIDE_WIDTH, Math.round(width)));
    try {
      localStorage.setItem("elab.sidebar.sideWidth", String(clamped));
    } catch {}
    set({ sideWidth: clamped });
  },

  resetPanelWidths: () => {
    try {
      localStorage.setItem("elab.sidebar.paletteWidth", String(DEFAULT_PALETTE_WIDTH));
      localStorage.setItem("elab.sidebar.sideWidth", String(DEFAULT_SIDE_WIDTH));
    } catch {}
    set({ paletteWidth: DEFAULT_PALETTE_WIDTH, sideWidth: DEFAULT_SIDE_WIDTH });
  },

  // Set whether to show ladder diagram menu
  setShowLadderMenu: (show: boolean) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.showLadderMenu", String(show));
      }
    } catch {}
    set({ showLadderMenu: show });
  },

  setShowWireLabels: (show: boolean) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.showWireLabels", String(show));
      }
    } catch {}
    set({ showWireLabels: show });
  },

  autoLabelWires: () => {
    get().pushHistory();
    const next = clone(get().circuit);
    const wires = next.wires;
    
    const n = wires.length;
    if (n === 0) {
      set({ circuit: next, isDirty: true });
      return;
    }

    // First pass: identify special nets and reserve their labels
    const reservedLabels = new Map<string, string>(); // wireId -> reserved label
    
    for (const dev of next.devices) {
      if (dev.kind === "mains-3ph") {
        // Find L1, L2, L3, N connections - these are reserved
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            for (const term of ["L1", "L2", "L3", "N"]) {
              const t = v.terminals.find(t => t.id === term);
              if (t) {
                for (const w of wires) {
                  if ((w.a.symbolId === sym.id && w.a.term === term) ||
                      (w.b.symbolId === sym.id && w.b.term === term)) {
                    switch(term) {
                      case "L1": reservedLabels.set(w.id, "90"); break;
                      case "L2": reservedLabels.set(w.id, "91"); break;
                      case "L3": reservedLabels.set(w.id, "92"); break;
                      case "N": reservedLabels.set(w.id, "93"); break;
                    }
                  }
                }
              }
            }
          }
        }
      } else if (dev.kind === "ground") {
        // PE/Ground is reserved as 0
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            // Find ground terminal (usually "1" or "PE")
            const gndTerm = v.terminals.find(t => t.id === "1" || t.id === "PE");
            if (gndTerm) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === gndTerm.id) ||
                    (w.b.symbolId === sym.id && w.b.term === gndTerm.id)) {
                  reservedLabels.set(w.id, "0");
                }
              }
            }
          }
        }
      } else if (dev.kind === "transformer") {
        // Transformer output: X1 is control circuit hot (reserved 1), X2 is return/ground (reserved 2)
        // Note: H1/H2/H3/H4 are high-voltage input and should NOT be reserved
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            // Check for X1 terminal (control circuit input) - reserved as 1
            const x1Term = v.terminals.find(t => t.id === "X1");
            if (x1Term) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === x1Term.id) ||
                    (w.b.symbolId === sym.id && w.b.term === x1Term.id)) {
                  reservedLabels.set(w.id, "1");
                }
              }
            }
            // Check for X2 terminal (return/ground line) - reserved as 2
            const x2Term = v.terminals.find(t => t.id === "X2");
            if (x2Term) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === x2Term.id) ||
                    (w.b.symbolId === sym.id && w.b.term === x2Term.id)) {
                  reservedLabels.set(w.id, "2");
                }
              }
            }
          }
        }
      } else if (dev.kind === "dc-supply") {
        // Find wires connected to + and -
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            const posTerm = v.terminals.find(t => t.id === "+" || t.id === "POS" || t.id === "1");
            const negTerm = v.terminals.find(t => t.id === "-" || t.id === "NEG" || t.id === "0V" || t.id === "2");
            
            if (posTerm) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === posTerm.id) ||
                    (w.b.symbolId === sym.id && w.b.term === posTerm.id)) {
                  reservedLabels.set(w.id, "1");
                }
              }
            }
            if (negTerm) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === negTerm.id) ||
                    (w.b.symbolId === sym.id && w.b.term === negTerm.id)) {
                  reservedLabels.set(w.id, "2");
                }
              }
            }
          }
        }
      }
    }

    // Only reserve specific terminal labels that should NOT be used as wire numbers:
    // - Power phase labels: L1, L2, L3
    // - Neutral: N
    // - Ground/Protective Earth: G, PE
    // - Transformer secondary: X1, X2
    // These are fixed standards that must not conflict with wire numbering
    const reservedTerminalLabels = new Set(["L1", "L2", "L3", "N", "G", "PE", "X1", "X2"]);
    
    const reservedTags = new Set<string>();
    next.devices.forEach(d => {
      if (d.tag.trim()) reservedTags.add(d.tag.trim());
    });
    next.symbols.forEach(s => {
      const dev = next.devices.find(d => d.id === s.deviceId);
      if (dev) {
        const v = variantDef(dev.kind, s.variant);
        v.terminals.forEach(t => {
          if (t.label.trim() && reservedTerminalLabels.has(t.label)) {
            reservedTags.add(t.label.trim());
          }
        });
      }
    });

    // Union-Find for grouping connected wires
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i: number): number {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    }
    function union(i: number, j: number) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootI] = rootJ;
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const w1 = wires[i];
        const w2 = wires[j];
        if (
          portsEqual(w1.a, w2.a) ||
          portsEqual(w1.a, w2.b) ||
          portsEqual(w1.b, w2.a) ||
          portsEqual(w1.b, w2.b)
        ) {
          union(i, j);
        }
      }
    }

    const components = new Map<number, string>();
    
    // First pass: assign reserved labels to their connected components
    const rootLabels = new Map<number, string>();
    
    for (const [wireId, label] of reservedLabels) {
      const wireIdx = wires.findIndex(w => w.id === wireId);
      if (wireIdx >= 0) {
        const root = find(wireIdx);
        if (!rootLabels.has(root)) {
          rootLabels.set(root, label);
        }
      }
    }

    // Calculate bounds for sorting by position
    // Use wire route start point (from terminalWorld) to determine reading order
    const componentBounds = new Map<number, { leftX: number; topY: number }>();
    
    wires.forEach((w, i) => {
      const root = find(i);
      if (!componentBounds.has(root)) {
        // Get wire endpoints using terminalWorld
        const a = terminalWorld(next, w.a);
        const b = terminalWorld(next, w.b);
        
        if (a && b) {
          // Use the topmost-leftmost point as the sorting anchor
          // Sort by y (top to bottom), then by x (left to right)
          let top = a, bottom = b;
          if (b.y < a.y || (b.y === a.y && b.x < a.x)) {
            top = b;
            bottom = a;
          }
          componentBounds.set(root, { leftX: top.x, topY: top.y });
        } else {
          // Fallback: use min x and y of wire route
          const pts = wireRoute(next, w.a, w.b, w.jog);
          let minX = Infinity, minY = Infinity;
          for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
          }
          componentBounds.set(root, { leftX: minX, topY: minY });
        }
      }
    });

    // Circuit type (HV vs control) is *not* the same as Union-Find nets.
    // Union-Find groups wires that share a port (same wire number). HV status
    // must also cross series power devices (DISC → CB → KM main → OL → motor)
    // without leaking through transformer secondaries or contactor coils.
    const hvWireIds = collectHvWireIds(next, wires);
    const hvNetMeta = collectHvNetMeta(next, wires, find);
    const isHVCircuitMap = new Map<number, boolean>();

    function determineCircuitType(root: number): boolean {
      if (isHVCircuitMap.has(root)) return isHVCircuitMap.get(root)!;
      let isHV = false;
      for (let i = 0; i < wires.length; i++) {
        if (find(i) === root && hvWireIds.has(wires[i].id)) {
          isHV = true;
          break;
        }
      }
      isHVCircuitMap.set(root, isHV);
      return isHV;
    }

    // Control nets: top to bottom, then left to right.
    // HV nets: by hop from the source (DISC column, then CB, then KM…),
    // then L1 / L2 / L3 — not "finish L1 all the way, then L2".
    const controlSortedRoots = Array.from(componentBounds.entries())
      .sort((a, b) => {
        if (a[1].topY !== b[1].topY) return a[1].topY - b[1].topY;
        return a[1].leftX - b[1].leftX;
      });
    const hvFallback: HvNetMeta = { phase: 99, stage: 99, onMotorPath: false };
    const hvSortedRoots = Array.from(componentBounds.keys())
      .sort((a, b) => {
        const ma = hvNetMeta.get(a) ?? hvFallback;
        const mb = hvNetMeta.get(b) ?? hvFallback;
        // Motor starter path first; transformer primary spurs after, so they
        // don't steal 10x numbers from the L1/L2/L3 columns.
        const aMain = ma.onMotorPath ? 0 : 1;
        const bMain = mb.onMotorPath ? 0 : 1;
        if (aMain !== bMain) return aMain - bMain;
        if (ma.stage !== mb.stage) return ma.stage - mb.stage;
        if (ma.phase !== mb.phase) return ma.phase - mb.phase;
        const ba = componentBounds.get(a)!;
        const bb = componentBounds.get(b)!;
        if (ba.leftX !== bb.leftX) return ba.leftX - bb.leftX;
        return ba.topY - bb.topY;
      });
    
    // Mark transformer internal jumper wires (single-phase transformers)
    // H1 and H4 are primary input terminals, H2 and H3 are tap terminals
    // Two common jumper configurations:
    //   Mode 1: H1->H3 (input to tap), H2->H4 (tap to input)
    //   Mode 2: H3->H2 (tap to tap - shorting taps together)
    // These should not get wire numbers as they are internal connections
    
    // Mark transformer jumper wires - only H1 and H4 are primary input terminals
    // For single-phase transformers:
    //   - H1 and H4 connect to mains (L1/L2/L3) - these should be numbered (HV)
    //   - H2 and H3 are tap terminals - connections to them don't need labels
    // A wire is a "transformer internal jumper" if it connects H1-H2, H1-H3, H2-H4, or H3-H4
    
    const transformerInternalJumperWireIds = new Set<string>();
    
    for (const dev of next.devices) {
      if (dev.kind === "transformer") {
        // Find all transformer symbols
        const transformerSyms = next.symbols.filter(s => s.deviceId === dev.id);
        
        for (const sym of transformerSyms) {
          const v = variantDef(dev.kind, sym.variant);
          const hasH1 = v.terminals.some(t => t.id === "H1");
          const hasH2 = v.terminals.some(t => t.id === "H2");
          const hasH3 = v.terminals.some(t => t.id === "H3");
          const hasH4 = v.terminals.some(t => t.id === "H4");
          
          // Check H1->H2 connection (input to first tap)
          if (hasH1 && hasH2) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H1" && w.b.term === "H2") ||
                  (w.a.symbolId === sym.id && w.a.term === "H2" && w.b.term === "H1") ||
                  (w.b.symbolId === sym.id && w.b.term === "H1" && w.a.term === "H2") ||
                  (w.b.symbolId === sym.id && w.b.term === "H2" && w.a.term === "H1")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
          
          // Check H1->H3 connection (input to second tap)
          if (hasH1 && hasH3) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H1" && w.b.term === "H3") ||
                  (w.a.symbolId === sym.id && w.a.term === "H3" && w.b.term === "H1") ||
                  (w.b.symbolId === sym.id && w.b.term === "H1" && w.a.term === "H3") ||
                  (w.b.symbolId === sym.id && w.b.term === "H3" && w.a.term === "H1")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
          
          // Check H2->H4 connection (first tap to input)
          if (hasH2 && hasH4) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H2" && w.b.term === "H4") ||
                  (w.a.symbolId === sym.id && w.a.term === "H4" && w.b.term === "H2") ||
                  (w.b.symbolId === sym.id && w.b.term === "H2" && w.a.term === "H4") ||
                  (w.b.symbolId === sym.id && w.b.term === "H4" && w.a.term === "H2")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
          
          // Check H3->H4 connection (second tap to input)
          if (hasH3 && hasH4) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H3" && w.b.term === "H4") ||
                  (w.a.symbolId === sym.id && w.a.term === "H4" && w.b.term === "H3") ||
                  (w.b.symbolId === sym.id && w.b.term === "H3" && w.a.term === "H4") ||
                  (w.b.symbolId === sym.id && w.b.term === "H4" && w.a.term === "H3")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
        }
      }
    }
    
    // Assign sequential labels. Reserved nets (90/91/92, X1=1, X2=2) first;
    // remaining HV nets by stage then phase; control nets along X1→coil
    // paths first, then leftover branches (lamps / alarms).
    const controlOrder = collectControlNetOrder(next, wires, find, determineCircuitType);
    let hvCounter = 100;
    let controlCounter = 1;
    const usedLabels = new Set<string>([...reservedTags, ...rootLabels.values()]);

    const assignIfNeeded = (root: number, asHv: boolean) => {
      if (components.has(root)) return;
      const reserved = rootLabels.get(root);
      if (reserved) {
        components.set(root, reserved);
        return;
      }
      if (asHv !== determineCircuitType(root)) return;
      let label = asHv ? `${hvCounter++}` : `${controlCounter++}`;
      while (usedLabels.has(label)) {
        label = asHv ? `${hvCounter++}` : `${controlCounter++}`;
      }
      usedLabels.add(label);
      components.set(root, label);
    };

    for (const root of hvSortedRoots) assignIfNeeded(root, true);
    for (const root of controlOrder) assignIfNeeded(root, false);
    for (const [root] of controlSortedRoots) assignIfNeeded(root, false);

    // Set labels for all wires
    wires.forEach((w, i) => {
      const root = find(i);
      
      // Check if this specific wire is a transformer internal jumper
      // If so, don't assign a label even if the component has one
      let isTransformerJumper = transformerInternalJumperWireIds.has(w.id);
      
      if (isTransformerJumper) {
        w.label = "";
      } else {
        w.label = components.get(root)!;
      }
    });

    set({ circuit: next, isDirty: true });
  },

  toggleShowLadderMenu: () => {
    const current = get().showLadderMenu;
    const next = !current;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.showLadderMenu", String(next));
      }
    } catch {}
    set({ showLadderMenu: next });
  },

  togglePalette: () => {
    const next = !get().paletteOpen;
    try {
      localStorage.setItem("elab.sidebar.paletteOpen", String(next));
    } catch {}
    set({ paletteOpen: next });
  },

  toggleSide: () => {
    const next = !get().sideOpen;
    try {
      localStorage.setItem("elab.sidebar.sideOpen", String(next));
    } catch {}
    set({ sideOpen: next });
  },

  setZoom: (zoom) => {
    const validZoom = Math.max(0.25, Math.min(1.5, Math.round(zoom * 100) / 100));
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.zoom", String(validZoom));
      }
    } catch {}
    set({ zoom: validZoom });
  },

  zoomIn: () => {
    const { zoom } = get();
    const next = Math.min(1.5, Math.round((zoom + 0.1) * 100) / 100);
    get().setZoom(next);
  },

  zoomOut: () => {
    const { zoom } = get();
    const prev = Math.max(0.25, Math.round((zoom - 0.1) * 100) / 100);
    get().setZoom(prev);
  },

  resetZoom: () => {
    get().setZoom(1);
  },

  zoomFit: () => {
    const { circuit, paletteOpen, sideOpen } = get();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const s of circuit.symbols) {
      const b = symbolBounds(circuit, s);
      if (b) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
      } else {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + 4);
        maxY = Math.max(maxY, s.y + 4);
      }
    }

    for (const w of circuit.wires) {
      const pA = terminalWorld(circuit, w.a);
      const pB = terminalWorld(circuit, w.b);
      if (pA) {
        minX = Math.min(minX, pA.x / GRID);
        minY = Math.min(minY, pA.y / GRID);
        maxX = Math.max(maxX, pA.x / GRID);
        maxY = Math.max(maxY, pA.y / GRID);
      }
      if (pB) {
        minX = Math.min(minX, pB.x / GRID);
        minY = Math.min(minY, pB.y / GRID);
        maxX = Math.max(maxX, pB.x / GRID);
        maxY = Math.max(maxY, pB.y / GRID);
      }
      if (w.jog) {
        const jx = w.jog.x ?? (w.jog.axis === "x" ? w.jog.pos : undefined);
        const jy = w.jog.y ?? (w.jog.axis === "y" ? w.jog.pos : undefined);
        if (jx !== undefined) {
          minX = Math.min(minX, jx / GRID);
          maxX = Math.max(maxX, jx / GRID);
        }
        if (jy !== undefined) {
          minY = Math.min(minY, jy / GRID);
          maxY = Math.max(maxY, jy / GRID);
        }
      }
    }

    const hasElements = (circuit.symbols.length > 0 || circuit.wires.length > 0) && isFinite(minX);
    const padGrid = 2;
    const contentW = hasElements ? Math.max((maxX - minX + padGrid * 2) * GRID, 400) : (COLS * GRID) * 0.4;
    const contentH = hasElements ? Math.max((maxY - minY + padGrid * 2) * GRID, 400) : (ROWS * GRID) * 0.4;

    let availW = 800;
    let availH = 600;
    const wrap = typeof document !== "undefined" ? document.querySelector<HTMLElement>(".paper-wrap") : null;

    if (wrap && wrap.clientWidth > 0 && wrap.clientHeight > 0) {
      // Direct DOM measurement of the visible area between open panels
      // Subtract margins/paddings (paper margin 12px*2 + wrap padding 12px*2 = 48px)
      availW = Math.max(wrap.clientWidth - 48, 200);
      availH = Math.max(wrap.clientHeight - 48, 200);
    } else if (typeof window !== "undefined") {
      // Fallback calculation when DOM measurement is not available
      const isDrawerMode = window.innerWidth <= 768 || (window.innerHeight <= 550 && window.innerWidth <= 1024);
      let paletteW = 0;
      let sideW = 0;
      if (!isDrawerMode) {
        if (paletteOpen) {
          paletteW = get().paletteWidth || (window.innerWidth <= 1024 ? 180 : window.innerWidth <= 1400 ? 200 : 230);
        }
        if (sideOpen) {
          sideW = get().sideWidth || (window.innerWidth <= 1024 ? 220 : window.innerWidth <= 1400 ? 240 : 270);
        }
      }
      availW = Math.max(window.innerWidth - paletteW - sideW - 60, 200);
      availH = Math.max(window.innerHeight - 100, 200);
    }

    const scale = Math.min(availW / contentW, availH / contentH);
    const fitZoom = Math.max(0.25, Math.min(1.5, Math.round(scale * 100) / 100));
    get().setZoom(fitZoom);

    // Center content in viewport after zooming
    if (wrap && hasElements) {
      try {
        const contentCenterX = ((minX + maxX) / 2) * GRID * fitZoom + 12;
        const contentCenterY = ((minY + maxY) / 2) * GRID * fitZoom + 12;
        const targetScrollLeft = Math.max(0, contentCenterX - wrap.clientWidth / 2);
        const targetScrollTop = Math.max(0, contentCenterY - wrap.clientHeight / 2);
        if (typeof wrap.scrollTo === "function") {
          setTimeout(() => {
            try {
              wrap.scrollTo({ left: targetScrollLeft, top: targetScrollTop, behavior: "smooth" });
            } catch {}
          }, 30);
        }
      } catch {}
    }
  },

  openPrint: () => set({ printOpen: true }),
  closePrint: () => set({ printOpen: false }),

  openTutorial: (version?: "pc" | "mobile") => {
    const isMobile = version
      ? version === "mobile"
      : typeof window !== "undefined" &&
        (window.innerWidth <= 768 || (window.innerHeight <= 550 && window.innerWidth <= 1024));
    set({
      tutorialOpen: true,
      tutorialStepIndex: 0,
      tutorialVersion: version || (isMobile ? "mobile" : "pc"),
    });
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.tutorial_completed", "true");
      }
    } catch {}
  },

  closeTutorial: () => {
    set({ tutorialOpen: false });
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.tutorial_completed", "true");
      }
    } catch {}
  },

  setTutorialStep: (index: number) => set({ tutorialStepIndex: Math.max(0, index) }),

  nextTutorialStep: () => {
    const { tutorialStepIndex, tutorialVersion } = get();
    const max = tutorialVersion === "mobile" ? 6 : 7;
    if (tutorialStepIndex < max) {
      set({ tutorialStepIndex: tutorialStepIndex + 1 });
    } else {
      get().closeTutorial();
    }
  },

  prevTutorialStep: () => {
    const { tutorialStepIndex } = get();
    if (tutorialStepIndex > 0) {
      set({ tutorialStepIndex: tutorialStepIndex - 1 });
    }
  },

  restartTutorial: () => {
    set({ tutorialStepIndex: 0 });
  },

  setTutorialVersion: (version: "pc" | "mobile") => {
    set({ tutorialVersion: version, tutorialStepIndex: 0 });
  },

}));

export function rotateSelected(dir: 1 | -1 = 1) {
  useLab.getState().rotateSelected(dir);
}

export function autoLayout(options?: AutoLayoutOptions) {
  useLab.getState().autoLayout(options);
}
