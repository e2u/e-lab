import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GRID } from "./types";
import { getSymbolTagPlacement } from "./tagPlacement";
import { hasGlyphTag, SymbolLayer } from "./ui/schematic/layers/SymbolLayer";
import { addDevice, addSymbol, emptyCircuit } from "./circuitBuilder";
import { emptySnapshot } from "./sim/engine";

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
    // Coils (timer, contactor, relay) now show external device tags
    expect(hasGlyphTag("timer-on", "coil")).toBe(false);
    expect(hasGlyphTag("timer-off", "coil")).toBe(false);
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
    expect(hasGlyphTag("net-terminal", "body")).toBe(true);
    expect(hasGlyphTag("comment", "body")).toBe(true);
    expect(hasGlyphTag("junction", "body")).toBe(true);

    // Normal symbols without glyph tags
    expect(hasGlyphTag("breaker-1p", "body")).toBe(false);
    expect(hasGlyphTag("ground", "body")).toBe(false);
    expect(hasGlyphTag("lamp", "body")).toBe(false);
    expect(hasGlyphTag("motor-3ph", "body")).toBe(false);
  });

  it("renders timer contact and timer coil delay badges tightly to the right of Device Tag and follows tagOffset", () => {
    const c = emptyCircuit();
    const tr = addDevice(c, "timer-on", "TR1", "coil", 10, 10, { delayMs: 3000 });
    const noSym = addSymbol(c, tr.device.id, "delayed-no", 20, 20);

    const snap = emptySnapshot(c);
    snap.runtime[tr.device.id] = {
      ...snap.runtime[tr.device.id],
      energized: true,
      elapsedMs: 1200,
      done: false,
    };

    // Render static markup
    const html = renderToStaticMarkup(
      createElement(SymbolLayer, {
        circuit: c,
        snapshot: snap,
      }),
    );

    expect(html).toContain("sym-tag-delay-group");
    expect(html).toContain("1.8s / 3.0s");

    // Check that delay badge is placed to the right of device tag:
    // Base placement for timer-on contact (w=4, h=2, sym at x=20, y=20, GRID=22):
    // tagX = (20 + 2) * 22 = 484
    // tagY = (20 + 2 + 0.5) * 22 = 495
    // textAnchor = middle, tagWidth = Math.max(16, 3 * 7) = 21
    // tagBoxX = 484 - (21/2 + 6) = 484 - 16.5 = 467.5
    // tagBoxW = 21 + 12 = 33
    // tagBoxY = 495 - 10 = 485, tagBoxH = 16
    // delayBadgeX = tagBoxX + tagBoxW + 2 = 467.5 + 33 + 2 = 502.5
    // delayBadgeY = tagBoxY + (16 - 14) / 2 = 486
    expect(html).toContain('x="502.5" y="486"');

    // Base placement for timer-on coil (w=4, h=2, sym at x=10, y=10, GRID=22):
    // tagX = (10 + 2) * 22 = 264
    // tagY = (10 + 2 + 0.5) * 22 = 275
    // textAnchor = middle, tagWidth = 21
    // tagBoxX = 264 - 16.5 = 247.5
    // tagBoxW = 33
    // tagBoxY = 275 - 10 = 265, tagBoxH = 16
    // delayBadgeX = tagBoxX + tagBoxW + 2 = 247.5 + 33 + 2 = 282.5
    // delayBadgeY = tagBoxY + (16 - 14) / 2 = 266
    expect(html).toContain('x="282.5" y="266"');

    // Test with tagOffset on both coil and contact
    tr.symbol.tagOffset = { dx: 1, dy: 1 };
    noSym.tagOffset = { dx: 3, dy: 2 };
    const htmlOffset = renderToStaticMarkup(
      createElement(SymbolLayer, {
        circuit: c,
        snapshot: snap,
      }),
    );

    // Coil with tagOffset: dx = 1 * 22 = +22, dy = 1 * 22 = +22
    // Expected coil delayBadgeX = 282.5 + 22 = 304.5
    // Expected coil delayBadgeY = 266 + 22 = 288
    expect(htmlOffset).toContain('x="304.5" y="288"');

    // Contact with tagOffset: dx = 3 * 22 = +66, dy = 2 * 22 = +44
    // Expected contact delayBadgeX = 502.5 + 66 = 568.5
    // Expected contact delayBadgeY = 486 + 44 = 530
    expect(htmlOffset).toContain('x="568.5" y="530"');
  });
});
