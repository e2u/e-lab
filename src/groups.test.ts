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

  it("aligns groups as whole units without modifying internal relative positions", () => {
    const c = emptyCircuit();
    // Group 1: 2 lamps at (0, 0) and (4, 0) -> width 6, x from 0 to 6
    const a1 = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const a2 = addDevice(c, "lamp", "HL2", "body", 4, 0);
    groupSymbols(c, [a1.symbol.id, a2.symbol.id]);

    // Group 2: 2 lamps at (10, 10) and (12, 10) -> width 4, x from 10 to 14
    const b1 = addDevice(c, "lamp", "HL3", "body", 10, 10);
    const b2 = addDevice(c, "lamp", "HL4", "body", 12, 10);
    groupSymbols(c, [b1.symbol.id, b2.symbol.id]);

    useLab.setState({
      circuit: c,
      selectedIds: [a1.symbol.id, a2.symbol.id, b1.symbol.id, b2.symbol.id],
    });

    useLab.getState().alignSelected("left");

    const updated = useLab.getState().circuit;
    const sa1 = updated.symbols.find((s) => s.id === a1.symbol.id)!;
    const sa2 = updated.symbols.find((s) => s.id === a2.symbol.id)!;
    const sb1 = updated.symbols.find((s) => s.id === b1.symbol.id)!;
    const sb2 = updated.symbols.find((s) => s.id === b2.symbol.id)!;

    // Group 1 remains at left=0 (sa1=0, sa2=4, dx between them=4)
    expect(sa1.x).toBe(0);
    expect(sa2.x).toBe(4);

    // Group 2 aligned left to minX=0 (sb1=0, sb2=2, dx between them=2 preserved!)
    expect(sb1.x).toBe(0);
    expect(sb2.x).toBe(2);
  });

  it("rotates a group around its center preserving internal layout and rotating wire jogs", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0); // box (0,0) to (3,2.5), center (1.5,1.25)
    const b = addDevice(c, "lamp", "HL2", "body", 4, 0); // box (4,0) to (7,2.5), center (5.5,1.25)
    addWire(c, a.symbol.id, "1", b.symbol.id, "1");
    const w = c.wires[c.wires.length - 1];
    w.jog = { axis: "x", pos: 3.5 * GRID }; // vertical line at x=3.5 (group center)
    groupSymbols(c, [a.symbol.id, b.symbol.id]); // bounds: x=0..7, y=0..2.5, center=(3.5, 1.25)

    useLab.setState({ circuit: c, selectedIds: [a.symbol.id, b.symbol.id] });
    useLab.getState().rotateSelected(1); // 90 deg CW

    const updated = useLab.getState().circuit;
    const sa = updated.symbols.find((s) => s.id === a.symbol.id)!;
    const sb = updated.symbols.find((s) => s.id === b.symbol.id)!;
    const sw = updated.wires.find((x) => x.id === w.id)!;

    // Group center was (3.5, 1.25). A center was (1.5, 1.25), B center was (5.5, 1.25).
    // CW 90: A center -> (3.5, -0.75). New lamp size is w:2.5, h:3. So sa.x = 3.5 - 1.25 = 2.25, sa.y = -0.75 - 1.5 = -2.25.
    // CW 90: B center -> (3.5, 3.25). New lamp size is w:2.5, h:3. So sb.x = 3.5 - 1.25 = 2.25, sb.y = 3.25 - 1.5 = 1.75.
    expect(sa.x).toBe(2.25);
    expect(sa.y).toBe(-2.25);
    expect(sa.rot).toBe(90);

    expect(sb.x).toBe(2.25);
    expect(sb.y).toBe(1.75);
    expect(sb.rot).toBe(90);

    // Wire jog axis rotated from 'x' to 'y', pos rotated around center
    expect(sw.jog?.axis).toBe("y");
    expect(sw.jog?.pos).toBe(1.25 * GRID);
  });

  it("disables flip operations on symbols in groups", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "KM1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "HL1", "body", 8, 4);
    groupSymbols(c, [km.symbol.id, lamp.symbol.id]);

    useLab.setState({ circuit: c, selectedIds: [km.symbol.id, lamp.symbol.id] });
    useLab.getState().flipSelected("h");

    const updated = useLab.getState().circuit;
    const skm = updated.symbols.find((s) => s.id === km.symbol.id)!;
    expect(skm.flipX).toBeFalsy();
  });
});
