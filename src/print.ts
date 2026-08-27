import { COLS, GRID, ROWS, type Circuit } from "./types";
import { allWireRoutes, symbolBounds, terminalWorld } from "./geometry";

export interface PrintContentBounds {
  minX: number; // in grid units
  minY: number;
  maxX: number;
  maxY: number;
  width: number; // in pixels
  height: number; // in pixels
  viewBox: string;
  hasElements: boolean;
  aspectRatio: number; // width / height
  suggestedOrientation: "portrait" | "landscape";
}

export interface PrintOptions {
  scope: "content" | "full";
  background: "white" | "paper" | "transparent";
  printGrid: boolean;
  colorMode: "color" | "monochrome";
  includeHeader: boolean;
  padding: number; // in grid units
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  scope: "content",
  background: "white",
  printGrid: false,
  colorMode: "color",
  includeHeader: true,
  padding: 2,
};

/**
 * Calculates the bounding box of active circuit elements (symbols, wires, terminals, jogs).
 * Excludes blank/empty areas of the diagram.
 */
export function getPrintContentBounds(circuit: Circuit, paddingGrids = 2): PrintContentBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // 1. Symbol bounding boxes
  for (const s of circuit.symbols) {
    const b = symbolBounds(circuit, s);
    if (b) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    } else {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + 4);
      maxY = Math.max(maxY, s.y + 4);
    }
  }

  // 2. Wire routes and terminal endpoints
  const routes = allWireRoutes(circuit);
  for (const w of circuit.wires) {
    const pts = routes.get(w.id);
    if (pts && pts.length > 0) {
      for (const p of pts) {
        minX = Math.min(minX, p.x / GRID);
        minY = Math.min(minY, p.y / GRID);
        maxX = Math.max(maxX, p.x / GRID);
        maxY = Math.max(maxY, p.y / GRID);
      }
    } else {
      const pA = terminalWorld(circuit, w.a);
      const pB = terminalWorld(circuit, w.b);
      if (pA) {
        minX = Math.min(minX, pA.x / GRID);
        minY = Math.min(minY, pA.y / GRID);
        maxX = Math.max(maxX, pA.x / GRID);
        maxY = Math.max(maxY, pA.y / GRID);
      }
      if (pB) {
        minX = Math.min(minX, pB.x / GRID);
        minY = Math.min(minY, pB.y / GRID);
        maxX = Math.max(maxX, pB.x / GRID);
        maxY = Math.max(maxY, pB.y / GRID);
      }
    }
    if (w.jog) {
      if (w.jog.axis === "x") {
        minX = Math.min(minX, w.jog.pos / GRID);
        maxX = Math.max(maxX, w.jog.pos / GRID);
      } else {
        minY = Math.min(minY, w.jog.pos / GRID);
        maxY = Math.max(maxY, w.jog.pos / GRID);
      }
    }
  }

  const hasElements = (circuit.symbols.length > 0 || circuit.wires.length > 0) && isFinite(minX);

  if (!hasElements) {
    const w = COLS * GRID;
    const h = ROWS * GRID;
    return {
      minX: 0,
      minY: 0,
      maxX: COLS,
      maxY: ROWS,
      width: w,
      height: h,
      viewBox: `0 0 ${w} ${h}`,
      hasElements: false,
      aspectRatio: w / h,
      suggestedOrientation: "landscape",
    };
  }

  const pad = Math.max(0, paddingGrids);
  const clampedMinX = Math.max(0, Math.floor(minX - pad));
  const clampedMinY = Math.max(0, Math.floor(minY - pad));
  const clampedMaxX = Math.min(COLS, Math.ceil(maxX + pad));
  const clampedMaxY = Math.min(ROWS, Math.ceil(maxY + pad));

  const pixelX = clampedMinX * GRID;
  const pixelY = clampedMinY * GRID;
  const pixelW = Math.max((clampedMaxX - clampedMinX) * GRID, GRID * 4);
  const pixelH = Math.max((clampedMaxY - clampedMinY) * GRID, GRID * 4);

  const aspectRatio = pixelW / pixelH;
  const suggestedOrientation = aspectRatio >= 1.05 ? "landscape" : "portrait";

  return {
    minX: clampedMinX,
    minY: clampedMinY,
    maxX: clampedMaxX,
    maxY: clampedMaxY,
    width: pixelW,
    height: pixelH,
    viewBox: `${pixelX} ${pixelY} ${pixelW} ${pixelH}`,
    hasElements: true,
    aspectRatio,
    suggestedOrientation,
  };
}
