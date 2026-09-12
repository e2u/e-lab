import { describe, expect, it } from "vitest";
import { addDevice, addSymbol, emptyCircuit } from "./circuitBuilder";
import { GRID } from "./types";
import {
  associationSpokes,
  relatedSymbols,
  spokeFromTo,
} from "./relatedSymbols";

describe("relatedSymbols", () => {
  it("includes other symbols of the same device", () => {
    const c = emptyCircuit();
    const relay = addDevice(c, "relay", "CR1", "coil", 0, 0);
    const noSym = addSymbol(c, relay.device.id, "aux-no", 10, 0);
    const ncSym = addSymbol(c, relay.device.id, "aux-nc", 20, 0);
    addDevice(c, "lamp", "LT1", "body", 30, 0);
    const related = relatedSymbols(c, relay.symbol.id).map((s) => s.id).sort();
    expect(related).toEqual([ncSym.id, noSym.id].sort());
  });

  it("includes a comment bound to the selected device", () => {
    const c = emptyCircuit();
    const coil = addDevice(c, "contactor", "M1", "coil", 0, 0);
    const note = addDevice(c, "comment", "N1", "body", 8, 0, { targetDeviceId: coil.device.id });
    const related = relatedSymbols(c, coil.symbol.id);
    expect(related.map((s) => s.id)).toEqual([note.symbol.id]);
  });

  it("includes same-kind same-tag devices", () => {
    const c = emptyCircuit();
    const host = addDevice(c, "overload", "OL1", "body", 0, 0);
    const aux = addDevice(c, "overload", "OL1", "aux-nc", 10, 0);
    const other = addDevice(c, "overload", "OL2", "body", 20, 0);
    const related = relatedSymbols(c, host.symbol.id).map((s) => s.id);
    expect(related).toEqual([aux.symbol.id]);
    expect(related).not.toContain(other.symbol.id);
  });

  it("skips junctions and net-labels", () => {
    const c = emptyCircuit();
    const coil = addDevice(c, "relay", "CR1", "coil", 0, 0);
    addDevice(c, "junction", "", "body", 4, 0);
    addDevice(c, "net-label", "L1", "body", 8, 0);
    expect(relatedSymbols(c, coil.symbol.id)).toEqual([]);
  });
});

describe("spokeFromTo", () => {
  it("draws a rightward spoke from the selected box to the related box", () => {
    const from = { x: 0, y: 0, w: 40, h: 40 };
    const to = { x: 200, y: 0, w: 40, h: 40 };
    const spoke = spokeFromTo(from, to, 0);
    expect(spoke).not.toBeNull();
    expect(spoke!.from.x).toBeCloseTo(40);
    expect(spoke!.to.x).toBeCloseTo(200);
    expect(spoke!.from.y).toBeCloseTo(20);
    expect(spoke!.to.y).toBeCloseTo(20);
  });

  it("returns null when boxes overlap", () => {
    const from = { x: 0, y: 0, w: 40, h: 40 };
    const to = { x: 10, y: 10, w: 40, h: 40 };
    expect(spokeFromTo(from, to, 0)).toBeNull();
  });
});

describe("associationSpokes", () => {
  it("emits one outbound spoke per related symbol from the selected coil", () => {
    const c = emptyCircuit();
    const relay = addDevice(c, "relay", "CR1", "coil", 0, 0);
    addSymbol(c, relay.device.id, "aux-no", 12, 0);
    addSymbol(c, relay.device.id, "aux-nc", 12, 8);
    const spokes = associationSpokes(c, relay.symbol.id);
    expect(spokes).toHaveLength(2);
    const coilBox = { x: 0, y: 0, w: 4 * GRID, h: 2 * GRID };
    for (const s of spokes) {
      expect(s.from.x).toBeGreaterThanOrEqual(coilBox.x);
      expect(s.from.x).toBeLessThanOrEqual(coilBox.x + coilBox.w + 8);
    }
  });
});
