import { describe, expect, it } from "vitest";
import { CIRCLE_TAG_BASE, circleTagFontSize } from "./circleTag";

function inkFits(label: string, radius: number, strokeWidth: number, fontSize: number): boolean {
  const inner = radius - strokeWidth / 2 - 1;
  const halfW = (label.trim().length * 0.64 * fontSize) / 2;
  const halfH = 0.66 * fontSize;
  return Math.hypot(halfW, halfH) <= inner + 0.05;
}

describe("circleTagFontSize", () => {
  it("keeps a short coil tag at the default size", () => {
    expect(circleTagFontSize("KM1", 16)).toBe(CIRCLE_TAG_BASE);
    expect(circleTagFontSize("CR1", 16)).toBe(CIRCLE_TAG_BASE);
  });

  it("shrinks M_FWD so the em box stays inside the coil circle", () => {
    const size = circleTagFontSize("M_FWD", 16);
    expect(size).toBeLessThan(CIRCLE_TAG_BASE);
    expect(inkFits("M_FWD", 16, 2, size)).toBe(true);
  });

  it("shrinks further as the circle gets smaller", () => {
    expect(circleTagFontSize("M_FWD", 14)).toBeLessThan(circleTagFontSize("M_FWD", 16));
  });
});
