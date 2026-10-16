import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addDevice, emptyCircuit } from "./circuitBuilder";
import { SymbolGlyph } from "./Glyphs";
import { GRID, type DeviceRuntime } from "./types";

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

  it("shrinks a long coil tag so it stays inside the circle", () => {
    const c = emptyCircuit();
    const short = addDevice(c, "contactor", "KM1", "coil", 0, 0).device;
    const long = addDevice(c, "contactor", "M_FWD", "coil", 4, 0).device;
    const shortHtml = renderToStaticMarkup(
      createElement(SymbolGlyph, { device: short, variant: "coil", w: 4, h: 2 }),
    );
    const longHtml = renderToStaticMarkup(
      createElement(SymbolGlyph, { device: long, variant: "coil", w: 4, h: 2 }),
    );
    const size = (html: string, tag: string) => {
      const match = html.match(new RegExp(`font-size:\\s*([\\d.]+)px[^>]*>${tag}<`));
      return Number(match?.[1]);
    };
    expect(size(shortHtml, "KM1")).toBe(12);
    expect(size(longHtml, "M_FWD")).toBeLessThan(12);
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

  it("draws net-terminal name without the Safari-ghost .sym-tag class", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "net-terminal", "L1", "body", 0, 0, { pinCount: 12 });
    const html = renderToStaticMarkup(
      createElement(SymbolGlyph, { device, variant: "body", w: 4, h: 13 }),
    );
    expect(html).toContain(">L1</text>");
    expect(html).toContain("glyph-net-name");
    expect(html).not.toMatch(/class="sym-tag"/);
  });

  it("uses dark net-terminal name on a light plate so it stays visible", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "net-terminal", "BUS", "body", 0, 0, {
      pinCount: 4,
      color: "#efe6d0",
    });
    const html = renderToStaticMarkup(
      createElement(SymbolGlyph, { device, variant: "body", w: 4, h: 5 }),
    );
    expect(html).toContain(">BUS</text>");
    expect(html).toContain('fill="#1b1a16"');
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

  it("renders distinct symbols for flow switch NO and NC", () => {
    const c = emptyCircuit();
    const { device: flowNo } = addDevice(c, "flow-no", "FLS1", "body", 0, 0);
    const { device: flowNc } = addDevice(c, "flow-nc", "FLS2", "body", 0, 0);

    const htmlNo = renderToStaticMarkup(
      createElement(SymbolGlyph, { device: flowNo, variant: "body", w: 4, h: 2 }),
    );
    const htmlNc = renderToStaticMarkup(
      createElement(SymbolGlyph, { device: flowNc, variant: "body", w: 4, h: 2 }),
    );

    // Both should render polygon vane for flow switch
    expect(htmlNo).toContain("<polygon");
    expect(htmlNc).toContain("<polygon");

    // NO blade is open below the line in unactuated state (y + r + 18 = 22 + 5 + 18 = 45)
    expect(htmlNo).toContain('y2="45"');

    // NC blade is closed resting on top of the contact dots in unactuated state (y - r - 2 = 22 - 5 - 2 = 15)
    expect(htmlNc).toContain('y2="15"');
  });

  it("renders distinct symbols for float switch NO and NC", () => {
    const c = emptyCircuit();
    const { device: floatNo } = addDevice(c, "float-no", "FS1", "body", 0, 0);
    const { device: floatNc } = addDevice(c, "float-nc", "FS2", "body", 0, 0);

    const htmlNo = renderToStaticMarkup(
      createElement(SymbolGlyph, { device: floatNo, variant: "body", w: 4, h: 2 }),
    );
    const htmlNc = renderToStaticMarkup(
      createElement(SymbolGlyph, { device: floatNc, variant: "body", w: 4, h: 2 }),
    );

    // Both should render float ball circle
    expect(htmlNo).toContain("<circle");
    expect(htmlNc).toContain("<circle");

    // NO blade is open below the contact dots in unactuated state (y + r + 18 = 22 + 5 + 18 = 45)
    expect(htmlNo).toContain('y2="45"');

    // NC blade is closed resting on top of the contact dots in unactuated state (y - r - 2 = 22 - 5 - 2 = 15)
    expect(htmlNc).toContain('y2="15"');
  });

  it("draws an NC slash only on F-O-R contacts set to NC", () => {
    const c = emptyCircuit();
    const { device: noDev } = addDevice(c, "selector-3", "SS1", "body", 0, 0);
    const { device: bothNc } = addDevice(c, "selector-3", "SS2", "body", 0, 0, {
      fwdContact: "nc",
      revContact: "nc",
    });
    const { device: fNc } = addDevice(c, "selector-3", "SS3", "body", 0, 0, { fwdContact: "nc" });

    const htmlNo = renderToStaticMarkup(createElement(SymbolGlyph, { device: noDev, variant: "body", w: 4, h: 4 }));
    const htmlBoth = renderToStaticMarkup(createElement(SymbolGlyph, { device: bothNc, variant: "body", w: 4, h: 4 }));
    const htmlF = renderToStaticMarkup(createElement(SymbolGlyph, { device: fNc, variant: "body", w: 4, h: 4 }));

    expect(htmlNo).not.toContain("sel-nc");
    expect(htmlBoth.match(/sel-nc/g)).toHaveLength(2);
    expect(htmlF.match(/sel-nc/g)).toHaveLength(1);
  });

  it("draws a drum switch open, straight, or crossed", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "drum", "DR1", "body", 0, 0);
    const render = (position: number) =>
      renderToStaticMarkup(
        createElement(SymbolGlyph, {
          device,
          variant: "body",
          w: 4,
          h: 6,
          rt: { position } as DeviceRuntime,
        }),
      );
    const off = render(0);
    const fwd = render(1);
    const rev = render(2);
    expect(off).toContain("drum-pos");
    expect(off).toContain('dominant-baseline="central"');
    expect(off).toContain('y="123"');
    expect(fwd).toContain('y="123"');
    expect(rev).toContain('y="123"');
    expect(off).toContain(">O<");
    expect(off).not.toContain("contact-broken");
    expect(off).toContain('x1="34" y1="4" x2="54" y2="22"');
    expect(off).toContain('x1="34" y1="48" x2="54" y2="66"');
    expect(off).toContain('x1="34" y1="92" x2="54" y2="110"');
    expect(off).not.toContain('x2="66" y2="22"');
    expect(fwd).toContain(">F<");
    expect(fwd).not.toContain("contact-broken");
    expect(fwd).not.toContain('y1="22" x2="66" y2="66"');
    expect(rev).toContain(">R<");
    expect(rev).toContain('x1="22" y1="22" x2="66" y2="66"');
    expect(rev).toContain('x1="22" y1="66" x2="66" y2="22"');
  });
});
