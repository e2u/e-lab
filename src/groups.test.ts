import { describe, expect, it } from "vitest";
import { addDevice, emptyCircuit } from "./circuitBuilder";
import {
  expandIds,
  groupSymbols,
  pruneGroups,
  selectionIsGroup,
  symbolsInRect,
  ungroupSymbols,
} from "./groups";

describe("symbol groups", () => {
  it("expands a member click to the whole group", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const b = addDevice(c, "lamp", "HL2", "body", 4, 0);
    const g = groupSymbols(c, [a.symbol.id, b.symbol.id]);
    expect(g).not.toBeNull();
    expect(expandIds(c, [a.symbol.id]).sort()).toEqual([a.symbol.id, b.symbol.id].sort());
    expect(selectionIsGroup(c, expandIds(c, [a.symbol.id]))?.id).toBe(g!.id);
  });

  it("merges overlapping groups when grouping again", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "A", "body", 0, 0);
    const b = addDevice(c, "lamp", "B", "body", 2, 0);
    const d = addDevice(c, "lamp", "C", "body", 4, 0);
    groupSymbols(c, [a.symbol.id, b.symbol.id]);
    const merged = groupSymbols(c, [b.symbol.id, d.symbol.id]);
    expect(c.groups).toHaveLength(1);
    expect(merged!.memberIds).toHaveLength(3);
  });

  it("ungroups and prunes leftover members after delete", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "A", "body", 0, 0);
    const b = addDevice(c, "lamp", "B", "body", 2, 0);
    groupSymbols(c, [a.symbol.id, b.symbol.id]);
    ungroupSymbols(c, [a.symbol.id]);
    expect(c.groups).toHaveLength(0);

    groupSymbols(c, [a.symbol.id, b.symbol.id]);
    c.symbols = c.symbols.filter((s) => s.id !== b.symbol.id);
    pruneGroups(c);
    expect(c.groups).toHaveLength(0);
  });

  it("finds symbols inside a marquee", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "A", "body", 0, 0);
    addDevice(c, "lamp", "B", "body", 20, 20);
    const hit = symbolsInRect(c, { x: -1, y: -1, w: 6, h: 6 });
    expect(hit).toContain(a.symbol.id);
    expect(hit).toHaveLength(1);
  });
});
