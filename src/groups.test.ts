import { describe, expect, it } from "vitest";
import { addDevice, addWire, emptyCircuit } from "./circuitBuilder";
import {
  expandIds,
  findInternalJunctions,
  groupSymbols,
  pruneGroups,
  selectionIsGroup,
  symbolsInRect,
  ungroupSymbols,
} from "./groups";
import { useLab } from "./store";
import { GRID } from "./types";

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

  it("automatically includes internal junctions within a group", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const b = addDevice(c, "lamp", "HL2", "body", 4, 0);
    const j = addDevice(c, "junction", "J1", "dot", 2, 0);
    addWire(c, a.symbol.id, "1", j.symbol.id, "1");
    addWire(c, j.symbol.id, "1", b.symbol.id, "1");

    const internal = findInternalJunctions(c, [a.symbol.id, b.symbol.id]);
    expect(internal).toEqual([j.symbol.id]);

    const g = groupSymbols(c, [a.symbol.id, b.symbol.id]);
    expect(g?.memberIds).toContain(j.symbol.id);
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

  it("moves internal wire jogs when moving a group", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const b = addDevice(c, "lamp", "HL2", "body", 4, 0);
    addWire(c, a.symbol.id, "1", b.symbol.id, "1");
    const w = c.wires[c.wires.length - 1];
    w.jog = { axis: "x", pos: 2 * GRID };
    groupSymbols(c, [a.symbol.id, b.symbol.id]);

    useLab.setState({ circuit: c, selectedIds: [a.symbol.id, b.symbol.id] });
    useLab.getState().moveGroup([
      { id: a.symbol.id, x: 1, y: 2 },
      { id: b.symbol.id, x: 5, y: 2 },
    ]);

    const updatedCircuit = useLab.getState().circuit;
    const updatedWire = updatedCircuit.wires.find((x) => x.id === w.id);
    expect(updatedWire?.jog?.pos).toBe(3 * GRID); // 2*GRID + 1*GRID
  });

  it("moves internal wire jogs when nudging a group", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const b = addDevice(c, "lamp", "HL2", "body", 4, 0);
    addWire(c, a.symbol.id, "1", b.symbol.id, "1");
    const w = c.wires[c.wires.length - 1];
    w.jog = { axis: "y", pos: 3 * GRID };
    groupSymbols(c, [a.symbol.id, b.symbol.id]);

    useLab.setState({ circuit: c, selectedIds: [a.symbol.id, b.symbol.id] });
    useLab.getState().nudgeSelected(2, 3);

    const updatedCircuit = useLab.getState().circuit;
    const updatedWire = updatedCircuit.wires.find((x) => x.id === w.id);
    expect(updatedWire?.jog?.pos).toBe(6 * GRID); // 3*GRID + 3*GRID
  });

  it("updates group color in store and retains it", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const b = addDevice(c, "lamp", "HL2", "body", 4, 0);
    const g = groupSymbols(c, [a.symbol.id, b.symbol.id]);
    expect(g).not.toBeNull();

    useLab.setState({ circuit: c, selectedIds: [a.symbol.id, b.symbol.id] });
    useLab.getState().updateGroup(g!.id, { color: "#ef4444" });

    const updatedCircuit = useLab.getState().circuit;
    const updatedGroup = updatedCircuit.groups?.find((x) => x.id === g!.id);
    expect(updatedGroup?.color).toBe("#ef4444");
  });

  it("preserves group color when duplicating/pasting", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const b = addDevice(c, "lamp", "HL2", "body", 4, 0);
    const g = groupSymbols(c, [a.symbol.id, b.symbol.id], "#10b981");
    expect(g?.color).toBe("#10b981");

    useLab.setState({ circuit: c, selectedIds: [a.symbol.id, b.symbol.id] });
    useLab.getState().copySelected();
    useLab.getState().pasteClipboard();

    const updatedCircuit = useLab.getState().circuit;
    expect(updatedCircuit.groups).toHaveLength(2);
    const newGroup = updatedCircuit.groups?.find((x) => x.id !== g!.id);
    expect(newGroup?.color).toBe("#10b981");
  });
});
