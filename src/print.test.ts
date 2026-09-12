import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addDevice, addWire, emptyCircuit } from "./circuitBuilder";
import { groupSymbols } from "./groups";
import {
  DEFAULT_PRINT_OPTIONS,
  getPrintContentBounds,
  PRINT_EDGE_GUTTER,
  PRINT_EDGE_URLS,
  printEdgeUrlBand,
  viewBoxWithPrintEdgeUrls,
} from "./print";
import { TRANSLATIONS } from "./i18n";
import { useLab } from "./store";
import { COLS, GRID, ROWS } from "./types";
import { PrintModal } from "./ui/PrintModal";

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
    addDevice(c, "lamp", "LT1", "body", 10, 15);
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
    const m = addDevice(c, "mains-3ph", "PWR1", "delta", 5, 5);
    const b = addDevice(c, "breaker-3p", "CB1", "body", 20, 5);
    addWire(c, m.symbol, "L1", b.symbol, "L1");

    const bounds = getPrintContentBounds(c, 2);

    expect(bounds.hasElements).toBe(true);
    expect(bounds.minX).toBeLessThanOrEqual(3); // 5 - 2
    expect(bounds.maxX).toBeGreaterThanOrEqual(24);
    expect(bounds.suggestedOrientation).toBe("landscape");
  });

  it("includes wire jogs in the bounding box", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "LT1", "body", 10, 10);
    const l2 = addDevice(c, "lamp", "LT2", "body", 30, 10);
    addWire(c, l1.symbol, "1", l2.symbol, "1");
    const w = c.wires[0];
    w.jog = { axis: "y", pos: 50 * GRID }; // jog way down at y=50

    const bounds = getPrintContentBounds(c, 2);
    expect(bounds.maxY).toBeGreaterThanOrEqual(52);
  });

  it("excludes hide-on-print groups from content bounds", () => {
    const c = emptyCircuit();
    const hiddenA = addDevice(c, "lamp", "LT1", "body", 2, 2);
    const hiddenB = addDevice(c, "lamp", "LT2", "body", 4, 2);
    groupSymbols(c, [hiddenA.symbol.id, hiddenB.symbol.id]);
    c.groups![0].hideOnPrint = true;
    const visible = addDevice(c, "lamp", "LT3", "body", 30, 20);

    const bounds = getPrintContentBounds(c, 2);
    expect(bounds.hasElements).toBe(true);
    expect(bounds.minX).toBeGreaterThanOrEqual(visible.symbol.x - 3);
    expect(bounds.minY).toBeGreaterThanOrEqual(visible.symbol.y - 3);
    expect(bounds.maxX).toBeGreaterThan(visible.symbol.x);
  });

  it("falls back to full canvas when every symbol is hide-on-print", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "LT1", "body", 10, 10);
    const b = addDevice(c, "lamp", "LT2", "body", 14, 10);
    addWire(c, a.symbol.id, "1", b.symbol.id, "1");
    groupSymbols(c, [a.symbol.id, b.symbol.id]);
    c.groups![0].hideOnPrint = true;

    const bounds = getPrintContentBounds(c, 2);
    expect(bounds.hasElements).toBe(false);
    expect(bounds.viewBox).toBe(`0 0 ${COLS * GRID} ${ROWS * GRID}`);
  });
});

describe("print edge URL bands", () => {
  it("repeats both site URLs so they can fill both page edges", () => {
    expect(PRINT_EDGE_URLS).toEqual(["https://elab.byd.io", "https://e2u.github.io"]);
    const band = printEdgeUrlBand(4);
    expect(band.startsWith("https://elab.byd.io")).toBe(true);
    expect(band).toContain("https://elab.byd.io**https://e2u.github.io");
    expect(band).not.toMatch(/elab\.byd\.io\s/);
    const first = band.indexOf("https://elab.byd.io");
    const second = band.indexOf("https://e2u.github.io");
    expect(second).toBeGreaterThan(first);
    expect(band.split("https://elab.byd.io").length - 1).toBe(4);
    expect(band.split("https://e2u.github.io").length - 1).toBe(4);
  });

  it("adds URL gutters after the auto-cropped viewBox without changing content height", () => {
    const cropped = "220 330 440 260";
    const next = viewBoxWithPrintEdgeUrls(cropped);
    expect(next.contentX).toBe(220);
    expect(next.contentY).toBe(330);
    expect(next.contentW).toBe(440);
    expect(next.contentH).toBe(260);
    expect(next.gutter).toBe(PRINT_EDGE_GUTTER);
    expect(next.viewBox).toBe(`${220 - PRINT_EDGE_GUTTER} 330 ${440 + PRINT_EDGE_GUTTER * 2} 260`);
  });

  it("renders repeating URLs on both edges of the cropped print SVG", () => {
    const html = renderToStaticMarkup(createElement(PrintModal, { isOpen: true, onClose: () => {} }));
    expect(html).toContain("print-edge-urls-svg");
    expect(html).toContain("print-edge-clip-left");
    expect(html).toContain("print-edge-clip-right");
    expect(html).toContain("https://elab.byd.io");
    expect(html).toContain("https://e2u.github.io");
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
