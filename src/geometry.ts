import { variantDef } from "./catalog";
import { GRID, type Circuit, type PortRef, type Rot, type SymbolInst, type WireJog } from "./types";

export function rotatePoint(
  x: number,
  y: number,
  w: number,
  h: number,
  rot: Rot,
): { x: number; y: number } {
  switch (rot) {
    case 0:
      return { x, y };
    case 90:
      return { x: h - y, y: x };
    case 180:
      return { x: w - x, y: h - y };
    case 270:
      return { x: y, y: w - x };
  }
}

export function symbolSize(sym: SymbolInst, kind: Circuit["devices"][0]["kind"]): {
  w: number;
  h: number;
} {
  const v = variantDef(kind, sym.variant);
  if (sym.rot === 90 || sym.rot === 270) return { w: v.h, h: v.w };
  return { w: v.w, h: v.h };
}

export function symbolBounds(
  circuit: Circuit,
  sym: SymbolInst,
): { x: number; y: number; w: number; h: number } | null {
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return null;
  const size = symbolSize(sym, dev.kind);
  return { x: sym.x, y: sym.y, w: size.w, h: size.h };
}

export function applyFlip(
  x: number,
  y: number,
  w: number,
  h: number,
  flipX?: boolean,
  flipY?: boolean,
): { x: number; y: number } {
  return {
    x: flipX ? w - x : x,
    y: flipY ? h - y : y,
  };
}

export function terminalWorld(
  circuit: Circuit,
  ref: PortRef,
): { x: number; y: number } | null {
  const sym = circuit.symbols.find((s) => s.id === ref.symbolId);
  if (!sym) return null;
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return null;
  const v = variantDef(dev.kind, sym.variant);
  const term = v.terminals.find((t) => t.id === ref.term);
  if (!term) return null;
  const flipped = applyFlip(term.x, term.y, v.w, v.h, sym.flipX, sym.flipY);
  const p = rotatePoint(flipped.x, flipped.y, v.w, v.h, sym.rot);
  return { x: (sym.x + p.x) * GRID, y: (sym.y + p.y) * GRID };
}

export const STUB = GRID / 4;

export function manhattan(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number }[] {
  if (a.x === b.x || a.y === b.y) return [a, b];
  const mid = { x: a.x, y: b.y };
  return [a, mid, b];
}

function rotateDir(dx: number, dy: number, rot: Rot): { x: number; y: number } {
  switch (rot) {
    case 0:
      return { x: dx, y: dy };
    case 90:
      return { x: -dy, y: dx };
    case 180:
      return { x: -dx, y: -dy };
    case 270:
      return { x: dy, y: -dx };
  }
}

/** Unit outward direction of a terminal, in world pixels. */
export function terminalOutward(
  circuit: Circuit,
  ref: PortRef,
): { x: number; y: number } {
  const sym = circuit.symbols.find((s) => s.id === ref.symbolId);
  if (!sym) return { x: 1, y: 0 };
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return { x: 1, y: 0 };
  const v = variantDef(dev.kind, sym.variant);
  const term = v.terminals.find((t) => t.id === ref.term);
  if (!term) return { x: 1, y: 0 };
  const p = applyFlip(term.x, term.y, v.w, v.h, sym.flipX, sym.flipY);
  const dl = p.x;
  const dr = v.w - p.x;
  const dt = p.y;
  const db = v.h - p.y;
  const nearest = Math.min(dl, dr, dt, db);
  let local = { x: 0, y: 1 };
  if (nearest === dl) local = { x: -1, y: 0 };
  else if (nearest === dr) local = { x: 1, y: 0 };
  else if (nearest === dt) local = { x: 0, y: -1 };
  else local = { x: 0, y: 1 };
  return rotateDir(local.x, local.y, sym.rot);
}

function append(
  pts: { x: number; y: number }[],
  p: { x: number; y: number },
): void {
  const last = pts[pts.length - 1];
  if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) return;
  pts.push(p);
}

function isPortRef(value: PortRef | { x: number; y: number }): value is PortRef {
  return "symbolId" in value && "term" in value;
}

function betweenStubs(
  a1: { x: number; y: number },
  b1: { x: number; y: number },
  jog?: WireJog,
): { x: number; y: number }[] {
  if (jog?.axis === "y") {
    return [a1, { x: a1.x, y: jog.pos }, { x: b1.x, y: jog.pos }, b1];
  }
  if (jog?.axis === "x") {
    return [a1, { x: jog.pos, y: a1.y }, { x: jog.pos, y: b1.y }, b1];
  }
  return manhattan(a1, b1);
}

export function portKind(circuit: Circuit, ref: PortRef): string | null {
  const sym = circuit.symbols.find((s) => s.id === ref.symbolId);
  if (!sym) return null;
  return circuit.devices.find((d) => d.id === sym.deviceId)?.kind ?? null;
}

function stubLen(circuit: Circuit, ref: PortRef): number {
  const kind = portKind(circuit, ref);
  if (kind === "junction" || kind === "net-label") return 0;
  return STUB;
}

/** Orthogonal route that leaves each terminal in a straight stub before any 90° bend. */
export function wireRoute(
  circuit: Circuit,
  from: PortRef,
  to: PortRef | { x: number; y: number },
  jog?: WireJog,
): { x: number; y: number }[] {
  const a = terminalWorld(circuit, from);
  if (!a) return [];
  const oa = terminalOutward(circuit, from);
  const sa = stubLen(circuit, from);
  const a1 = { x: a.x + oa.x * sa, y: a.y + oa.y * sa };
  const pts: { x: number; y: number }[] = [];
  append(pts, a);
  append(pts, a1);
  if (isPortRef(to)) {
    const b = terminalWorld(circuit, to);
    if (!b) return pts;
    const ob = terminalOutward(circuit, to);
    const sb = stubLen(circuit, to);
    const b1 = { x: b.x + ob.x * sb, y: b.y + ob.y * sb };
    for (const p of betweenStubs(a1, b1, jog).slice(1)) append(pts, p);
    append(pts, b);
    return pts;
  }
  for (const p of manhattan(a1, to).slice(1)) append(pts, p);
  return pts;
}

export const WIRE_LANE = 8;

type Pt = { x: number; y: number };

function overlapSpan(a0: number, a1: number, b0: number, b1: number): number {
  const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  return hi - lo;
}

interface Occ {
  id: string;
  i: number;
  axis: "x" | "y";
  fixed: number;
  lo: number;
  hi: number;
}

function skipDeviceStub(circuit: Circuit, w: { a: PortRef; b: PortRef }, pts: Pt[], i: number): boolean {
  if (pts.length < 3) return false;
  if (i !== 0 && i !== pts.length - 2) return false;
  const ref = i === 0 ? w.a : w.b;
  const kind = portKind(circuit, ref);
  if (kind === "junction" || kind === "net-label") return false;
  const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return len <= STUB + 2;
}

function collectOcc(circuit: Circuit, id: string, w: { a: PortRef; b: PortRef }, pts: Pt[]): Occ[] {
  const out: Occ[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (skipDeviceStub(circuit, w, pts, i)) continue;
    const axis = segmentAxis(pts[i], pts[i + 1]);
    if (!axis) continue;
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < GRID * 0.4) continue;
    if (axis === "y") out.push({ id, i, axis, fixed: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
    else out.push({ id, i, axis, fixed: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
  }
  return out;
}

function overlapComponents(group: Occ[]): Occ[][] {
  const n = group.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (overlapSpan(group[i].lo, group[i].hi, group[j].lo, group[j].hi) >= GRID * 0.45) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }
  const seen = new Set<number>();
  const comps: Occ[][] = [];
  for (let i = 0; i < n; i += 1) {
    if (seen.has(i)) continue;
    const stack = [i];
    const comp: Occ[] = [];
    seen.add(i);
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(group[u]);
      for (const v of adj[u]) {
        if (seen.has(v)) continue;
        seen.add(v);
        stack.push(v);
      }
    }
    comps.push(comp);
  }
  return comps;
}

function colorLanes(comp: Occ[]): Map<string, number> {
  const sorted = [...comp].sort((a, b) => a.lo - b.lo || a.id.localeCompare(b.id));
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const o of sorted) {
    let lane = laneEnds.findIndex((end) => o.lo >= end - 0.5);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(o.hi);
    } else {
      laneEnds[lane] = Math.max(laneEnds[lane], o.hi);
    }
    lanes.set(`${o.id}:${o.i}`, lane);
  }
  return lanes;
}

/** Routes every wire, then nudges overlapping parallel runs apart. Terminals stay put. */
export function allWireRoutes(circuit: Circuit): Map<string, Pt[]> {
  const base = new Map<string, Pt[]>();
  const byId = new Map<string, { a: PortRef; b: PortRef }>();
  for (const w of circuit.wires) {
    base.set(w.id, wireRoute(circuit, w.a, w.b, w.jog));
    byId.set(w.id, w);
  }
  const occs: Occ[] = [];
  for (const [id, pts] of base) {
    const w = byId.get(id)!;
    occs.push(...collectOcc(circuit, id, w, pts));
  }
  const clusters = new Map<string, Occ[]>();
  for (const o of occs) {
    const key = `${o.axis}:${Math.round(o.fixed)}`;
    const list = clusters.get(key) ?? [];
    list.push(o);
    clusters.set(key, list);
  }
  const shift = new Map<string, number>();
  for (const group of clusters.values()) {
    if (group.length < 2) continue;
    for (const comp of overlapComponents(group)) {
      if (comp.length < 2) continue;
      const lanes = colorLanes(comp);
      const n = 1 + Math.max(0, ...lanes.values());
      if (n < 2) continue;
      for (const o of comp) {
        const lane = lanes.get(`${o.id}:${o.i}`) ?? 0;
        const d = (lane - (n - 1) / 2) * WIRE_LANE;
        if (Math.abs(d) > 0.5) shift.set(`${o.id}:${o.i}`, d);
      }
    }
  }
  const out = new Map<string, Pt[]>();
  for (const [id, pts] of base) {
    if (!pts.length) {
      out.set(id, pts);
      continue;
    }
    const rebuilt: Pt[] = [{ x: pts[0].x, y: pts[0].y }];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const A = pts[i];
      const B = pts[i + 1];
      const d = shift.get(`${id}:${i}`) ?? 0;
      if (Math.abs(d) < 0.5) {
        rebuilt.push({ x: B.x, y: B.y });
        continue;
      }
      const axis = segmentAxis(A, B);
      const ox = axis === "x" ? d : 0;
      const oy = axis === "y" ? d : 0;
      rebuilt.push({ x: A.x + ox, y: A.y + oy });
      rebuilt.push({ x: B.x + ox, y: B.y + oy });
      rebuilt.push({ x: B.x, y: B.y });
    }
    out.set(id, rebuilt);
  }
  return out;
}

export function portsEqual(a: PortRef, b: PortRef): boolean {
  return a.symbolId === b.symbolId && a.term === b.term;
}

export function wireHasEnds(w: { a: PortRef; b: PortRef }, a: PortRef, b: PortRef): boolean {
  return (portsEqual(w.a, a) && portsEqual(w.b, b)) || (portsEqual(w.a, b) && portsEqual(w.b, a));
}

export function nearestOnPolyline(
  pts: { x: number; y: number }[],
  p: { x: number; y: number },
): { x: number; y: number; d: number; index: number } | null {
  let best: { x: number; y: number; d: number; index: number } | null = null;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 < 1 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
    const x = a.x + t * vx;
    const y = a.y + t * vy;
    const d = Math.hypot(p.x - x, p.y - y);
    if (!best || d < best.d) best = { x, y, d, index: i };
  }
  return best;
}

/** Snap a point onto an orthogonal segment, then onto the drawing grid. */
export function snapOnSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  p: { x: number; y: number },
  grid = GRID,
): { x: number; y: number } {
  const axis = segmentAxis(a, b);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  if (axis === "y") {
    const x = clamp(Math.round(p.x / grid) * grid, Math.min(a.x, b.x), Math.max(a.x, b.x));
    return { x, y: a.y };
  }
  if (axis === "x") {
    const y = clamp(Math.round(p.y / grid) * grid, Math.min(a.y, b.y), Math.max(a.y, b.y));
    return { x: a.x, y };
  }
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}

export function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function segmentAxis(
  a: { x: number; y: number },
  b: { x: number; y: number },
): "x" | "y" | null {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx < 0.8 && dy > 0.8) return "x";
  if (dy < 0.8 && dx > 0.8) return "y";
  return null;
}

/** Hit a draggable middle segment (skips terminal stubs). */
export function hitWireSegment(
  pts: { x: number; y: number }[],
  p: { x: number; y: number },
  threshold = 10,
): { index: number; axis: "x" | "y" } | null {
  if (pts.length < 4) return null;
  let best: { index: number; axis: "x" | "y"; d: number } | null = null;
  for (let i = 1; i < pts.length - 2; i += 1) {
    const axis = segmentAxis(pts[i], pts[i + 1]);
    if (!axis) continue;
    const d = distToSegment(p, pts[i], pts[i + 1]);
    if (d <= threshold && (!best || d < best.d)) best = { index: i, axis, d };
  }
  return best ? { index: best.index, axis: best.axis } : null;
}

function flipTransform(vw: number, vh: number, flipX?: boolean, flipY?: boolean): string {
  const fx = flipX ? -1 : 1;
  const fy = flipY ? -1 : 1;
  if (fx === 1 && fy === 1) return "";
  const cx = (vw * GRID) / 2;
  const cy = (vh * GRID) / 2;
  return ` translate(${cx} ${cy}) scale(${fx} ${fy}) translate(${-cx} ${-cy})`;
}

export function glyphTransform(sym: SymbolInst, vw: number, vh: number): string {
  const sx = sym.x * GRID;
  const sy = sym.y * GRID;
  const wG = vw * GRID;
  const hG = vh * GRID;
  const flip = flipTransform(vw, vh, sym.flipX, sym.flipY);
  switch (sym.rot) {
    case 0:
      return `translate(${sx} ${sy})${flip}`;
    case 90:
      return `translate(${sx} ${sy}) translate(${hG} 0) rotate(90)${flip}`;
    case 180:
      return `translate(${sx} ${sy}) translate(${wG} ${hG}) rotate(180)${flip}`;
    case 270:
      return `translate(${sx} ${sy}) translate(0 ${wG}) rotate(270)${flip}`;
  }
}

/** Keep text readable inside a flipped symbol. Anchor (x, y) is in glyph local pixels. */
export function textUnflipTransform(x: number, y: number, flipX?: boolean, flipY?: boolean): string | undefined {
  const fx = flipX ? -1 : 1;
  const fy = flipY ? -1 : 1;
  if (fx === 1 && fy === 1) return undefined;
  return `translate(${x} ${y}) scale(${fx} ${fy}) translate(${-x} ${-y})`;
}

/** 左右／上下 in world space, independent of current rotation. */
export function toggleWorldFlip(sym: SymbolInst, axis: "h" | "v"): void {
  const localX = sym.rot === 0 || sym.rot === 180;
  if (axis === "h") {
    if (localX) sym.flipX = !sym.flipX;
    else sym.flipY = !sym.flipY;
  } else if (localX) {
    sym.flipY = !sym.flipY;
  } else {
    sym.flipX = !sym.flipX;
  }
}

export function nodeKey(deviceId: string, term: string): string {
  return `${deviceId}::${term}`;
}

export function portDevice(
  circuit: Circuit,
  ref: PortRef,
): { deviceId: string; term: string } | null {
  const sym = circuit.symbols.find((s) => s.id === ref.symbolId);
  if (!sym) return null;
  return { deviceId: sym.deviceId, term: ref.term };
}

/** Check if a symbol is a junction device. */
export function isJunction(symbolId: string, circuit: Circuit): boolean {
  const sym = circuit.symbols.find((s) => s.id === symbolId);
  if (!sym) return false;
  return circuit.devices.find((d) => d.id === sym.deviceId)?.kind === "junction";
}

/** Check if two line segments intersect and return the intersection point. */
function lineIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): { x: number; y: number } | null {
  const denom = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
  if (Math.abs(denom) < 0.1) return null;
  const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denom;
  const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denom;
  if (ua > 0.02 && ua < 0.98 && ub > 0.02 && ub < 0.98) {
    return { x: a.x + ua * (b.x - a.x), y: a.y + ua * (b.y - a.y) };
  }
  return null;
}

export const HOP_R = 10;

/** A crossing of two unconnected wires. The hopping wire draws a semicircle. */
export interface WireCrossover {
  x: number;
  y: number;
  hopWireId: string;
  /** "x" = vertical hop (constant x, bulge right); "y" = horizontal hop (bulge up). */
  hopAxis: "x" | "y";
}

function sharesJunction(a: { a: PortRef; b: PortRef }, b: { a: PortRef; b: PortRef }, circuit: Circuit): boolean {
  const ids = [a.a.symbolId, a.b.symbolId];
  return ids.some((id) => (b.a.symbolId === id || b.b.symbolId === id) && isJunction(id, circuit));
}

/** Find unconnected wire crossings. Vertical wire hops over horizontal. */
export function findWireCrossovers(circuit: Circuit, routes?: Map<string, Pt[]>): WireCrossover[] {
  const crossovers: WireCrossover[] = [];
  const resolved = routes ?? allWireRoutes(circuit);
  const wireSegments = circuit.wires.map((w) => {
    const pts = resolved.get(w.id) ?? wireRoute(circuit, w.a, w.b, w.jog);
    const segments: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push({ a: pts[i], b: pts[i + 1] });
    }
    return { wire: w, segments };
  });

  for (let i = 0; i < wireSegments.length; i++) {
    for (let j = i + 1; j < wireSegments.length; j++) {
      const wireA = wireSegments[i];
      const wireB = wireSegments[j];
      if (sharesJunction(wireA.wire, wireB.wire, circuit)) continue;

      for (const segA of wireA.segments) {
        for (const segB of wireB.segments) {
          const axisA = segmentAxis(segA.a, segA.b);
          const axisB = segmentAxis(segB.a, segB.b);
          if (!axisA || !axisB || axisA === axisB) continue;
          const intersect = lineIntersect(segA.a, segA.b, segB.a, segB.b);
          if (!intersect) continue;
          
          // Always show crossover for wire crossings
          const hopAxis: "x" | "y" = axisA === "x" || axisB === "x" ? "x" : "y";
          const hopWireId = hopAxis === axisA ? wireA.wire.id : wireB.wire.id;
          if (!crossovers.some((c) => Math.hypot(c.x - intersect.x, c.y - intersect.y) < 2)) {
            crossovers.push({ x: intersect.x, y: intersect.y, hopWireId, hopAxis });
          }
        }
      }
    }
  }
  return crossovers;
}

function hopSweep(hopAxis: "x" | "y", from: { x: number; y: number }, to: { x: number; y: number }): 0 | 1 {
  if (hopAxis === "x") return from.y <= to.y ? 1 : 0;
  return from.x <= to.x ? 0 : 1;
}

/** Semicircle overlay for a hop, always the same geometry as `polylinePathD`. */
export function hopArcD(c: WireCrossover, r = HOP_R): string {
  if (c.hopAxis === "x") {
    return `M ${c.x} ${c.y - r} A ${r} ${r} 0 0 1 ${c.x} ${c.y + r}`;
  }
  return `M ${c.x - r} ${c.y} A ${r} ${r} 0 0 0 ${c.x + r} ${c.y}`;
}

function hopsOnSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  hops: WireCrossover[],
  r: number,
): WireCrossover[] {
  const axis = segmentAxis(a, b);
  if (!axis) return [];
  const hits = hops.filter((h) => {
    if (h.hopAxis !== axis) return false;
    if (distToSegment(h, a, b) > 1.5) return false;
    const da = Math.hypot(h.x - a.x, h.y - a.y);
    const db = Math.hypot(h.x - b.x, h.y - b.y);
    return da >= r && db >= r;
  });
  hits.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
  return hits;
}

/** SVG path along an orthogonal polyline, with hop semicircles on the hopping wire. */
export function polylinePathD(
  pts: { x: number; y: number }[],
  hops: WireCrossover[] = [],
  r = HOP_R,
): string {
  if (!pts.length) return "";
  const parts: string[] = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const onSeg = hopsOnSegment(a, b, hops, r);
    let cursor = a;
    for (const hop of onSeg) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1) continue;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const before = { x: hop.x - ux * r, y: hop.y - uy * r };
      const after = { x: hop.x + ux * r, y: hop.y + uy * r };
      parts.push(`L ${before.x} ${before.y}`);
      parts.push(`A ${r} ${r} 0 0 ${hopSweep(hop.hopAxis, before, after)} ${after.x} ${after.y}`);
      cursor = after;
    }
    if (Math.hypot(cursor.x - b.x, cursor.y - b.y) > 0.5) {
      parts.push(`L ${b.x} ${b.y}`);
    }
  }
  return parts.join(" ");
}

/** Midpoint of the longest segment, plus a perpendicular offset for a wire label. */
export function wireLabelPos(
  pts: { x: number; y: number }[],
  offset = 12,
): { x: number; y: number; horizontal: boolean } | null {
  if (pts.length < 2) return null;
  let best = { a: pts[0], b: pts[1], len: -1 };
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (len > best.len) best = { a: pts[i], b: pts[i + 1], len };
  }
  if (best.len < 1) return null;
  const mx = (best.a.x + best.b.x) / 2;
  const my = (best.a.y + best.b.y) / 2;
  const horizontal = Math.abs(best.a.y - best.b.y) < 0.8;
  return horizontal
    ? { x: mx, y: my - offset, horizontal: true }
    : { x: mx + offset, y: my, horizontal: false };
}
