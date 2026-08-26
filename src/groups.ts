import { symbolBounds } from "./geometry";
import { uniqueId } from "./ids";
import type { Circuit, SymbolGroup } from "./types";

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
