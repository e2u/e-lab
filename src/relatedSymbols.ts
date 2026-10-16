import { symbolBounds } from "./geometry";
import { GRID, type Circuit, type Device, type SymbolInst } from "./types";

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

const SKIP_KINDS = new Set(["junction", "net-label", "net-terminal", "term-block", "busbar", "title-block"]);

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

/** True when the device owns a coil symbol (contactor, relay, timer...). */
export function deviceHasCoil(circuit: Circuit, deviceId: string): boolean {
  return circuit.symbols.some((s) => s.deviceId === deviceId && s.variant === "coil");
}

/**
 * Symbols of other coil-less devices sharing the selected device's tag.
 * Empty when the selected device has a coil (its contacts are linked via `relatedSymbols`).
 */
export function sameNameSymbols(circuit: Circuit, selectedSymbolId: string): SymbolInst[] {
  const selectedSym = circuit.symbols.find((s) => s.id === selectedSymbolId);
  if (!selectedSym) return [];
  const selectedDev = circuit.devices.find((d) => d.id === selectedSym.deviceId);
  if (!selectedDev || selectedDev.kind === "comment" || SKIP_KINDS.has(selectedDev.kind)) return [];
  const tag = selectedDev.tag.trim();
  if (!tag || deviceHasCoil(circuit, selectedDev.id)) return [];
  return circuit.symbols.filter((sym) => {
    if (sym.deviceId === selectedDev.id) return false;
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || dev.kind === "comment" || SKIP_KINDS.has(dev.kind)) return false;
    if (dev.tag.trim() !== tag) return false;
    return !deviceHasCoil(circuit, dev.id);
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
  /** "device": same device / comment link; "name": same-tag coil-less device link. */
  kind: "device" | "name";
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
  const byName = sameNameSymbols(circuit, selectedSymbolId);
  const nameIds = new Set(byName.map((s) => s.id));
  const targets = [...relatedSymbols(circuit, selectedSymbolId).filter((s) => !nameIds.has(s.id)), ...byName];
  const spokes: AssociationSpoke[] = [];
  for (const rel of targets) {
    const toBox = symbolWorldBox(circuit, rel);
    if (!toBox) continue;
    const spoke = spokeFromTo(fromBox, toBox);
    if (!spoke) continue;
    spokes.push({ id: rel.id, from: spoke.from, to: spoke.to, kind: nameIds.has(rel.id) ? "name" : "device" });
  }
  return spokes;
}

interface NameAnchor {
  sym: SymbolInst;
  tag: string;
  box: Box;
}

function compareAnchors(a: NameAnchor, b: NameAnchor): number {
  return a.box.y - b.box.y || a.box.x - b.box.x || a.sym.id.localeCompare(b.sym.id);
}

/**
 * Same-tag links among coil-less devices. One star per tag, from the
 * top-left device, so the lines stay put when the selection changes.
 * Each device contributes its top-left symbol only.
 */
export function nameAssociationSpokes(circuit: Circuit): AssociationSpoke[] {
  const byDevice = new Map<string, NameAnchor>();
  for (const sym of circuit.symbols) {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || dev.kind === "comment" || SKIP_KINDS.has(dev.kind)) continue;
    const tag = dev.tag.trim();
    if (!tag || deviceHasCoil(circuit, dev.id)) continue;
    const box = symbolWorldBox(circuit, sym);
    if (!box) continue;
    const anchor: NameAnchor = { sym, tag, box };
    const prev = byDevice.get(dev.id);
    if (!prev || compareAnchors(anchor, prev) < 0) byDevice.set(dev.id, anchor);
  }
  const groups = new Map<string, NameAnchor[]>();
  for (const anchor of byDevice.values()) {
    const list = groups.get(anchor.tag);
    if (list) list.push(anchor);
    else groups.set(anchor.tag, [anchor]);
  }
  const spokes: AssociationSpoke[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(compareAnchors);
    const hub = group[0];
    for (const other of group.slice(1)) {
      const spoke = spokeFromTo(hub.box, other.box);
      if (!spoke) continue;
      spokes.push({
        id: `${hub.sym.id}-${other.sym.id}`,
        from: spoke.from,
        to: spoke.to,
        kind: "name",
      });
    }
  }
  return spokes;
}
