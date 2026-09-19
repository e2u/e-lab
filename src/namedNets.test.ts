import { describe, expect, it } from "vitest";
import { emptyCircuit, addDevice } from "./circuitBuilder";
import {
  clampPinCount,
  isNamedNetKind,
  namedNetKey,
  namedNetKeyOf,
  netTerminalDef,
  netTerminalPinSide,
} from "./namedNets";
import { nodeKeysForPort } from "./geometry";

describe("namedNets policy", () => {
  it("namedNetKey trims, isolates empty, and keeps case", () => {
    expect(namedNetKey(" L1 ")).toBe("L1");
    expect(namedNetKey("")).toBeNull();
    expect(namedNetKey("   ")).toBeNull();
    expect(namedNetKey("l1")).toBe("l1");
    expect(namedNetKey("L1")).toBe("L1");
  });

  it("isNamedNetKind covers both flag and strip", () => {
    expect(isNamedNetKind("net-label")).toBe(true);
    expect(isNamedNetKind("net-terminal")).toBe(true);
    expect(isNamedNetKind("junction")).toBe(false);
  });

  it("namedNetKeyOf ignores other kinds", () => {
    const c = emptyCircuit();
    const lamp = addDevice(c, "lamp", "LT1", "body", 0, 0);
    expect(namedNetKeyOf(lamp.device)).toBeNull();
    const flag = addDevice(c, "net-label", " L1 ", "body", 2, 0);
    expect(namedNetKeyOf(flag.device)).toBe("L1");
  });

  it("netTerminalPinSide maps odd left / even right", () => {
    expect(netTerminalPinSide("1")).toBe("L");
    expect(netTerminalPinSide("3")).toBe("L");
    expect(netTerminalPinSide("2")).toBe("R");
    expect(netTerminalPinSide("6")).toBe("R");
    expect(netTerminalPinSide("")).toBeNull();
    expect(netTerminalPinSide("A1")).toBeNull();
  });

  it("clampPinCount defaults, clamps, and parses strings", () => {
    expect(clampPinCount(undefined)).toBe(4);
    expect(clampPinCount(1)).toBe(2);
    expect(clampPinCount(99)).toBe(12);
    expect(clampPinCount("3")).toBe(3);
    expect(clampPinCount(NaN)).toBe(4);
    expect(clampPinCount("nope")).toBe(4);
  });

  it("netTerminalDef(3) is 4×4 with three pairs left and right", () => {
    const v = netTerminalDef(3);
    expect(v.w).toBe(4);
    expect(v.h).toBe(4);
    expect(v.terminals).toHaveLength(6);
    expect(v.terminals.map((t) => ({ id: t.id, x: t.x, y: t.y }))).toEqual([
      { id: "1", x: 0, y: 1 },
      { id: "2", x: 4, y: 1 },
      { id: "3", x: 0, y: 2 },
      { id: "4", x: 4, y: 2 },
      { id: "5", x: 0, y: 3 },
      { id: "6", x: 4, y: 3 },
    ]);
  });

  it("netTerminalDef(4) is 4×5 with four pairs", () => {
    const v = netTerminalDef(4);
    expect(v.w).toBe(4);
    expect(v.h).toBe(5);
    expect(v.terminals).toHaveLength(8);
    expect(v.terminals.filter((t) => t.x === 0).map((t) => t.id)).toEqual(["1", "3", "5", "7"]);
    expect(v.terminals.filter((t) => t.x === 4).map((t) => t.id)).toEqual(["2", "4", "6", "8"]);
  });
});

describe("nodeKeysForPort matrix", () => {
  it("emits net:/bus:/port:/junction: as specified", () => {
    const c = emptyCircuit();
    const j = addDevice(c, "junction", "J1", "body", 0, 0);
    const flag = addDevice(c, "net-label", "L1", "body", 4, 0);
    const emptyFlag = addDevice(c, "net-label", "  ", "body", 8, 0);
    const strip = addDevice(c, "net-terminal", "L1", "body", 12, 0, { pinCount: 4 });
    const emptyStrip = addDevice(c, "net-terminal", "", "body", 16, 0, { pinCount: 4 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 20, 0);

    expect(nodeKeysForPort(c, { symbolId: j.symbol.id, term: "1" })).toEqual([`junction:${j.symbol.id}`]);
    expect(nodeKeysForPort(c, { symbolId: flag.symbol.id, term: "1" })).toEqual(["net:L1"]);
    expect(nodeKeysForPort(c, { symbolId: emptyFlag.symbol.id, term: "1" })).toEqual([
      `port:${emptyFlag.symbol.id}:1`,
    ]);
    expect(nodeKeysForPort(c, { symbolId: strip.symbol.id, term: "3" })).toEqual([
      `bus:${strip.device.id}`,
      "net:L1",
    ]);
    expect(nodeKeysForPort(c, { symbolId: emptyStrip.symbol.id, term: "2" })).toEqual([
      `bus:${emptyStrip.device.id}`,
    ]);
    expect(nodeKeysForPort(c, { symbolId: lamp.symbol.id, term: "1" })).toEqual([
      `port:${lamp.symbol.id}:1`,
    ]);
  });

  it("term-block pairs are isolated rows", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "term-block", "X1", "body", 8, 4, { pinCount: 3 });
    expect(nodeKeysForPort(c, { symbolId: strip.symbol.id, term: "1" })).toEqual([
      `pair:${strip.device.id}:1`,
    ]);
    expect(nodeKeysForPort(c, { symbolId: strip.symbol.id, term: "2" })).toEqual([
      `pair:${strip.device.id}:1`,
    ]);
    expect(nodeKeysForPort(c, { symbolId: strip.symbol.id, term: "3" })).toEqual([
      `pair:${strip.device.id}:2`,
    ]);
  });
});
