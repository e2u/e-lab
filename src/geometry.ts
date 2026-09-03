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

function lookupTerminal(v: VariantDef, kind: string, termId: string): TerminalDef | undefined {
  let term = v.terminals.find((t) => t.id === termId);
  if (!term && (kind === "breaker-3p" || kind === "isolator" || kind === "overload" || kind === "contactor")) {
    const aliasMap: Record<string, string> =
      kind === "isolator"
        ? {
            "1": "L1",
            "3": "L2",
            "5": "L3",
            "2": "T1",
            "4": "T2",
            "6": "T3",
            L1: "1",
            L2: "3",
            L3: "5",
            T1: "2",
            T2: "4",
            T3: "6",
          }
        : {
            "5": "L3",
            "3": "L2",
            "1": "L1",
            "6": "T3",
            "4": "T2",
            "2": "T1",
            L3: "5",
            L2: "3",
            L1: "1",
            T3: "6",
            T2: "4",
            T1: "2",
          };
    const mapped = aliasMap[termId];
    if (mapped) term = v.terminals.find((t) => t.id === mapped);
  }
  return term;
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
  const term = lookupTerminal(v, dev.kind, ref.term);
  if (!term) return null;
  const s = dev.params?.scale ?? 1;
  const termX = term.x * s;
  const termY = term.y * s;
  const vw = v.w * s;
  const vh = v.h * s;
  const flipped = applyFlip(termX, termY, vw, vh, sym.flipX, sym.flipY);
  const p = rotatePoint(flipped.x, flipped.y, vw, vh, sym.rot);
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
  const term = lookupTerminal(v, dev.kind, ref.term);
  if (!term) return { x: 0, y: 0 };
  const s = dev.params?.scale ?? 1;
  const p = applyFlip(term.x * s, term.y * s, v.w * s, v.h * s, sym.flipX, sym.flipY);
  const dl = p.x;
  const dr = v.w * s - p.x;
  const dt = p.y;
  const db = v.h * s - p.y;
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
  isSelf = false,
): { x: number; y: number }[] {
  const jogX = jog?.x ?? (jog?.axis === "x" ? jog.pos : undefined);
  const jogY = jog?.y ?? (jog?.axis === "y" ? jog.pos : undefined);

  if (jogX !== undefined && jogY !== undefined) {
    const oaActive = Boolean(oa && (oa.x !== 0 || oa.y !== 0));
    const obActive = Boolean(ob && (ob.x !== 0 || ob.y !== 0));

    let exitH = true;
    if (oaActive) {
      exitH = oa!.x !== 0;
    } else if (obActive) {
      exitH = ob!.y !== 0;
    } else {
      exitH = jog?.axis !== "y";
    }

    if (exitH) {
      const turnAy = oa && oa.y !== 0 ? Math.round((a1.y + oa.y * GRID) / GRID) * GRID : a1.y;
      const turnBx = ob && ob.x !== 0 ? Math.round((b1.x + ob.x * GRID) / GRID) * GRID : b1.x;
      const pts: { x: number; y: number }[] = [a1];
      if (oa && oa.y !== 0) pts.push({ x: a1.x, y: turnAy });
      pts.push({ x: jogX, y: turnAy });
      pts.push({ x: jogX, y: jogY });
      pts.push({ x: turnBx, y: jogY });
      if (ob && ob.x !== 0) pts.push({ x: turnBx, y: b1.y });
      pts.push(b1);
      return pts;
    } else {
      const turnAx = oa && oa.x !== 0 ? Math.round((a1.x + oa.x * GRID) / GRID) * GRID : a1.x;
      const turnBy = ob && ob.y !== 0 ? Math.round((b1.y + ob.y * GRID) / GRID) * GRID : b1.y;
      const pts: { x: number; y: number }[] = [a1];
      if (oa && oa.x !== 0) pts.push({ x: turnAx, y: a1.y });
      pts.push({ x: turnAx, y: jogY });
      pts.push({ x: jogX, y: jogY });
      pts.push({ x: jogX, y: turnBy });
      if (ob && ob.y !== 0) pts.push({ x: b1.x, y: turnBy });
      pts.push(b1);
      return pts;
    }
  }

  if (jogY !== undefined) {
    const turnAx = oa && oa.x !== 0 ? Math.round((a1.x + oa.x * GRID) / GRID) * GRID : a1.x;
    const turnBx = ob && ob.x !== 0 ? Math.round((b1.x + ob.x * GRID) / GRID) * GRID : b1.x;
    const pts: { x: number; y: number }[] = [a1];
    if (oa && oa.x !== 0) pts.push({ x: turnAx, y: a1.y });
    pts.push({ x: turnAx, y: jogY });
    pts.push({ x: turnBx, y: jogY });
    if (ob && ob.x !== 0) pts.push({ x: turnBx, y: b1.y });
    pts.push(b1);
    return pts;
  }
  if (jogX !== undefined) {
    const turnAy = oa && oa.y !== 0 ? Math.round((a1.y + oa.y * GRID) / GRID) * GRID : a1.y;
    const turnBy = ob && ob.y !== 0 ? Math.round((b1.y + ob.y * GRID) / GRID) * GRID : b1.y;
    const pts: { x: number; y: number }[] = [a1];
    if (oa && oa.y !== 0) pts.push({ x: a1.x, y: turnAy });
    pts.push({ x: jogX, y: turnAy });
    pts.push({ x: jogX, y: turnBy });
    if (ob && ob.y !== 0) pts.push({ x: b1.x, y: turnBy });
    pts.push(b1);
    return pts;
  }

  // If not on the same symbol, collinear stubs connect directly
  if (!isSelf && (Math.abs(a1.x - b1.x) < 0.5 || Math.abs(a1.y - b1.y) < 0.5)) {
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
        if (Math.abs(a1.y - b1.y) < 0.5) return [a1, b1];
        // Space in between -> clean S-bend snapped to grid
        const midX = Math.round(((a1.x + b1.x) / 2) / GRID) * GRID;
        return [a1, { x: midX, y: a1.y }, { x: midX, y: b1.y }, b1];
      }
      // Crossed over / facing away -> route around in Y snapped to grid
      const rawOutY = a1.y <= b1.y ? Math.min(a1.y, b1.y) - GRID : Math.max(a1.y, b1.y) + GRID;
      const outY = Math.round(rawOutY / GRID) * GRID;
      const turnAx = Math.round((a1.x + oaX * GRID) / GRID) * GRID;
      const turnBx = Math.round((b1.x + obX * GRID) / GRID) * GRID;
      return [a1, { x: turnAx, y: a1.y }, { x: turnAx, y: outY }, { x: turnBx, y: outY }, { x: turnBx, y: b1.y }, b1];
    }
    // Facing same horizontal direction (C-shape / U-turn) snapped to grid
    const rawOutX = oaX > 0 ? Math.max(a1.x, b1.x) + GRID : Math.min(a1.x, b1.x) - GRID;
    const outX = Math.round(rawOutX / GRID) * GRID;
    return [a1, { x: outX, y: a1.y }, { x: outX, y: b1.y }, b1];
  }

  // If both outward directions are vertical
  if (oaY !== 0 && obY !== 0) {
    if (oaY * obY < 0) {
      // Facing each other
      if ((b1.y - a1.y) * oaY >= 0) {
        if (Math.abs(a1.x - b1.x) < 0.5) return [a1, b1];
        const midY = Math.round(((a1.y + b1.y) / 2) / GRID) * GRID;
        return [a1, { x: a1.x, y: midY }, { x: b1.x, y: midY }, b1];
      }
      // Crossed over -> route around in X snapped to grid
      const rawOutX = a1.x <= b1.x ? Math.min(a1.x, b1.x) - GRID : Math.max(a1.x, b1.x) + GRID;
      const outX = Math.round(rawOutX / GRID) * GRID;
      const turnAy = Math.round((a1.y + oaY * GRID) / GRID) * GRID;
      const turnBy = Math.round((b1.y + obY * GRID) / GRID) * GRID;
      return [a1, { x: a1.x, y: turnAy }, { x: outX, y: turnAy }, { x: outX, y: turnBy }, { x: b1.x, y: turnBy }, b1];
    }
    // Facing same vertical direction snapped to grid
    const rawOutY = oaY > 0 ? Math.max(a1.y, b1.y) + GRID : Math.min(a1.y, b1.y) - GRID;
    const outY = Math.round(rawOutY / GRID) * GRID;
    return [a1, { x: a1.x, y: outY }, { x: b1.x, y: outY }, b1];
  }

  // If oa is horizontal and ob is vertical
  if (oaX !== 0 && obY !== 0) {
    if ((b1.x - a1.x) * oaX >= -0.5 && (a1.y - b1.y) * obY <= 0.5) {
      return [a1, { x: b1.x, y: a1.y }, b1];
    }
    const rawTurnX = oaX > 0 ? Math.max(a1.x, b1.x) + GRID : Math.min(a1.x, b1.x) - GRID;
    const turnX = Math.round(rawTurnX / GRID) * GRID;
    const turnBy = Math.round((b1.y + obY * GRID) / GRID) * GRID;
    return [a1, { x: turnX, y: a1.y }, { x: turnX, y: turnBy }, { x: b1.x, y: turnBy }, b1];
  }

  // If oa is vertical and ob is horizontal
  if (oaY !== 0 && obX !== 0) {
    if ((b1.y - a1.y) * oaY >= -0.5 && (a1.x - b1.x) * obX <= 0.5) {
      return [a1, { x: a1.x, y: b1.y }, b1];
    }
    const rawTurnY = oaY > 0 ? Math.max(a1.y, b1.y) + GRID : Math.min(a1.y, b1.y) - GRID;
    const turnY = Math.round(rawTurnY / GRID) * GRID;
    const turnBx = Math.round((b1.x + obX * GRID) / GRID) * GRID;
    return [a1, { x: a1.x, y: turnY }, { x: turnBx, y: turnY }, { x: turnBx, y: b1.y }, b1];
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
    const isSelf = from.symbolId === to.symbolId;
    if (!isSelf && !jog && (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5)) {
      return [a, b];
    }
    const ob = terminalOutward(circuit, to);
    const sb = stubLen(circuit, to);
    const b1 = { x: b.x + ob.x * sb, y: b.y + ob.y * sb };
    for (const p of betweenStubs(a1, b1, oa, ob, jog, isSelf).slice(1)) append(pts, p);
    append(pts, b);
    return cleanPolyline(pts);
  }
  if (!jog && (Math.abs(a.x - to.x) < 0.5 || Math.abs(a.y - to.y) < 0.5)) {
    return [a, to];
  }
  const mid = oa.x !== 0 ? { x: to.x, y: a1.y } : { x: a1.x, y: to.y };
  append(pts, mid);
  append(pts, to);
  return cleanPolyline(pts);
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

/** Find existing orthogonal jog coordinate from polyline points when initiating a drag. */
export function findComplementaryJogFromPolyline(
  pts: { x: number; y: number }[],
  hitAxis: "x" | "y",
  hitIndex?: number,
): number | undefined {
  if (pts.length < 3) return undefined;

  if (hitAxis === "x") {
    // We are dragging in X (vertical segment). Look for horizontal segments in pts.
    const order: number[] = [];
    if (hitIndex !== undefined) {
      if (hitIndex + 1 < pts.length - 1) order.push(hitIndex + 1);
      if (hitIndex - 1 >= 0) order.push(hitIndex - 1);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (!order.includes(i)) order.push(i);
    }
    for (const i of order) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dx = Math.abs(p0.x - p1.x);
      const dy = Math.abs(p0.y - p1.y);
      if (dy < 0.8 && dx > 0.8) {
        return Math.round(p0.y / GRID) * GRID;
      }
    }
  } else {
    // We are dragging in Y (horizontal segment). Look for vertical segments in pts.
    const order: number[] = [];
    if (hitIndex !== undefined) {
      if (hitIndex + 1 < pts.length - 1) order.push(hitIndex + 1);
      if (hitIndex - 1 >= 0) order.push(hitIndex - 1);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (!order.includes(i)) order.push(i);
    }
    for (const i of order) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dx = Math.abs(p0.x - p1.x);
      const dy = Math.abs(p0.y - p1.y);
      if (dx < 0.8 && dy > 0.8) {
        return Math.round(p0.x / GRID) * GRID;
      }
    }
  }
  return undefined;
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

/** Horizontal / vertical flip in world space, independent of current rotation. */
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

/** Calculate the optimal junction grid position (gx, gy) when merging two wires. */
export function findOptimalJunctionForWires(
  circuit: Circuit,
  wireId1: string,
  wireId2: string,
): { x: number; y: number } | null {
  const w1 = circuit.wires.find((w) => w.id === wireId1);
  const w2 = circuit.wires.find((w) => w.id === wireId2);
  if (!w1 || !w2 || w1.id === w2.id) return null;

  const pts1 = wireRoute(circuit, w1.a, w1.b, w1.jog);
  const pts2 = wireRoute(circuit, w2.a, w2.b, w2.jog);
  if (pts1.length < 2 || pts2.length < 2) return null;

  // 1. Check segment-segment intersection (crossings or overlaps)
  for (let i = 0; i < pts1.length - 1; i++) {
    const a1 = pts1[i];
    const b1 = pts1[i + 1];
    for (let j = 0; j < pts2.length - 1; j++) {
      const a2 = pts2[j];
      const b2 = pts2[j + 1];

      // Intersection between orthogonal or general segments
      const denom = (b2.y - a2.y) * (b1.x - a1.x) - (b2.x - a2.x) * (b1.y - a1.y);
      if (Math.abs(denom) >= 0.001) {
        const ua = ((b2.x - a2.x) * (a1.y - a2.y) - (b2.y - a2.y) * (a1.x - a2.x)) / denom;
        const ub = ((b1.x - a1.x) * (a1.y - a2.y) - (b1.y - a1.y) * (a1.x - a2.x)) / denom;
        if (ua >= -0.05 && ua <= 1.05 && ub >= -0.05 && ub <= 1.05) {
          const ix = a1.x + Math.max(0, Math.min(1, ua)) * (b1.x - a1.x);
          const iy = a1.y + Math.max(0, Math.min(1, ua)) * (b1.y - a1.y);
          return { x: Math.round(ix / GRID), y: Math.round(iy / GRID) };
        }
      } else {
        // Collinear parallel segments: check overlap
        const axis1 = segmentAxis(a1, b1);
        const axis2 = segmentAxis(a2, b2);
        if (axis1 && axis1 === axis2 && distToSegment(a2, a1, b1) < 2) {
          if (axis1 === "x") {
            const min1 = Math.min(a1.y, b1.y);
            const max1 = Math.max(a1.y, b1.y);
            const min2 = Math.min(a2.y, b2.y);
            const max2 = Math.max(a2.y, b2.y);
            const overlapMin = Math.max(min1, min2);
            const overlapMax = Math.min(max1, max2);
            if (overlapMin <= overlapMax) {
              const midY = (overlapMin + overlapMax) / 2;
              return { x: Math.round(a1.x / GRID), y: Math.round(midY / GRID) };
            }
          } else {
            const min1 = Math.min(a1.x, b1.x);
            const max1 = Math.max(a1.x, b1.x);
            const min2 = Math.min(a2.x, b2.x);
            const max2 = Math.max(a2.x, b2.x);
            const overlapMin = Math.max(min1, min2);
            const overlapMax = Math.min(max1, max2);
            if (overlapMin <= overlapMax) {
              const midX = (overlapMin + overlapMax) / 2;
              return { x: Math.round(midX / GRID), y: Math.round(a1.y / GRID) };
            }
          }
        }
      }
    }
  }

  // 2. Check if an endpoint of one wire lies along or near the other wire (T-junction)
  const a1World = terminalWorld(circuit, w1.a);
  const b1World = terminalWorld(circuit, w1.b);
  const a2World = terminalWorld(circuit, w2.a);
  const b2World = terminalWorld(circuit, w2.b);

  const checkEndpointsOnOther = [
    { pt: a1World, otherPts: pts2 },
    { pt: b1World, otherPts: pts2 },
    { pt: a2World, otherPts: pts1 },
    { pt: b2World, otherPts: pts1 },
  ];

  for (const { pt, otherPts } of checkEndpointsOnOther) {
    if (!pt) continue;
    const near = nearestOnPolyline(otherPts, pt);
    if (near) {
      const d = Math.hypot(near.x - pt.x, near.y - pt.y);
      if (d <= GRID * 1.5) {
        return { x: Math.round(near.x / GRID), y: Math.round(near.y / GRID) };
      }
    }
  }

  // 3. Check shared endpoints
  const sharedPorts: PortRef[] = [];
  if (portsEqual(w1.a, w2.a) || portsEqual(w1.a, w2.b)) sharedPorts.push(w1.a);
  if (portsEqual(w1.b, w2.a) || portsEqual(w1.b, w2.b)) sharedPorts.push(w1.b);

  if (sharedPorts.length > 0) {
    const sp = sharedPorts[0];
    const sym = circuit.symbols.find((s) => s.id === sp.symbolId);
    if (sym && isJunction(sym.id, circuit)) {
      return { x: Math.round(sym.x), y: Math.round(sym.y) };
    }
    const world = terminalWorld(circuit, sp);
    if (world) {
      const outward = terminalOutward(circuit, sp);
      if (Math.abs(outward.x) > 0.1 || Math.abs(outward.y) > 0.1) {
        return {
          x: Math.round((world.x + outward.x * GRID) / GRID),
          y: Math.round((world.y + outward.y * GRID) / GRID),
        };
      }
      return { x: Math.round(world.x / GRID), y: Math.round(world.y / GRID) };
    }
  }

  // 4. Closest points between polylines
  let bestDist = Infinity;
  let bestMid = { x: (pts1[0].x + pts2[0].x) / 2, y: (pts1[0].y + pts2[0].y) / 2 };

  for (const p1 of pts1) {
    const near = nearestOnPolyline(pts2, p1);
    if (near) {
      const d = Math.hypot(near.x - p1.x, near.y - p1.y);
      if (d < bestDist) {
        bestDist = d;
        bestMid = { x: (p1.x + near.x) / 2, y: (p1.y + near.y) / 2 };
      }
    }
  }

  return { x: Math.round(bestMid.x / GRID), y: Math.round(bestMid.y / GRID) };
}

/**
 * Find all wire IDs that belong to the same contiguous connected electrical net/branch
 * as the given wire(s).
 */
export function getConnectedWireIds(circuit: Circuit, startWireIds: string[] | string): Set<string> {
  const seeds = Array.isArray(startWireIds) ? startWireIds : [startWireIds];
  const initialValid = seeds.filter((id) => circuit.wires.some((w) => w.id === id));
  if (initialValid.length === 0) return new Set();

  const getNodeKey = (ref: PortRef): string => {
    if (isJunction(ref.symbolId, circuit)) {
      return `junction:${ref.symbolId}`;
    }
    const sym = circuit.symbols.find((s) => s.id === ref.symbolId);
    const dev = sym && circuit.devices.find((d) => d.id === sym.deviceId);
    if (dev?.kind === "net-label") {
      const tag = dev.tag.trim();
      if (tag) return `net:${tag}`;
    }
    return `port:${ref.symbolId}:${ref.term}`;
  };

  const nodeToWires = new Map<string, string[]>();
  const wireToNodes = new Map<string, [string, string]>();

  for (const w of circuit.wires) {
    const na = getNodeKey(w.a);
    const nb = getNodeKey(w.b);
    wireToNodes.set(w.id, [na, nb]);

    if (!nodeToWires.has(na)) nodeToWires.set(na, []);
    nodeToWires.get(na)!.push(w.id);

    if (!nodeToWires.has(nb)) nodeToWires.set(nb, []);
    nodeToWires.get(nb)!.push(w.id);
  }

  const visitedWires = new Set<string>(initialValid);
  const queue = [...initialValid];

  while (queue.length > 0) {
    const curWireId = queue.shift()!;
    const nodes = wireToNodes.get(curWireId);
    if (!nodes) continue;

    for (const nodeKey of nodes) {
      const neighborWireIds = nodeToWires.get(nodeKey);
      if (neighborWireIds) {
        for (const nWireId of neighborWireIds) {
          if (!visitedWires.has(nWireId)) {
            visitedWires.add(nWireId);
            queue.push(nWireId);
          }
        }
      }
    }
  }

  return visitedWires;
}

/** Check if two wires are connected topologically, by shared node/net, or intersecting geometrically. */
export function areWiresConnected(circuit: Circuit, wireId1: string, wireId2: string): boolean {
  const w1 = circuit.wires.find((w) => w.id === wireId1);
  const w2 = circuit.wires.find((w) => w.id === wireId2);
  if (!w1 || !w2 || w1.id === w2.id) return false;

  // 1. Direct topological connection (shared port, junction, net label, multi-hop net)
  if (getConnectedWireIds(circuit, [wireId1]).has(wireId2)) {
    return true;
  }

  // 2. Geometric intersection or close proximity (for merging intersecting wires)
  const pts1 = wireRoute(circuit, w1.a, w1.b, w1.jog);
  const pts2 = wireRoute(circuit, w2.a, w2.b, w2.jog);
  for (let i = 0; i < pts1.length - 1; i++) {
    for (let j = 0; j < pts2.length - 1; j++) {
      const a1 = pts1[i];
      const b1 = pts1[i + 1];
      const a2 = pts2[j];
      const b2 = pts2[j + 1];
      const denom = (b2.y - a2.y) * (b1.x - a1.x) - (b2.x - a2.x) * (b1.y - a1.y);
      if (Math.abs(denom) >= 0.001) {
        const ua = ((b2.x - a2.x) * (a1.y - a2.y) - (b2.y - a2.y) * (a1.x - a2.x)) / denom;
        const ub = ((b1.x - a1.x) * (a1.y - a2.y) - (b1.y - a1.y) * (a1.x - a2.x)) / denom;
        if (ua >= -0.05 && ua <= 1.05 && ub >= -0.05 && ub <= 1.05) return true;
      } else {
        if (distToSegment(a2, a1, b1) < GRID * 1.2 || distToSegment(b2, a1, b1) < GRID * 1.2) {
          return true;
        }
      }
    }
  }

  return false;
}

/** Find wire IDs whose route passes through or intersects the given bounding rectangle (in grid units). */
export function wiresInRect(
  circuit: Circuit,
  rect: { x: number; y: number; w: number; h: number },
  routes?: Map<string, { x: number; y: number }[]>,
): string[] {
  const result: string[] = [];
  const rx0 = rect.x * GRID;
  const ry0 = rect.y * GRID;
  const rx1 = (rect.x + rect.w) * GRID;
  const ry1 = (rect.y + rect.h) * GRID;
  const minX = Math.min(rx0, rx1);
  const maxX = Math.max(rx0, rx1);
  const minY = Math.min(ry0, ry1);
  const maxY = Math.max(ry0, ry1);

  for (const w of circuit.wires) {
    const pts = routes?.get(w.id) ?? wireRoute(circuit, w.a, w.b, w.jog);
    let hit = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const segMinX = Math.min(p1.x, p2.x);
        const segMaxX = Math.max(p1.x, p2.x);
        const segMinY = Math.min(p1.y, p2.y);
        const segMaxY = Math.max(p1.y, p2.y);
        if (segMaxX >= minX && segMinX <= maxX && segMaxY >= minY && segMinY <= maxY) {
          hit = true;
          break;
        }
      }
    }
    if (hit) result.push(w.id);
  }
  return result;
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

/** A crossing of two unconnected wires. The hopping wire draws an arc (semicircle or merged arch). */
export interface WireCrossover {
  x: number;
  y: number;
  hopWireId: string;
  /** "x" = vertical hop (constant x, bulge right); "y" = horizontal hop (bulge up). */
  hopAxis: "x" | "y";
  /** Horizontal radius of the arc. */
  rx?: number;
  /** Vertical radius of the arc. */
  ry?: number;
  /** Number of crossed wires spanned by this arc. */
  count?: number;
}

function sharesJunction(a: { a: PortRef; b: PortRef }, b: { a: PortRef; b: PortRef }, circuit: Circuit): boolean {
  const ids = [a.a.symbolId, a.b.symbolId];
  return ids.some((id) => (b.a.symbolId === id || b.b.symbolId === id) && isJunction(id, circuit));
}

/** Find unconnected wire crossings. Vertical wire hops over horizontal. Merges multiple close crossings into a single larger arc. */
export function findWireCrossovers(circuit: Circuit, routes?: Map<string, Pt[]>): WireCrossover[] {
  const rawCrossings: { x: number; y: number; hopWireId: string; hopAxis: "x" | "y" }[] = [];
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

          const hopAxis: "x" | "y" = axisA === "x" || axisB === "x" ? "x" : "y";
          const hopWireId = hopAxis === axisA ? wireA.wire.id : wireB.wire.id;
          if (!rawCrossings.some((c) => c.hopWireId === hopWireId && Math.hypot(c.x - intersect.x, c.y - intersect.y) < 2)) {
            rawCrossings.push({ x: intersect.x, y: intersect.y, hopWireId, hopAxis });
          }
        }
      }
    }
  }

  const MAX_MERGE_GAP = 50;
  const crossovers: WireCrossover[] = [];

  for (const item of wireSegments) {
    const w = item.wire;
    const wireRaw = rawCrossings.filter((c) => c.hopWireId === w.id);
    if (!wireRaw.length) continue;

    for (const seg of item.segments) {
      const segAxis = segmentAxis(seg.a, seg.b);
      if (!segAxis) continue;

      const segHits = wireRaw.filter((h) => h.hopAxis === segAxis && distToSegment(h, seg.a, seg.b) < 1.5);
      if (!segHits.length) continue;

      if (segAxis === "x") {
        segHits.sort((p, q) => p.y - q.y);
      } else {
        segHits.sort((p, q) => p.x - q.x);
      }

      const clusters: typeof segHits[] = [];
      for (const hit of segHits) {
        if (!clusters.length) {
          clusters.push([hit]);
        } else {
          const curCluster = clusters[clusters.length - 1];
          const lastHit = curCluster[curCluster.length - 1];
          const gap = segAxis === "x" ? Math.abs(hit.y - lastHit.y) : Math.abs(hit.x - lastHit.x);
          if (gap <= MAX_MERGE_GAP) {
            curCluster.push(hit);
          } else {
            clusters.push([hit]);
          }
        }
      }

      for (const cluster of clusters) {
        if (cluster.length === 1) {
          crossovers.push({
            x: cluster[0].x,
            y: cluster[0].y,
            hopWireId: w.id,
            hopAxis: segAxis,
            rx: HOP_R,
            ry: HOP_R,
            count: 1,
          });
        } else {
          const first = cluster[0];
          const last = cluster[cluster.length - 1];
          if (segAxis === "x") {
            const yMin = Math.min(first.y, last.y);
            const yMax = Math.max(first.y, last.y);
            const span = yMax - yMin;
            const pad = 9;
            const rParallel = span / 2 + pad;
            const rPerp = Math.min(22, Math.max(10, Math.round(7 + rParallel * 0.35)));
            const yc = (yMin + yMax) / 2;
            crossovers.push({
              x: first.x,
              y: yc,
              hopWireId: w.id,
              hopAxis: "x",
              rx: rPerp,
              ry: rParallel,
              count: cluster.length,
            });
          } else {
            const xMin = Math.min(first.x, last.x);
            const xMax = Math.max(first.x, last.x);
            const span = xMax - xMin;
            const pad = 9;
            const rParallel = span / 2 + pad;
            const rPerp = Math.min(22, Math.max(10, Math.round(7 + rParallel * 0.35)));
            const xc = (xMin + xMax) / 2;
            crossovers.push({
              x: xc,
              y: first.y,
              hopWireId: w.id,
              hopAxis: "y",
              rx: rParallel,
              ry: rPerp,
              count: cluster.length,
            });
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

/** Semicircle or merged elliptical arc overlay for a hop, always the same geometry as `polylinePathD`. */
export function hopArcD(c: WireCrossover, r = HOP_R): string {
  const rx = c.rx ?? r;
  const ry = c.ry ?? r;
  if (c.hopAxis === "x") {
    return `M ${c.x} ${c.y - ry} A ${rx} ${ry} 0 0 1 ${c.x} ${c.y + ry}`;
  }
  return `M ${c.x - rx} ${c.y} A ${rx} ${ry} 0 0 0 ${c.x + rx} ${c.y}`;
}

function hopsOnSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  hops: WireCrossover[],
): WireCrossover[] {
  const axis = segmentAxis(a, b);
  if (!axis) return [];
  const hits = hops.filter((h) => {
    if (h.hopAxis !== axis) return false;
    if (distToSegment(h, a, b) > 1.5) return false;
    const da = Math.hypot(h.x - a.x, h.y - a.y);
    const db = Math.hypot(h.x - b.x, h.y - b.y);
    return da >= 2 && db >= 2;
  });
  hits.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
  return hits;
}

/** SVG path along an orthogonal polyline, with hop semicircles or merged arches on the hopping wire. */
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
    const onSeg = hopsOnSegment(a, b, hops);
    let cursor = a;
    for (const hop of onSeg) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1) continue;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const rPar = hop.hopAxis === "x" ? (hop.ry ?? r) : (hop.rx ?? r);
      const rx = hop.rx ?? r;
      const ry = hop.ry ?? r;
      const before = { x: hop.x - ux * rPar, y: hop.y - uy * rPar };
      const after = { x: hop.x + ux * rPar, y: hop.y + uy * rPar };
      const forwardDist = (before.x - cursor.x) * ux + (before.y - cursor.y) * uy;
      if (forwardDist < -0.1) continue;
      parts.push(`L ${before.x} ${before.y}`);
      parts.push(`A ${rx} ${ry} 0 0 ${hopSweep(hop.hopAxis, before, after)} ${after.x} ${after.y}`);
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
