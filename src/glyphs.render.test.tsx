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

  it("renders terminal labels when hideTerminals is false, and omits them when hideTerminals is true", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "relay", "CR1", "coil", 0, 0);

    const htmlShown = renderToStaticMarkup(
      createElement(SymbolGlyph, { device, variant: "coil", w: 4, h: 2, hideTerminals: false }),
    );
    expect(htmlShown).toContain("A1");
    expect(htmlShown).toContain("A2");
    expect(htmlShown).toContain("term-lab");

    const htmlHidden = renderToStaticMarkup(
      createElement(SymbolGlyph, { device, variant: "coil", w: 4, h: 2, hideTerminals: true }),
    );
    expect(htmlHidden).not.toContain("A1");
    expect(htmlHidden).not.toContain("A2");
  });

  it("renders 11-pin solid-state off-delay timer coil with TRIGGER label on terminals 5-6", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "timer-ss-off", "TR1", "coil", 0, 0);

    const html = renderToStaticMarkup(
      createElement(SymbolGlyph, { device, variant: "coil", w: 6, h: 4, hideTerminals: false }),
    );
    expect(html).toContain("TRIGGER");
    expect(html).not.toContain("START");
    expect(html).toContain("OFF-DELAY");
    expect(html).toContain("TR1");
  });

  it("renders fuse with neutral background fill and without colored tint", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "fuse", "FU1", "body", 0, 0);

    const html = renderToStaticMarkup(
      createElement(SymbolGlyph, { device, variant: "body", w: 2, h: 4 }),
    );
    expect(html).toContain('fill="#efe6d0"');
    expect(html).not.toContain("#cfe8c4");
    expect(html).not.toContain("#e8c4c4");
    expect(html).toContain("FU");
  });
});
