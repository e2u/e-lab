import { symbolBounds } from "./geometry";
import { GRID, type Circuit, type Device, type SymbolInst } from "./types";

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

const SKIP_KINDS = new Set(["junction", "net-label", "title-block"]);

/** Same-device / same-tag / comment-target match used by the amber selection highlight. */
export function devicesAreRelated(selected: Device, other: Device, otherSymbol: SymbolInst): boolean {
  if (SKIP_KINDS.has(other.kind)) return false;
  if (other.kind !== "comment" && otherSymbol.deviceId === selected.id) return true;
  if (selected.kind === "comment" && other.id === selected.params?.targetDeviceId) return true;
  if (other.kind === "comment" && other.params?.targetDeviceId === selected.id) return true;
  if (
    other.kind !== "comment" &&
    other.kind === selected.kind &&
    other.tag.trim() &&
    other.tag.trim() === selected.tag.trim()
  ) {
    return true;
  }
  return false;
}

/** Other symbols highlighted as related when `selectedSymbolId` is the selection. */
export function relatedSymbols(circuit: Circuit, selectedSymbolId: string): SymbolInst[] {
  const selectedSym = circuit.symbols.find((s) => s.id === selectedSymbolId);
  if (!selectedSym) return [];
  const selectedDev = circuit.devices.find((d) => d.id === selectedSym.deviceId);
  if (!selectedDev) return [];
  return circuit.symbols.filter((sym) => {
    if (sym.id === selectedSym.id) return false;
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev) return false;
    return devicesAreRelated(selectedDev, dev, sym);
  });
}

export function symbolWorldBox(circuit: Circuit, sym: SymbolInst): Box | null {
  const b = symbolBounds(circuit, sym);
  if (!b) return null;
  return { x: b.x * GRID, y: b.y * GRID, w: b.w * GRID, h: b.h * GRID };
}

export function boxCenter(b: Box): Pt {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function boxContains(box: Box, p: Pt): boolean {
  return p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
}

function expandBox(box: Box, pad: number): Box {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}

/** First hit of ray (ox,oy) + t*(dx,dy), t>0, on the rectangle boundary. */
export function rayRectHit(ox: number, oy: number, dx: number, dy: number, box: Box): { t: number; p: Pt } | null {
  if (dx === 0 && dy === 0) return null;
  const { x, y, w, h } = box;
  let bestT = Infinity;
  let best: Pt | null = null;
  const consider = (t: number, px: number, py: number, axis: "x" | "y") => {
    if (t <= 1e-6 || t >= bestT) return;
    if (axis === "x") {
      if (py < y - 0.51 || py > y + h + 0.51) return;
    } else if (px < x - 0.51 || px > x + w + 0.51) return;
    bestT = t;
    best = { x: px, y: py };
  };
  if (dx !== 0) {
    const tL = (x - ox) / dx;
    consider(tL, x, oy + dy * tL, "x");
    const tR = (x + w - ox) / dx;
    consider(tR, x + w, oy + dy * tR, "x");
  }
  if (dy !== 0) {
    const tT = (y - oy) / dy;
    consider(tT, ox + dx * tT, y, "y");
    const tB = (y + h - oy) / dy;
    consider(tB, ox + dx * tB, y + h, "y");
  }
  return best ? { t: bestT, p: best } : null;
}

export interface AssociationSpoke {
  id: string;
  from: Pt;
  to: Pt;
}

/**
 * Straight spoke from the selected symbol box to a related symbol box.
 * Endpoints sit just outside the dashed highlight rects.
 */
export function spokeFromTo(fromBox: Box, toBox: Box, pad = 6): { from: Pt; to: Pt } | null {
  const a = expandBox(fromBox, pad);
  const b = expandBox(toBox, pad);
  const ac = boxCenter(fromBox);
  const bc = boxCenter(toBox);
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  if (Math.hypot(dx, dy) < 8) return null;
  if (boxContains(b, ac) || boxContains(a, bc)) return null;
  const hitFrom = rayRectHit(ac.x, ac.y, dx, dy, a);
  const hitTo = rayRectHit(ac.x, ac.y, dx, dy, b);
  if (!hitFrom || !hitTo) return null;
  if (hitTo.t <= hitFrom.t) return null;
  if (Math.hypot(hitTo.p.x - hitFrom.p.x, hitTo.p.y - hitFrom.p.y) < 10) return null;
  return { from: hitFrom.p, to: hitTo.p };
}

export function associationSpokes(circuit: Circuit, selectedSymbolId: string): AssociationSpoke[] {
  const selectedSym = circuit.symbols.find((s) => s.id === selectedSymbolId);
  if (!selectedSym) return [];
  const fromBox = symbolWorldBox(circuit, selectedSym);
  if (!fromBox) return [];
  const spokes: AssociationSpoke[] = [];
  for (const rel of relatedSymbols(circuit, selectedSymbolId)) {
    const toBox = symbolWorldBox(circuit, rel);
    if (!toBox) continue;
    const spoke = spokeFromTo(fromBox, toBox);
    if (!spoke) continue;
    spokes.push({ id: rel.id, from: spoke.from, to: spoke.to });
  }
  return spokes;
}
