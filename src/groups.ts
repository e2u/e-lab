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
  edge: "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter",
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

  const minX = Math.min(...entities.map((e) => e.box.x));
  const minY = Math.min(...entities.map((e) => e.box.y));
  const maxR = Math.max(...entities.map((e) => e.box.x + e.box.w));
  const maxB = Math.max(...entities.map((e) => e.box.y + e.box.h));
  const midX = (minX + maxR) / 2;
  const midY = (minY + maxB) / 2;

  const symbolUpdates: { id: string; x: number; y: number }[] = [];
  const wireJogUpdates: { id: string; jog: WireJog }[] = [];
  const updatedWires = new Set<string>();

  for (const entity of entities) {
    let dx = 0;
    let dy = 0;
    if (edge === "left") dx = minX - entity.box.x;
    if (edge === "right") dx = maxR - entity.box.w - entity.box.x;
    if (edge === "top") dy = minY - entity.box.y;
    if (edge === "bottom") dy = maxB - entity.box.h - entity.box.y;
    if (edge === "hcenter") dx = Math.round(midX - entity.box.w / 2) - entity.box.x;
    if (edge === "vcenter") dy = Math.round(midY - entity.box.h / 2) - entity.box.y;

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
          const newPos = w.jog.axis === "x" ? w.jog.pos + dx * GRID : w.jog.pos + dy * GRID;
          wireJogUpdates.push({ id: w.id, jog: { axis: w.jog.axis, pos: newPos } });
        }
      }
    }
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
        const sizeBefore = symbolSize(sym, kind);
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
        const sizeAfter = symbolSize(symTemp, kind);

        const newX = Math.round((scxNew - sizeAfter.w / 2) * 16) / 16;
        const newY = Math.round((scyNew - sizeAfter.h / 2) * 16) / 16;
        symbolUpdates.push({ id: sym.id, x: newX, y: newY, rot: newRot });
      }

      const cxPx = cx * GRID;
      const cyPx = cy * GRID;
      for (const w of circuit.wires) {
        if (w.jog && memberSet.has(w.a.symbolId) && memberSet.has(w.b.symbolId)) {
          if (dir === 1) {
            if (w.jog.axis === "x") {
              wireJogUpdates.push({ id: w.id, jog: { axis: "y", pos: cyPx + (w.jog.pos - cxPx) } });
            } else {
              wireJogUpdates.push({ id: w.id, jog: { axis: "x", pos: cxPx - (w.jog.pos - cyPx) } });
            }
          } else {
            if (w.jog.axis === "x") {
              wireJogUpdates.push({ id: w.id, jog: { axis: "y", pos: cyPx - (w.jog.pos - cxPx) } });
            } else {
              wireJogUpdates.push({ id: w.id, jog: { axis: "x", pos: cxPx + (w.jog.pos - cyPx) } });
            }
          }
        }
      }
    }
  }

  return { symbolUpdates, wireJogUpdates };
}
