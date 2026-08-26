import { describe, expect, it } from "vitest";
import { GRID } from "./types";
import { getSymbolTagPlacement } from "./tagPlacement";

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
});
