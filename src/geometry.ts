import { resolvedVariant, type VariantDef } from "./catalog";
import { isRailKind, railBusTerminals, railTermId } from "./rails/railBus";
import { isNamedNetKind, namedNetKey, netTerminalPinSide } from "./namedNets";
import { GRID, type Circuit, type PortRef, type Rot, type SymbolInst, type TerminalDef, type Wire, type WireJog } from "./types";

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
  const v = resolvedVariant(kind, sym.variant, params);
  const s = kind === "net-terminal" ? 1 : (params?.scale ?? 1);
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
  if (
    (isRailKind(dev.kind) || dev.kind === "rail-break") &&
    typeof dev.params.railY0 === "number" &&
    typeof dev.params.railY1 === "number"
  ) {
    const lo = Math.min(dev.params.railY0, dev.params.railY1);
    const hi = Math.max(dev.params.railY0, dev.params.railY1);
    return { x: sym.x, y: lo, w: 1, h: Math.max(1, hi - lo) };
  }
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
  let term = v.terminals.find((t: TerminalDef) => t.id === termId);
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
    if (mapped) term = v.terminals.find((t: TerminalDef) => t.id === mapped);
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
  if (isRailKind(dev.kind)) {
    const term = railBusTerminals(sym, dev).find((t) => t.id === ref.term);
    if (!term) return null;
    return { x: (sym.x + term.x) * GRID, y: (sym.y + term.y) * GRID };
  }
  const v = resolvedVariant(dev.kind, sym.variant, dev.params);
  const term = lookupTerminal(v, dev.kind, ref.term);
  if (!term) return null;
  const s = dev.kind === "net-terminal" ? 1 : (dev.params?.scale ?? 1);
  const termX = term.x * s;
  const termY = term.y * s;
  const vw = v.w * s;
  const vh = v.h * s;
  const flipped = applyFlip(termX, termY, vw, vh, sym.flipX, sym.flipY);
  const p = rotatePoint(flipped.x, flipped.y, vw, vh, sym.rot);
  return { x: (sym.x + p.x) * GRID, y: (sym.y + p.y) * GRID };
}

export const STUB = GRID / 4;

export function snapPxToGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}

export function snapPointToGrid(p: { x: number; y: number }): { x: number; y: number } {
  return { x: snapPxToGrid(p.x), y: snapPxToGrid(p.y) };
}

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
  if (dev.kind === "junction" || isNamedNetKind(dev.kind) || isRailKind(dev.kind)) {
    return { x: 0, y: 0 };
  }
  const v = resolvedVariant(dev.kind, sym.variant, dev.params);
  const term = lookupTerminal(v, dev.kind, ref.term);
  if (!term) return { x: 0, y: 0 };
  const s = dev.params?.scale ?? 1;
  const p = applyFlip(term.x * s, term.y * s, v.w * s, v.h * s, sym.flipX, sym.flipY);
  const dl = p.x;
  const dr = v.w * s - p.x;
  const dt = p.y;
  const db = v.h * s - p.y;
  const nearest = Math.min(dl, dr, dt, db);
  const local =
    nearest === dl ? { x: -1, y: 0 } :
    nearest === dr ? { x: 1, y: 0 } :
    nearest === dt ? { x: 0, y: -1 } :
    { x: 0, y: 1 };
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

    const exitH = oaActive ? oa!.x !== 0 : obActive ? ob!.y !== 0 : jog?.axis !== "y";

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
  if (kind === "junction" || (kind !== null && (isNamedNetKind(kind) || isRailKind(kind)))) return 0;
  return STUB;
}

function railSpanPx(circuit: Circuit, port: PortRef): { lo: number; hi: number } | null {
  const sym = circuit.symbols.find((s) => s.id === port.symbolId);
  const dev = sym && circuit.devices.find((d) => d.id === sym.deviceId);
  const y0 = dev?.params.railY0;
  const y1 = dev?.params.railY1;
  if (typeof y0 !== "number" || typeof y1 !== "number") return null;
  return { lo: Math.round(Math.min(y0, y1)) * GRID, hi: Math.round(Math.max(y0, y1)) * GRID };
}

function isRailEndPin(port: PortRef): boolean {
  return port.railPin === "y0" || port.railPin === "y1";
}

/**
 * A wire pinned to a control-rail end square may turn beside the device and
 * enter that square horizontally. Every other rail tap is a straight run.
 */
function approachRail(
  circuit: Circuit,
  from: PortRef,
  to: PortRef,
  a: { x: number; y: number },
  a1: { x: number; y: number },
  oa: { x: number; y: number },
  b: { x: number; y: number },
  b1: { x: number; y: number },
  ob: { x: number; y: number },
  jog: WireJog | undefined,
  isSelf: boolean,
): { x: number; y: number }[] | null {
  if (isSelf) return null;
  const fromKind = portKind(circuit, from);
  const toKind = portKind(circuit, to);
  const fromRail = fromKind !== null && isRailKind(fromKind);
  const toRail = toKind !== null && isRailKind(toKind);
  if (fromRail === toRail) return null;
  if (!(toRail && isRailEndPin(to)) && !(fromRail && isRailEndPin(from))) return null;
  const rail = toRail ? b : a;
  const dev = toRail ? a : b;
  const stub = toRail ? a1 : b1;
  const out = toRail ? oa : ob;
  const jogX = jog?.x ?? (jog?.axis === "x" ? jog.pos : undefined);
  let laneX = jogX ?? stub.x;
  if (jogX === undefined && Math.abs(laneX - rail.x) < 1) {
    const dir = out.x !== 0 ? out.x : Math.sign(dev.x - rail.x) || 1;
    laneX = dev.x + dir * GRID;
  }
  const knee = { x: laneX, y: stub.y };
  const corner = { x: laneX, y: rail.y };
  return toRail ? [a, stub, knee, corner, b] : [a, corner, knee, stub, b];
}

const TRANSFORMER_PRIMARY_TERMS = new Set(["H1", "H2", "H3", "H4"]);

function isTransformerPrimaryTerm(circuit: Circuit, ref: PortRef): boolean {
  if (portKind(circuit, ref) !== "transformer") return false;
  return TRANSFORMER_PRIMARY_TERMS.has(ref.term.trim().toUpperCase());
}

/** H1–H4 share one transformer edge, so a link between them is that edge. */
function isTransformerPrimaryLink(circuit: Circuit, from: PortRef, to: PortRef): boolean {
  return isTransformerPrimaryTerm(circuit, from) && isTransformerPrimaryTerm(circuit, to);
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
    // Same-symbol H1–H4 would otherwise leave sideways and come back as a C.
    if (
      isTransformerPrimaryLink(circuit, from, to) &&
      (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5)
    ) {
      return [a, b];
    }
    const isSelf = from.symbolId === to.symbolId;
    const fromKind = portKind(circuit, from);
    const toKind = portKind(circuit, to);
    const fromRail = fromKind !== null && isRailKind(fromKind);
    const toRail = toKind !== null && isRailKind(toKind);
    // Ordinary control-rail taps stay one horizontal line. An end-square pin
    // may keep a dragged corner beside the device and still enter horizontally.
    if (!isSelf && fromRail !== toRail) {
      const pinned = (toRail && isRailEndPin(to)) || (fromRail && isRailEndPin(from));
      if (pinned && jog) {
        const ob = terminalOutward(circuit, to);
        const sb = stubLen(circuit, to);
        const b1 = { x: b.x + ob.x * sb, y: b.y + ob.y * sb };
        const railPath = approachRail(circuit, from, to, a, a1, oa, b, b1, ob, jog, isSelf);
        if (railPath) return cleanPolyline(railPath);
      }
      // Stay attached: past the rail's end, run along the rail column to the nearest end.
      const dev = toRail ? a : b;
      const span = railSpanPx(circuit, toRail ? to : from);
      const tapY = span ? Math.min(span.hi, Math.max(span.lo, dev.y)) : dev.y;
      const corner = { x: toRail ? b.x : a.x, y: dev.y };
      const tap = { x: corner.x, y: tapY };
      const run = Math.abs(tapY - dev.y) < 0.5 ? [dev, corner] : [dev, corner, tap];
      return toRail ? cleanPolyline(run) : cleanPolyline(run.reverse());
    }
    if (!isSelf && !jog && (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5)) {
      return [a, b];
    }
    const pinned = (toRail && isRailEndPin(to)) || (fromRail && isRailEndPin(from));
    if (!isSelf && !jog && fromRail !== toRail && !pinned) {
      return toRail ? [a, { x: b.x, y: a.y }] : [{ x: a.x, y: b.y }, b];
    }
    const ob = terminalOutward(circuit, to);
    const sb = stubLen(circuit, to);
    const b1 = { x: b.x + ob.x * sb, y: b.y + ob.y * sb };
    const railPath = approachRail(circuit, from, to, a, a1, oa, b, b1, ob, jog, isSelf);
    if (railPath) return cleanPolyline(railPath);
    for (const p of betweenStubs(a1, b1, oa, ob, jog, isSelf).slice(1)) append(pts, p);
    append(pts, b);
    return cleanPolyline(pts);
  }
  const dest = snapPointToGrid(to);
  if (!jog && (Math.abs(a.x - dest.x) < 0.5 || Math.abs(a.y - dest.y) < 0.5)) {
    return [a, dest];
  }
  const mid = oa.x !== 0 ? { x: dest.x, y: a1.y } : { x: a1.x, y: dest.y };
  append(pts, mid);
  append(pts, dest);
  return cleanPolyline(pts);
}

/**
 * Free-cursor target for a wire being drawn.
 * A perpendicular leg of one grid or less is dropped so the preview stays
 * orthogonal and matches the junction that a drop will create. The outward
 * stub is unchanged.
 */
export function wiringTarget(
  circuit: Circuit,
  from: PortRef,
  point: { x: number; y: number },
): { x: number; y: number } {
  const dest = snapPointToGrid(point);
  const a = terminalWorld(circuit, from);
  if (!a) return dest;
  const oa = terminalOutward(circuit, from);
  // One grid is the smallest cursor step, so a single-cell perpendicular
  // leg is the short corner. Two cells and beyond stay.
  const nearY = Math.abs(dest.y - a.y) <= GRID;
  const nearX = Math.abs(dest.x - a.x) <= GRID;
  if (oa.x !== 0 && nearY) return snapPointToGrid({ x: dest.x, y: a.y });
  if (oa.y !== 0 && nearX) return snapPointToGrid({ x: a.x, y: dest.y });
  if (oa.x === 0 && oa.y === 0) {
    if (nearY && Math.abs(dest.x - a.x) > GRID) return snapPointToGrid({ x: dest.x, y: a.y });
    if (nearX && Math.abs(dest.y - a.y) > GRID) return snapPointToGrid({ x: a.x, y: dest.y });
  }
  return dest;
}

/** Move one orthogonal segment onto `pos`. Terminal endpoints stay put. */
export function slideOrthogonalSegment(
  pts: { x: number; y: number }[],
  index: number,
  axis: "x" | "y",
  pos: number,
): { x: number; y: number }[] {
  if (pts.length < 2 || index < 0 || index >= pts.length - 1) return pts.map((p) => ({ ...p }));
  // A straight run has no interior corner. Keep both terminals and park the
  // grabbed segment on `pos`, with the bends at the terminal rows or columns.
  if (index === 0 && index + 1 === pts.length - 1) {
    const a = pts[0];
    const b = pts[1];
    const seg = segmentAxis(a, b);
    if (seg === "x") return cleanPolyline([a, { x: pos, y: a.y }, { x: pos, y: b.y }, b]);
    if (seg === "y") return cleanPolyline([a, { x: a.x, y: pos }, { x: b.x, y: pos }, b]);
  }
  const moved = pts.map((p) => ({ ...p }));
  if (index > 0) {
    if (axis === "x") moved[index].x = pos;
    else moved[index].y = pos;
  }
  if (index + 1 < pts.length - 1) {
    if (axis === "x") moved[index + 1].x = pos;
    else moved[index + 1].y = pos;
  }
  const out = moved.slice();
  if (out.length >= 2 && Math.abs(out[1].x - out[0].x) > 0.5 && Math.abs(out[1].y - out[0].y) > 0.5) {
    const original = segmentAxis(pts[0], pts[1]);
    const bend = original === "x"
      ? { x: out[0].x, y: out[1].y }
      : { x: out[1].x, y: out[0].y };
    out.splice(1, 0, bend);
  }
  const n = out.length;
  if (n >= 2 && Math.abs(out[n - 1].x - out[n - 2].x) > 0.5 && Math.abs(out[n - 1].y - out[n - 2].y) > 0.5) {
    const original = segmentAxis(pts[pts.length - 2], pts[pts.length - 1]);
    const bend = original === "x"
      ? { x: out[n - 1].x, y: out[n - 2].y }
      : { x: out[n - 2].x, y: out[n - 1].y };
    out.splice(n - 1, 0, bend);
  }
  return cleanPolyline(out);
}

/**
 * Slide one segment onto `pos`. Junction vertices marked in `movable` move
 * with that segment so the path does not travel out and back.
 */
export function slideSegmentWithJunctions(
  pts: { x: number; y: number }[],
  index: number,
  axis: "x" | "y",
  pos: number,
  movable: boolean[],
): { x: number; y: number }[] {
  if (!movable.some(Boolean)) return slideOrthogonalSegment(pts, index, axis, pos);
  const seeded = pts.map((p, i) => {
    if (!movable[i]) return { ...p };
    return axis === "x" ? { x: pos, y: p.y } : { x: p.x, y: pos };
  });
  // The junction is the other end of an elbow. Park the grabbed run on `pos`
  // and let that junction meet it, instead of keeping the old corner.
  const onGrabbed = Boolean(movable[index] || movable[index + 1]);
  if (!onGrabbed && seeded.length > 2) {
    const a = seeded[0];
    const b = seeded[seeded.length - 1];
    if (axis === "x") return cleanPolyline([a, { x: pos, y: a.y }, { x: pos, y: b.y }, b]);
    return cleanPolyline([a, { x: a.x, y: pos }, { x: b.x, y: pos }, b]);
  }
  if (seeded.length === 2) {
    const a = seeded[0];
    const b = seeded[1];
    if (axis === "x") return cleanPolyline([a, { x: pos, y: a.y }, { x: pos, y: b.y }, b]);
    return cleanPolyline([a, { x: a.x, y: pos }, { x: b.x, y: pos }, b]);
  }
  return slideOrthogonalSegment(seeded, index, axis, pos);
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
  if (kind === "junction" || (kind !== null && isNamedNetKind(kind))) return false;
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

function colorLanes(comp: Occ[], netOf?: (id: string) => string): Map<string, number> {
  // Segments of the same electrical net may share a lane: they are the same conductor.
  const units: { members: Occ[]; lo: number; hi: number; score: number; id: string }[] = [];
  for (const o of comp) {
    const net = netOf ? netOf(o.id) : o.id;
    const u = netOf ? units.find((x) => netOf(x.id) === net && overlapSpan(x.lo, x.hi, o.lo, o.hi) >= -0.5) : undefined;
    if (u) {
      u.members.push(o);
      u.lo = Math.min(u.lo, o.lo);
      u.hi = Math.max(u.hi, o.hi);
      u.score = Math.min(u.score, o.score);
    } else {
      units.push({ members: [o], lo: o.lo, hi: o.hi, score: o.score, id: o.id });
    }
  }
  const sorted = [...units].sort((a, b) => a.score - b.score || a.lo - b.lo || a.id.localeCompare(b.id));
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
    for (const m of o.members) lanes.set(`${m.id}:${m.i}`, lane);
  }
  return lanes;
}

function wireNetResolver(circuit: Circuit): (id: string) => string {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(k, r);
    return r;
  };
  const node = (p: PortRef) => (portKind(circuit, p) === "junction" ? `j:${p.symbolId}` : `p:${p.symbolId}:${p.term}`);
  for (const w of circuit.wires) {
    if (w.broken) continue;
    const a = find(node(w.a));
    const b = find(node(w.b));
    if (a !== b) parent.set(a, b);
  }
  const byWire = new Map<string, string>();
  for (const w of circuit.wires) byWire.set(w.id, w.broken ? `w:${w.id}` : find(node(w.a)));
  return (id) => byWire.get(id) ?? id;
}

/**
 * Apply lane shifts by sliding the corners of the shifted segment along their
 * neighbouring perpendicular segments, so no extra bumps are introduced.
 * Falls back to per-segment bumps when a neighbour would collapse or reverse.
 */
function applyLaneShifts(pts: Pt[], shiftOf: (i: number) => number): Pt[] {
  const n = pts.length;
  const segs = n - 1;
  const d: number[] = [];
  let any = false;
  for (let i = 0; i < segs; i += 1) {
    d.push(shiftOf(i));
    if (Math.abs(d[i]) >= 0.5) any = true;
  }
  if (!any) return pts;
  const moved = pts.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 0; i < segs; i += 1) {
    if (Math.abs(d[i]) < 0.5) continue;
    const axis = segmentAxis(pts[i], pts[i + 1]);
    for (const k of [i, i + 1]) {
      if (k === 0 || k === n - 1) continue;
      if (axis === "x") moved[k].x = pts[k].x + d[i];
      else moved[k].y = pts[k].y + d[i];
    }
  }
  let ok = true;
  for (let i = 0; i < segs && ok; i += 1) {
    const ox = pts[i + 1].x - pts[i].x;
    const oy = pts[i + 1].y - pts[i].y;
    const shiftedEnd = (i === 0 && Math.abs(d[0]) >= 0.5) || (i === segs - 1 && Math.abs(d[segs - 1]) >= 0.5);
    if (shiftedEnd) continue;
    const nx = moved[i + 1].x - moved[i].x;
    const ny = moved[i + 1].y - moved[i].y;
    const ol = ox + oy;
    const nl = nx + ny;
    if (Math.abs(nx) > 0.5 && Math.abs(ny) > 0.5) ok = false;
    else if (Math.abs(ol) >= 0.5 && (Math.sign(ol) !== Math.sign(nl) || Math.abs(nl) < 3)) ok = false;
  }
  if (!ok) {
    const rebuilt: Pt[] = [{ x: pts[0].x, y: pts[0].y }];
    for (let i = 0; i < segs; i += 1) {
      const A = pts[i];
      const B = pts[i + 1];
      if (Math.abs(d[i]) < 0.5) {
        rebuilt.push({ x: B.x, y: B.y });
        continue;
      }
      const axis = segmentAxis(A, B);
      const ox = axis === "x" ? d[i] : 0;
      const oy = axis === "y" ? d[i] : 0;
      rebuilt.push({ x: A.x + ox, y: A.y + oy });
      rebuilt.push({ x: B.x + ox, y: B.y + oy });
      rebuilt.push({ x: B.x, y: B.y });
    }
    return rebuilt;
  }
  const out: Pt[] = [moved[0]];
  if (Math.abs(d[0]) >= 0.5) {
    const axis = segmentAxis(pts[0], pts[1]);
    out.push(axis === "x" ? { x: pts[0].x + d[0], y: pts[0].y } : { x: pts[0].x, y: pts[0].y + d[0] });
  }
  for (let k = 1; k < n - 1; k += 1) out.push(moved[k]);
  if (segs > 0 && Math.abs(d[segs - 1]) >= 0.5) {
    const axis = segmentAxis(pts[n - 2], pts[n - 1]);
    out.push(axis === "x" ? { x: pts[n - 1].x + d[segs - 1], y: pts[n - 1].y } : { x: pts[n - 1].x, y: pts[n - 1].y + d[segs - 1] });
  }
  out.push(moved[n - 1]);
  return out;
}

function cleanPolyline(pts: Pt[]): Pt[] {
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

function polylineMatches(a: Pt[], b: Pt[], tol = 0.5): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > tol || Math.abs(a[i].y - b[i].y) > tol) {
      return false;
    }
  }
  return true;
}

function polylineDistance(a: Pt[], b: Pt[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  if (a.length === b.length) {
    let maxD = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
      if (d > maxD) maxD = d;
    }
    return maxD;
  }
  let maxD = 0;
  for (const p of a) {
    let minD = Infinity;
    for (let j = 0; j < b.length - 1; j++) {
      const d = distToSegment(p, b[j], b[j + 1]);
      if (d < minD) minD = d;
    }
    if (minD > maxD) maxD = minD;
  }
  for (const p of b) {
    let minD = Infinity;
    for (let j = 0; j < a.length - 1; j++) {
      const d = distToSegment(p, a[j], a[j + 1]);
      if (d < minD) minD = d;
    }
    if (minD > maxD) maxD = minD;
  }
  return maxD + Math.abs(a.length - b.length) * 10;
}

function jogSimplicityScore(jog: WireJog | undefined): number {
  if (!jog) return 0;
  let score = 0;
  if (jog.axis !== undefined) score += 1;
  if (jog.pos !== undefined) score += 1;
  if (jog.x !== undefined) score += 2;
  if (jog.y !== undefined) score += 2;
  return score;
}

/**
 * Given a circuit, two port endpoints (from, to), and a desired polyline route (targetPts),
 * derives the WireJog (if any) that makes wireRoute(circuit, from, to, jog) reproduce targetPts.
 */
export function deriveJogToMatchPolyline(
  circuit: Circuit,
  from: PortRef,
  to: PortRef,
  targetPts: Pt[],
): WireJog | undefined {
  const cleanTarget = cleanPolyline(targetPts);
  if (cleanTarget.length <= 1) return undefined;

  const candidates: (WireJog | undefined)[] = [undefined];

  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const p of cleanTarget) {
    xs.add(Math.round(p.x / GRID) * GRID);
    ys.add(Math.round(p.y / GRID) * GRID);
    xs.add(p.x);
    ys.add(p.y);
  }

  // Single axis / coord candidates
  for (const x of xs) {
    candidates.push({ x });
    candidates.push({ axis: "x", pos: x });
    candidates.push({ axis: "x", pos: x, x });
  }
  for (const y of ys) {
    candidates.push({ y });
    candidates.push({ axis: "y", pos: y });
    candidates.push({ axis: "y", pos: y, y });
  }

  // Intermediate corners from cleanTarget
  for (let i = 1; i < cleanTarget.length - 1; i++) {
    const p = cleanTarget[i];
    candidates.push({ x: p.x, y: p.y });
    candidates.push({ axis: "x", pos: p.x, x: p.x, y: p.y });
    candidates.push({ axis: "y", pos: p.y, x: p.x, y: p.y });
  }

  // Cross pairs of X and Y
  for (const x of xs) {
    for (const y of ys) {
      candidates.push({ x, y });
      candidates.push({ axis: "x", pos: x, x, y });
      candidates.push({ axis: "y", pos: y, x, y });
    }
  }

  // Deduplicate candidates
  const candidateMap = new Map<string, WireJog | undefined>();
  for (const cand of candidates) {
    const key = cand ? `${cand.axis}:${cand.pos}:${cand.x}:${cand.y}` : "none";
    if (!candidateMap.has(key)) {
      candidateMap.set(key, cand);
    }
  }

  let bestExact: WireJog | undefined = undefined;
  let bestExactScore = Infinity;

  let bestApprox: WireJog | undefined = undefined;
  let bestApproxDist = Infinity;

  for (const cand of candidateMap.values()) {
    const route = cleanPolyline(wireRoute(circuit, from, to, cand));
    if (polylineMatches(route, cleanTarget)) {
      const score = jogSimplicityScore(cand);
      if (score < bestExactScore) {
        bestExactScore = score;
        bestExact = cand;
      }
    } else if (bestExactScore === Infinity) {
      const dist = polylineDistance(route, cleanTarget);
      if (dist < bestApproxDist) {
        bestApproxDist = dist;
        bestApprox = cand;
      }
    }
  }

  if (bestExactScore !== Infinity) {
    return bestExact;
  }

  return bestApprox;
}

/** Jog that reproduces `targetPts`, or undefined when no jog matches exactly. */
export function jogForPolyline(
  circuit: Circuit,
  from: PortRef,
  to: PortRef,
  targetPts: Pt[],
): WireJog | undefined {
  const jog = deriveJogToMatchPolyline(circuit, from, to, targetPts);
  const route = cleanPolyline(wireRoute(circuit, from, to, jog));
  return polylineMatches(route, cleanPolyline(targetPts)) ? jog : undefined;
}

function keepsTerminalExit(circuit: Circuit, from: PortRef, to: PortRef, pts: Pt[]): boolean {
  if (pts.length <= 2) return true;
  const leaves = (ref: PortRef, tip: Pt, next: Pt) => {
    const out = terminalOutward(circuit, ref);
    if (out.x === 0 && out.y === 0) return true;
    const dx = next.x - tip.x;
    const dy = next.y - tip.y;
    if (out.x !== 0) return Math.abs(dy) < 0.8 && dx * out.x > 0.5;
    return Math.abs(dx) < 0.8 && dy * out.y > 0.5;
  };
  return leaves(from, pts[0], pts[1]) && leaves(to, pts[pts.length - 1], pts[pts.length - 2]);
}

function sameWireRoute(
  circuit: Circuit,
  from: PortRef,
  to: PortRef,
  jog: WireJog | undefined,
  targetPts: Pt[],
): boolean {
  return polylineMatches(cleanPolyline(wireRoute(circuit, from, to, jog)), cleanPolyline(targetPts));
}

function polyLength(pts: Pt[]): number {
  let length = 0;
  for (let i = 1; i < pts.length; i += 1) {
    length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return length;
}

function segmentLiesOn(pts: Pt[], axis: "x" | "y", pos: number): boolean {
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (segmentAxis(pts[i], pts[i + 1]) !== axis) continue;
    const fixed = axis === "x" ? pts[i].x : pts[i].y;
    if (Math.abs(fixed - pos) < 0.8) return true;
  }
  return false;
}

/**
 * Jog that keeps a junction slide on `pos`.
 * An exact stored path wins. A straight run needs no jog. Otherwise one elbow
 * on the cursor line is kept when it stays within a stub of the short path.
 */
export function jogForJunctionSlide(
  circuit: Circuit,
  from: PortRef,
  to: PortRef,
  targetPts: Pt[],
  axis: "x" | "y",
  pos: number,
): WireJog | undefined {
  const natural = cleanPolyline(wireRoute(circuit, from, to));
  const target = cleanPolyline(targetPts);
  if (keepsTerminalExit(circuit, from, to, natural) && polyLength(natural) + 0.5 < polyLength(target)) {
    return undefined;
  }
  const exact = jogForPolyline(circuit, from, to, targetPts);
  if (exact && keepsTerminalExit(circuit, from, to, cleanPolyline(targetPts))) return exact;
  if (
    sameWireRoute(circuit, from, to, undefined, targetPts) &&
    keepsTerminalExit(circuit, from, to, cleanPolyline(wireRoute(circuit, from, to)))
  ) {
    return undefined;
  }
  const candidate: WireJog = axis === "y" ? { axis: "y", pos, y: pos } : { axis: "x", pos, x: pos };
  const route = cleanPolyline(wireRoute(circuit, from, to, candidate));
  if (route.length < 2 || !segmentLiesOn(route, axis, pos) || !keepsTerminalExit(circuit, from, to, route)) {
    return undefined;
  }
  const shortest = polyLength(manhattan(route[0], route[route.length - 1]));
  if (polyLength(route) > shortest + GRID + STUB + 1) return undefined;
  const stored = jogForPolyline(circuit, from, to, route);
  if (stored) return stored;
  if (sameWireRoute(circuit, from, to, undefined, route)) return undefined;
  return candidate;
}

/**
 * Jog for a drag that cannot move either endpoint.
 * Undefined leaves the natural stub-preserving route, so a perpendicular
 * pull does not store the out-and-back bend.
 */
export function jogForFixedSegmentDrag(
  circuit: Circuit,
  from: PortRef,
  to: PortRef,
  originPts: { x: number; y: number }[],
  index: number,
  axis: "x" | "y",
  pos: number,
): WireJog | undefined {
  const slid = slideOrthogonalSegment(originPts, index, axis, pos);
  return jogForJunctionSlide(circuit, from, to, slid, axis, pos);
}

/**
 * Junction endpoints that move with this drag.
 * Either end follows, whichever segment is grabbed, so the far junction
 * is not left behind when the near one slides.
 */
export function junctionFollowVertices(
  circuit: Circuit,
  wire: { id: string; a: PortRef; b: PortRef },
  pts: { x: number; y: number }[],
  _index: number,
  _axis: "x" | "y",
): boolean[] {
  const n = pts.length;
  return pts.map((_, i) => {
    if (n < 2 || (i !== 0 && i !== n - 1)) return false;
    const id = i === 0 ? wire.a.symbolId : wire.b.symbolId;
    return portKind(circuit, { symbolId: id, term: "1" }) === "junction";
  });
}

function pointOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  tol = 1,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return Math.hypot(p.x - a.x, p.y - a.y) < tol;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) < tol;
}

/** Original grid cell of each junction that travels with this wire. */
export function junctionDragBases(
  circuit: Circuit,
  wire: { a: PortRef; b: PortRef },
  pts: { x: number; y: number }[],
): { id: string; x: number; y: number }[] {
  const out: { id: string; x: number; y: number }[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (!id || seen.has(id)) return;
    if (portKind(circuit, { symbolId: id, term: "1" }) !== "junction") return;
    const sym = circuit.symbols.find((s) => s.id === id);
    if (!sym) return;
    seen.add(id);
    out.push({ id, x: sym.x, y: sym.y });
  };
  add(wire.a.symbolId);
  add(wire.b.symbolId);
  for (let i = 0; i < pts.length - 1; i += 1) {
    for (const sym of circuit.symbols) {
      if (seen.has(sym.id)) continue;
      if (portKind(circuit, { symbolId: sym.id, term: "1" }) !== "junction") continue;
      const world = terminalWorld(circuit, { symbolId: sym.id, term: "1" });
      if (!world || !pointOnSegment(world, pts[i], pts[i + 1])) continue;
      add(sym.id);
    }
  }
  return out;
}

/**
 * Grid cell for each followed junction.
 * The junction takes the cursor line on the dragged axis. When that would
 * stack both ends on one cell, they keep their spacing and shift by the
 * same step as the grabbed segment, measured from the drag's starting cells.
 */
export function junctionDragMoves(
  circuit: Circuit,
  wire: { a: PortRef; b: PortRef },
  follow: boolean[],
  axis: "x" | "y",
  pos: number,
  pts?: { x: number; y: number }[],
  index?: number,
  bases?: { id: string; x: number; y: number }[],
): { id: string; x: number; y: number }[] {
  if (follow.length < 2) return [];
  const gridPos = Math.round(pos / GRID);
  let delta = 0;
  let haveDelta = false;
  if (pts && index !== undefined && pts[index]) {
    const old = axis === "x" ? pts[index].x : pts[index].y;
    delta = gridPos - Math.round(old / GRID);
    haveDelta = true;
  }
  const originCell = (id: string): { x: number; y: number } | undefined => {
    const saved = bases?.find((b) => b.id === id);
    if (saved) return { x: saved.x, y: saved.y };
    if (pts && pts.length >= 2) {
      if (id === wire.a.symbolId) return { x: Math.round(pts[0].x / GRID), y: Math.round(pts[0].y / GRID) };
      if (id === wire.b.symbolId) return { x: Math.round(pts[pts.length - 1].x / GRID), y: Math.round(pts[pts.length - 1].y / GRID) };
    }
    const sym = circuit.symbols.find((s) => s.id === id);
    return sym ? { x: sym.x, y: sym.y } : undefined;
  };
  const endpointIds = [
    follow[0] === true ? wire.a.symbolId : "",
    follow[follow.length - 1] === true ? wire.b.symbolId : "",
  ].filter((id) => id && portKind(circuit, { symbolId: id, term: "1" }) === "junction");
  const extraIds: string[] = [];
  const consider = (id: string, world: { x: number; y: number } | null | undefined, a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (!id || endpointIds.includes(id) || extraIds.includes(id)) return;
    if (portKind(circuit, { symbolId: id, term: "1" }) !== "junction") return;
    if (!world || !pointOnSegment(world, a, b)) return;
    extraIds.push(id);
  };
  if (pts) {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      if (bases) {
        for (const base of bases) {
          consider(base.id, { x: base.x * GRID, y: base.y * GRID }, a, b);
        }
      } else {
        for (const sym of circuit.symbols) {
          consider(sym.id, terminalWorld(circuit, { symbolId: sym.id, term: "1" }), a, b);
        }
      }
    }
  }
  const destinations = endpointIds.map((id) => {
    const origin = originCell(id);
    if (!origin) return undefined;
    return {
      x: axis === "x" ? gridPos : origin.x,
      y: axis === "y" ? gridPos : origin.y,
    };
  });
  const stacked = haveDelta
    && destinations.length === 2
    && destinations[0] !== undefined
    && destinations[1] !== undefined
    && destinations[0].x === destinations[1].x
    && destinations[0].y === destinations[1].y;
  const moves: { id: string; x: number; y: number }[] = [];
  const seen = new Set<string>();
  const taken = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id)) return;
    const sym = circuit.symbols.find((s) => s.id === id);
    const origin = originCell(id);
    if (!sym || !origin) return;
    const x = axis === "x" ? (stacked ? origin.x + delta : gridPos) : origin.x;
    const y = axis === "y" ? (stacked ? origin.y + delta : gridPos) : origin.y;
    const cell = `${x},${y}`;
    if (taken.has(cell)) return;
    seen.add(id);
    taken.add(cell);
    if (x === sym.x && y === sym.y) return;
    moves.push({ id, x, y });
  };
  for (const id of endpointIds) push(id);
  for (const id of extraIds) push(id);
  return moves;
}

export { cleanPolyline };

/** Routes every wire, then nudges overlapping parallel runs apart. Terminals stay put. */
/** Geometry fingerprint so routes/crossovers skip recompute when only labels change.
 *  Includes params that move terminals (`pinCount`, `scale`). Tag/color/text do not. */
export function circuitRouteKey(circuit: Circuit): string {
  let key = `${circuit.symbols.length}:${circuit.wires.length}:${circuit.devices.length}|`;
  for (const s of circuit.symbols) {
    key += `${s.id}:${s.deviceId}:${s.x}:${s.y}:${s.rot}:${s.variant}:${s.flipX ? 1 : 0}:${s.flipY ? 1 : 0};`;
  }
  key += "|";
  for (const d of circuit.devices) {
    const pin = d.params.pinCount ?? "";
    const scale = d.params.scale ?? "";
    const railY0 = d.params.railY0 ?? "";
    const railY1 = d.params.railY1 ?? "";
    key += `${d.id}:${d.kind}:${pin}:${scale}:${railY0}:${railY1};`;
  }
  key += "|";
  for (const w of circuit.wires) {
    const j = w.jog;
    key += `${w.id}:${w.a.symbolId}:${w.a.term}:${w.a.railPin ?? ""}:${w.b.symbolId}:${w.b.term}:${w.b.railPin ?? ""}:${w.broken ? 1 : 0}:`;
    key += j ? `${j.axis}:${j.pos}:${j.x ?? ""}:${j.y ?? ""}` : "";
    key += ";";
  }
  return key;
}

export function allWireRoutes(circuit: Circuit, anchorId?: string): Map<string, Pt[]> {
  const base = new Map<string, Pt[]>();
  const byId = new Map<string, { a: PortRef; b: PortRef }>();
  const straightPrimary = new Set<string>();
  for (const w of circuit.wires) {
    const pts = wireRoute(circuit, w.a, w.b, w.jog);
    base.set(w.id, pts);
    byId.set(w.id, w);
    if (pts.length === 2 && isTransformerPrimaryLink(circuit, w.a, w.b)) straightPrimary.add(w.id);
  }
  const occs: Occ[] = [];
  for (const [id, pts] of base) {
    const w = byId.get(id)!;
    occs.push(...collectOcc(circuit, id, w, pts));
  }
  const netOf = wireNetResolver(circuit);
  const clusters = clusterOccs(occs, 8);
  const shift = new Map<string, number>();
  for (const group of clusters) {
    if (group.length < 2) continue;
    for (const comp of overlapComponents(group)) {
      if (comp.length < 2) continue;
      const lanes = colorLanes(comp, netOf);
      const n = 1 + Math.max(0, ...lanes.values());
      if (n < 2) continue;
      const anchorOcc = anchorId ? comp.find((o) => o.id === anchorId) : undefined;
      const primaryOcc = comp.find((o) => straightPrimary.has(o.id));
      const railOcc = comp.find((o) => isRailWire(circuit, byId.get(o.id)!));
      const center = anchorOcc
        ? (lanes.get(`${anchorOcc.id}:${anchorOcc.i}`) ?? 0)
        : primaryOcc
          ? (lanes.get(`${primaryOcc.id}:${primaryOcc.i}`) ?? 0)
          : railOcc
            ? (lanes.get(`${railOcc.id}:${railOcc.i}`) ?? 0)
            : (n - 1) / 2;
      for (const o of comp) {
        if (isRailWire(circuit, byId.get(o.id)!)) continue;
        if (anchorOcc && o.id === anchorId) continue;
        if (straightPrimary.has(o.id)) continue;
        const lane = lanes.get(`${o.id}:${o.i}`) ?? 0;
        const d = (lane - center) * WIRE_LANE;
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
    out.set(id, cleanPolyline(applyLaneShifts(pts, (i) => shift.get(`${id}:${i}`) ?? 0)));
  }
  return out;
}

function isRailWire(circuit: Circuit, w: { a: PortRef; b: PortRef }): boolean {
  const ka = portKind(circuit, w.a);
  const kb = portKind(circuit, w.b);
  return (ka !== null && isRailKind(ka)) || (kb !== null && isRailKind(kb));
}

/** Control-rail tap that is not pinned to an end square. Its jog is ignored. */
export function plainRailTap(circuit: Circuit, w: { a: PortRef; b: PortRef }): boolean {
  const ka = portKind(circuit, w.a);
  const kb = portKind(circuit, w.b);
  const aRail = ka !== null && isRailKind(ka);
  const bRail = kb !== null && isRailKind(kb);
  if (aRail === bRail) return false;
  if (aRail && isRailEndPin(w.a)) return false;
  if (bRail && isRailEndPin(w.b)) return false;
  return true;
}

/** End-square tap. A dragged corner stays beside the device; entry stays horizontal. */
export function endPinnedRailTap(circuit: Circuit, w: { a: PortRef; b: PortRef }): boolean {
  const ka = portKind(circuit, w.a);
  const kb = portKind(circuit, w.b);
  const aRail = ka !== null && isRailKind(ka);
  const bRail = kb !== null && isRailKind(kb);
  if (aRail === bRail) return false;
  return (aRail && isRailEndPin(w.a)) || (bRail && isRailEndPin(w.b));
}

interface RunSeg { axis: "x" | "y"; fixed: number; lo: number; hi: number }

function runSegs(pts: Pt[]): RunSeg[] {
  const out: RunSeg[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const axis = segmentAxis(a, b);
    if (axis === "x") out.push({ axis, fixed: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
    else if (axis === "y") out.push({ axis, fixed: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
  }
  return out;
}

/** Total collinear overlap length between a route and the other nets' routes. */
function overlapWithOthers(pts: Pt[], others: RunSeg[]): number {
  let total = 0;
  for (const s of runSegs(pts)) {
    for (const o of others) {
      if (o.axis !== s.axis || Math.abs(o.fixed - s.fixed) > 0.5) continue;
      const ov = overlapSpan(s.lo, s.hi, o.lo, o.hi);
      if (ov >= 3) total += ov;
    }
  }
  return total;
}

function otherNetSegs(circuit: Circuit, wireId: string, netOf: (id: string) => string): RunSeg[] {
  const net = netOf(wireId);
  const segs: RunSeg[] = [];
  for (const w of circuit.wires) {
    if (w.id === wireId || netOf(w.id) === net) continue;
    segs.push(...runSegs(wireRoute(circuit, w.a, w.b, w.jog)));
  }
  return segs;
}

/** Free distance from `fixed` to the nearest parallel run on each side within span lo..hi. */
function sideSpace(others: RunSeg[], axis: "x" | "y", fixed: number, lo: number, hi: number): { neg: number; pos: number } {
  let neg = Infinity;
  let pos = Infinity;
  for (const o of others) {
    if (o.axis !== axis || overlapSpan(lo, hi, o.lo, o.hi) < 3) continue;
    const d = o.fixed - fixed;
    if (d > 0.5) pos = Math.min(pos, d);
    else if (d < -0.5) neg = Math.min(neg, -d);
  }
  return { neg, pos };
}

function jogAt(jog: WireJog, axis: "x" | "y", pos: number): WireJog {
  const out: WireJog = { ...jog, axis, pos };
  if (axis === "x") out.x = pos;
  else out.y = pos;
  return out;
}

/**
 * Move a dragged/new wire's jog so it never runs on top of another net's wire.
 * Jumps toward the side with more free space. Returns the jog unchanged when clear.
 */
export function avoidWireOverlap(
  circuit: Circuit,
  wireId: string,
  from: PortRef,
  to: PortRef,
  jog: WireJog | undefined,
  maxSteps = 24,
): WireJog | undefined {
  if (isRailWire(circuit, { a: from, b: to })) return jog;
  const netOf = wireNetResolver(circuit);
  const others = otherNetSegs(circuit, wireId, netOf);
  const base = wireRoute(circuit, from, to, jog);
  if (overlapWithOthers(base, others) < 3) return jog;
  const tries: { axis: "x" | "y"; start: number; lo: number; hi: number }[] = [];
  if (jog) {
    const axis = jog.axis ?? (jog.x !== undefined ? "x" : "y");
    const start = (axis === "x" ? (jog.x ?? jog.pos) : (jog.y ?? jog.pos)) ?? 0;
    const seg = runSegs(base).find((s) => s.axis === axis && Math.abs(s.fixed - start) < 0.5);
    tries.push({ axis, start, lo: seg?.lo ?? -Infinity, hi: seg?.hi ?? Infinity });
  } else {
    // New wire: try a jog on whichever overlapping run is longest.
    let best: RunSeg | null = null;
    for (const s of runSegs(base)) {
      if (overlapWithOthers([s.axis === "x" ? { x: s.fixed, y: s.lo } : { x: s.lo, y: s.fixed }, s.axis === "x" ? { x: s.fixed, y: s.hi } : { x: s.hi, y: s.fixed }], others) < 3) continue;
      if (!best || s.hi - s.lo > best.hi - best.lo) best = s;
    }
    if (best) tries.push({ axis: best.axis, start: Math.round(best.fixed / GRID) * GRID, lo: best.lo, hi: best.hi });
    for (const axis of ["x", "y"] as const) {
      const a = terminalWorld(circuit, from);
      const b = terminalWorld(circuit, to);
      if (!a || !b) continue;
      const mid = Math.round(((axis === "x" ? a.x + b.x : a.y + b.y) / 2) / GRID) * GRID;
      tries.push({ axis, start: mid, lo: -Infinity, hi: Infinity });
    }
  }
  let fallback: { jog: WireJog; ov: number } | null = null;
  for (const t of tries) {
    const space = sideSpace(others, t.axis, t.start, t.lo, t.hi);
    const first = space.pos >= space.neg ? 1 : -1;
    for (let k = 0; k <= maxSteps; k += 1) {
      for (const dir of k === 0 ? [0] : [first, -first]) {
        const pos = t.start + dir * k * GRID;
        const cand = jogAt(jog ?? { axis: t.axis, pos }, t.axis, pos);
        const ov = overlapWithOthers(wireRoute(circuit, from, to, cand), others);
        if (ov < 3) return cand;
        if (!fallback || ov < fallback.ov) fallback = { jog: cand, ov };
      }
    }
  }
  return fallback?.jog ?? jog;
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
    const terminals = isRailKind(dev.kind) ? railBusTerminals(sym, dev) : resolvedVariant(dev.kind, sym.variant, dev.params).terminals;
    for (const t of terminals) {
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

/** Half-grid: terminals this close after a snap-move are treated as overlapping. */
export const TERMINAL_OVERLAP_PX = GRID * 0.35;

function uniqueLocatedPorts(circuit: Circuit, symbolId: string): { port: PortRef; x: number; y: number }[] {
  const sym = circuit.symbols.find((s) => s.id === symbolId);
  if (!sym) return [];
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return [];
  const terminals = isRailKind(dev.kind)
    ? railBusTerminals(sym, dev)
    : resolvedVariant(dev.kind, sym.variant, dev.params).terminals;
  const wired = new Set<string>();
  for (const w of circuit.wires) {
    if (w.a.symbolId === symbolId) wired.add(w.a.term);
    if (w.b.symbolId === symbolId) wired.add(w.b.term);
  }
  const byPos = new Map<string, { port: PortRef; x: number; y: number }[]>();
  for (const t of terminals) {
    const world = terminalWorld(circuit, { symbolId: sym.id, term: t.id });
    if (!world) continue;
    const key = `${Math.round(world.x)},${Math.round(world.y)}`;
    const list = byPos.get(key);
    const loc = { port: { symbolId: sym.id, term: t.id }, x: world.x, y: world.y };
    if (list) list.push(loc);
    else byPos.set(key, [loc]);
  }
  const out: { port: PortRef; x: number; y: number }[] = [];
  for (const list of byPos.values()) {
    out.push(list.find((p) => wired.has(p.port.term)) ?? list[0]);
  }
  return out;
}

export interface HotRailSplice {
  contactSymbolId: string;
  railSymbolId: string;
  railDeviceId: string;
  /** Upper and lower grid rows where the contact meets the rail. */
  rows: [number, number];
}

function isNoNcContact(kind: string, variant: string): boolean {
  const v = variant.toLowerCase();
  if (v === "coil" || v === "main") return false;
  if (v.includes("nc") || v.includes("no")) return true;
  return /(?:^|-)(no|nc)$/.test(kind) || kind === "estop" || kind === "door-nc" || kind === "pull-cord";
}

/** NO/NC whose terminals both sit on the control hot rail. The rail opens between them. */
export function hotRailSplices(circuit: Circuit): HotRailSplice[] {
  const rails = circuit.symbols.flatMap((sym) => {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || dev.kind !== "rail-l") return [];
    const y0 = dev.params.railY0;
    const y1 = dev.params.railY1;
    if (typeof y0 !== "number" || typeof y1 !== "number") return [];
    return [{ sym, dev, x: sym.x * GRID, lo: Math.min(y0, y1), hi: Math.max(y0, y1) }];
  });
  if (rails.length === 0) return [];
  const splices: HotRailSplice[] = [];
  for (const sym of circuit.symbols) {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || !isNoNcContact(dev.kind, sym.variant)) continue;
    const variant = resolvedVariant(dev.kind, sym.variant, dev.params);
    const points = variant.terminals
      .map((t) => ({ id: t.id, world: terminalWorld(circuit, { symbolId: sym.id, term: t.id }) }))
      .filter((p): p is { id: string; world: { x: number; y: number } } => Boolean(p.world));
    const unique = new Map<string, { id: string; x: number; y: number }>();
    for (const p of points) unique.set(`${Math.round(p.world.x)},${Math.round(p.world.y)}`, { id: p.id, ...p.world });
    if (unique.size !== 2) continue;
    const [p, q] = [...unique.values()];
    if (Math.abs(p.x - q.x) > 0.5) continue;
    const rail = rails.find((r) => Math.abs(r.x - p.x) <= 0.5);
    if (!rail) continue;
    const rowP = Math.round(p.y / GRID);
    const rowQ = Math.round(q.y / GRID);
    if (rowP === rowQ) continue;
    const lo = Math.min(rowP, rowQ);
    const hi = Math.max(rowP, rowQ);
    if (lo < rail.lo || hi > rail.hi) continue;
    splices.push({
      contactSymbolId: sym.id,
      railSymbolId: rail.sym.id,
      railDeviceId: rail.dev.id,
      rows: [lo, hi],
    });
  }
  return splices;
}

/** Vertical break marks sitting on a control rail. They open the rail but do not renumber it. */
export function railBreakCuts(circuit: Circuit): { railSymbolId: string; rows: [number, number] }[] {
  const rails = circuit.symbols.flatMap((sym) => {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || (dev.kind !== "rail-l" && dev.kind !== "rail-n")) return [];
    const y0 = dev.params.railY0;
    const y1 = dev.params.railY1;
    if (typeof y0 !== "number" || typeof y1 !== "number") return [];
    return [{ sym, lo: Math.min(y0, y1), hi: Math.max(y0, y1) }];
  });
  const cuts: { railSymbolId: string; rows: [number, number] }[] = [];
  for (const sym of circuit.symbols) {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || dev.kind !== "rail-break") continue;
    const y0 = dev.params.railY0;
    const y1 = dev.params.railY1;
    if (typeof y0 !== "number" || typeof y1 !== "number") continue;
    const rail = rails.find((r) => r.sym.x === sym.x);
    if (!rail) continue;
    const lo = Math.max(Math.min(y0, y1), rail.lo);
    const hi = Math.min(Math.max(y0, y1), rail.hi);
    if (hi - lo < 1) continue;
    cuts.push({ railSymbolId: rail.sym.id, rows: [lo, hi] });
  }
  return cuts;
}

/**
 * Keep every control-rail tap on one horizontal line.
 * A tap pinned to an end square stays on that square and may turn.
 * Pass `onlySymbolIds` to limit the pass to wires that touch those symbols.
 * Returns true when a tap or jog changed.
 */
export function alignRailWireEnds(
  circuit: Circuit,
  keepJogs = false,
  onlySymbolIds?: ReadonlySet<string>,
): boolean {
  let changed = false;
  const setTerm = (port: PortRef, row: number) => {
    const id = railTermId(row);
    if (port.term !== id) {
      port.term = id;
      changed = true;
    }
  };
  const syncPin = (port: PortRef): boolean => {
    if (!isRailEndPin(port)) return false;
    const sym = circuit.symbols.find((s) => s.id === port.symbolId);
    const dev = sym && circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || !isRailKind(dev.kind)) {
      delete port.railPin;
      changed = true;
      return false;
    }
    const end = port.railPin === "y0" ? dev.params.railY0 : dev.params.railY1;
    if (typeof end === "number") setTerm(port, Math.round(end));
    return true;
  };
  const clearJog = (w: { jog?: WireJog }) => {
    if (!keepJogs && w.jog !== undefined) {
      w.jog = undefined;
      changed = true;
    }
  };
  for (const w of circuit.wires) {
    const pinA = syncPin(w.a);
    const pinB = syncPin(w.b);
    const a = railPort(circuit, w.a);
    const b = railPort(circuit, w.b);
    if (!a && !b) continue;
    if (pinA || pinB) continue;
    if (a && b) {
      if (onlySymbolIds && !onlySymbolIds.has(w.a.symbolId) && !onlySymbolIds.has(w.b.symbolId)) continue;
      const lo = Math.max(a.lo, b.lo);
      const hi = Math.min(a.hi, b.hi);
      if (lo > hi) continue;
      const current = termRow(w.a.term) ?? termRow(w.b.term) ?? lo;
      const row = Math.max(lo, Math.min(hi, current));
      setTerm(w.a, row);
      setTerm(w.b, row);
      clearJog(w);
      continue;
    }
    const rail = (a ?? b)!;
    const other = a ? w.b : w.a;
    const railSymId = a ? w.a.symbolId : w.b.symbolId;
    if (onlySymbolIds && !onlySymbolIds.has(other.symbolId) && !onlySymbolIds.has(railSymId)) continue;
    const world = terminalWorld(circuit, other);
    if (!world) continue;
    const row = Math.max(rail.lo, Math.min(rail.hi, Math.round(world.y / GRID)));
    setTerm(a ? w.a : w.b, row);
    clearJog(w);
  }
  return changed;
}

function termRow(term: string): number | null {
  const match = /^y(-?\d+)$/.exec(term);
  return match ? Number(match[1]) : null;
}

function railPort(circuit: Circuit, port: PortRef): { lo: number; hi: number } | null {
  const sym = circuit.symbols.find((s) => s.id === port.symbolId);
  if (!sym) return null;
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev || !isRailKind(dev.kind)) return null;
  const y0 = dev.params.railY0;
  const y1 = dev.params.railY1;
  if (typeof y0 !== "number" || typeof y1 !== "number") return null;
  return { lo: Math.min(y0, y1), hi: Math.max(y0, y1) };
}

/** Drop wires from a contact onto the hot rail once it is no longer spliced into that rail. */
export function detachUnsplicedHotRailWires(circuit: Circuit, contactIds: string[]): void {
  if (contactIds.length === 0) return;
  const spliced = new Set(hotRailSplices(circuit).map((s) => s.contactSymbolId));
  const leaving = contactIds.filter((id) => !spliced.has(id));
  if (leaving.length === 0) return;
  const railIds = new Set(
    circuit.symbols
      .filter((s) => circuit.devices.some((d) => d.id === s.deviceId && d.kind === "rail-l"))
      .map((s) => s.id),
  );
  const drop = new Set(leaving);
  circuit.wires = circuit.wires.filter((w) => {
    const aLeave = drop.has(w.a.symbolId) && railIds.has(w.b.symbolId);
    const bLeave = drop.has(w.b.symbolId) && railIds.has(w.a.symbolId);
    return !aLeave && !bLeave;
  });
}

/**
 * Terminal pairs that occupy the same world point after moving `movedSymbolIds`.
 * Same-symbol aliases are ignored. Existing wires are not filtered here.
 */
export function findOverlappingTerminalPairs(
  circuit: Circuit,
  movedSymbolIds: string[],
  tolerancePx = TERMINAL_OVERLAP_PX,
): { a: PortRef; b: PortRef }[] {
  if (!movedSymbolIds.length) return [];
  const moved = new Set(movedSymbolIds);
  const movedPorts = movedSymbolIds.flatMap((id) => uniqueLocatedPorts(circuit, id));
  const otherPorts = circuit.symbols
    .filter((s) => !moved.has(s.id))
    .flatMap((s) => uniqueLocatedPorts(circuit, s.id));

  const pairs: { a: PortRef; b: PortRef }[] = [];
  const seen = new Set<string>();
  const addPair = (a: PortRef, b: PortRef) => {
    if (a.symbolId === b.symbolId) return;
    const ka = `${a.symbolId}:${a.term}`;
    const kb = `${b.symbolId}:${b.term}`;
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ a, b });
  };

  for (const p of movedPorts) {
    for (const q of otherPorts) {
      if (Math.hypot(p.x - q.x, p.y - q.y) <= tolerancePx) addPair(p.port, q.port);
    }
  }
  for (let i = 0; i < movedPorts.length; i += 1) {
    for (let j = i + 1; j < movedPorts.length; j += 1) {
      const p = movedPorts[i];
      const q = movedPorts[j];
      if (p.port.symbolId === q.port.symbolId) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) <= tolerancePx) addPair(p.port, q.port);
    }
  }
  return pairs;
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

/** Graph keys for one port: junction / named net / strip bus / physical pin. */
export function nodeKeysForPort(circuit: Circuit, ref: PortRef): string[] {
  if (isJunction(ref.symbolId, circuit)) {
    return [`junction:${ref.symbolId}`];
  }
  const sym = circuit.symbols.find((s) => s.id === ref.symbolId);
  const dev = sym && circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return [`port:${ref.symbolId}:${ref.term}`];
  if (dev.kind === "net-label") {
    const k = namedNetKey(dev.tag);
    if (k) return [`net:${k}`];
    return [`port:${ref.symbolId}:1`];
  }
  if (dev.kind === "net-terminal") {
    const keys = [`bus:${dev.id}`];
    const k = namedNetKey(dev.tag);
    if (k) keys.push(`net:${k}`);
    return keys;
  }
  if (dev.kind === "term-block") {
    const n = Number(ref.term);
    if (Number.isInteger(n) && n >= 1) return [`pair:${dev.id}:${Math.ceil(n / 2)}`];
  }
  if (dev.kind === "busbar") {
    const keys = [`bus:${dev.id}`];
    const k = namedNetKey(dev.tag);
    if (k) keys.push(`net:${k}`);
    return keys;
  }
  if (dev.kind === "rail-l" || dev.kind === "rail-n") return [`rail:${dev.id}`];
  return [`port:${ref.symbolId}:${ref.term}`];
}

export function buildNetGraph(circuit: Circuit): {
  wireToNodes: Map<string, string[]>;
  nodeToWires: Map<string, string[]>;
} {
  const nodeToWires = new Map<string, string[]>();
  const wireToNodes = new Map<string, string[]>();
  for (const w of circuit.wires) {
    const keys = [...nodeKeysForPort(circuit, w.a), ...nodeKeysForPort(circuit, w.b)];
    const unique = [...new Set(keys)];
    wireToNodes.set(w.id, unique);
    for (const key of unique) {
      const list = nodeToWires.get(key);
      if (list) list.push(w.id);
      else nodeToWires.set(key, [w.id]);
    }
  }
  return { wireToNodes, nodeToWires };
}

/**
 * Find all wire IDs that belong to the same contiguous connected electrical net/branch
 * as the given wire(s).
 */
export function getConnectedWireIds(circuit: Circuit, startWireIds: string[] | string): Set<string> {
  const seeds = Array.isArray(startWireIds) ? startWireIds : [startWireIds];
  const initialValid = seeds.filter((id) => circuit.wires.some((w) => w.id === id));
  if (initialValid.length === 0) return new Set();

  const { nodeToWires, wireToNodes } = buildNetGraph(circuit);
  const visitedWires = new Set<string>(initialValid);
  const queue = [...initialValid];

  while (queue.length > 0) {
    const curWireId = queue.shift()!;
    const nodes = wireToNodes.get(curWireId);
    if (!nodes) continue;

    for (const nodeKey of nodes) {
      const neighborWireIds = nodeToWires.get(nodeKey);
      if (!neighborWireIds) continue;
      for (const nWireId of neighborWireIds) {
        if (!visitedWires.has(nWireId)) {
          visitedWires.add(nWireId);
          queue.push(nWireId);
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

/** Check if a wire passes through a junction point in a straight line (no T-junction). */
export function isWireStraightThroughJunction(
  circuit: Circuit,
  wireId: string,
  junctionSymbolId: string,
): boolean {
  const w = circuit.wires.find(wire => wire.id === wireId);
  if (!w) return false;
  
  // Check if both ends of the wire are connected to the same symbol (not the junction)
  const symA = circuit.symbols.find(s => s.id === w.a.symbolId);
  const symB = circuit.symbols.find(s => s.id === w.b.symbolId);
  
  if (!symA || !symB) return false;
  
  // Both ends should be connected to the same non-junction symbol
  if (symA.deviceId !== symB.deviceId) return false;
  
  const dev = circuit.devices.find(d => d.id === symA.deviceId);
  if (dev?.kind === "junction") return false;
  
  // Check if wire passes through the junction point in a straight line
  const pts = wireRoute(circuit, w.a, w.b, w.jog);
  const juncSym = circuit.symbols.find(s => s.id === junctionSymbolId);
  if (!juncSym) return false;
  
  const juncX = juncSym.x * GRID;
  const juncY = juncSym.y * GRID;
  
  // Find if any point on the wire is at the junction position
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    if (Math.abs(p.x - juncX) < 0.5 && Math.abs(p.y - juncY) < 0.5) {
      // Check if it's a straight line through the junction
      // The points before and after should be collinear with the junction
      const prev = pts[i - 1];
      const next = pts[i + 1];
      
      // Calculate direction vectors
      const dx1 = p.x - prev.x;
      const dy1 = p.y - prev.y;
      const dx2 = next.x - p.x;
      const dy2 = next.y - p.y;
      
      // Check if they're collinear (same or opposite direction)
      const cross = dx1 * dy2 - dy1 * dx2;
      return Math.abs(cross) < 0.5; // Approximately collinear
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
  offset = 6,
  circuit?: Circuit,
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
  const base = offsetLabelPoint(mx, my, horizontal, offset);

  if (circuit) {
    const JUNCTION_RADIUS = 6;
    for (const sym of circuit.symbols) {
      const dev = circuit.devices.find((d) => d.id === sym.deviceId);
      if (dev?.kind !== "junction") continue;
      const juncPos = terminalWorld(circuit, { symbolId: sym.id, term: "1" });
      if (!juncPos) continue;
      if (Math.hypot(base.x - juncPos.x, base.y - juncPos.y) < JUNCTION_RADIUS + 2) {
        return offsetLabelPoint(mx, my, horizontal, -offset);
      }
    }
  }

  return base;
}

/** Skip stubs shorter than this (world units). */
export const WIRE_LABEL_MIN_SEG = GRID * 2;
/** Extra copies only when a run is at least this long. */
export const WIRE_LABEL_REPEAT = GRID * 14;
/** Keep labels off segment ends (junctions / terminals). */
export const WIRE_LABEL_INSET = GRID * 2.5;
/** Drop a same-number copy only when the circles would sit on top of each other. */
export const WIRE_LABEL_SEPARATION = GRID * 2.5;

export type WireLabelAnchor = {
  x: number;
  y: number;
  horizontal: boolean;
  segLen: number;
  t: number;
};

export function makeWireLabelKey(wireId: string, t: number): string {
  return `${wireId}@${t.toFixed(3)}`;
}

export function parseWireLabelKey(key: string): { wireId: string; t: number } | null {
  const at = key.lastIndexOf("@");
  if (at <= 0) return null;
  const t = Number(key.slice(at + 1));
  if (!Number.isFinite(t)) return null;
  return { wireId: key.slice(0, at), t };
}

export function labelMarkMatches(a: number, b: number, eps = 0.04): boolean {
  return Math.abs(a - b) < eps;
}

/** Matches the SVG circle radius used to draw a wire-number badge. */
export function wireLabelRadius(tag = "0"): number {
  return Math.max(10, (tag.length * 6.8) / 2 + 4);
}

/** Center-to-wire distance so the badge outline is tangent to the stroke. */
export function wireLabelOffset(tag = "0"): number {
  return wireLabelRadius(tag) + 2.2 / 2;
}

function offsetLabelPoint(
  mx: number,
  my: number,
  horizontal: boolean,
  offset: number,
): { x: number; y: number; horizontal: boolean } {
  if (horizontal) return { x: mx, y: my + offset, horizontal: true };
  return { x: mx + offset, y: my, horizontal: false };
}

/** Sample along a run so crowded midpoints have nearby fallbacks. */
const WIRE_LABEL_SAMPLE = GRID * 6;

/**
 * Candidate label spots on a polyline: samples along every long-enough segment
 * so a later pass can skip crowded T-junctions and still label the run.
 */
export function wireLabelAnchors(
  pts: { x: number; y: number }[],
  offset = 6,
): WireLabelAnchor[] {
  if (pts.length < 2) return [];
  const dists = getCumulativeDistances(pts);
  const total = dists[dists.length - 1] || 1;
  const out: WireLabelAnchor[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < WIRE_LABEL_MIN_SEG) continue;
    const horizontal = Math.abs(a.y - b.y) < 0.8;
    const count = Math.max(1, Math.round(len / WIRE_LABEL_SAMPLE));
    const inset = count === 1 ? len / 2 : Math.min(WIRE_LABEL_INSET, len * 0.25);
    const usable = count === 1 ? 0 : Math.max(0, len - 2 * inset);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    for (let k = 0; k < count; k++) {
      const d = count === 1 ? inset : inset + (usable * k) / Math.max(1, count - 1);
      const mx = a.x + ux * d;
      const my = a.y + uy * d;
      const t = (dists[i] + d) / total;
      out.push({ ...offsetLabelPoint(mx, my, horizontal, offset), segLen: len, t });
    }
  }
  if (out.length === 0 && pts.length >= 2) {
    const p = getPointAtProgress(pts, 0.5) ?? pts[0];
    let horizontal = Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.8;
    let segLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len >= segLen) {
        segLen = len;
        horizontal = Math.abs(a.y - b.y) < 0.8;
      }
    }
    out.push({ ...offsetLabelPoint(p.x, p.y, horizontal, offset), segLen: Math.max(segLen, 1), t: 0.5 });
  }
  out.sort((p, q) => q.segLen - p.segLen);
  return out;
}

export function wireLabelAnchorAtT(
  pts: { x: number; y: number }[],
  t: number,
  offset = 6,
): WireLabelAnchor | null {
  if (pts.length < 2) return null;
  const p = getPointAtProgress(pts, t);
  if (!p) return null;
  const dists = getCumulativeDistances(pts);
  const total = dists[dists.length - 1] || 1;
  const target = total * Math.max(0, Math.min(1, t));
  let horizontal = true;
  let segLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (dists[i] + len >= target - 1e-6 || i === pts.length - 2) {
      horizontal = Math.abs(a.y - b.y) < 0.8;
      segLen = len;
      break;
    }
  }
  return { ...offsetLabelPoint(p.x, p.y, horizontal, offset), segLen, t };
}

type RankedLabel = WireLabelAnchor & { wireId: string; tag: string };

function minDistTo(
  p: { x: number; y: number },
  others: { x: number; y: number }[],
): number {
  let best = Infinity;
  for (const o of others) {
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    if (d < best) best = d;
  }
  return best;
}

function tagNum(tag: string): number | null {
  if (!/^\d+$/.test(tag)) return null;
  return Number(tag);
}

/** Same-number copies: one per column, and not closer than REPEAT along a run. */
function sameTagLabelClash(
  a: { x: number; y: number },
  b: { x: number; y: number },
  minSeparation = WIRE_LABEL_SEPARATION,
): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const d = Math.hypot(dx, dy);
  if (d < minSeparation) return true;
  if (dx < GRID * 2 && dy < GRID * 12) return true;
  const alongRun = dx < GRID * 2 || dy < GRID * 2;
  return alongRun && d < WIRE_LABEL_REPEAT;
}

/**
 * Place labels away from other numbers and junctions. Each net gets at least
 * one copy; extra copies stay on long/branch runs if the spot is clear.
 */
export function pickVisibleWireLabels(
  candidates: { wireId: string; tag: string; anchors: WireLabelAnchor[] }[],
  minSeparation = WIRE_LABEL_SEPARATION,
  avoid: { x: number; y: number }[] = [],
): Map<string, WireLabelAnchor[]> {
  const byTag = new Map<string, RankedLabel[]>();
  const flat: RankedLabel[] = [];
  for (const c of candidates) {
    for (const a of c.anchors) {
      const row = { ...a, wireId: c.wireId, tag: c.tag };
      flat.push(row);
      const list = byTag.get(c.tag);
      if (list) list.push(row);
      else byTag.set(c.tag, [row]);
    }
  }
  const kept: RankedLabel[] = [];

  const scoreOf = (c: RankedLabel): number => {
    const dKeep = minDistTo(c, kept);
    const dAvoid = minDistTo(c, avoid);
    const d = Math.min(dKeep, dAvoid);
    const clash = d < minSeparation ? d - 1000 : d;
    return clash + c.segLen * 0.2 + (c.horizontal ? 80 : 0);
  };

  for (const opts of byTag.values()) {
    let best = opts[0];
    let bestScore = -Infinity;
    for (const c of opts) {
      const s = scoreOf(c);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (best) kept.push(best);
  }

  const extras = [...flat].sort((a, b) => b.segLen - a.segLen);
  for (const c of extras) {
    if (kept.some((b) => b.wireId === c.wireId && Math.abs(b.t - c.t) < 1e-4)) continue;
    const tooCloseSameTag = kept.some((b) => b.tag === c.tag && sameTagLabelClash(b, c, minSeparation));
    if (tooCloseSameTag) continue;
    const alongExisting = kept.some((b) => {
      if (b.tag !== c.tag) return false;
      return Math.abs(b.x - c.x) < GRID * 2 || Math.abs(b.y - c.y) < GRID * 2;
    });
    if (alongExisting && c.segLen < WIRE_LABEL_REPEAT) continue;
    if (!c.horizontal && kept.some((b) => b.tag === c.tag && b.horizontal)) continue;
    const clash = minDistTo(c, kept) < minSeparation || minDistTo(c, avoid) < minSeparation;
    if (clash) continue;
    kept.push(c);
  }

  const byWire = new Map<string, WireLabelAnchor[]>();
  for (const a of kept) {
    const list = byWire.get(a.wireId) ?? [];
    list.push(a);
    byWire.set(a.wireId, list);
  }
  return byWire;
}

type HSeg = { x0: number; x1: number; y: number; len: number };

function horizontalSegs(pts: { x: number; y: number }[]): HSeg[] {
  const segs: HSeg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.abs(a.y - b.y) >= 0.8) continue;
    const len = Math.abs(b.x - a.x);
    if (len < WIRE_LABEL_MIN_SEG) continue;
    segs.push({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y: a.y, len });
  }
  return segs;
}

function snapToMainRun(
  pts: { x: number; y: number }[],
  commonX: number,
  offset: number,
  yHint: number,
): WireLabelAnchor | null {
  const segs = horizontalSegs(pts);
  if (!segs.length) return null;
  let best = segs[0];
  let bestScore = -Infinity;
  for (const s of segs) {
    const covers = commonX >= s.x0 - 1 && commonX <= s.x1 + 1;
    const score = (covers ? 1000 : 0) + s.len - Math.abs(s.y - yHint) * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  const pad = Math.min(GRID, best.len / 4);
  const mx = Math.max(best.x0 + pad, Math.min(best.x1 - pad, commonX));
  const t = getClosestTOnPolyline(pts, { x: mx, y: best.y });
  return { ...offsetLabelPoint(mx, best.y, true, offset), segLen: best.len, t };
}

function stackedPair(
  a: { tag: string; a: WireLabelAnchor },
  b: { tag: string; a: WireLabelAnchor },
  colX: number,
  colYMin: number,
  colYMax: number,
): boolean {
  if (a.tag === b.tag) return false;
  const dx = Math.abs(a.a.x - b.a.x);
  const dy = Math.abs(a.a.y - b.a.y);
  if (dx >= colX || dy < colYMin || dy > colYMax) return false;
  const na = tagNum(a.tag);
  const nb = tagNum(b.tag);
  if (na == null || nb == null) return true;
  if (Math.abs(na - nb) > 2) return false;
  // 3-phase stacks increase downward (90 / 91 / 92). Do not merge 102 (L3) with 103 (next L1).
  if (a.a.y < b.a.y) return na < nb;
  return na > nb;
}

/**
 * Line up stacked numbers on parallel horizontals (100/101/102, 109/110/111)
 * onto a shared X, preferring each net's longest main run over T-drops.
 */
export function alignStackedWireLabels(
  byWire: Map<string, WireLabelAnchor[]>,
  wireInfo: Map<string, { pts: { x: number; y: number }[]; tag: string; offset: number }>,
): Map<string, WireLabelAnchor[]> {
  type Item = { wireId: string; tag: string; a: WireLabelAnchor };
  const items: Item[] = [];
  for (const [wireId, list] of byWire) {
    const info = wireInfo.get(wireId);
    if (!info) continue;
    for (const a of list) {
      if (a.horizontal) items.push({ wireId, tag: info.tag, a });
    }
  }
  const n = items.length;
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };
  const colX = GRID * 2.5;
  const colYMin = GRID * 0.75;
  const colYMax = GRID * 12;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (stackedPair(items[i], items[j], colX, colYMin, colYMax)) union(i, j);
    }
  }
  const groups = new Map<number, Item[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r) ?? [];
    g.push(items[i]);
    groups.set(r, g);
  }

  const next = new Map<string, WireLabelAnchor[]>();
  for (const [id, list] of byWire) next.set(id, [...list]);

  const wiresByTag = new Map<string, string[]>();
  for (const [wid, info] of wireInfo) {
    const list = wiresByTag.get(info.tag);
    if (list) list.push(wid);
    else wiresByTag.set(info.tag, [wid]);
  }

  const relocate = (tag: string, yHint: number, commonX: number, y0: number, y1: number) => {
    let best: { wireId: string; anchor: WireLabelAnchor } | null = null;
    for (const wid of wiresByTag.get(tag) ?? []) {
      const info = wireInfo.get(wid);
      if (!info) continue;
      const snapped = snapToMainRun(info.pts, commonX, info.offset, yHint);
      if (!snapped) continue;
      if (!best || snapped.segLen > best.anchor.segLen) best = { wireId: wid, anchor: snapped };
    }
    if (!best) return;
    const lo = y0 - GRID * 2;
    const hi = y1 + GRID * 2;
    const colR = GRID * 3;
    for (const wid of wiresByTag.get(tag) ?? []) {
      const list = next.get(wid);
      if (!list) continue;
      next.set(
        wid,
        list.filter((a) => {
          const inY = a.y >= lo && a.y <= hi;
          if (!inY) return true;
          if (Math.abs(a.x - commonX) < colR) return false;
          if (!a.horizontal) return false;
          return true;
        }),
      );
    }
    const dest = next.get(best.wireId) ?? [];
    dest.push(best.anchor);
    next.set(best.wireId, dest);
  };

  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const xs = g.map((it) => it.a.x).sort((a, b) => a - b);
    const commonX = xs[Math.floor(xs.length / 2)];
    const y0 = Math.min(...g.map((it) => it.a.y));
    const y1 = Math.max(...g.map((it) => it.a.y));
    const groupTags = new Set(g.map((it) => it.tag));
    const groupNums = [...groupTags].map(tagNum).filter((n): n is number => n != null);
    const yHintByTag = new Map<string, number>();
    for (const it of g) {
      if (!yHintByTag.has(it.tag)) yHintByTag.set(it.tag, it.a.y);
    }
    for (const [, info] of wireInfo) {
      if (yHintByTag.has(info.tag)) continue;
      const n = tagNum(info.tag);
      const mate =
        n != null && groupNums.some((gn) => Math.abs(gn - n) <= 2);
      if (!mate && !groupTags.has(info.tag)) continue;
      const segs = horizontalSegs(info.pts);
      if (!segs.some((s) => commonX >= s.x0 - 1 && commonX <= s.x1 + 1)) continue;
      const snapped = snapToMainRun(info.pts, commonX, info.offset, (y0 + y1) / 2);
      if (snapped) yHintByTag.set(info.tag, snapped.y);
    }
    for (const [tag, yHint] of yHintByTag) relocate(tag, yHint, commonX, y0, y1);
  }
  return next;
}

/**
 * Drop leftover copies of the same number that sit on one column or overlap
 * after alignment / pinned marks. Distant extras on long rails are kept.
 */
export function dedupeWireLabels(
  byWire: Map<string, WireLabelAnchor[]>,
  wireInfo: Map<string, { tag: string }>,
  minSeparation = WIRE_LABEL_SEPARATION,
): Map<string, WireLabelAnchor[]> {
  type Item = { wireId: string; tag: string; a: WireLabelAnchor };
  const items: Item[] = [];
  for (const [wireId, list] of byWire) {
    const tag = wireInfo.get(wireId)?.tag;
    if (!tag) continue;
    for (const a of list) items.push({ wireId, tag, a });
  }
  items.sort((p, q) => q.a.segLen - p.a.segLen);
  const kept: Item[] = [];
  for (const it of items) {
    const clash = kept.some((b) => b.tag === it.tag && sameTagLabelClash(b.a, it.a, minSeparation));
    if (!clash) kept.push(it);
  }
  const next = new Map<string, WireLabelAnchor[]>();
  for (const it of kept) {
    const list = next.get(it.wireId) ?? [];
    list.push(it.a);
    next.set(it.wireId, list);
  }
  return next;
}

function polylineLen(pts: { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    n += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return n;
}

/**
 * A net-terminal is a visual break in the run: the same number must appear on
 * both the left screws and the right screws, even when the two stubs are too
 * close for the usual along-run dedupe.
 */
export function ensureNetTerminalSideLabels(
  circuit: Circuit,
  placed: Map<string, WireLabelAnchor[]>,
  wireInfo: Map<string, { pts: { x: number; y: number }[]; tag: string; offset: number }>,
): Map<string, WireLabelAnchor[]> {
  const next = new Map<string, WireLabelAnchor[]>();
  for (const [id, list] of placed) next.set(id, [...list]);

  const existing: { tag: string; a: WireLabelAnchor }[] = [];
  for (const [wid, list] of next) {
    const tag = wireInfo.get(wid)?.tag;
    if (!tag) continue;
    for (const a of list) existing.push({ tag, a });
  }

  const pinSide = (w: { a: PortRef; b: PortRef }, symbolId: string): "L" | "R" | null => {
    if (w.a.symbolId === symbolId) {
      const s = netTerminalPinSide(w.a.term);
      if (s) return s;
    }
    if (w.b.symbolId === symbolId) return netTerminalPinSide(w.b.term);
    return null;
  };

  const ensureSide = (wireIds: string[], tag: string) => {
    if (wireIds.some((id) => (next.get(id) ?? []).length > 0)) return;
    let bestId: string | null = null;
    let bestLen = -1;
    for (const id of wireIds) {
      const pts = wireInfo.get(id)?.pts;
      if (!pts || pts.length < 2) continue;
      const len = polylineLen(pts);
      if (len > bestLen) {
        bestLen = len;
        bestId = id;
      }
    }
    if (!bestId) return;
    const info = wireInfo.get(bestId);
    if (!info) return;
    const othersDiff = existing.filter((e) => e.tag !== tag).map((e) => e.a);
    const othersSame = existing.filter((e) => e.tag === tag).map((e) => e.a);
    const anchors = wireLabelAnchors(info.pts, info.offset);
    let chosen: WireLabelAnchor | null = null;
    let bestScore = -Infinity;
    for (const a of anchors) {
      if (minDistTo(a, othersDiff) < WIRE_LABEL_SEPARATION) continue;
      const score = minDistTo(a, othersSame) + a.segLen * 0.1;
      if (score > bestScore) {
        bestScore = score;
        chosen = a;
      }
    }
    if (!chosen) {
      for (const a of anchors) {
        if (minDistTo(a, othersDiff) >= WIRE_LABEL_SEPARATION) {
          chosen = a;
          break;
        }
      }
    }
    if (!chosen) return;
    const list = next.get(bestId) ?? [];
    list.push(chosen);
    next.set(bestId, list);
    existing.push({ tag, a: chosen });
  };

  for (const sym of circuit.symbols) {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (dev?.kind !== "net-terminal" && dev?.kind !== "term-block") continue;
    const left: string[] = [];
    const right: string[] = [];
    for (const w of circuit.wires) {
      if (!wireInfo.has(w.id)) continue;
      const side = pinSide(w, sym.id);
      if (side === "L") left.push(w.id);
      else if (side === "R") right.push(w.id);
    }
    if (!left.length || !right.length) continue;
    const tagsOf = (ids: string[]) => {
      const tags = new Set<string>();
      for (const id of ids) {
        const tag = wireInfo.get(id)?.tag;
        if (tag) tags.add(tag);
      }
      return tags;
    };
    const rightTags = tagsOf(right);
    for (const tag of tagsOf(left)) {
      if (!rightTags.has(tag)) continue;
      ensureSide(left.filter((id) => wireInfo.get(id)?.tag === tag), tag);
      ensureSide(right.filter((id) => wireInfo.get(id)?.tag === tag), tag);
    }
  }
  return next;
}

/** Calculate cumulative distance at each point along a polyline */
export function getCumulativeDistances(pts: { x: number; y: number }[]): number[] {
  if (pts.length === 0) return [];
  const dists = [0];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    dists.push(dists[dists.length - 1] + len);
  }
  return dists;
}

/** Find the closest progress value (0 to 1) along a polyline to a given point. */
export function getClosestTOnPolyline(pts: { x: number; y: number }[], p: { x: number; y: number }): number {
  if (pts.length === 0) return 0;
  if (pts.length === 1) return 0;

  let minDist = Infinity;
  let bestT = 0;
  let currentLen = 0;

  // Calculate total length
  const totalLen = pts.reduce((acc, pt, i) => {
    if (i > 0) return acc + Math.hypot(pt.x - pts[i - 1].x, pt.y - pts[i - 1].y);
    return 0;
  }, 0);

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);

    if (segLen === 0) continue;

    // Project point onto segment
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;

    // Calculate t for closest point on segment (0 to 1)
    let tLocal = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    tLocal = Math.max(0, Math.min(1, tLocal));

    // Calculate distance from point to projected point
    const px = a.x + tLocal * dx;
    const py = a.y + tLocal * dy;
    const dist = Math.hypot(p.x - px, p.y - py);

    if (dist < minDist) {
      minDist = dist;
      // Convert local segment t to global polyline t
      bestT = (currentLen + tLocal * segLen) / totalLen;
    }

    currentLen += segLen;
  }

  return Math.max(0, Math.min(1, bestT));
}

/** Get the point at a given progress value (0 to 1) along a polyline. */
export function getPointAtProgress(pts: { x: number; y: number }[], t: number): { x: number; y: number } | null {
  if (pts.length === 0) return null;
  if (pts.length === 1) return { ...pts[0] };

  t = Math.max(0, Math.min(1, t));

  // Calculate total length
  const totalLen = pts.reduce((acc, pt, i) => {
    if (i > 0) return acc + Math.hypot(pt.x - pts[i - 1].x, pt.y - pts[i - 1].y);
    return 0;
  }, 0);

  const targetDist = totalLen * t;
  let currentDist = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);

    if (currentDist + segLen >= targetDist) {
      // Interpolate within this segment
      const remainingDist = targetDist - currentDist;
      const tLocal = segLen === 0 ? 0 : remainingDist / segLen;
      return {
        x: a.x + (b.x - a.x) * tLocal,
        y: a.y + (b.y - a.y) * tLocal,
      };
    }

    currentDist += segLen;
  }

  // Return last point if we've gone past the end
  return { ...pts[pts.length - 1] };
}
