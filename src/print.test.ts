import { describe, expect, it } from "vitest";
import { addDevice, addWire, emptyCircuit } from "./circuitBuilder";
import { DEFAULT_PRINT_OPTIONS, getPrintContentBounds } from "./print";
import { TRANSLATIONS } from "./i18n";
import { useLab } from "./store";
import { COLS, GRID, ROWS } from "./types";

describe("print bounds calculation", () => {
  it("returns full canvas bounds when circuit is empty", () => {
    const c = emptyCircuit();
    const bounds = getPrintContentBounds(c);

    expect(bounds.hasElements).toBe(false);
    expect(bounds.minX).toBe(0);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxX).toBe(COLS);
    expect(bounds.maxY).toBe(ROWS);
    expect(bounds.viewBox).toBe(`0 0 ${COLS * GRID} ${ROWS * GRID}`);
  });

  it("calculates tight bounding box with padding for single symbol", () => {
    const c = emptyCircuit();
    addDevice(c, "lamp", "HL1", "body", 10, 15);
    const bounds = getPrintContentBounds(c, 2);

    expect(bounds.hasElements).toBe(true);
    expect(bounds.minX).toBe(8); // 10 - 2
    expect(bounds.minY).toBe(13); // 15 - 2
    expect(bounds.maxX).toBeGreaterThanOrEqual(14);
    expect(bounds.maxY).toBeGreaterThanOrEqual(19);
    expect(bounds.width).toBe((bounds.maxX - bounds.minX) * GRID);
    expect(bounds.height).toBe((bounds.maxY - bounds.minY) * GRID);
    expect(bounds.viewBox).toBe(`${bounds.minX * GRID} ${bounds.minY * GRID} ${bounds.width} ${bounds.height}`);
  });

  it("calculates accurate bounding box enclosing multiple components and wires", () => {
    const c = emptyCircuit();
    const m = addDevice(c, "mains-3ph", "G1", "delta", 5, 5);
    const b = addDevice(c, "breaker-3p", "QF1", "body", 20, 5);
    addWire(c, m.symbol, "L1", b.symbol, "L1");

    const bounds = getPrintContentBounds(c, 2);

    expect(bounds.hasElements).toBe(true);
    expect(bounds.minX).toBeLessThanOrEqual(3); // 5 - 2
    expect(bounds.maxX).toBeGreaterThanOrEqual(24);
    expect(bounds.suggestedOrientation).toBe("landscape");
  });

  it("includes wire jogs in the bounding box", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 10, 10);
    const l2 = addDevice(c, "lamp", "HL2", "body", 30, 10);
    addWire(c, l1.symbol, "1", l2.symbol, "1");
    const w = c.wires[0];
    w.jog = { axis: "y", pos: 50 * GRID }; // jog way down at y=50

    const bounds = getPrintContentBounds(c, 2);
    expect(bounds.maxY).toBeGreaterThanOrEqual(52);
  });
});

describe("print store actions and defaults", () => {
  it("provides correct default print options", () => {
    expect(DEFAULT_PRINT_OPTIONS.scope).toBe("content");
    expect(DEFAULT_PRINT_OPTIONS.background).toBe("white");
    expect(DEFAULT_PRINT_OPTIONS.printGrid).toBe(false);
    expect(DEFAULT_PRINT_OPTIONS.colorMode).toBe("color");
    expect(DEFAULT_PRINT_OPTIONS.includeHeader).toBe(true);
  });

  it("toggles print modal state in store", () => {
    expect(useLab.getState().printOpen).toBe(false);

    useLab.getState().openPrint();
    expect(useLab.getState().printOpen).toBe(true);

    useLab.getState().closePrint();
    expect(useLab.getState().printOpen).toBe(false);
  });

  it("includes all print i18n keys for both English and Chinese", () => {
    const keys = [
      "files.print",
      "print.title",
      "print.preview",
      "print.scope",
      "print.scopeContent",
      "print.scopeFull",
      "print.background",
      "print.bgWhite",
      "print.bgPaper",
      "print.bgTransparent",
      "print.printGrid",
      "print.colorMode",
      "print.colorFull",
      "print.colorMono",
      "print.includeHeader",
      "print.orientation",
      "print.orientationAuto",
      "print.orientationPortrait",
      "print.orientationLandscape",
      "print.execute",
      "print.cancel",
      "print.noElements",
    ];

    for (const key of keys) {
      expect(TRANSLATIONS.en[key]).toBeDefined();
      expect(TRANSLATIONS.zh[key]).toBeDefined();
    }
  });
});
