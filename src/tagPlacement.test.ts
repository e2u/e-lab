import { describe, expect, it } from "vitest";
import { GRID } from "./types";
import { getSymbolTagPlacement } from "./tagPlacement";
import { hasGlyphTag } from "./ui/schematic/layers/SymbolLayer";

describe("tagPlacement", () => {
  it("places breaker-1p tag on the right side", () => {
    const sym = { x: 10, y: 10 };
    const v = { w: 2, h: 4 };
    const res = getSymbolTagPlacement("breaker-1p", sym, v);
    expect(res.textAnchor).toBe("start");
    expect(res.tagX).toBe((10 + 2 - 1) * GRID);
    expect(res.tagY).toBe((10 + 4 - 5) * GRID);
  });

  it("places transformer tag at top", () => {
    const sym = { x: 10, y: 10 };
    const v = { w: 4, h: 4 };
    const res = getSymbolTagPlacement("transformer", sym, v);
    expect(res.textAnchor).toBe("middle");
    expect(res.tagX).toBe((10 + 2) * GRID);
    expect(res.tagY).toBe(10 * GRID - 0.5 * GRID);
  });

  it("places contactor tag at bottom", () => {
    const sym = { x: 10, y: 10 };
    const v = { w: 4, h: 4 };
    const res = getSymbolTagPlacement("contactor", sym, v);
    expect(res.textAnchor).toBe("middle");
    expect(res.tagX).toBe((10 + 2) * GRID);
    expect(res.tagY).toBe((10 + 4 + 0.5) * GRID);
  });

  it("correctly identifies symbols that render tag inside glyph", () => {
    // Timer coils have tag drawn inside glyph
    expect(hasGlyphTag("timer-on", "coil")).toBe(true);
    expect(hasGlyphTag("timer-off", "coil")).toBe(true);

    // Contactor/relay coils now show external device tags (not inside glyph)
    expect(hasGlyphTag("contactor", "coil")).toBe(false);
    expect(hasGlyphTag("relay", "coil")).toBe(false);

    // Contacts do not have tag drawn inside glyph (must show SymbolLayer tag badge)
    expect(hasGlyphTag("contactor", "aux-no")).toBe(false);
    expect(hasGlyphTag("contactor", "aux-nc")).toBe(false);
    expect(hasGlyphTag("contactor", "main")).toBe(false);
    expect(hasGlyphTag("relay", "aux-no")).toBe(false);
    expect(hasGlyphTag("timer-on", "delayed-no")).toBe(false);

    // Standalone symbols with glyph tags
    expect(hasGlyphTag("mains-3ph", "delta")).toBe(true);
    expect(hasGlyphTag("dc-supply", "body")).toBe(true);
    expect(hasGlyphTag("counter", "body")).toBe(true);
    expect(hasGlyphTag("starter-dol", "body")).toBe(true);
    expect(hasGlyphTag("net-label", "body")).toBe(true);
    expect(hasGlyphTag("comment", "body")).toBe(true);
    expect(hasGlyphTag("junction", "body")).toBe(true);

    // Normal symbols without glyph tags
    expect(hasGlyphTag("breaker-1p", "body")).toBe(false);
    expect(hasGlyphTag("ground", "body")).toBe(false);
    expect(hasGlyphTag("lamp", "body")).toBe(false);
    expect(hasGlyphTag("motor-3ph", "body")).toBe(false);
  });
});
