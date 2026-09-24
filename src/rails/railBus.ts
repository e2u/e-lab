import type { Circuit, Device, SymbolInst, TerminalDef } from "../types";

export function isRailKind(kind: string): boolean {
  return kind === "rail-l" || kind === "rail-n";
}

export function isRailSpanKind(kind: string): boolean {
  return isRailKind(kind) || kind === "rail-break";
}

/** Terminal id for the bus point on grid row `row`. */
export function railTermId(row: number): string {
  return `y${row}`;
}

/**
 * One terminal on every grid row of the rail. All of them are the same wire:
 * Line rail joins the control hot, Cross-ref rail joins the neutral.
 */
export function railBusTerminals(sym: SymbolInst, dev: Device): TerminalDef[] {
  const y0 = dev.params.railY0;
  const y1 = dev.params.railY1;
  if (typeof y0 !== "number" || typeof y1 !== "number" || !Number.isFinite(y0) || !Number.isFinite(y1)) {
    return [];
  }
  const lo = Math.round(Math.min(y0, y1));
  const hi = Math.round(Math.max(y0, y1));
  const terminals: TerminalDef[] = [];
  for (let row = lo; row <= hi; row += 1) {
    terminals.push({
      id: railTermId(row),
      label: String(row),
      x: 0,
      y: row - sym.y,
    });
  }
  return terminals;
}

/** Slide a rail's vertical span when its symbol moves by `dy` grid rows. */
export function shiftRailWithSymbol(dev: Device, dy: number): void {
  if (!isRailSpanKind(dev.kind) || dy === 0) return;
  if (typeof dev.params.railY0 === "number") dev.params.railY0 += dy;
  if (typeof dev.params.railY1 === "number") dev.params.railY1 += dy;
}

/**
 * Rail breaks sitting on a control rail's column travel with that rail.
 * Breaks already in `except` moved on their own and are left alone.
 */
export function shiftBreaksOnColumn(
  circuit: Circuit,
  column: number,
  dx: number,
  dy: number,
  except?: ReadonlySet<string>,
): void {
  if (dx === 0 && dy === 0) return;
  for (const sym of circuit.symbols) {
    if (sym.x !== column || except?.has(sym.id)) continue;
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || dev.kind !== "rail-break") continue;
    sym.x = column + dx;
    sym.y += dy;
    shiftRailWithSymbol(dev, dy);
  }
}
