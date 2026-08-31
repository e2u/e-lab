import { symbolBounds, symbolSize } from "./geometry";
import { uniqueId } from "./ids";
import { GRID, type Circuit, type Rot, type SymbolGroup, type WireJog } from "./types";

export function circuitGroups(circuit: Circuit): SymbolGroup[] {
  if (!circuit.groups) circuit.groups = [];
  return circuit.groups;
}

export function findInternalJunctions(circuit: Circuit, ids: string[]): string[] {
  const set = new Set(ids);
  const junctions = circuit.symbols.filter((s) => {
    if (set.has(s.id)) return false;
    const dev = circuit.devices.find((d) => d.id === s.deviceId);
    return dev?.kind === "junction";
  });
  if (!junctions.length) return [];

  const outsideNonJunctions = new Set(
    circuit.symbols
      .filter((s) => {
        if (set.has(s.id)) return false;
        const dev = circuit.devices.find((d) => d.id === s.deviceId);
        return dev?.kind !== "junction";
      })
      .map((s) => s.id),
  );

  const adj = new Map<string, string[]>();
  for (const w of circuit.wires) {
    if (!adj.has(w.a.symbolId)) adj.set(w.a.symbolId, []);
    if (!adj.has(w.b.symbolId)) adj.set(w.b.symbolId, []);
    adj.get(w.a.symbolId)!.push(w.b.symbolId);
    adj.get(w.b.symbolId)!.push(w.a.symbolId);
  }

  const visitedFromOutside = new Set<string>();
  const queue: string[] = [...outsideNonJunctions];
  for (const q of queue) visitedFromOutside.add(q);

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const neighbors = adj.get(cur) ?? [];
    for (const n of neighbors) {
      if (!set.has(n) && !visitedFromOutside.has(n)) {
        visitedFromOutside.add(n);
        queue.push(n);
      }
    }
  }

  const reachableFromSet = new Set<string>();
  const setQueue: string[] = [...set];
  for (const q of setQueue) reachableFromSet.add(q);
  let setHead = 0;
  while (setHead < setQueue.length) {
    const cur = setQueue[setHead++];
    const neighbors = adj.get(cur) ?? [];
    for (const n of neighbors) {
      if (!visitedFromOutside.has(n) && !reachableFromSet.has(n)) {
        reachableFromSet.add(n);
        setQueue.push(n);
      }
    }
  }

  const internalJunctionIds: string[] = [];
  for (const j of junctions) {
    if (!visitedFromOutside.has(j.id) && reachableFromSet.has(j.id)) {
      internalJunctionIds.push(j.id);
    }
  }

  return internalJunctionIds;
}

export function expandIds(circuit: Circuit, ids: string[]): string[] {
  const want = new Set(ids);
  const live = new Set(circuit.symbols.map((s) => s.id));
  for (const g of circuit.groups ?? []) {
    if (g.memberIds.some((id) => want.has(id))) {
      for (const id of g.memberIds) {
        if (live.has(id)) want.add(id);
      }
    }
  }
  const currentMembers = circuit.symbols.map((s) => s.id).filter((id) => want.has(id));
  const internalJunctions = findInternalJunctions(circuit, currentMembers);
  for (const jid of internalJunctions) {
    want.add(jid);
  }
  return circuit.symbols.map((s) => s.id).filter((id) => want.has(id));
}

export function groupOf(circuit: Circuit, symbolId: string): SymbolGroup | undefined {
  return (circuit.groups ?? []).find((g) => g.memberIds.includes(symbolId));
}

/** True if the current selection is exactly one persisted group. */
export function selectionIsGroup(circuit: Circuit, ids: string[]): SymbolGroup | null {
  if (ids.length < 2) return null;
  const set = new Set(ids);
  for (const g of circuit.groups ?? []) {
    if (g.memberIds.length === ids.length && g.memberIds.every((id) => set.has(id))) return g;
  }
  return null;
}

export function selectionHasGroup(circuit: Circuit, ids: string[]): boolean {
  return ids.some((id) => Boolean(groupOf(circuit, id)));
}

export function groupSymbols(
  circuit: Circuit,
  ids: string[],
  color?: string,
  name?: string,
): SymbolGroup | null {
  const members = expandIds(circuit, ids);
  if (members.length < 2) return null;
  circuit.groups = (circuit.groups ?? []).filter((g) => !g.memberIds.some((id) => members.includes(id)));
  const used = new Set<string>([
    ...circuit.devices.map((d) => d.id),
    ...circuit.symbols.map((s) => s.id),
    ...circuit.wires.map((w) => w.id),
    ...circuitGroups(circuit).map((g) => g.id),
  ]);
  const g: SymbolGroup = { id: uniqueId("g", used), memberIds: members, color, name };
  circuitGroups(circuit).push(g);
  return g;
}

export function ungroupSymbols(circuit: Circuit, ids: string[]): void {
  const hit = new Set(expandIds(circuit, ids));
  circuit.groups = (circuit.groups ?? []).filter((g) => !g.memberIds.some((id) => hit.has(id)));
}

export function pruneGroups(circuit: Circuit): void {
  const live = new Set(circuit.symbols.map((s) => s.id));
  circuit.groups = (circuit.groups ?? [])
    .map((g) => ({ ...g, memberIds: g.memberIds.filter((id) => live.has(id)) }))
    .filter((g) => g.memberIds.length >= 2);
}

export function boxesIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function symbolsInRect(
  circuit: Circuit,
  rect: { x: number; y: number; w: number; h: number },
): string[] {
  const ids: string[] = [];
  for (const s of circuit.symbols) {
    const b = symbolBounds(circuit, s);
    const box = b && b.w > 0.05 && b.h > 0.05 ? b : { x: s.x - 0.5, y: s.y - 0.5, w: 1, h: 1 };
    if (boxesIntersect(rect, box)) ids.push(s.id);
  }
  return expandIds(circuit, ids);
}

export function unionBounds(
  circuit: Circuit,
  ids: string[],
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const s = circuit.symbols.find((x) => x.id === id);
    if (!s) continue;
    const b = symbolBounds(circuit, s) ?? { x: s.x, y: s.y, w: 1, h: 1 };
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

export function alignEntities(
  circuit: Circuit,
  selectedIds: string[],
  edge: "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter" | "distribute-h" | "distribute-v",
): { symbolUpdates: { id: string; x: number; y: number }[]; wireJogUpdates: { id: string; jog: WireJog }[] } | null {
  if (selectedIds.length < 2) return null;
  const groups = circuit.groups ?? [];
  const handled = new Set<string>();

  type Entity =
    | { type: "group"; group: SymbolGroup; symbolIds: string[]; box: { x: number; y: number; w: number; h: number } }
    | { type: "symbol"; symbolId: string; box: { x: number; y: number; w: number; h: number } };

  const entities: Entity[] = [];

  for (const id of selectedIds) {
    if (handled.has(id)) continue;
    const g = groups.find((grp) => grp.memberIds.includes(id));
    if (g) {
      const allMembers = expandIds(circuit, g.memberIds);
      for (const m of allMembers) handled.add(m);
      const box = unionBounds(circuit, allMembers);
      if (box) {
        entities.push({ type: "group", group: g, symbolIds: allMembers, box });
      }
    } else {
      handled.add(id);
      const sym = circuit.symbols.find((s) => s.id === id);
      if (sym) {
        const box = symbolBounds(circuit, sym) ?? { x: sym.x, y: sym.y, w: 1, h: 1 };
        entities.push({ type: "symbol", symbolId: id, box });
      }
    }
  }

  if (entities.length < 2) return null;

  const symbolUpdates: { id: string; x: number; y: number }[] = [];
  const wireJogUpdates: { id: string; jog: WireJog }[] = [];
  const updatedWires = new Set<string>();

  if (edge === "distribute-h") {
    const sorted = [...entities].sort((a, b) => (a.box.x !== b.box.x ? a.box.x - b.box.x : a.box.y - b.box.y));
    const gap = Math.max(0, sorted[1].box.x - (sorted[0].box.x + sorted[0].box.w));
    let currentRight = sorted[0].box.x + sorted[0].box.w;

    for (let i = 1; i < sorted.length; i++) {
      const entity = sorted[i];
      const targetX = currentRight + gap;
      const dx = targetX - entity.box.x;
      currentRight = targetX + entity.box.w;

      if (Math.abs(dx) < 0.0001) continue;

      if (entity.type === "symbol") {
        const sym = circuit.symbols.find((s) => s.id === entity.symbolId);
        if (sym) {
          symbolUpdates.push({ id: sym.id, x: sym.x + dx, y: sym.y });
        }
      } else {
        const memberSet = new Set(entity.symbolIds);
        for (const symId of entity.symbolIds) {
          const sym = circuit.symbols.find((s) => s.id === symId);
          if (sym) {
            symbolUpdates.push({ id: sym.id, x: sym.x + dx, y: sym.y });
          }
        }
        for (const w of circuit.wires) {
          if (w.jog && memberSet.has(w.a.symbolId) && memberSet.has(w.b.symbolId) && !updatedWires.has(w.id)) {
            updatedWires.add(w.id);
            const jogCopy: WireJog = { ...w.jog };
            if (jogCopy.x !== undefined) jogCopy.x += dx * GRID;
            if (jogCopy.axis === "x") jogCopy.pos = (jogCopy.pos ?? 0) + dx * GRID;
            wireJogUpdates.push({ id: w.id, jog: jogCopy });
          }
        }
      }
    }

    return { symbolUpdates, wireJogUpdates };
  }

  if (edge === "distribute-v") {
    const sorted = [...entities].sort((a, b) => (a.box.y !== b.box.y ? a.box.y - b.box.y : a.box.x - b.box.x));
    const gap = Math.max(0, sorted[1].box.y - (sorted[0].box.y + sorted[0].box.h));
    let currentBottom = sorted[0].box.y + sorted[0].box.h;

    for (let i = 1; i < sorted.length; i++) {
      const entity = sorted[i];
      const targetY = currentBottom + gap;
      const dy = targetY - entity.box.y;
      currentBottom = targetY + entity.box.h;

      if (Math.abs(dy) < 0.0001) continue;

      if (entity.type === "symbol") {
        const sym = circuit.symbols.find((s) => s.id === entity.symbolId);
        if (sym) {
          symbolUpdates.push({ id: sym.id, x: sym.x, y: sym.y + dy });
        }
      } else {
        const memberSet = new Set(entity.symbolIds);
        for (const symId of entity.symbolIds) {
          const sym = circuit.symbols.find((s) => s.id === symId);
          if (sym) {
            symbolUpdates.push({ id: sym.id, x: sym.x, y: sym.y + dy });
          }
        }
        for (const w of circuit.wires) {
          if (w.jog && memberSet.has(w.a.symbolId) && memberSet.has(w.b.symbolId) && !updatedWires.has(w.id)) {
            updatedWires.add(w.id);
            const jogCopy: WireJog = { ...w.jog };
            if (jogCopy.y !== undefined) jogCopy.y += dy * GRID;
            if (jogCopy.axis === "y") jogCopy.pos = (jogCopy.pos ?? 0) + dy * GRID;
            wireJogUpdates.push({ id: w.id, jog: jogCopy });
          }
        }
      }
    }

    return { symbolUpdates, wireJogUpdates };
  }

  const minX = Math.min(...entities.map((e) => e.box.x));
  const minY = Math.min(...entities.map((e) => e.box.y));
  const maxR = Math.max(...entities.map((e) => e.box.x + e.box.w));
  const maxB = Math.max(...entities.map((e) => e.box.y + e.box.h));
  const midX = (minX + maxR) / 2;
  const midY = (minY + maxB) / 2;

  // For horizontal alignments (left/right/hcenter), sort by Y and ensure entities do not vertically overlap
  if (edge === "left" || edge === "right" || edge === "hcenter") {
    const sorted = [...entities].sort((a, b) => (a.box.y !== b.box.y ? a.box.y - b.box.y : a.box.x - b.box.x));
    let prevBottom = -Infinity;

    for (const entity of sorted) {
      let targetX = minX;
      if (edge === "right") targetX = maxR - entity.box.w;
      if (edge === "hcenter") targetX = Math.round(midX - entity.box.w / 2);

      const targetY = Math.max(entity.box.y, prevBottom);
      prevBottom = targetY + entity.box.h;

      const dx = targetX - entity.box.x;
      const dy = targetY - entity.box.y;

      if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) continue;

      if (entity.type === "symbol") {
        const sym = circuit.symbols.find((s) => s.id === entity.symbolId);
        if (sym) {
          symbolUpdates.push({ id: sym.id, x: sym.x + dx, y: sym.y + dy });
        }
      } else {
        const memberSet = new Set(entity.symbolIds);
        for (const symId of entity.symbolIds) {
          const sym = circuit.symbols.find((s) => s.id === symId);
          if (sym) {
            symbolUpdates.push({ id: sym.id, x: sym.x + dx, y: sym.y + dy });
          }
        }
        for (const w of circuit.wires) {
          if (w.jog && memberSet.has(w.a.symbolId) && memberSet.has(w.b.symbolId) && !updatedWires.has(w.id)) {
            updatedWires.add(w.id);
            const jogCopy: WireJog = { ...w.jog };
            if (jogCopy.x !== undefined && Math.abs(dx) > 0.0001) jogCopy.x += dx * GRID;
            if (jogCopy.y !== undefined && Math.abs(dy) > 0.0001) jogCopy.y += dy * GRID;
            if (jogCopy.axis === "x" && Math.abs(dx) > 0.0001) jogCopy.pos = (jogCopy.pos ?? 0) + dx * GRID;
            if (jogCopy.axis === "y" && Math.abs(dy) > 0.0001) jogCopy.pos = (jogCopy.pos ?? 0) + dy * GRID;
            wireJogUpdates.push({ id: w.id, jog: jogCopy });
          }
        }
      }
    }

    return { symbolUpdates, wireJogUpdates };
  }

  // For vertical alignments (top/bottom/vcenter), sort by X and ensure entities do not horizontally overlap
  if (edge === "top" || edge === "bottom" || edge === "vcenter") {
    const sorted = [...entities].sort((a, b) => (a.box.x !== b.box.x ? a.box.x - b.box.x : a.box.y - b.box.y));
    let prevRight = -Infinity;

    for (const entity of sorted) {
      let targetY = minY;
      if (edge === "bottom") targetY = maxB - entity.box.h;
      if (edge === "vcenter") targetY = Math.round(midY - entity.box.h / 2);

      const targetX = Math.max(entity.box.x, prevRight);
      prevRight = targetX + entity.box.w;

      const dx = targetX - entity.box.x;
      const dy = targetY - entity.box.y;

      if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) continue;

      if (entity.type === "symbol") {
        const sym = circuit.symbols.find((s) => s.id === entity.symbolId);
        if (sym) {
          symbolUpdates.push({ id: sym.id, x: sym.x + dx, y: sym.y + dy });
        }
      } else {
        const memberSet = new Set(entity.symbolIds);
        for (const symId of entity.symbolIds) {
          const sym = circuit.symbols.find((s) => s.id === symId);
          if (sym) {
            symbolUpdates.push({ id: sym.id, x: sym.x + dx, y: sym.y + dy });
          }
        }
        for (const w of circuit.wires) {
          if (w.jog && memberSet.has(w.a.symbolId) && memberSet.has(w.b.symbolId) && !updatedWires.has(w.id)) {
            updatedWires.add(w.id);
            const jogCopy: WireJog = { ...w.jog };
            if (jogCopy.x !== undefined && Math.abs(dx) > 0.0001) jogCopy.x += dx * GRID;
            if (jogCopy.y !== undefined && Math.abs(dy) > 0.0001) jogCopy.y += dy * GRID;
            if (jogCopy.axis === "x" && Math.abs(dx) > 0.0001) jogCopy.pos = (jogCopy.pos ?? 0) + dx * GRID;
            if (jogCopy.axis === "y" && Math.abs(dy) > 0.0001) jogCopy.pos = (jogCopy.pos ?? 0) + dy * GRID;
            wireJogUpdates.push({ id: w.id, jog: jogCopy });
          }
        }
      }
    }

    return { symbolUpdates, wireJogUpdates };
  }

  return { symbolUpdates, wireJogUpdates };
}

export function rotateSelection(
  circuit: Circuit,
  selectedIds: string[],
  dir: 1 | -1 = 1,
): { symbolUpdates: { id: string; x: number; y: number; rot: Rot }[]; wireJogUpdates: { id: string; jog: WireJog }[] } | null {
  if (!selectedIds.length) return null;
  const groups = circuit.groups ?? [];
  const handled = new Set<string>();

  type Entity =
    | { type: "group"; group: SymbolGroup; symbolIds: string[]; box: { x: number; y: number; w: number; h: number } }
    | { type: "symbol"; symbolId: string };

  const entities: Entity[] = [];

  for (const id of selectedIds) {
    if (handled.has(id)) continue;
    const g = groups.find((grp) => grp.memberIds.includes(id));
    if (g) {
      const allMembers = expandIds(circuit, g.memberIds);
      for (const m of allMembers) handled.add(m);
      const box = unionBounds(circuit, allMembers);
      if (box) {
        entities.push({ type: "group", group: g, symbolIds: allMembers, box });
      }
    } else {
      handled.add(id);
      entities.push({ type: "symbol", symbolId: id });
    }
  }

  const symbolUpdates: { id: string; x: number; y: number; rot: Rot }[] = [];
  const wireJogUpdates: { id: string; jog: WireJog }[] = [];
  const step = dir === 1 ? 90 : 270;

  for (const entity of entities) {
    if (entity.type === "symbol") {
      const sym = circuit.symbols.find((s) => s.id === entity.symbolId);
      if (!sym) continue;
      const dev = circuit.devices.find((d) => d.id === sym.deviceId);
      const isJunction = dev?.kind === "junction";
      const newRot = isJunction ? sym.rot : (((sym.rot + step) % 360) as Rot);
      symbolUpdates.push({ id: sym.id, x: sym.x, y: sym.y, rot: newRot });
    } else {
      const { box, symbolIds } = entity;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const memberSet = new Set(symbolIds);

      for (const symId of symbolIds) {
        const sym = circuit.symbols.find((s) => s.id === symId);
        if (!sym) continue;
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        const kind = dev?.kind ?? "lamp";
        const isJunction = kind === "junction";
        const sizeBefore = symbolSize(sym, kind, dev?.params);
        const scx = sym.x + sizeBefore.w / 2;
        const scy = sym.y + sizeBefore.h / 2;

        let scxNew = cx;
        let scyNew = cy;
        if (dir === 1) {
          scxNew = cx - (scy - cy);
          scyNew = cy + (scx - cx);
        } else {
          scxNew = cx + (scy - cy);
          scyNew = cy - (scx - cx);
        }

        const newRot = isJunction ? sym.rot : (((sym.rot + step) % 360) as Rot);
        const symTemp = { ...sym, rot: newRot };
        const sizeAfter = symbolSize(symTemp, kind, dev?.params);

        const newX = Math.round((scxNew - sizeAfter.w / 2) * 16) / 16;
        const newY = Math.round((scyNew - sizeAfter.h / 2) * 16) / 16;
        symbolUpdates.push({ id: sym.id, x: newX, y: newY, rot: newRot });
      }

      const cxPx = cx * GRID;
      const cyPx = cy * GRID;
      for (const w of circuit.wires) {
        if (w.jog && memberSet.has(w.a.symbolId) && memberSet.has(w.b.symbolId)) {
          const oldX = w.jog.x ?? (w.jog.axis === "x" ? w.jog.pos : undefined);
          const oldY = w.jog.y ?? (w.jog.axis === "y" ? w.jog.pos : undefined);
          let newX: number | undefined;
          let newY: number | undefined;
          if (oldX !== undefined) {
            newY = dir === 1 ? cyPx + (oldX - cxPx) : cyPx - (oldX - cxPx);
          }
          if (oldY !== undefined) {
            newX = dir === 1 ? cxPx - (oldY - cyPx) : cxPx + (oldY - cyPx);
          }
          const jogObj: WireJog = {
            axis: w.jog.axis === "x" ? "y" : "x",
            pos: w.jog.axis === "x" ? (newY ?? 0) : (newX ?? 0),
          };
          if (newX !== undefined) jogObj.x = newX;
          if (newY !== undefined) jogObj.y = newY;
          wireJogUpdates.push({ id: w.id, jog: jogObj });
        }
      }
    }
  }

  return { symbolUpdates, wireJogUpdates };
}
