import { resolvedVariant } from "../catalog";
import { terminalWorld } from "../geometry";
import { GRID, type Circuit, type Device, type RailCellContent, type RailTextSegment, type SymbolInst } from "../types";

/** Hit target and paint box for one rail cell. Coordinates are schematic pixels. */
export interface RailCellBox {
  rail: "l" | "n";
  y: number;
  index: number;
  text: string;
  side: "left" | "right";
  isNC: boolean;
  style?: "bold" | "italic";
  segments?: RailTextSegment[];
  x: number;
  yPx: number;
  w: number;
  h: number;
  /** Spine x. Text grows away from this column. */
  colX: number;
}

export interface RailSpine {
  rail: "l" | "n";
  symbolId: string;
  x: number;
  /** Spine ends in schematic pixels. */
  y1: number;
  y2: number;
  /** Spine ends in grid rows. Either end may be the top. */
  y0Grid: number;
  y1Grid: number;
}

export interface LogicRailLayout {
  spines: RailSpine[];
  cells: RailCellBox[];
}

export interface RailSelection {
  rail: "l" | "n";
  y: number;
  index: number;
}

export interface LogicRails {
  lineNumbers: Record<number, string>;
  crossReferences: Record<number, RailCellContent[]>;
}

const SKIP_ROW = new Set(["junction", "comment", "title-block", "rail-l", "rail-n"]);

const CELL_H = GRID;
const CHAR_W = 7.2;
const CELL_PAD = 12;
const SIDE_GAP = 4;
const RAIL_CLEAR = 8;

export function isLogicRailKind(kind: string): boolean {
  return kind === "rail-l" || kind === "rail-n" || kind === "rail-break";
}

export function sameLogicRails(a: LogicRails, b: LogicRails): boolean {
  return (
    JSON.stringify(a.lineNumbers) === JSON.stringify(b.lineNumbers) &&
    JSON.stringify(a.crossReferences) === JSON.stringify(b.crossReferences)
  );
}

export function normalizeRailCell(raw: Partial<RailCellContent> | null | undefined): RailCellContent {
  const side = raw?.side === "left" ? "left" : "right";
  const cell: RailCellContent = { text: String(raw?.text ?? ""), side };
  if (raw?.isNC) cell.isNC = true;
  if (raw?.style === "bold" || raw?.style === "italic") cell.style = raw.style;
  if (raw?.segments?.length) {
    cell.segments = raw.segments.map((seg) => {
      const next: RailTextSegment = { text: String(seg?.text ?? "") };
      if (seg?.isNC) next.isNC = true;
      return next;
    });
  }
  return cell;
}

export function mergeRailCell(cell: RailCellContent, patch: Partial<RailCellContent>): RailCellContent {
  return normalizeRailCell({
    text: patch.text !== undefined ? patch.text : cell.text,
    side: patch.side !== undefined ? patch.side : cell.side,
    isNC: "isNC" in patch ? patch.isNC : cell.isNC,
    style: "style" in patch ? patch.style : cell.style,
    segments: patch.text !== undefined ? undefined : cell.segments,
  });
}

function deviceOf(circuit: Circuit, sym: SymbolInst): Device | undefined {
  return circuit.devices.find((d) => d.id === sym.deviceId);
}

function firstDevice(circuit: Circuit, kind: "rail-l" | "rail-n"): Device | undefined {
  return circuit.devices.find((d) => d.kind === kind);
}

function firstSymbol(circuit: Circuit, deviceId: string): SymbolInst | undefined {
  return circuit.symbols.find((s) => s.deviceId === deviceId);
}

/** Grid rows that carry an electrical symbol, top to bottom. */
export function contentRows(circuit: Circuit): number[] {
  const rows: number[] = [];
  const seen = new Set<number>();
  for (const sym of circuit.symbols) {
    const row = electricalRow(circuit, sym);
    if (row === null || seen.has(row)) continue;
    seen.add(row);
    rows.push(row);
  }
  rows.sort((a, b) => a - b);
  return rows;
}

/**
 * Vertical ends of a rail in grid rows.
 * Explicit `railY0` / `railY1` win. Otherwise the rail covers the content.
 */
export function railEnds(dev: Device, sym: SymbolInst, rows: number[]): { y0: number; y1: number } {
  const y0 = dev.params.railY0;
  const y1 = dev.params.railY1;
  if (typeof y0 === "number" && Number.isFinite(y0) && typeof y1 === "number" && Number.isFinite(y1)) {
    return { y0, y1 };
  }
  if (rows.length === 0) return { y0: sym.y, y1: sym.y + 8 };
  return { y0: rows[0] - 1, y1: rows[rows.length - 1] + 1 };
}

export function spanContains(row: number, ends: { y0: number; y1: number }): boolean {
  const lo = Math.min(ends.y0, ends.y1);
  const hi = Math.max(ends.y0, ends.y1);
  return row >= lo && row <= hi;
}

/** Grid row of a symbol's terminals. Sheet furniture and rails return null. */
export function electricalRow(circuit: Circuit, sym: SymbolInst): number | null {
  const dev = deviceOf(circuit, sym);
  if (!dev || SKIP_ROW.has(dev.kind)) return null;
  const variant = resolvedVariant(dev.kind, sym.variant, dev.params);
  const ys: number[] = [];
  for (const term of variant.terminals) {
    const p = terminalWorld(circuit, { symbolId: sym.id, term: term.id });
    if (p) ys.push(Math.round(p.y / GRID));
  }
  if (ys.length === 0) return null;
  ys.sort((a, b) => a - b);
  return ys[Math.floor((ys.length - 1) / 2)];
}

/** NO/NC of a coil device, including a timer's delayed contacts. The coil itself is omitted. */
function contactPole(variant: string): "no" | "nc" | null {
  const v = variant.toLowerCase();
  if (v === "coil" || v === "main" || v === "body" || v === "") return null;
  if (v.includes("nc")) return "nc";
  if (v.includes("no")) return "no";
  return null;
}

/** `(5,7)` on the coil row. NC row numbers are underlined segments. */
function crossRefCell(
  entries: { row: number; nc: boolean }[],
  lineNumbers: Record<number, string>,
): RailCellContent {
  const segments: RailTextSegment[] = [{ text: "(" }];
  entries.forEach((entry, index) => {
    if (index > 0) segments.push({ text: "," });
    const printed = lineNumbers[entry.row];
    const text = printed !== undefined && printed !== "" ? printed : String(entry.row);
    segments.push(entry.nc ? { text, isNC: true } : { text });
  });
  segments.push({ text: ")" });
  return normalizeRailCell({
    text: segments.map((seg) => seg.text).join(""),
    side: "right",
    segments,
  });
}

/**
 * Line numbers from a top-to-bottom Y scan (L rail) and coil cross-references (N rail).
 * A missing rail component leaves that half empty. Row overrides on the rail device win.
 */
export function computeLogicRails(circuit: Circuit): LogicRails {
  const lineNumbers: Record<number, string> = {};
  const crossReferences: Record<number, RailCellContent[]> = {};
  const railL = firstDevice(circuit, "rail-l");
  const railN = firstDevice(circuit, "rail-n");
  const lSym = railL ? firstSymbol(circuit, railL.id) : undefined;
  const nSym = railN ? firstSymbol(circuit, railN.id) : undefined;
  const rows = railL || railN ? contentRows(circuit) : [];
  const lEnds = railL && lSym ? railEnds(railL, lSym, rows) : null;
  const nEnds = railN && nSym ? railEnds(railN, nSym, rows) : null;

  if (railL && lEnds) {
    rows.filter((row) => spanContains(row, lEnds)).forEach((row, i) => {
      lineNumbers[row] = String(i + 1);
    });
    for (const [key, text] of Object.entries(railL.params.railLineOverrides ?? {})) {
      const y = Number(key);
      if (!Number.isFinite(y) || !spanContains(y, lEnds)) continue;
      lineNumbers[y] = String(text);
    }
  }

  if (railN && nEnds) {
    const coilSymbols = circuit.symbols.filter((s) => s.variant === "coil");
    for (const coil of coilSymbols) {
      const dev = deviceOf(circuit, coil);
      if (!dev) continue;
      const coilRow = electricalRow(circuit, coil);
      if (coilRow === null || !spanContains(coilRow, nEnds)) continue;
      const seen = new Set<string>();
      const entries: { row: number; nc: boolean }[] = [];
      for (const sym of circuit.symbols) {
        if (sym.deviceId !== dev.id || sym.id === coil.id) continue;
        const pole = contactPole(sym.variant);
        if (!pole) continue;
        const row = electricalRow(circuit, sym);
        if (row === null || row === coilRow) continue;
        const key = `${row}:${pole}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ row, nc: pole === "nc" });
      }
      if (entries.length === 0) continue;
      entries.sort((a, b) => a.row - b.row || (a.nc === b.nc ? 0 : a.nc ? -1 : 1));
      const list = crossReferences[coilRow] ?? [];
      list.push(crossRefCell(entries, lineNumbers));
      crossReferences[coilRow] = list;
    }
    for (const [key, cells] of Object.entries(railN.params.railCrossOverrides ?? {})) {
      const y = Number(key);
      if (!Number.isFinite(y) || !Array.isArray(cells) || !spanContains(y, nEnds)) continue;
      crossReferences[y] = cells.map((cell) => normalizeRailCell(cell));
    }
  }

  return { lineNumbers, crossReferences };
}

function cellWidth(text: string): number {
  return Math.max(GRID, Math.ceil(text.length * CHAR_W) + CELL_PAD);
}

/**
 * Paint boxes aligned to the grid. The spine x stays on the rail symbol;
 * cell text grows left or right of that column.
 */
export function layoutLogicRails(
  circuit: Circuit,
  lineNumbers: Record<number, string>,
  crossReferences: Record<number, RailCellContent[]>,
): LogicRailLayout {
  const spines: RailSpine[] = [];
  const cells: RailCellBox[] = [];
  const railL = firstDevice(circuit, "rail-l");
  const railN = firstDevice(circuit, "rail-n");
  const lSym = railL ? firstSymbol(circuit, railL.id) : undefined;
  const nSym = railN ? firstSymbol(circuit, railN.id) : undefined;

  const rows = contentRows(circuit);
  const lEnds = railL && lSym ? railEnds(railL, lSym, rows) : null;
  const nEnds = railN && nSym ? railEnds(railN, nSym, rows) : null;

  if (lSym && lEnds) {
    const colX = lSym.x * GRID;
    const top = Math.min(lEnds.y0, lEnds.y1);
    const bot = Math.max(lEnds.y0, lEnds.y1);
    spines.push({ rail: "l", symbolId: lSym.id, x: colX, y1: top * GRID, y2: bot * GRID, y0Grid: lEnds.y0, y1Grid: lEnds.y1 });
    for (const y of Object.keys(lineNumbers)) {
      const row = Number(y);
      if (!Number.isFinite(row) || !lEnds || !spanContains(row, lEnds)) continue;
      const text = lineNumbers[row] ?? "";
      const w = cellWidth(text);
      cells.push({
        rail: "l",
        y: row,
        index: 0,
        text,
        side: "left",
        isNC: false,
        x: colX - RAIL_CLEAR - w,
        yPx: row * GRID - CELL_H / 2,
        w,
        h: CELL_H,
        colX,
      });
    }
  }

  if (nSym && nEnds) {
    const colX = nSym.x * GRID;
    const top = Math.min(nEnds.y0, nEnds.y1);
    const bot = Math.max(nEnds.y0, nEnds.y1);
    spines.push({ rail: "n", symbolId: nSym.id, x: colX, y1: top * GRID, y2: bot * GRID, y0Grid: nEnds.y0, y1Grid: nEnds.y1 });
    for (const y of Object.keys(crossReferences)) {
      const row = Number(y);
      if (!Number.isFinite(row) || !nEnds || !spanContains(row, nEnds)) continue;
      let rightCursor = colX + RAIL_CLEAR;
      const list = crossReferences[row] ?? [];
      list.forEach((cell, index) => {
        const norm = normalizeRailCell(cell);
        const w = cellWidth(norm.text);
        const x = rightCursor;
        rightCursor += w + SIDE_GAP;
        cells.push({
          rail: "n",
          y: row,
          index,
          text: norm.text,
          side: "right",
          isNC: Boolean(norm.isNC),
          style: norm.style,
          segments: norm.segments,
          x,
          yPx: row * GRID - CELL_H / 2,
          w,
          h: CELL_H,
          colX,
        });
      });
    }
  }

  return { spines, cells };
}

export function hitTestRailCell(px: number, py: number, cells: RailCellBox[]): RailCellBox | null {
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    if (px >= cell.x && px <= cell.x + cell.w && py >= cell.yPx && py <= cell.yPx + cell.h) return cell;
  }
  return null;
}
