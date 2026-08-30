import { variantDef } from "./catalog";
import { GRID, type Circuit, type PortRef, type Rot, type SymbolInst, type Wire, type WireJog } from "./types";

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

export function symbolSize(
  sym: SymbolInst,
  kind: Circuit["devices"][0]["kind"],
  params?: Circuit["devices"][0]["params"],
): {
  w: number;
  h: number;
} {
  const v = variantDef(kind, sym.variant);
  const s = params?.scale ?? 1;
  const bw = v.w * s;
  const bh = v.h * s;
  if (sym.rot === 90 || sym.rot === 270) return { w: bh, h: bw };
  return { w: bw, h: bh };
}

export function symbolBounds(
  circuit: Circuit,
  sym: SymbolInst,
): { x: number; y: number; w: number; h: number } | null {
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return null;
  const size = symbolSize(sym, dev.kind, dev.params);
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
  if (!sym) return { x: 0, y: 0 };
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return { x: 0, y: 0 };
  if (dev.kind === "junction" || dev.kind === "net-label") {
    return { x: 0, y: 0 };
  }
  const v = variantDef(dev.kind, sym.variant);
  const term = v.terminals.find((t) => t.id === ref.term);
  if (!term) return { x: 0, y: 0 };
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
  oa?: { x: number; y: number },
  ob?: { x: number; y: number },
  jog?: WireJog,
): { x: number; y: number }[] {
  if (jog?.axis === "y") {
    return [a1, { x: a1.x, y: jog.pos }, { x: b1.x, y: jog.pos }, b1];
  }
  if (jog?.axis === "x") {
    return [a1, { x: jog.pos, y: a1.y }, { x: jog.pos, y: b1.y }, b1];
  }
  if (a1.x === b1.x || a1.y === b1.y) {
    return [a1, b1];
  }

  const oaActive = Boolean(oa && (oa.x !== 0 || oa.y !== 0));
  const obActive = Boolean(ob && (ob.x !== 0 || ob.y !== 0));

  if (!oaActive && !obActive) {
    return manhattan(a1, b1);
  }

  if (!oaActive && obActive) {
    if (ob!.x !== 0) {
      return [a1, { x: a1.x, y: b1.y }, b1];
    }
    return [a1, { x: b1.x, y: a1.y }, b1];
  }

  if (oaActive && !obActive) {
    if (oa!.x !== 0) {
      return [a1, { x: b1.x, y: a1.y }, b1];
    }
    return [a1, { x: a1.x, y: b1.y }, b1];
  }

  // Both oa and ob are active
  const oaX = oa!.x;
  const oaY = oa!.y;
  const obX = ob!.x;
  const obY = ob!.y;

  // If both outward directions are horizontal
  if (oaX !== 0 && obX !== 0) {
    if (oaX * obX < 0) {
      // Facing each other or opposite directions
      if ((b1.x - a1.x) * oaX >= 0) {
        // Space in between -> clean S-bend
        const midX = Math.round((a1.x + b1.x) / 2);
        return [a1, { x: midX, y: a1.y }, { x: midX, y: b1.y }, b1];
      }
      // Crossed over -> route around
      const outX = oaX > 0 ? Math.max(a1.x, b1.x) + STUB * 3 : Math.min(a1.x, b1.x) - STUB * 3;
      return [a1, { x: outX, y: a1.y }, { x: outX, y: b1.y }, b1];
    }
    // Facing same horizontal direction (C-shape / U-turn)
    const outX = oaX > 0 ? Math.max(a1.x, b1.x) + STUB * 3 : Math.min(a1.x, b1.x) - STUB * 3;
    return [a1, { x: outX, y: a1.y }, { x: outX, y: b1.y }, b1];
  }

  // If both outward directions are vertical
  if (oaY !== 0 && obY !== 0) {
    if (oaY * obY < 0) {
      // Facing each other
      if ((b1.y - a1.y) * oaY >= 0) {
        const midY = Math.round((a1.y + b1.y) / 2);
        return [a1, { x: a1.x, y: midY }, { x: b1.x, y: midY }, b1];
      }
      // Crossed over
      const outY = oaY > 0 ? Math.max(a1.y, b1.y) + STUB * 3 : Math.min(a1.y, b1.y) - STUB * 3;
      return [a1, { x: a1.x, y: outY }, { x: b1.x, y: outY }, b1];
    }
    // Facing same vertical direction
    const outY = oaY > 0 ? Math.max(a1.y, b1.y) + STUB * 3 : Math.min(a1.y, b1.y) - STUB * 3;
    return [a1, { x: a1.x, y: outY }, { x: b1.x, y: outY }, b1];
  }

  // If oa is horizontal and ob is vertical
  if (oaX !== 0 && obY !== 0) {
    if ((b1.x - a1.x) * oaX >= -0.5 && (a1.y - b1.y) * obY <= 0.5) {
      return [a1, { x: b1.x, y: a1.y }, b1];
    }
    const turnX = a1.x + oaX * STUB * 2;
    return [a1, { x: turnX, y: a1.y }, { x: turnX, y: b1.y }, b1];
  }

  // If oa is vertical and ob is horizontal
  if (oaY !== 0 && obX !== 0) {
    if ((b1.y - a1.y) * oaY >= -0.5 && (a1.x - b1.x) * obX <= 0.5) {
      return [a1, { x: a1.x, y: b1.y }, b1];
    }
    const turnY = a1.y + oaY * STUB * 2;
    return [a1, { x: a1.x, y: turnY }, { x: b1.x, y: turnY }, b1];
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
    for (const p of betweenStubs(a1, b1, oa, ob, jog).slice(1)) append(pts, p);
    append(pts, b);
    return pts;
  }
  const mid = oa.x !== 0 ? { x: to.x, y: a1.y } : { x: a1.x, y: to.y };
  if (a1.x === to.x || a1.y === to.y) {
    append(pts, to);
  } else {
    append(pts, mid);
    append(pts, to);
  }
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
  score: number;
}

function calcOccScore(pts: Pt[], i: number, axis: "x" | "y"): number {
  const A = pts[i];
  const B = pts[i + 1];
  if (axis === "x") {
    const sy = Math.sign(B.y - A.y);
    let sx = 0;
    if (i > 0) {
      sx = Math.sign(A.x - pts[i - 1].x);
    } else if (i + 1 < pts.length - 1) {
      sx = Math.sign(pts[i + 2].x - B.x);
    }
    if (sy !== 0 && sx !== 0) {
      return -sy * sx * A.y;
    }
    return Math.min(A.y, B.y);
  } else {
    const sx = Math.sign(B.x - A.x);
    let sy = 0;
    if (i > 0) {
      sy = Math.sign(A.y - pts[i - 1].y);
    } else if (i + 1 < pts.length - 1) {
      sy = Math.sign(pts[i + 2].y - B.y);
    }
    if (sx !== 0 && sy !== 0) {
      return -sx * sy * A.x;
    }
    return Math.min(A.x, B.x);
  }
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
    const score = calcOccScore(pts, i, axis);
    if (axis === "y") out.push({ id, i, axis, fixed: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x), score });
    else out.push({ id, i, axis, fixed: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y), score });
  }
  return out;
}

function overlapComponents(group: Occ[]): Occ[][] {
  const n = group.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (overlapSpan(group[i].lo, group[i].hi, group[j].lo, group[j].hi) >= 3) {
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

function clusterOccs(occs: Occ[], threshold = 8): Occ[][] {
  const xOccs = occs.filter((o) => o.axis === "x").sort((a, b) => a.fixed - b.fixed);
  const yOccs = occs.filter((o) => o.axis === "y").sort((a, b) => a.fixed - b.fixed);
  const clusters: Occ[][] = [];
  for (const list of [xOccs, yOccs]) {
    let current: Occ[] = [];
    for (const o of list) {
      if (!current.length) {
        current.push(o);
      } else {
        const minFixed = Math.min(...current.map((item) => item.fixed));
        const maxFixed = Math.max(...current.map((item) => item.fixed));
        if (Math.abs(o.fixed - minFixed) <= threshold || Math.abs(o.fixed - maxFixed) <= threshold) {
          current.push(o);
        } else {
          clusters.push(current);
          current = [o];
        }
      }
    }
    if (current.length) clusters.push(current);
  }
  return clusters;
}

function colorLanes(comp: Occ[]): Map<string, number> {
  const sorted = [...comp].sort((a, b) => a.score - b.score || a.lo - b.lo || a.id.localeCompare(b.id));
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

export function cleanPolyline(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i];
    const prev = out[out.length - 1];
    if (Math.abs(p.x - prev.x) < 0.5 && Math.abs(p.y - prev.y) < 0.5) continue;
    out.push(p);
  }
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    for (let i = 0; i < out.length - 2; i += 1) {
      const a = out[i];
      const b = out[i + 1];
      const c = out[i + 2];
      // Collinear horizontal
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5) {
        out.splice(i + 1, 1);
        changed = true;
        break;
      }
      // Collinear vertical
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) {
        out.splice(i + 1, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
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
  const clusters = clusterOccs(occs, 8);
  const shift = new Map<string, number>();
  for (const group of clusters) {
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
    out.set(id, cleanPolyline(rebuilt));
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

export { GRID };
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

/** Hit a draggable segment of the wire polyline. */
export function hitWireSegment(
  pts: { x: number; y: number }[],
  p: { x: number; y: number },
  threshold = 16,
): { index: number; axis: "x" | "y" } | null {
  if (pts.length < 2) return null;
  let best: { index: number; axis: "x" | "y"; d: number } | null = null;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const segAxis = segmentAxis(pts[i], pts[i + 1]);
    const dx = Math.abs(pts[i].x - pts[i + 1].x);
    const dy = Math.abs(pts[i].y - pts[i + 1].y);
    const axis: "x" | "y" = segAxis ?? (dx >= dy ? "y" : "x");
    const d = distToSegment(p, pts[i], pts[i + 1]);
    if (d <= threshold && (!best || d < best.d)) {
      best = { index: i, axis, d };
    }
  }
  return best ? { index: best.index, axis: best.axis } : null;
}

/** Find the closest wire in the circuit within maxDist to a point (x, y) in world pixels. */
export function findWireAtPoint(
  circuit: Circuit,
  x: number,
  y: number,
  maxDist = 36,
): Wire | null {
  let best: { wire: Wire; dist: number } | null = null;
  for (const w of circuit.wires) {
    const pts = wireRoute(circuit, w.a, w.b, w.jog);
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment({ x, y }, pts[i], pts[i + 1]);
      if (d <= maxDist && (!best || d < best.dist)) {
        best = { wire: w, dist: d };
      }
    }
  }
  return best ? best.wire : null;
}

/** Find the closest port/terminal in the circuit within maxDist to a point (x, y) in world pixels. */
export function findPortAtPoint(
  circuit: Circuit,
  x: number,
  y: number,
  maxDist = 20,
): PortRef | null {
  let best: { port: PortRef; dist: number } | null = null;
  for (const sym of circuit.symbols) {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev) continue;
    const v = variantDef(dev.kind, sym.variant);
    for (const t of v.terminals) {
      const world = terminalWorld(circuit, { symbolId: sym.id, term: t.id });
      if (!world) continue;
      const d = Math.hypot(world.x - x, world.y - y);
      if (d <= maxDist && (!best || d < best.dist)) {
        best = { port: { symbolId: sym.id, term: t.id }, dist: d };
      }
    }
  }
  return best ? best.port : null;
}

/** Pick the best grid coordinates (gx, gy) on a wire to insert a junction. */
export function pickJunctionPositionOnWire(
  circuit: Circuit,
  wireId: string,
  worldPos?: { x: number; y: number },
): { x: number; y: number } | null {
  const w = circuit.wires.find((item) => item.id === wireId);
  if (!w) return null;
  const pts = wireRoute(circuit, w.a, w.b, w.jog);
  if (pts.length < 2) return null;

  const a = terminalWorld(circuit, w.a);
  const b = terminalWorld(circuit, w.b);
  const tol = GRID * 0.45;

  if (worldPos) {
    const near = nearestOnPolyline(pts, worldPos);
    if (near) {
      const snapped = snapOnSegment(pts[near.index], pts[near.index + 1], { x: near.x, y: near.y });
      const gx = Math.round(snapped.x / GRID);
      const gy = Math.round(snapped.y / GRID);
      const isNearA = a && Math.hypot(a.x - gx * GRID, a.y - gy * GRID) <= tol;
      const isNearB = b && Math.hypot(b.x - gx * GRID, b.y - gy * GRID) <= tol;
      if (!isNearA && !isNearB) {
        return { x: gx, y: gy };
      }
    }
  }

  // Calculate midpoint along total polyline length
  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    totalLen += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  const half = totalLen / 2;
  let curr = 0;
  let midPt = pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (curr + segLen >= half || i === pts.length - 2) {
      const t = segLen > 0 ? (half - curr) / segLen : 0.5;
      midPt = {
        x: pts[i].x + Math.max(0, Math.min(1, t)) * (pts[i + 1].x - pts[i].x),
        y: pts[i].y + Math.max(0, Math.min(1, t)) * (pts[i + 1].y - pts[i].y),
      };
      const snapped = snapOnSegment(pts[i], pts[i + 1], midPt);
      const gx = Math.round(snapped.x / GRID);
      const gy = Math.round(snapped.y / GRID);
      return { x: gx, y: gy };
    }
    curr += segLen;
  }
  return { x: Math.round(midPt.x / GRID), y: Math.round(midPt.y / GRID) };
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
  const out: WireCrossover[] = [];
  for (const h of hits) {
    if (!out.length) {
      out.push(h);
    } else {
      const prev = out[out.length - 1];
      if (Math.hypot(h.x - prev.x, h.y - prev.y) >= r * 1.2) {
        out.push(h);
      }
    }
  }
  return out;
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
      const forwardDist = (before.x - cursor.x) * ux + (before.y - cursor.y) * uy;
      if (forwardDist < -0.1) continue;
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
