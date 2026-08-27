import { describe, expect, it } from "vitest";
import { addDevice, addSymbol, addWire, emptyCircuit } from "./circuitBuilder";
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

  it("distributes symbols horizontally with equal gap based on the 1st and 2nd element gap", () => {
    const c = emptyCircuit();
    // 3 lamps: Lamp 1 at x=0 (w=2, right=2), Lamp 2 at x=6 (w=2, left=6, right=8) -> gap = 6 - 2 = 4
    // Lamp 3 at x=20 (w=2)
    const l1 = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const l2 = addDevice(c, "lamp", "HL2", "body", 6, 0);
    const l3 = addDevice(c, "lamp", "HL3", "body", 20, 0);

    useLab.setState({ circuit: c, selectedIds: [l1.symbol.id, l2.symbol.id, l3.symbol.id] });
    useLab.getState().alignSelected("distribute-h");

    const updated = useLab.getState().circuit;
    const s1 = updated.symbols.find((s) => s.id === l1.symbol.id)!;
    const s2 = updated.symbols.find((s) => s.id === l2.symbol.id)!;
    const s3 = updated.symbols.find((s) => s.id === l3.symbol.id)!;

    expect(s1.x).toBe(0);
    expect(s2.x).toBe(6);
    // s3.x should be s2.x + w2 + gap = 6 + 2 + 4 = 12
    expect(s3.x).toBe(12);
  });

  it("distributes symbols vertically with equal gap based on the 1st and 2nd element gap", () => {
    const c = emptyCircuit();
    // 3 lamps: Lamp 1 at y=0 (h=2, bottom=2), Lamp 2 at y=5 (h=2, top=5, bottom=7) -> gap = 5 - 2 = 3
    // Lamp 3 at y=30 (h=2)
    const l1 = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const l2 = addDevice(c, "lamp", "HL2", "body", 0, 5);
    const l3 = addDevice(c, "lamp", "HL3", "body", 0, 30);

    useLab.setState({ circuit: c, selectedIds: [l1.symbol.id, l2.symbol.id, l3.symbol.id] });
    useLab.getState().alignSelected("distribute-v");

    const updated = useLab.getState().circuit;
    const s1 = updated.symbols.find((s) => s.id === l1.symbol.id)!;
    const s2 = updated.symbols.find((s) => s.id === l2.symbol.id)!;
    const s3 = updated.symbols.find((s) => s.id === l3.symbol.id)!;

    expect(s1.y).toBe(0);
    expect(s2.y).toBe(5);
    // s3.y should be s2.y + h2 + gap = 5 + 2 + 3 = 10
    expect(s3.y).toBe(10);
  });

  it("distributes mixed groups and symbols with equal gap preserving group internal layout", () => {
    const c = emptyCircuit();
    // Element 1: Single lamp at x=0 (w=2, right=2)
    const l1 = addDevice(c, "lamp", "HL1", "body", 0, 0);

    // Element 2: Group of 2 lamps at x=5 and x=7 (group box: x=5 to x=9, w=4) -> gap = 5 - 2 = 3
    const g1a = addDevice(c, "lamp", "HL2", "body", 5, 0);
    const g1b = addDevice(c, "lamp", "HL3", "body", 7, 0);
    groupSymbols(c, [g1a.symbol.id, g1b.symbol.id]);

    // Element 3: Single lamp at x=25 (w=2)
    const l4 = addDevice(c, "lamp", "HL4", "body", 25, 0);

    useLab.setState({
      circuit: c,
      selectedIds: [l1.symbol.id, g1a.symbol.id, g1b.symbol.id, l4.symbol.id],
    });
    useLab.getState().alignSelected("distribute-h");

    const updated = useLab.getState().circuit;
    const sl1 = updated.symbols.find((s) => s.id === l1.symbol.id)!;
    const sg1a = updated.symbols.find((s) => s.id === g1a.symbol.id)!;
    const sg1b = updated.symbols.find((s) => s.id === g1b.symbol.id)!;
    const sl4 = updated.symbols.find((s) => s.id === l4.symbol.id)!;

    expect(sl1.x).toBe(0);
    expect(sg1a.x).toBe(5);
    expect(sg1b.x).toBe(7);
    // Group right edge is 5 + 4 = 9. Next target left is 9 + gap(3) = 12.
    expect(sl4.x).toBe(12);
  });

  it("prevents vertical overlap when aligning multiple elements to left/right/hcenter", () => {
    const c = emptyCircuit();
    // 3 lamps at the same y=0, but different x
    const l1 = addDevice(c, "lamp", "HL1", "body", 0, 0); // h=2
    const l2 = addDevice(c, "lamp", "HL2", "body", 10, 0); // h=2
    const l3 = addDevice(c, "lamp", "HL3", "body", 20, 0); // h=2

    useLab.setState({ circuit: c, selectedIds: [l1.symbol.id, l2.symbol.id, l3.symbol.id] });
    useLab.getState().alignSelected("left");

    const updated = useLab.getState().circuit;
    const s1 = updated.symbols.find((s) => s.id === l1.symbol.id)!;
    const s2 = updated.symbols.find((s) => s.id === l2.symbol.id)!;
    const s3 = updated.symbols.find((s) => s.id === l3.symbol.id)!;

    // All should have x=0 (minX)
    expect(s1.x).toBe(0);
    expect(s2.x).toBe(0);
    expect(s3.x).toBe(0);

    // They must not stack on top of each other at y=0!
    // Since each lamp height is 2.5, they should be placed at y=0, y=2.5, y=5
    expect(s1.y).toBe(0);
    expect(s2.y).toBe(2.5);
    expect(s3.y).toBe(5);
  });

  it("prevents horizontal overlap when aligning multiple elements to top/bottom/vcenter", () => {
    const c = emptyCircuit();
    // 3 lamps at the same x=0, but different y
    const l1 = addDevice(c, "lamp", "HL1", "body", 0, 0); // w=3
    const l2 = addDevice(c, "lamp", "HL2", "body", 0, 10); // w=3
    const l3 = addDevice(c, "lamp", "HL3", "body", 0, 20); // w=3

    useLab.setState({ circuit: c, selectedIds: [l1.symbol.id, l2.symbol.id, l3.symbol.id] });
    useLab.getState().alignSelected("top");

    const updated = useLab.getState().circuit;
    const s1 = updated.symbols.find((s) => s.id === l1.symbol.id)!;
    const s2 = updated.symbols.find((s) => s.id === l2.symbol.id)!;
    const s3 = updated.symbols.find((s) => s.id === l3.symbol.id)!;

    // All should have y=0 (minY)
    expect(s1.y).toBe(0);
    expect(s2.y).toBe(0);
    expect(s3.y).toBe(0);

    // They must not stack on top of each other at x=0!
    // Since each lamp width is 3, they should be placed at x=0, x=3, x=6
    expect(s1.x).toBe(0);
    expect(s2.x).toBe(3);
    expect(s3.x).toBe(6);
  });

  it("sets selected to specifically clicked symbol when selecting within a group", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const l2 = addDevice(c, "lamp", "HL2", "body", 10, 0);
    groupSymbols(c, [l1.symbol.id, l2.symbol.id]);

    useLab.setState({ circuit: c });
    useLab.getState().select({ type: "symbol", id: l1.symbol.id });

    // selected should be l1, while selectedIds expands to the whole group [l1, l2]
    expect(useLab.getState().selected).toEqual({ type: "symbol", id: l1.symbol.id });
    expect(useLab.getState().selectedIds.sort()).toEqual([l1.symbol.id, l2.symbol.id].sort());

    // Selecting l2 inside the group updates selected to l2 while preserving group selectedIds
    useLab.getState().select({ type: "symbol", id: l2.symbol.id });
    expect(useLab.getState().selected).toEqual({ type: "symbol", id: l2.symbol.id });
    expect(useLab.getState().selectedIds.sort()).toEqual([l1.symbol.id, l2.symbol.id].sort());
  });

  it("links all symbols belonging to the same device (e.g. Relay/Timer/Contactor NO/NC) for device highlighting", () => {
    const c = emptyCircuit();
    const relay = addDevice(c, "relay", "TR1", "coil", 0, 0);
    const noSym = addSymbol(c, relay.device.id, "aux-no", 10, 0);
    const ncSym = addSymbol(c, relay.device.id, "aux-nc", 20, 0);
    const lamp = addDevice(c, "lamp", "HL1", "body", 30, 0);

    useLab.setState({ circuit: c });
    useLab.getState().select({ type: "symbol", id: relay.symbol.id });

    const selected = useLab.getState().selected;
    expect(selected).toEqual({ type: "symbol", id: relay.symbol.id });

    const selectedSym = c.symbols.find((s) => s.id === selected!.id);
    const selectedDevId = selectedSym?.deviceId;
    expect(selectedDevId).toBe(relay.device.id);

    // Symbols of TR1 (coil, aux-no, aux-nc) all match selectedDevId
    const sameDeviceSymbols = c.symbols.filter((s) => s.deviceId === selectedDevId);
    expect(sameDeviceSymbols.map((s) => s.id).sort()).toEqual(
      [relay.symbol.id, noSym.id, ncSym.id].sort()
    );

    // Lamp HL1 has a different device ID and is not matched
    expect(lamp.symbol.deviceId).not.toBe(selectedDevId);
  });

  it("isolates a single component when double-clicked inside a group allowing property updates", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 0, 0);
    const l2 = addDevice(c, "lamp", "HL2", "body", 10, 0);
    groupSymbols(c, [l1.symbol.id, l2.symbol.id]);

    useLab.setState({ circuit: c, sideOpen: false });

    // Single click selects the whole group
    useLab.getState().select({ type: "symbol", id: l1.symbol.id });
    expect(useLab.getState().selectedIds.sort()).toEqual([l1.symbol.id, l2.symbol.id].sort());
    expect(useLab.getState().selected).toEqual({ type: "symbol", id: l1.symbol.id });

    // Double click isolates l1 and opens the side panel
    useLab.getState().select({ type: "symbol", id: l1.symbol.id }, true);
    useLab.getState().setSideOpen(true);

    expect(useLab.getState().selectedIds).toEqual([l1.symbol.id]);
    expect(useLab.getState().selected).toEqual({ type: "symbol", id: l1.symbol.id });
    expect(useLab.getState().sideOpen).toBe(true);

    // Adjusting properties of l1 while inside the group
    useLab.getState().updateDevice(l1.device.id, { tag: "HL_UPDATED", color: "red" });
    const updatedDev = useLab.getState().circuit.devices.find((d) => d.id === l1.device.id);
    expect(updatedDev?.tag).toBe("HL_UPDATED");
    expect(updatedDev?.params?.color).toBe("red");
  });
});
