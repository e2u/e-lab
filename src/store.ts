import { create } from "zustand";
import { catalogItem, suggestNetLabelTag } from "./catalog";
import { addDevice, addSymbol, addWire, emptyCircuit, isJunctionSymbol, pruneOrphanJunctions, removeJunction, splitWireAt } from "./circuitBuilder";
import { expandIds, groupSymbols, pruneGroups, selectionHasGroup, ungroupSymbols } from "./groups";
import { EXAMPLES, selfHoldMotor } from "./examples";
import { allWireRoutes, nearestOnPolyline, portsEqual, snapOnSegment, symbolBounds, toggleWorldFlip, wireHasEnds, wireRoute } from "./geometry";
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
import { GRID, type Circuit, type Lang, type Mode, type PortRef, type ProcessVars, type SimSnapshot, type WireJog } from "./types";
import { getLang as getLanguage, setLang as setLanguage, t } from "./i18n";

// Check if circuit has unsaved changes by comparing with a reference (e.g., blank template)
function hasUnsavedChanges(circuit: Circuit): boolean {
  return (
    circuit.devices.length > 0 ||
    circuit.symbols.length > 0 ||
    circuit.wires.length > 0
  );
}

function readLang(): Lang {
  return getLanguage();
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

  setMode: (mode: Mode) => void;
  setRunning: (running: boolean) => void;
  step: () => void;
  resetSim: () => void;
  setProcess: (patch: Partial<ProcessVars>) => void;
  setPlacing: (id: string | null) => void;
  setHoverPort: (port: PortRef | null) => void;
  select: (sel: Selection | null) => void;
  selectToggle: (id: string) => void;
  selectIds: (ids: string[], additive?: boolean) => void;
  selectAll: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  rotateSelected: (dir?: 1 | -1) => void;
  flipSelected: (axis: "h" | "v") => void;
  nudgeSelected: (dx: number, dy: number) => void;
  alignSelected: (edge: "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter") => void;
  snapSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  placeAt: (x: number, y: number) => void;
  moveSymbol: (id: string, x: number, y: number) => void;
  moveGroup: (updates: { id: string; x: number; y: number }[]) => void;
  clickPort: (port: PortRef) => void;
  connectToWire: (wireId: string, world: { x: number; y: number }) => void;
  setWireJog: (id: string, jog: WireJog) => void;
  pointerDevice: (deviceId: string, down: boolean) => void;
  toggleIo: (deviceId: string, field: "on" | "tripped" | "actuated" | "prime") => void;
  cyclePosition: (deviceId: string) => void;
  updateDevice: (deviceId: string, patch: { tag?: string; color?: string; delayMs?: number; preset?: number; setpoint?: number; ratio?: string; primaryVolts?: string; secondaryVolts?: string; primaryConn?: "delta" | "wye"; secondaryConn?: "delta" | "wye"; shaftWith?: string; welded?: boolean }) => void;
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

const boot = startupDoc(selfHoldMotor, "接觸器自鎖起動");
sanitizeCircuitIds(boot.circuit);

export const useLab = create<LabState>((set, get) => ({
  circuit: boot.circuit,
  snapshot: emptySnapshot(boot.circuit),
  mode: "edit",
  running: false,
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
  docName: boot.name,
  notice: null,
  savesTick: 0,
  lang: readLang(),

  pushHistory: () => {
    const { history, circuit } = get();
    set({ history: [...history.slice(-40), clone(circuit)], future: [] });
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
    });
  },
  setRunning: (running) => set({ running }),
  step: () => {
    const s = get();
    const snap = tick(
      s.circuit,
      s.snapshot.runtime,
      { held: new Set(s.held), process: s.process },
      50,
      s.timeMs + 50,
    );
    set({ snapshot: snap, timeMs: s.timeMs + 50 });
  },
  resetSim: () => {
    const { circuit } = get();
    set({
      snapshot: emptySnapshot(circuit),
      timeMs: 0,
      held: [],
    });
  },
  setProcess: (patch) => set({ process: { ...get().process, ...patch } }),
  setPlacing: (id) => set({ placing: id, wiringFrom: null, selected: null, selectedIds: [] }),
  setHoverPort: (port) => set({ hoverPort: port }),
  select: (sel) => {
    if (!sel || sel.type !== "symbol") {
      set({ selected: sel, selectedIds: [], placing: null, wiringFrom: null });
      return;
    }
    set({
      selected: sel,
      selectedIds: expandIds(get().circuit, [sel.id]),
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
      notice: `已編成一組（${g.memberIds.length}）`,
    });
  },
  ungroupSelected: () => {
    const { circuit, selectedIds } = get();
    if (!selectionHasGroup(circuit, selectedIds)) return;
    get().pushHistory();
    const next = clone(circuit);
    ungroupSymbols(next, selectedIds);
    set({ circuit: next, notice: "已打散" });
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

  placeAt: (x, y) => {
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
          {},
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
        snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
      });
      return;
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
      item.kind === "lamp" ? { color: "green" } : item.kind === "timer-on" || item.kind === "timer-off" ? { delayMs: 2000 } : item.kind === "temp-no" || item.kind === "temp-nc" ? { setpoint: 60 } : item.kind === "transformer" ? { ratio: "480/120" } : {},
      item.defaultRot ?? 0,
    );
    set({
      circuit: next,
      selected: { type: "symbol", id: created.symbol.id },
      selectedIds: [created.symbol.id],
      snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
    });
  },

  moveSymbol: (id, x, y) => {
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === id);
    if (!sym) return;
    sym.x = x;
    sym.y = y;
    set({ circuit: next });
  },
  moveGroup: (updates) => {
    const next = clone(get().circuit);
    for (const u of updates) {
      const sym = next.symbols.find((s) => s.id === u.id);
      if (sym) {
        sym.x = u.x;
        sym.y = u.y;
      }
    }
    set({ circuit: next });
  },

  setWireJog: (id, jog) => {
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    w.jog = jog;
    set({ circuit: next });
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
    set({ circuit: next, wiringFrom: null });
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
    set({ circuit: next, wiringFrom: null });
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

  updateDevice: (deviceId, patch: {
    tag?: string;
    color?: string;
    delayMs?: number;
    preset?: number;
    setpoint?: number;
    ratio?: string;
    primaryVolts?: string;
    secondaryVolts?: string;
    primaryConn?: "delta" | "wye";
    secondaryConn?: "delta" | "wye";
    shaftWith?: string;
    welded?: boolean;
  }) => {
    const next = clone(get().circuit);
    const d = next.devices.find((x) => x.id === deviceId);
    if (!d) return;
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
    if (patch.shaftWith !== undefined) d.params.shaftWith = patch.shaftWith;
    if (patch.welded !== undefined) d.params.welded = patch.welded;
    set({ circuit: next });
  },

  rebind: (symbolId, deviceId) => {
    const next = clone(get().circuit);
    const sym = next.symbols.find((s) => s.id === symbolId);
    if (!sym) return;
    sym.deviceId = deviceId;
    set({ circuit: next });
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
    set({ circuit: next, selected: null, selectedIds: [] });
  },

  loadExample: async (id) => {
    // First try to load from JSON file with cache-buster
    try {
      const response = await fetch(`/src/examples/${id}.json?v=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.circuit) {
          get().pushHistory();
          sanitizeCircuitIds(data.circuit);
          set({
            circuit: data.circuit,
            snapshot: emptySnapshot(data.circuit),
            selected: null,
            selectedIds: [],
            placing: null,
            wiringFrom: null,
            timeMs: 0,
            held: [],
            running: false,
            mode: "edit",
            docName: data.title || id,
          });
          return;
        }
      }
    } catch (e) {
      // Fall back to built-in examples
    }

    // Fallback to built-in examples
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
    });
  },

  loadBlankTemplate: () => {
    // Default blank template with power distribution using net labels and isolator
    const c = emptyCircuit();
    
    // Add mains-3ph device at position (0, 0)
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    
    // Add isolator at position (6, 1)
    const iso = addDevice(c, "isolator", "Main Disconnect Breaker", "body", 6, 1);
    
    // Add net-label devices for power distribution
    const nlL1 = addDevice(c, "net-label", "L1", "body", 13, 2);
    const nlL2 = addDevice(c, "net-label", "L2", "body", 13, 4);
    const nlL3 = addDevice(c, "net-label", "L3", "body", 13, 6);
    const nlN = addDevice(c, "net-label", "N", "body", 6, 10);
    const nlPE = addDevice(c, "net-label", "G", "body", 6, 13); // G for Ground
    
    // Connect power to isolator
    addWire(c, g.symbol, "L1", iso.symbol, "L1");
    addWire(c, g.symbol, "L2", iso.symbol, "L2");
    addWire(c, g.symbol, "L3", iso.symbol, "L3");
    
    // Connect isolator output to net labels
    addWire(c, iso.symbol, "T1", nlL1.symbol, "1");
    addWire(c, iso.symbol, "T2", nlL2.symbol, "1");
    addWire(c, iso.symbol, "T3", nlL3.symbol, "1");
    
    // Connect N and PE directly to net labels
    addWire(c, g.symbol, "N", nlN.symbol, "1");
    addWire(c, g.symbol, "PE", nlPE.symbol, "1");
    
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
      docName: "未命名圖紙",
    });
  },

  newBoard: () => {
    if (hasUnsavedChanges(get().circuit)) {
      const confirmDiscard = t("msg.confirmDiscard") || "Current diagram will be lost. Continue?";
      if (!window.confirm(confirmDiscard)) {
        return; // User cancelled
      }
    }
    useLab.getState().loadBlankTemplate(true); // Skip confirm in loadBlankTemplate since we already confirmed
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
    });
  },
  setDocName: (name) => set({ docName: name }),
  setNotice: (notice) => set({ notice }),

  updateWire: (id, patch) => {
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    if (patch.label !== undefined) w.label = patch.label;
    set({ circuit: next });
  },
  toggleWireBroken: (id) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const w = next.wires.find((x) => x.id === id);
    if (!w) return;
    w.broken = !w.broken;
    set({ circuit: next });
  },
  toggleDeviceWelded: (id) => {
    get().pushHistory();
    const next = clone(get().circuit);
    const d = next.devices.find((x) => x.id === id);
    if (!d) return;
    d.params.welded = !d.params.welded;
    set({ circuit: next });
  },
  clearFaults: () => {
    get().pushHistory();
    const next = clone(get().circuit);
    for (const w of next.wires) w.broken = false;
    for (const d of next.devices) d.params.welded = false;
    set({ circuit: next, notice: "已清除全部故障" });
  },

  saveToLibrary: (name) => {
    const s = get();
    const title = (name ?? s.docName).trim() || "未命名圖紙";
    const save: SavedLab = {
      id: uid("lab"),
      name: title,
      savedAt: Date.now(),
      doc: makeDoc(s.circuit, title, s.process),
    };
    putSave(save);
    set({ docName: title, savesTick: s.savesTick + 1, notice: `已存檔「${title}」` });
  },
  loadSave: (id) => {
    const found = listSaves().find((s) => s.id === id);
    if (!found) return;
    get().pushHistory();
    get().loadCircuit(found.doc.circuit, found.name, found.doc.process);
    set({ notice: `已開啟「${found.name}」` });
  },
  deleteSave: (id) => {
    removeSave(id);
    set({ savesTick: get().savesTick + 1, notice: "已刪除存檔" });
  },
  exportFile: () => {
    const s = get();
    const name = s.docName.trim() || "elab-circuit";
    downloadJson(makeDoc(s.circuit, name, s.process), `${name}.json`);
    set({ notice: "已匯出 JSON" });
  },
  importDoc: (raw) => {
    const doc = parseDoc(raw);
    if (!doc) {
      set({ notice: "檔案格式不正確" });
      return;
    }
    get().pushHistory();
    get().loadCircuit(doc.circuit, doc.name ?? "匯入圖紙", doc.process);
    set({ notice: "已匯入圖紙" });
  },
  copyShareLink: async () => {
    const s = get();
    const hash = hashFromDoc(makeDoc(s.circuit, s.docName, s.process));
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, "", hash);
    try {
      await navigator.clipboard.writeText(url);
      set({ notice: "分享連結已複製" });
    } catch {
      set({ notice: "已寫入網址列，請手動複製" });
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
    get().pushHistory();
    const next = clone(circuit);
    for (const id of ids) {
      const sym = next.symbols.find((x) => x.id === id);
      if (!sym || isJunctionSymbol(next, id)) continue;
      const step = dir === 1 ? 90 : 270;
      sym.rot = ((sym.rot + step) % 360) as 0 | 90 | 180 | 270;
    }
    set({ circuit: next });
  },

  flipSelected: (axis) => {
    const { selected, selectedIds, circuit } = get();
    const ids = selectedIds.length
      ? selectedIds
      : selected?.type === "symbol"
        ? [selected.id]
        : [];
    if (!ids.length) return;
    get().pushHistory();
    const next = clone(circuit);
    for (const id of ids) {
      const sym = next.symbols.find((x) => x.id === id);
      if (!sym || isJunctionSymbol(next, id)) continue;
      toggleWorldFlip(sym, axis);
    }
    set({ circuit: next });
  },

  nudgeSelected: (dx, dy) => {
    const ids = get().selectedIds;
    if (!ids.length) return;
    get().pushHistory();
    const next = clone(get().circuit);
    for (const id of ids) {
      const sym = next.symbols.find((s) => s.id === id);
      if (!sym) continue;
      sym.x += dx;
      sym.y += dy;
    }
    set({ circuit: next });
  },

  alignSelected: (edge) => {
    const { circuit, selectedIds } = get();
    if (selectedIds.length < 2) return;
    const boxes = selectedIds
      .map((id) => {
        const sym = circuit.symbols.find((s) => s.id === id);
        if (!sym) return null;
        const b = symbolBounds(circuit, sym);
        return b ? { id, ...b } : null;
      })
      .filter((b): b is { id: string; x: number; y: number; w: number; h: number } => b !== null);
    if (boxes.length < 2) return;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxR = Math.max(...boxes.map((b) => b.x + b.w));
    const maxB = Math.max(...boxes.map((b) => b.y + b.h));
    const midX = (minX + maxR) / 2;
    const midY = (minY + maxB) / 2;
    get().pushHistory();
    const next = clone(circuit);
    for (const box of boxes) {
      const sym = next.symbols.find((s) => s.id === box.id);
      if (!sym) continue;
      if (edge === "left") sym.x = minX;
      if (edge === "right") sym.x = maxR - box.w;
      if (edge === "top") sym.y = minY;
      if (edge === "bottom") sym.y = maxB - box.h;
      if (edge === "hcenter") sym.x = Math.round(midX - box.w / 2);
      if (edge === "vcenter") sym.y = Math.round(midY - box.h / 2);
    }
    set({ circuit: next });
  },

  snapSelected: () => {
    const ids = get().selectedIds;
    if (!ids.length) return;
    get().pushHistory();
    const next = clone(get().circuit);
    for (const id of ids) {
      const sym = next.symbols.find((s) => s.id === id);
      if (!sym) continue;
      sym.x = Math.round(sym.x);
      sym.y = Math.round(sym.y);
    }
    set({ circuit: next });
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
    set({ clipboard: { devices, symbols, wires, groups }, notice: `已複製 ${symbols.length} 個元件` });
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
      next.wires.push({
        ...clone(w),
        id: uniqueId("w", used),
        a: { symbolId: a, term: w.a.term },
        b: { symbolId: b, term: w.b.term },
      });
    }
    for (const g of clipboard.groups ?? []) {
      const memberIds = g.memberIds.map((id) => symMap.get(id)).filter((id): id is string => Boolean(id));
      if (memberIds.length < 2) continue;
      next.groups.push({ id: uniqueId("g", used), memberIds });
    }
    const newIds = [...symMap.values()];
    set({
      circuit: next,
      selected: newIds.length ? { type: "symbol", id: newIds[0] } : null,
      selectedIds: newIds,
      snapshot: { ...get().snapshot, runtime: mergeRuntime(next, get().snapshot.runtime) },
    });
  },

  setLang: (lang) => {
    setLanguage(lang);
    set({ lang, notice: lang === "zh" ? t("notice.lang.zh") : t("notice.lang.en") });
  },

}));

export function rotateSelected(dir: 1 | -1 = 1) {
  useLab.getState().rotateSelected(dir);
}
