import { describe, it, expect, beforeEach } from "vitest";
import { useLab } from "./store";
import { handleGlobalKeyDown, executeCommand, getRegisteredCommands } from "./keyboard";

function fireKey(key: string, code: string, options: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; target?: any } = {}) {
  const evt = {
    key,
    code,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    target: options.target ?? null,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;
  return handleGlobalKeyDown(evt);
}

describe("Keyboard Shortcuts & Store Handlers", () => {
  beforeEach(() => {
    useLab.getState().loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit", editSubMode: "editing", layoutMode: "schematic", placing: null, wiringFrom: null, selected: null, selectedIds: [] });
  });

  it("handles nudgeSelected with single selected symbol when selectedIds is empty", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(10, 10);

    const sym = useLab.getState().circuit.symbols[0];
    expect(sym).toBeDefined();

    // Select with selected property
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [] });

    s.nudgeSelected(2, 3);
    const updated = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updated.x).toBe(12);
    expect(updated.y).toBe(13);
  });

  it("handles snapSelected with single selected symbol", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(10.4, 10.6);

    const sym = useLab.getState().circuit.symbols[0];
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [] });

    s.snapSelected();
    const updated = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updated.x).toBe(10);
    expect(updated.y).toBe(11);
  });

  it("handles undo and redo properly", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(10, 10);

    expect(useLab.getState().circuit.symbols.length).toBe(1);
    s.undo();
    expect(useLab.getState().circuit.symbols.length).toBe(0);
    s.redo();
    expect(useLab.getState().circuit.symbols.length).toBe(1);
  });

  it("handles deleteSelected for symbols and wires", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(10, 10);

    const sym = useLab.getState().circuit.symbols[0];
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [sym.id] });

    s.deleteSelected();
    expect(useLab.getState().circuit.symbols.length).toBe(0);
  });

  it("deletes wires using Delete and Backspace keyboard shortcuts and handles bend points", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(4, 4);
    s.setPlacing("km-coil");
    s.placeAt(14, 14);

    const [s1, s2] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: s1.id, term: "A1" });
    s.clickPort({ symbolId: s2.id, term: "A1" });

    expect(useLab.getState().circuit.wires.length).toBe(1);
    const wire = useLab.getState().circuit.wires[0];

    // Select wire and fire Delete key
    useLab.setState({ selected: { type: "wire", id: wire.id }, selectedIds: [] });
    fireKey("Delete", "Delete");
    expect(useLab.getState().circuit.wires.length).toBe(0);
    expect(useLab.getState().selected).toBeNull();

    // Test Undo
    s.undo();
    expect(useLab.getState().circuit.wires.length).toBe(1);

    // Test Backspace key
    const restoredWire = useLab.getState().circuit.wires[0];
    useLab.setState({ selected: { type: "wire", id: restoredWire.id }, selectedIds: [] });
    fireKey("Backspace", "Backspace");
    expect(useLab.getState().circuit.wires.length).toBe(0);

    // Test Cmd+Delete / Mod+Backspace
    s.undo();
    expect(useLab.getState().circuit.wires.length).toBe(1);
    const reWire = useLab.getState().circuit.wires[0];
    useLab.setState({ selected: { type: "wire", id: reWire.id }, selectedIds: [] });
    fireKey("Backspace", "Backspace", { metaKey: true });
    expect(useLab.getState().circuit.wires.length).toBe(0);
  });

  it("deletes a targeted wire segment without shifting or deleting other wires", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(4, 4);
    s.setPlacing("km-coil");
    s.placeAt(14, 14);

    const [s1, s2] = useLab.getState().circuit.symbols;

    // Start wiring from s1.A1, click blank canvas twice to create 2 bend junctions, then finish at s2.A1
    s.setEditSubMode("wiring");
    s.clickPort({ symbolId: s1.id, term: "A1" });
    s.addJunctionAndConnect(8, 4);
    s.addJunctionAndConnect(8, 14);
    s.clickPort({ symbolId: s2.id, term: "A1" });

    // 3 wire segments and 2 intermediate junctions created
    expect(useLab.getState().circuit.wires.length).toBe(3);
    expect(useLab.getState().circuit.symbols.length).toBe(4); // 2 coils + 2 junctions

    const wire0 = useLab.getState().circuit.wires[0];
    const wire2 = useLab.getState().circuit.wires[2];

    // Select the middle wire segment and delete it
    const middleWire = useLab.getState().circuit.wires[1];
    useLab.setState({ selected: { type: "wire", id: middleWire.id }, selectedIds: [] });
    fireKey("Delete", "Delete");

    // Only the selected middle wire segment is removed.
    // Other wire segments (s1->j1 and j2->s2) remain intact without shifting!
    expect(useLab.getState().circuit.wires.length).toBe(2);
    expect(useLab.getState().circuit.wires.some((w) => w.id === wire0.id)).toBe(true);
    expect(useLab.getState().circuit.wires.some((w) => w.id === wire2.id)).toBe(true);
    expect(useLab.getState().circuit.symbols.length).toBe(4); // Coils and junctions stay in place
  });

  it("deletes a branch wire without shifting or modifying remaining main wires", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(4, 4);
    s.setPlacing("km-coil");
    s.placeAt(14, 4);
    s.setPlacing("km-coil");
    s.placeAt(14, 14);

    const [s1, s2, s3] = useLab.getState().circuit.symbols;

    // Connect s1.A1 to s2.A1
    s.clickPort({ symbolId: s1.id, term: "A1" });
    s.clickPort({ symbolId: s2.id, term: "A1" });
    const mainWire = useLab.getState().circuit.wires[0];

    // Start wiring from s3.A1 and connect to main wire at (9, 4)
    s.clickPort({ symbolId: s3.id, term: "A1" });
    s.connectToWire(mainWire.id, { x: 9 * 22, y: 4 * 22 });

    // Now we have a 3-way junction and 3 wires
    expect(useLab.getState().circuit.wires.length).toBe(3);
    const branchWire = useLab.getState().circuit.wires.find(
      (w) => w.a.symbolId === s3.id || w.b.symbolId === s3.id
    )!;
    expect(branchWire).toBeDefined();

    const mainLegs = useLab.getState().circuit.wires.filter(
      (w) => w.id !== branchWire.id
    );
    expect(mainLegs.length).toBe(2);

    // Select the branch wire and delete it
    useLab.setState({ selected: { type: "wire", id: branchWire.id }, selectedIds: [] });
    fireKey("Delete", "Delete");

    // Only the branch wire is deleted.
    // Main wires remain completely in place without shifting or jumping!
    expect(useLab.getState().circuit.wires.length).toBe(2);
    for (const leg of mainLegs) {
      expect(useLab.getState().circuit.wires.some((w) => w.id === leg.id)).toBe(true);
    }
  });

  it("handles copy, paste, and duplicate", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(10, 10);

    const sym = useLab.getState().circuit.symbols[0];
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [sym.id] });

    s.copySelected();
    expect(useLab.getState().clipboard).not.toBeNull();

    s.pasteClipboard();
    expect(useLab.getState().circuit.symbols.length).toBe(2);

    s.duplicateSelected();
    expect(useLab.getState().circuit.symbols.length).toBe(3);
  });

  it("handles rotate and flip operations", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(10, 10);

    const sym = useLab.getState().circuit.symbols[0];
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [sym.id] });

    s.rotateSelected(1);
    let updated = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updated.rot).toBe(90);

    s.rotateSelected(-1);
    updated = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updated.rot).toBe(0);

    s.flipSelected("h");
    updated = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updated.flipX).toBe(true);

    s.flipSelected("v");
    updated = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updated.flipY).toBe(true);
  });

  it("handles nudgeSelected with wire jog", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(4, 4);
    s.setPlacing("km-coil");
    s.placeAt(14, 14);

    const [s1, s2] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: s1.id, term: "A1" });
    s.clickPort({ symbolId: s2.id, term: "A1" });

    const wire = useLab.getState().circuit.wires[0];
    expect(wire).toBeDefined();

    // Select wire and nudge
    useLab.setState({ selected: { type: "wire", id: wire.id }, selectedIds: [] });
    s.nudgeSelected(2, 0);

    const updatedWire = useLab.getState().circuit.wires.find((w) => w.id === wire.id)!;
    expect(updatedWire.jog).toBeDefined();
    expect(updatedWire.jog?.x).toBe(2 * 22);
  });

  it("handles edit submode and layout mode switching", () => {
    const s = useLab.getState();
    expect(s.editSubMode).toBe("editing");

    s.setEditSubMode("wiring");
    expect(useLab.getState().editSubMode).toBe("wiring");

    s.setEditSubMode("editing");
    expect(useLab.getState().editSubMode).toBe("editing");

    s.toggleEditSubMode();
    expect(useLab.getState().editSubMode).toBe("wiring");

    s.toggleEditSubMode();
    expect(useLab.getState().editSubMode).toBe("editing");

    s.toggleLayoutMode();
    expect(useLab.getState().layoutMode).toBe("ladder");
    s.toggleLayoutMode();
    expect(useLab.getState().layoutMode).toBe("schematic");
  });

  it("handles rotatePlacing when placing a component", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    expect(useLab.getState().placing).toBe("km-coil");
    expect(useLab.getState().placingRot).toBe(0);

    s.rotatePlacing(1);
    expect(useLab.getState().placingRot).toBe(90);

    s.rotatePlacing(1);
    expect(useLab.getState().placingRot).toBe(180);

    s.rotatePlacing(-1);
    expect(useLab.getState().placingRot).toBe(90);

    s.placeAt(10, 10);
    const sym = useLab.getState().circuit.symbols[0];
    expect(sym).toBeDefined();
    expect(sym.rot).toBe(90);
    expect(useLab.getState().placing).toBeNull();
    expect(useLab.getState().placingRot).toBe(0);
  });

  it("handles rotateSelected for single symbol and straightening wire", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(5, 5);
    const sym = useLab.getState().circuit.symbols[0];

    // Select symbol without selectedIds array
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [] });
    s.rotateSelected(1);
    expect(useLab.getState().circuit.symbols[0].rot).toBe(90);

    s.rotateSelected(1);
    expect(useLab.getState().circuit.symbols[0].rot).toBe(180);

    // Place second symbol and wire them
    s.setPlacing("km-coil");
    s.placeAt(15, 15);
    const [s1, s2] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: s1.id, term: "A1" });
    s.clickPort({ symbolId: s2.id, term: "A1" });
    const wire = useLab.getState().circuit.wires[0];

    s.setWireJog(wire.id, { axis: "x", pos: 100, x: 100, y: 50 });
    expect(useLab.getState().circuit.wires[0].jog).toBeDefined();

    s.straightenWire(wire.id);
    expect(useLab.getState().circuit.wires[0].jog).toBeUndefined();
  });

  it("handles mode switching shortcuts via handleGlobalKeyDown", () => {
    // Press 'W' or '2' -> wiring mode
    expect(useLab.getState().editSubMode).toBe("editing");
    fireKey("w", "KeyW");
    expect(useLab.getState().editSubMode).toBe("wiring");

    // Press 'E' or '1' -> editing mode
    fireKey("e", "KeyE");
    expect(useLab.getState().editSubMode).toBe("editing");

    fireKey("2", "Digit2");
    expect(useLab.getState().editSubMode).toBe("wiring");

    fireKey("1", "Digit1");
    expect(useLab.getState().editSubMode).toBe("editing");

    // Press Tab -> toggle mode
    fireKey("tab", "Tab");
    expect(useLab.getState().editSubMode).toBe("wiring");
    fireKey("tab", "Tab");
    expect(useLab.getState().editSubMode).toBe("editing");

    // Press 'L' -> toggle layout mode
    fireKey("l", "KeyL");
    expect(useLab.getState().layoutMode).toBe("ladder");
    fireKey("l", "KeyL");
    expect(useLab.getState().layoutMode).toBe("schematic");

    // Set mode back to edit
    useLab.getState().setMode("edit");

    // Press Space -> toggle run mode
    expect(useLab.getState().mode).toBe("edit");
    fireKey(" ", "Space");
    expect(useLab.getState().mode).toBe("run");

    // In run mode, Space toggles running
    expect(useLab.getState().running).toBe(true);
    fireKey(" ", "Space");
    expect(useLab.getState().running).toBe(false);

    // Escape in run mode returns to edit mode
    fireKey("escape", "Escape");
    expect(useLab.getState().mode).toBe("edit");
  });

  it("handles R and Shift+R via handleGlobalKeyDown", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    expect(useLab.getState().placing).toBe("km-coil");
    expect(useLab.getState().placingRot).toBe(0);

    // R while placing rotates placing preview
    fireKey("r", "KeyR");
    expect(useLab.getState().placingRot).toBe(90);

    // Shift+R rotates counter-clockwise
    fireKey("R", "KeyR", { shiftKey: true });
    expect(useLab.getState().placingRot).toBe(0);

    s.placeAt(10, 10);
    const sym = useLab.getState().circuit.symbols[0];
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [sym.id] });

    // R on selected symbol rotates CW
    fireKey("r", "KeyR");
    expect(useLab.getState().circuit.symbols[0].rot).toBe(90);

    // Shift+R on selected symbol rotates CCW
    fireKey("R", "KeyR", { shiftKey: true });
    expect(useLab.getState().circuit.symbols[0].rot).toBe(0);
  });

  it("handles Escape cancellation for placing, wiring, and selection", () => {
    const s = useLab.getState();

    // Cancel placing
    s.setPlacing("km-coil");
    expect(useLab.getState().placing).toBe("km-coil");
    fireKey("escape", "Escape");
    expect(useLab.getState().placing).toBeNull();

    // Cancel selection
    s.setPlacing("km-coil");
    s.placeAt(5, 5);
    const sym = useLab.getState().circuit.symbols[0];
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [sym.id] });
    expect(useLab.getState().selected).not.toBeNull();
    fireKey("escape", "Escape");
    expect(useLab.getState().selected).toBeNull();
    expect(useLab.getState().selectedIds).toEqual([]);
  });

  it("handles zoom shortcuts via handleGlobalKeyDown", () => {
    const initialZoom = useLab.getState().zoom;

    // Zoom in '+' / '='
    fireKey("=", "Equal");
    expect(useLab.getState().zoom).toBeGreaterThan(initialZoom);

    // Zoom out '-'
    fireKey("-", "Minus");
    expect(useLab.getState().zoom).toBe(initialZoom);

    // Zoom reset '0'
    fireKey("0", "Digit0");
    expect(useLab.getState().zoom).toBe(1);
  });

  it("handles text input isolation and focus blur", () => {
    let blurred = false;
    const fakeInput = {
      tagName: "INPUT",
      type: "text",
      value: "test",
      blur: () => {
        blurred = true;
      },
    } as unknown as HTMLElement;

    // Normal letters should NOT trigger app shortcuts when typing
    const handled = fireKey("w", "KeyW", { target: fakeInput });
    expect(handled).toBe(false);
    expect(useLab.getState().editSubMode).toBe("editing"); // Not changed to wiring!

    // Escape should blur the input
    const escapeHandled = fireKey("escape", "Escape", { target: fakeInput });
    expect(escapeHandled).toBe(true);
    expect(blurred).toBe(true);
  });

  it("handles Arrow nudge shortcuts with and without Shift", () => {
    const s = useLab.getState();
    s.setPlacing("km-coil");
    s.placeAt(10, 10);
    const sym = useLab.getState().circuit.symbols[0];
    useLab.setState({ selected: { type: "symbol", id: sym.id }, selectedIds: [sym.id] });

    // Arrow Right (1 step)
    fireKey("ArrowRight", "ArrowRight");
    expect(useLab.getState().circuit.symbols[0].x).toBe(11);

    // Shift + Arrow Down (5 steps)
    fireKey("ArrowDown", "ArrowDown", { shiftKey: true });
    expect(useLab.getState().circuit.symbols[0].y).toBe(15);

    // Arrow Left (1 step)
    fireKey("ArrowLeft", "ArrowLeft");
    expect(useLab.getState().circuit.symbols[0].x).toBe(10);

    // Shift + Arrow Up (5 steps)
    fireKey("ArrowUp", "ArrowUp", { shiftKey: true });
    expect(useLab.getState().circuit.symbols[0].y).toBe(10);
  });

  it("handles panel toggle shortcuts '[' and ']'", () => {
    expect(useLab.getState().paletteOpen).toBe(true);
    fireKey("[", "BracketLeft");
    expect(useLab.getState().paletteOpen).toBe(false);
    fireKey("[", "BracketLeft");
    expect(useLab.getState().paletteOpen).toBe(true);

    expect(useLab.getState().sideOpen).toBe(true);
    fireKey("]", "BracketRight");
    expect(useLab.getState().sideOpen).toBe(false);
    fireKey("]", "BracketRight");
    expect(useLab.getState().sideOpen).toBe(true);
  });

  it("supports direct command execution and querying via CommandRegistry", () => {
    const commands = getRegisteredCommands();
    expect(commands.length).toBeGreaterThanOrEqual(25);

    // Test executeCommand
    expect(useLab.getState().editSubMode).toBe("editing");
    const ok = executeCommand("mode.wiring");
    expect(ok).toBe(true);
    expect(useLab.getState().editSubMode).toBe("wiring");
  });
});
