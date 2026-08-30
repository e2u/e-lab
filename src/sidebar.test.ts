import { describe, expect, it } from "vitest";
import { MAX_PALETTE_WIDTH, MAX_SIDE_WIDTH, MIN_PALETTE_WIDTH, MIN_SIDE_WIDTH, useLab } from "./store";

describe("sidebar collapse and resize feature", () => {
  it("initializes with panels open and default widths", () => {
    const s = useLab.getState();
    expect(typeof s.paletteOpen).toBe("boolean");
    expect(typeof s.sideOpen).toBe("boolean");
    expect(typeof s.paletteWidth).toBe("number");
    expect(s.paletteWidth).toBeGreaterThanOrEqual(MIN_PALETTE_WIDTH);
    expect(s.paletteWidth).toBeLessThanOrEqual(MAX_PALETTE_WIDTH);
    expect(typeof s.sideWidth).toBe("number");
    expect(s.sideWidth).toBeGreaterThanOrEqual(MIN_SIDE_WIDTH);
    expect(s.sideWidth).toBeLessThanOrEqual(MAX_SIDE_WIDTH);
  });

  it("toggles palette and persists state", () => {
    const s = useLab.getState();
    const initialPalette = s.paletteOpen;
    s.togglePalette();
    expect(useLab.getState().paletteOpen).toBe(!initialPalette);
    s.setPaletteOpen(initialPalette);
    expect(useLab.getState().paletteOpen).toBe(initialPalette);
  });

  it("toggles side panel and persists state", () => {
    const s = useLab.getState();
    const initialSide = s.sideOpen;
    s.toggleSide();
    expect(useLab.getState().sideOpen).toBe(!initialSide);
    s.setSideOpen(initialSide);
    expect(useLab.getState().sideOpen).toBe(initialSide);
  });

  it("adjusts palette width and clamps to min/max boundaries", () => {
    const s = useLab.getState();
    s.setPaletteWidth(320);
    expect(useLab.getState().paletteWidth).toBe(320);

    // Below minimum
    s.setPaletteWidth(50);
    expect(useLab.getState().paletteWidth).toBe(MIN_PALETTE_WIDTH);

    // Above maximum
    s.setPaletteWidth(1200);
    expect(useLab.getState().paletteWidth).toBe(MAX_PALETTE_WIDTH);
  });

  it("adjusts side panel width and clamps to min/max boundaries", () => {
    const s = useLab.getState();
    s.setSideWidth(380);
    expect(useLab.getState().sideWidth).toBe(380);

    // Below minimum
    s.setSideWidth(80);
    expect(useLab.getState().sideWidth).toBe(MIN_SIDE_WIDTH);

    // Above maximum
    s.setSideWidth(1500);
    expect(useLab.getState().sideWidth).toBe(MAX_SIDE_WIDTH);
  });

  it("resets panel widths to default values", () => {
    const s = useLab.getState();
    s.setPaletteWidth(400);
    s.setSideWidth(450);
    expect(useLab.getState().paletteWidth).toBe(400);
    expect(useLab.getState().sideWidth).toBe(450);

    s.resetPanelWidths();
    expect(useLab.getState().paletteWidth).toBe(220);
    expect(useLab.getState().sideWidth).toBe(260);
  });
});
