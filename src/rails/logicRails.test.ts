import { describe, expect, it } from "vitest";
import { addDevice, addSymbol, addWire, emptyCircuit } from "../circuitBuilder";
import { GRID } from "../types";
import { computeLogicRails, layoutLogicRails } from "./logicRails";

describe("logic rails", () => {
  it("numbers electrical rows from top to bottom when an L rail is placed", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "rail-l", "L", "body", 1, 1);
    const lower = addDevice(circuit, "pb-no", "PB2", "body", 8, 10);
    const upper = addDevice(circuit, "pb-nc", "PB1", "body", 4, 4);
    expect(lower.symbol.y).toBeGreaterThan(upper.symbol.y);

    const { lineNumbers, crossReferences } = computeLogicRails(circuit);
    expect(lineNumbers[5]).toBe("1");
    expect(lineNumbers[11]).toBe("2");
    expect(crossReferences).toEqual({});
  });

  it("leaves line numbers empty until an L rail is on the sheet", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "pb-nc", "PB1", "body", 4, 4);
    expect(computeLogicRails(circuit).lineNumbers).toEqual({});
  });

  it("lets a row override replace the scanned line number", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "rail-l", "L", "body", 1, 1, { railLineOverrides: { "5": "10" } });
    addDevice(circuit, "pb-nc", "PB1", "body", 4, 4);
    expect(computeLogicRails(circuit).lineNumbers[5]).toBe("10");
  });

  it("lists only the NO and NC contacts of a device that has a coil", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "rail-n", "N", "body", 30, 1);
    const km = addDevice(circuit, "contactor", "M1", "coil", 14, 4);
    addSymbol(circuit, km.device.id, "aux-nc", 14, 8);
    addSymbol(circuit, km.device.id, "aux-no", 14, 12);
    addSymbol(circuit, km.device.id, "main", 4, 16);
    const pb = addDevice(circuit, "pb-nc", "PB1", "body", 6, 4);
    addWire(circuit, pb.symbol, "2", km.symbol, "A1");
    addDevice(circuit, "lamp", "LT1", "body", 14, 8);

    const { crossReferences } = computeLogicRails(circuit);
    expect(crossReferences[9]).toBeUndefined();
    expect(crossReferences[13]).toBeUndefined();
    expect(crossReferences[5]).toEqual([
      {
        text: "(9,13)",
        side: "right",
        segments: [
          { text: "(" },
          { text: "9", isNC: true },
          { text: "," },
          { text: "13" },
          { text: ")" },
        ],
      },
    ]);
  });

  it("cites timer delay contacts by row on the coil line", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "rail-n", "N", "body", 30, 1);
    const ton = addDevice(circuit, "timer-on", "TR1", "coil", 14, 4);
    addSymbol(circuit, ton.device.id, "delayed-nc", 14, 8);
    addSymbol(circuit, ton.device.id, "inst-no", 14, 12);

    const { crossReferences } = computeLogicRails(circuit);
    expect(crossReferences[5]?.[0].text).toBe("(9,13)");
    expect(crossReferences[5]?.[0].segments?.find((seg) => seg.text === "9")?.isNC).toBe(true);
    expect(crossReferences[5]?.[0].segments?.find((seg) => seg.text === "13")?.isNC).toBeUndefined();
  });

  it("uses the Line rail number when that rail labels the contact row", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "rail-l", "L", "body", 1, 1);
    addDevice(circuit, "rail-n", "N", "body", 30, 1);
    const km = addDevice(circuit, "contactor", "M1", "coil", 14, 4);
    addSymbol(circuit, km.device.id, "aux-nc", 14, 8);
    addSymbol(circuit, km.device.id, "aux-no", 14, 12);

    const { lineNumbers, crossReferences } = computeLogicRails(circuit);
    expect(lineNumbers[5]).toBe("1");
    expect(lineNumbers[9]).toBe("2");
    expect(lineNumbers[13]).toBe("3");
    expect(crossReferences[5]?.[0].text).toBe("(2,3)");
    expect(crossReferences[5]?.[0].segments?.find((seg) => seg.text === "2")?.isNC).toBe(true);
  });

  it("limits line numbers and the spine to a manual start and end", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "rail-l", "L", "body", 1, 1, { railY0: 5, railY1: 5 });
    addDevice(circuit, "pb-nc", "PB1", "body", 4, 4);
    addDevice(circuit, "pb-no", "PB2", "body", 8, 10);
    const rails = computeLogicRails(circuit);
    expect(rails.lineNumbers).toEqual({ 5: "1" });
    const layout = layoutLogicRails(circuit, rails.lineNumbers, rails.crossReferences);
    const spine = layout.spines.find((s) => s.rail === "l");
    expect(spine?.y1).toBe(5 * GRID);
    expect(spine?.y2).toBe(5 * GRID);
    expect(layout.cells.map((c) => c.y)).toEqual([5]);
  });

  it("grows cross-reference text away from the N column", () => {
    const circuit = emptyCircuit();
    addDevice(circuit, "rail-n", "N", "body", 20, 1);
    const relay = addDevice(circuit, "relay", "CR1-LONG-TAG", "coil", 10, 4);
    addSymbol(circuit, relay.device.id, "aux-nc", 10, 8);
    addSymbol(circuit, relay.device.id, "aux-no", 10, 12);
    const rails = computeLogicRails(circuit);
    const layout = layoutLogicRails(circuit, rails.lineNumbers, rails.crossReferences);
    const spine = layout.spines.find((s) => s.rail === "n");
    expect(spine?.x).toBe(20 * GRID);
    const row = layout.cells.filter((c) => c.y === 5);
    expect(row).toHaveLength(1);
    expect(row[0]?.text).toBe("(9,13)");
    expect(row.every((c) => c.side === "right" && c.x > spine!.x)).toBe(true);
    const xs = row.map((c) => c.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(layout.spines.every((s) => s.x === spine!.x || s.rail === "l")).toBe(true);
  });
});
