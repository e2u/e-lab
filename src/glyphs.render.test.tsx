import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addDevice, emptyCircuit } from "./circuitBuilder";
import { SymbolGlyph } from "./Glyphs";
import { GRID } from "./types";

describe("coil glyph leads", () => {
  it("reaches both terminal edges so print does not show a gap", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "relay", "CR1", "coil", 0, 0);
    const html = renderToStaticMarkup(
      createElement(SymbolGlyph, { device, variant: "coil", w: 4, h: 2 }),
    );
    const width = 4 * GRID;
    expect(html).toContain(`x1="0"`);
    expect(html).toContain(`x2="${width}"`);
  });
});
