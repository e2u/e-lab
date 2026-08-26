import { describe, expect, it } from "vitest";
import { useLab } from "./store";
import { COLS, ZOOM_LEVELS } from "./types";

describe("canvas width and zoom features", () => {
  it("has doubled canvas width (COLS = 168)", () => {
    expect(COLS).toBe(168);
  });

  it("defines standard zoom levels 25%, 50%, 100%, 125%, 150%", () => {
    expect(ZOOM_LEVELS).toEqual([0.25, 0.5, 1, 1.25, 1.5]);
  });

  it("initializes with default zoom level 1 (100%)", () => {
    const s = useLab.getState();
    expect(s.zoom).toBe(1);
  });

  it("can set custom zoom level within bounds", () => {
    const s = useLab.getState();
    s.setZoom(0.5);
    expect(useLab.getState().zoom).toBe(0.5);

    s.setZoom(1.25);
    expect(useLab.getState().zoom).toBe(1.25);

    s.setZoom(1.5);
    expect(useLab.getState().zoom).toBe(1.5);

    s.setZoom(0.25);
    expect(useLab.getState().zoom).toBe(0.25);

    // Clamps to min/max
    s.setZoom(0.1);
    expect(useLab.getState().zoom).toBe(0.25);

    s.setZoom(2.0);
    expect(useLab.getState().zoom).toBe(1.5);
  });

  it("steps through zoom levels with zoomIn and zoomOut", () => {
    const s = useLab.getState();
    s.resetZoom();
    expect(useLab.getState().zoom).toBe(1);

    s.zoomIn();
    expect(useLab.getState().zoom).toBe(1.25);

    s.zoomIn();
    expect(useLab.getState().zoom).toBe(1.5);

    // At max, zoomIn stays at 1.5
    s.zoomIn();
    expect(useLab.getState().zoom).toBe(1.5);

    s.zoomOut();
    expect(useLab.getState().zoom).toBe(1.25);

    s.zoomOut();
    expect(useLab.getState().zoom).toBe(1);

    s.zoomOut();
    expect(useLab.getState().zoom).toBe(0.5);

    s.zoomOut();
    expect(useLab.getState().zoom).toBe(0.25);

    // At min, zoomOut stays at 0.25
    s.zoomOut();
    expect(useLab.getState().zoom).toBe(0.25);

    s.resetZoom();
    expect(useLab.getState().zoom).toBe(1);
  });
});
