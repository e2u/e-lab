import type { Device, TerminalDef } from "./types";

export const NAMED_NET_KINDS: ReadonlySet<string> = new Set(["net-label", "net-terminal"]);

export const NET_TERMINAL_MIN_PINS = 2;
export const NET_TERMINAL_MAX_PINS = 12;
export const NET_TERMINAL_DEFAULT_PINS = 4;
/** Grid units between rows. 1 keeps the strip compact. */
export const NET_TERMINAL_PITCH = 1;
export const NET_TERMINAL_WIDTH = 4;

/** Screw ids that remain when the strip has `n` pairs (2n terminals). */
export function netTerminalKeepIds(n: number): Set<string> {
  const keep = new Set<string>();
  for (let i = 1; i <= n; i += 1) {
    keep.add(String(2 * i - 1));
    keep.add(String(2 * i));
  }
  return keep;
}

export function isNamedNetKind(kind: string): boolean {
  return NAMED_NET_KINDS.has(kind);
}

/** Left screws are odd (1,3,5…); right screws are even (2,4,6…). */
export function netTerminalPinSide(termId: string): "L" | "R" | null {
  const n = Number(termId);
  if (!Number.isInteger(n) || n < 1) return null;
  return n % 2 === 1 ? "L" : "R";
}

/** Case-sensitive. Empty / whitespace-only → isolated (null). */
export function namedNetKey(tag: string): string | null {
  const k = tag.trim();
  return k.length ? k : null;
}

export function namedNetKeyOf(dev: Device): string | null {
  return isNamedNetKind(dev.kind) ? namedNetKey(dev.tag) : null;
}

export function clampPinCount(n: unknown): number {
  const v = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  if (!Number.isFinite(v)) return NET_TERMINAL_DEFAULT_PINS;
  return Math.min(NET_TERMINAL_MAX_PINS, Math.max(NET_TERMINAL_MIN_PINS, Math.round(v)));
}

/**
 * `pinCount` is pairs / screws per side. N=3 → 3 left + 3 right.
 * Left ids 1,3,5… at x=0; right ids 2,4,6… at x=width. Row i at y=i.
 */
export function netTerminalDef(pinCount?: number): {
  w: number;
  h: number;
  terminals: TerminalDef[];
} {
  const n = clampPinCount(pinCount);
  const terminals: TerminalDef[] = [];
  for (let i = 1; i <= n; i += 1) {
    const y = NET_TERMINAL_PITCH * (i - 1) + 1;
    terminals.push({
      id: String(2 * i - 1),
      label: String(2 * i - 1),
      x: 0,
      y,
    });
    terminals.push({
      id: String(2 * i),
      label: String(2 * i),
      x: NET_TERMINAL_WIDTH,
      y,
    });
  }
  return {
    w: NET_TERMINAL_WIDTH,
    h: n + 1,
    terminals,
  };
}

