import { describe, expect, it } from "vitest";
import { computeRulerLeftTicks, computeRulerTopTicks } from "./ui/schematic/Ruler";
import { quantizeRulerPos, samePos } from "./ui/schematic/useSchematicEvents";

describe("Ruler components", () => {
  it("computes RulerTop ticks and labels correctly", () => {
    const topTicks = computeRulerTopTicks(168, 1);
    expect(topTicks.lines.length).toBe(169);
    // Every 10 cols should have labels
    expect(topTicks.labels.length).toBe(16); // 10, 20, ... 160
    expect(topTicks.labels[0]).toEqual({ px: 10 * 22, text: "10" });
    expect(topTicks.labels[1]).toEqual({ px: 20 * 22, text: "20" });

    // Major tick line at x=10 has width 1.2 and height 7..20
    const line10 = topTicks.lines[10];
    expect(line10).toEqual({ px: 10 * 22, y1: 7, y2: 20, color: "#9e9175", width: 1.2 });
  });

  it("computes RulerLeft ticks and labels correctly", () => {
    const leftTicks = computeRulerLeftTicks(216, 1.25);
    expect(leftTicks.lines.length).toBe(217);
    expect(leftTicks.labels.length).toBe(21); // 10, 20, ... 210
    expect(leftTicks.labels[0]).toEqual({ py: 10 * 22 * 1.25, text: "10" });

    const line10 = leftTicks.lines[10];
    expect(line10).toEqual({ py: 10 * 22 * 1.25, x1: 7, x2: 20, color: "#9e9175", width: 1.2 });
  });
});

describe("ruler pointer snap", () => {
  it("quantizes to 1/8 grid and treats equal positions as unchanged", () => {
    expect(quantizeRulerPos({ x: 3.04, y: 7.97 })).toEqual({ x: 3, y: 8 });
    expect(quantizeRulerPos({ x: 3.10, y: 7.90 })).toEqual({ x: 3.125, y: 7.875 });
    const a = quantizeRulerPos({ x: 1.01, y: 2.01 });
    const b = quantizeRulerPos({ x: 1.02, y: 2.02 });
    expect(samePos(a, b)).toBe(true);
    expect(samePos(a, { x: 1.125, y: 2 })).toBe(false);
    expect(samePos(null, null)).toBe(true);
    expect(samePos(a, null)).toBe(false);
  });
});
