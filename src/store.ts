import { create } from "zustand";
import { catalogItem, suggestNetLabelTag } from "./catalog";
import { addDevice, addSymbol, isJunctionSymbol, pruneOrphanJunctions, removeJunction, splitWireAt } from "./circuitBuilder";
import { loadExampleJson } from "./examples/index";
import templateData from "./examples/blank-template.json";
import { alignEntities, expandIds, groupSymbols, pruneGroups, rotateSelection, selectionHasGroup, ungroupSymbols } from "./groups";
import { EXAMPLES } from "./examples";
import { allWireRoutes, findWireAtPoint, nearestOnPolyline, portsEqual, snapOnSegment, symbolBounds, terminalWorld, toggleWorldFlip, wireHasEnds, wireRoute } from "./geometry";
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
import { emptySnapshot, tick } from "./sim/engine";
import { buildLadderDiagram } from "./ladder/ladderLayout";
import { GRID, COLS, ROWS, type Circuit, type DeviceParams, type Lang, type LayoutMode, type MeterDataPoint, type Mode, type PortRef, type ProcessVars, type SimSnapshot, type Theme, type WireJog } from "./types";
import {getLang as getLanguage, setLang as setLanguage, t, tOr} from "./i18n";

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
  return "schematic";  // 默認返回 schematic
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

function readSidebarState(): { paletteOpen: boolean; sideOpen: boolean } {
  if (typeof localStorage === "undefined") return { paletteOpen: true, sideOpen: true };
  try {
    const p = localStorage.getItem("elab.sidebar.paletteOpen");
    const s = localStorage.getItem("elab.sidebar.sideOpen");
    return {
      paletteOpen: p !== null ? p === "true" : true,
      sideOpen: s !== null ? s === "true" : true,
    };
  } catch {
    return { paletteOpen: true, sideOpen: true };
  }
}

// ✅ 新增：檢查是否顯示梯形圖菜單的設置
function readShowLadderMenu(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const val = localStorage.getItem("elab.showLadderMenu");
    // 預設顯示（true），只有明確設定為 false 才隱藏
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export interface Selection {
  type: "symbol" | "wire";
  id: string;
}

export interface LabState {
  circuit: Circuit;
  snapshot: SimSnapshot;
  mode: Mode;
  running: boolean;
  held: string[];
  process: ProcessVars;
  selected: Selection | null;
  selectedIds: string[];
  clipboard: Circuit | null;
  placing: string | null;
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
  showLadderMenu: boolean;  // ✅ 新增：控制是否顯示梯形圖菜單
  isDirty: boolean;
  paletteOpen: boolean;
  sideOpen: boolean;
  zoom: number;
  printOpen: boolean;
  tutorialOpen: boolean;
  tutorialStepIndex: number;
  tutorialVersion: "pc" | "mobile";
  meterHistory: Record<string, MeterDataPoint[]>;

  setMode: (mode: Mode) => void;
  setRunning: (running: boolean) => void;
  step: () => void;
  resetSim: () => void;
  setProcess: (patch: Partial<ProcessVars>) => void;
  setPlacing: (id: string | null) => void;
  setHoverPort: (port: PortRef | null) => void;
  select: (sel: Selection | null, isolate?: boolean) => void;
  selectToggle: (id: string) => void;
  selectIds: (ids: string[], additive?: boolean) => void;
  selectAll: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  rotateSelected: (dir?: 1 | -1) => void;
  flipSelected: (axis: "h" | "v") => void;
  nudgeSelected: (dx: number, dy: number) => void;
  alignSelected: (edge: "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter" | "distribute-h" | "distribute-v") => void;
  snapSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  placeAt: (x: number, y: number, extraParams?: Partial<DeviceParams>) => void;
  quickAttachClampMeter: (wireId: string) => void;
  moveSymbol: (id: string, x: number, y: number) => void;
  moveGroup: (
    updates: { id: string; x: number; y: number }[],
    wireUpdates?: { id: string; jog: WireJog }[],
  ) => void;
  clickPort: (port: PortRef) => void;
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
  updateWire: (id: string, patch: { label?: string }) => void;
  updateGroup: (groupId: string, patch: { color?: string; name?: string }) => void;
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
  togglePalette: () => void;
  toggleSide: () => void;
  setShowLadderMenu: (show: boolean) => void;
  toggleShowLadderMenu: () => void;
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
  temperature: 25,
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
  running: initialLayoutMode === "ladder",
  held: [],
  process: boot.process ?? defaultProcess(),
  selected: null,
  selectedIds: [],
  clipboard: null,
  placing: null,
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
  showLadderMenu: readShowLadderMenu(),  // ✅ 新增：控制是否顯示梯形圖菜單
  isDirty: false,
  paletteOpen: sidebarBoot.paletteOpen,
  sideOpen: sidebarBoot.sideOpen,
  zoom: readZoom(),
  printOpen: false,
  tutorialOpen: false,
  tutorialStepIndex: 0,
  tutorialVersion: "pc",
  meterHistory: {},

  pushHistory: () => {
    const { history, circuit } = get();
    
    // 當切換布局模式或執行某些操作時，確保 ladderRungOrder 與 rung ID 同步
    const normalizedCircuit = { ...circuit };
    if (normalizedCircuit.ladderRungOrder && Array.isArray(normalizedCircuit.ladderRungOrder)) {
      // 過濾掉不存在於 circuit 中的 rung IDs（防止舊 ID 殘留）
      const existingDeviceIds = new Set([
        ...circuit.symbols.map(s => s.deviceId),
        ...circuit.devices.map(d => d.id)
      ]);
      
      normalizedCircuit.ladderRungOrder = normalizedCircuit.ladderRungOrder.filter(id => {
        if (!id.startsWith("rung_")) return false;
        
        // 提取 device id 從 rung_id
        const parts = id.split("_");
        if (parts.length < 2) return true;  // 保留未知格式
        
        const deviceId = parts[1];
        return existingDeviceIds.has(deviceId);
      });
    }
    
    set({ history: [...history.slice(-40), clone(normalizedCircuit)], future: [] });
  },

  setMode: (mode) => {
    const { circuit } = get();
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
  setRunning: (running) => set({ running }),
  step: () => {
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
  setProcess: (patch) => set({ process: { ...get().process, ...patch } }),
  setPlacing: (id) => set({ placing: id, wiringFrom: null, selected: null, selectedIds: [] }),
  setHoverPort: (port) => set({ hoverPort: port }),
  select: (sel, isolate = false) => {
    if (!sel || sel.type !== "symbol") {
      set({ selected: sel, selectedIds: [], placing: null, wiringFrom: null });
      return;
    }
    set({
      selected: sel,
      selectedIds: isolate ? [sel.id] : expandIds(get().circuit, [sel.id]),
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
      placing: null,
      wiringFrom: null,
    });
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
      placing: null,
      wiringFrom: null,
    });
  },

  placeAt: (x, y, extraParams) => {
    const { placing, circuit, selected } = get();
    if (!placing) return;
    const item = catalogItem(placing);
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
          item.defaultRot ?? 0,
        );
        host = created.device.id;
      } else {
        addSymbol(next, host, item.variant, gx, gy, item.defaultRot ?? 0);
      }
      const placed = next.symbols[next.symbols.length - 1];
      set({
        circuit: next,
        selected: { type: "symbol", id: placed.id },
        selectedIds: [placed.id],
        placing: null, // 放置一個元件後回到佈線模式
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
          : item.kind === "temp-no" || item.kind === "temp-nc"
            ? { setpoint: 60 }
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
      item.defaultRot ?? 0,
    );
    set({
      circuit: next,
      selected: { type: "symbol", id: created.symbol.id },
      selectedIds: [created.symbol.id],
      placing: null, // 放置一個元件後回到佈線模式
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

  moveSymbol: (id, x, y) => {
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === id);
    if (!sym) return;
    sym.x = x;
    sym.y = y;
    const dev = next.devices.find((d) => d.id === sym.deviceId);
    if (dev && dev.kind === "ammeter") {
      const detected = findWireAtPoint(next, (x + 2) * GRID, (y + 2) * GRID, GRID * 2.5);
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
        deltas.set(u.id, { dx: u.x - sym.x, dy: u.y - sym.y });
        sym.x = u.x;
        sym.y = u.y;
        const dev = next.devices.find((d) => d.id === sym.deviceId);
        if (dev && dev.kind === "ammeter") {
          const detected = findWireAtPoint(next, (u.x + 2) * GRID, (u.y + 2) * GRID, GRID * 2.5);
          dev.params = { ...dev.params, clampedWireId: detected?.id };
        }
      }
    }
    if (wireUpdates && wireUpdates.length > 0) {
      for (const wu of wireUpdates) {
        const w = next.wires.find((x) => x.id === wu.id);
        if (w) w.jog = wu.jog;
      }
    } else {
      for (const w of next.wires) {
        if (w.jog && movedIds.has(w.a.symbolId) && movedIds.has(w.b.symbolId)) {
          const da = deltas.get(w.a.symbolId);
          const db = deltas.get(w.b.symbolId);
          if (da && db && Math.abs(da.dx - db.dx) < 1e-4 && Math.abs(da.dy - db.dy) < 1e-4) {
            if (w.jog.axis === "x") {
              w.jog.pos += da.dx * GRID;
            } else if (w.jog.axis === "y") {
              w.jog.pos += da.dy * GRID;
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
    w.jog = jog;
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

  connectToWire: (wireId, world) => {
    if (get().mode !== "edit") return;
    const from = get().wiringFrom;
    if (!from) return;
    const circuit = get().circuit;
    const w = circuit.wires.find((item) => item.id === wireId);
    if (!w) return;
    const pts = allWireRoutes(circuit).get(wireId) ?? wireRoute(circuit, w.a, w.b, w.jog);
    const near = nearestOnPolyline(pts, world);
    if (!near || near.d > 14) return;
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
    if (dev.kind === "pb-no" || dev.kind === "pb-nc" || dev.kind === "foot" || dev.kind === "foot-no" || dev.kind === "foot-nc") {
      const held = new Set(get().held);
      if (down) held.add(deviceId);
      else held.delete(deviceId);
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
    const runtime = { ...get().snapshot.runtime };
    const rt = { ...(runtime[deviceId] ?? emptySnapshot(get().circuit).runtime[deviceId]) };
    if (field === "on") rt.on = !rt.on;
    if (field === "tripped") rt.tripped = !rt.tripped;
    if (field === "actuated") rt.actuated = !rt.actuated;
    runtime[deviceId] = rt;
    set({ snapshot: { ...get().snapshot, runtime } });
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
    set({ circuit: next, isDirty: true });
  },

  setSymbolVariant: (symbolId, variant) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === symbolId);
    if (!sym) return;
    sym.variant = variant;
    const d = next.devices.find((x) => x.id === sym.deviceId);
    if (d && d.kind === "mains-3ph" && (variant === "wye" || variant === "delta")) {
      d.params.supplyType = variant;
    }
    set({ circuit: next, isDirty: true });
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
    const { selected, selectedIds, circuit } = get();
    if (!selected && !selectedIds.length) return;
    get().pushHistory();
    const next = clone(circuit);
    if (selected?.type === "wire") {
      next.wires = next.wires.filter((w) => w.id !== selected.id);
      pruneOrphanJunctions(next);
    } else {
      const ids = new Set(selectedIds.length ? selectedIds : selected ? [selected.id] : []);
      const onlyJunction =
        ids.size === 1 && [...ids].every((id) => isJunctionSymbol(next, id));
      if (onlyJunction) {
        removeJunction(next, [...ids][0]);
      } else {
        next.wires = next.wires.filter((w) => !ids.has(w.a.symbolId) && !ids.has(w.b.symbolId));
        const removed = next.symbols.filter((s) => ids.has(s.id));
        next.symbols = next.symbols.filter((s) => !ids.has(s.id));
        for (const sym of removed) {
          const leftovers = next.symbols.some((s) => s.deviceId === sym.deviceId);
          if (!leftovers) next.devices = next.devices.filter((d) => d.id !== sym.deviceId);
        }
        pruneOrphanJunctions(next);
      }
      pruneGroups(next);
    }
    set({ circuit: next, selected: null, selectedIds: [], isDirty: true });
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
      
      set({
        circuit: jsonData.circuit,
        snapshot: emptySnapshot(jsonData.circuit),
        selected: null,
        selectedIds: [],
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
    if (!skipConfirm && get().isDirty) {
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

  updateWire: (id, patch) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    if (patch.label !== undefined) w.label = patch.label;
    set({ circuit: next, isDirty: true });
  },
  updateGroup: (groupId, patch) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const g = (next.groups ?? []).find((x) => x.id === groupId);
    if (!g) return;
    if (patch.color !== undefined) g.color = patch.color;
    if (patch.name !== undefined) g.name = patch.name;
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
    set({ docName: title, savesTick: s.savesTick + 1, notice: t("notice.savedDoc", { title }), isDirty: false });
  },
  loadSave: (id) => {
    const found = listSaves().find((s) => s.id === id);
    if (!found) return;
    get().pushHistory();
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
    downloadJson(makeDoc(s.circuit, name, s.process), `${name}.json`);
    set({ notice: t("notice.exportJson"), isDirty: false });
  },
  importDoc: (raw) => {
    const doc = parseDoc(raw);
    if (!doc) {
      set({ notice: t("msg.fileFormatError") });
      return;
    }
    get().pushHistory();
    get().loadCircuit(doc.circuit, doc.name ?? tOr("msg.unnamedDiagram", "Untitled Diagram"), doc.process);
    set({ notice: t("notice.importFile") });
  },
  copyShareLink: async () => {
    const s = get();
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
    const ids = get().selectedIds;
    if (!ids.length) return;
    get().pushHistory();
    const next = clone(get().circuit);
    const movedIds = new Set(ids);
    for (const id of ids) {
      const sym = next.symbols.find((s) => s.id === id);
      if (!sym) continue;
      sym.x += dx;
      sym.y += dy;
    }
    for (const w of next.wires) {
      if (w.jog && movedIds.has(w.a.symbolId) && movedIds.has(w.b.symbolId)) {
        if (w.jog.axis === "x") {
          w.jog.pos += dx * GRID;
        } else if (w.jog.axis === "y") {
          w.jog.pos += dy * GRID;
        }
      }
    }
    set({ circuit: next, isDirty: true });
  },

  alignSelected: (edge) => {
    const { circuit, selectedIds } = get();
    if (selectedIds.length < 2) return;
    const res = alignEntities(circuit, selectedIds, edge);
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
    const ids = get().selectedIds;
    if (!ids.length) return;
    get().pushHistory();
    const next = clone(get().circuit);
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
          if (w.jog.axis === "x") {
            w.jog.pos += da.dx * GRID;
          } else if (w.jog.axis === "y") {
            w.jog.pos += da.dy * GRID;
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
      const jog = w.jog
        ? {
            axis: w.jog.axis,
            pos: w.jog.axis === "x" ? w.jog.pos + 2 * GRID : w.jog.pos + 2 * GRID,
          }
        : undefined;
      next.wires.push({
        ...clone(w),
        id: uniqueId("w", used),
        a: { symbolId: a, term: w.a.term },
        b: { symbolId: b, term: w.b.term },
        jog,
      });
    }
    for (const g of clipboard.groups ?? []) {
      const memberIds = g.memberIds.map((id) => symMap.get(id)).filter((id): id is string => Boolean(id));
      if (memberIds.length < 2) continue;
      next.groups.push({
        id: uniqueId("g", used),
        memberIds,
        color: g.color,
        name: g.name,
      });
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
    setLanguage(lang);
    set({ lang, notice: lang === "zh" ? t("notice.lang.zh") : t("notice.lang.en") });
  },

  setTheme: (theme) => {
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
      get().setMode("run");
    }
    set({ layoutMode });
  },

  toggleLayoutMode: () => {
    const next = get().layoutMode === "schematic" ? "ladder" : "schematic";
    get().setLayoutMode(next);
    
    // ✅ 切換到 schematic 模式時自動清理 ladderRungOrder（因為 schematic mode 不需要它）
    if (next === "schematic") {
      const current = get().circuit;
      if (current.ladderRungOrder && Array.isArray(current.ladderRungOrder)) {
        get().pushHistory();
        set({
          circuit: {
            ...clone(current),
            ladderRungOrder: undefined  // 清除 ladderRungOrder 在 schematic mode
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

  // ✅ 新增：設置是否顯示梯形圖菜單
  setShowLadderMenu: (show: boolean) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("elab.showLadderMenu", String(show));
      }
    } catch {}
    set({ showLadderMenu: show });
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
        if (w.jog.axis === "x") {
          minX = Math.min(minX, w.jog.pos / GRID);
          maxX = Math.max(maxX, w.jog.pos / GRID);
        } else {
          minY = Math.min(minY, w.jog.pos / GRID);
          maxY = Math.max(maxY, w.jog.pos / GRID);
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
          paletteW = window.innerWidth <= 1024 ? 180 : window.innerWidth <= 1400 ? 200 : 230;
        }
        if (sideOpen) {
          sideW = window.innerWidth <= 1024 ? 220 : window.innerWidth <= 1400 ? 240 : 270;
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
