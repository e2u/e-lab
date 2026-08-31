import { describe, expect, it, vi } from "vitest";
import { wireRoute } from "./geometry";
import { triggerHaptic } from "./ui/schematic/interact";
import { useLab } from "./store";
import { TRANSLATIONS } from "./i18n";

describe("touch & mobile adaptation", () => {
  it("triggerHaptic calls navigator.vibrate when available", () => {
    const vibrateMock = vi.fn();
    const originalNavigator = globalThis.navigator;
    
    Object.defineProperty(globalThis, "navigator", {
      value: { vibrate: vibrateMock },
      configurable: true,
      writable: true,
    });

    triggerHaptic(20);
    expect(vibrateMock).toHaveBeenCalledWith(20);

    triggerHaptic();
    expect(vibrateMock).toHaveBeenCalledWith(15);

    // Restore original navigator
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("calculates multi-touch pinch zoom scale correctly", () => {
    // Initial two touch points with distance = 100px, initial zoom = 1.0
    const initialDist = 100;
    const initialZoom = 1.0;

    // Fingers spread apart to distance = 150px (1.5x)
    const newDistSpread = 150;
    const spreadScale = newDistSpread / initialDist;
    const calculatedSpreadZoom = Math.max(0.25, Math.min(1.5, Math.round(initialZoom * spreadScale * 100) / 100));
    expect(calculatedSpreadZoom).toBe(1.5);

    // Fingers pinch together to distance = 50px (0.5x)
    const newDistPinch = 50;
    const pinchScale = newDistPinch / initialDist;
    const calculatedPinchZoom = Math.max(0.25, Math.min(1.5, Math.round(initialZoom * pinchScale * 100) / 100));
    expect(calculatedPinchZoom).toBe(0.5);

    // Over-pinch clamps to min zoom (0.25)
    const newDistMin = 10;
    const minScale = newDistMin / initialDist;
    const calculatedMinZoom = Math.max(0.25, Math.min(1.5, Math.round(initialZoom * minScale * 100) / 100));
    expect(calculatedMinZoom).toBe(0.25);

    // Over-spread clamps to max zoom (1.5)
    const newDistMax = 300;
    const maxScale = newDistMax / initialDist;
    const calculatedMaxZoom = Math.max(0.25, Math.min(1.5, Math.round(initialZoom * maxScale * 100) / 100));
    expect(calculatedMaxZoom).toBe(1.5);
  });

  it("handles floating action bar undo/redo/rotate operations", () => {
    const s = useLab.getState();
    s.loadBlankTemplate(true);
    useLab.setState({ history: [], future: [] });

    expect(useLab.getState().history.length).toBe(0);
    expect(useLab.getState().future.length).toBe(0);

    const initialSymbolCount = useLab.getState().circuit.symbols.length;

    // Place a symbol
    s.setPlacing("lamp");
    s.placeAt(5, 5);

    const placedSymbols = useLab.getState().circuit.symbols;
    expect(placedSymbols.length).toBe(initialSymbolCount + 1);

    // Undo via store
    useLab.getState().undo();
    expect(useLab.getState().circuit.symbols.length).toBe(initialSymbolCount);

    // Redo via store
    useLab.getState().redo();
    expect(useLab.getState().circuit.symbols.length).toBe(initialSymbolCount + 1);
  });

  it("straightens a jogged wire via useLab store action", () => {
    const s = useLab.getState();
    s.loadBlankTemplate(true);
    s.setPlacing("lamp");
    s.placeAt(5, 5);
    s.setPlacing("lamp");
    s.placeAt(15, 15);

    const [symA, symB] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: symA.id, term: "1" });
    s.clickPort({ symbolId: symB.id, term: "1" });

    const wire = useLab.getState().circuit.wires[0];
    expect(wire).toBeDefined();

    // Set jog
    useLab.setState((state) => ({
      circuit: {
        ...state.circuit,
        wires: state.circuit.wires.map((w) => (w.id === wire.id ? { ...w, jog: { axis: "x", pos: 200 } } : w)),
      },
    }));

    expect(useLab.getState().circuit.wires[0].jog).toEqual({ axis: "x", pos: 200 });

    // Straighten wire
    useLab.getState().straightenWire(wire.id);
    expect(useLab.getState().circuit.wires[0].jog).toBeUndefined();

    // Undo should restore jog
    useLab.getState().undo();
    expect(useLab.getState().circuit.wires[0].jog).toEqual({ axis: "x", pos: 200 });

    // Redo should remove jog
    useLab.getState().redo();
    expect(useLab.getState().circuit.wires[0].jog).toBeUndefined();
  });

  it("adds junction on wire via addJunctionOnWire with undo/redo support", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });
    s.setPlacing("lamp");
    s.placeAt(5, 5);
    s.setPlacing("lamp");
    s.placeAt(15, 5);

    const [symA, symB] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: symA.id, term: "1" });
    s.clickPort({ symbolId: symB.id, term: "1" });

    expect(useLab.getState().circuit.wires.length).toBe(1);
    const wire = useLab.getState().circuit.wires[0];

    // Add junction to wire at midpoint
    s.addJunctionOnWire(wire.id);

    const circuitAfter = useLab.getState().circuit;
    // Wire should be split into 2 wires
    expect(circuitAfter.wires.length).toBe(2);

    // A junction device and symbol should be created
    const junctionSym = circuitAfter.symbols.find((sym) => {
      const dev = circuitAfter.devices.find((d) => d.id === sym.deviceId);
      return dev?.kind === "junction";
    });
    expect(junctionSym).toBeDefined();

    // Newly added junction should be selected
    expect(useLab.getState().selected).toEqual({ type: "symbol", id: junctionSym!.id });

    // Both wires should connect to the junction's terminal "1"
    const legs = circuitAfter.wires.filter(
      (w) => w.a.symbolId === junctionSym!.id || w.b.symbolId === junctionSym!.id
    );
    expect(legs.length).toBe(2);

    // Test Undo
    useLab.getState().undo();
    expect(useLab.getState().circuit.wires.length).toBe(1);
    expect(
      useLab.getState().circuit.devices.some((d) => d.kind === "junction")
    ).toBe(false);

    // Test Redo
    useLab.getState().redo();
    expect(useLab.getState().circuit.wires.length).toBe(2);
    expect(
      useLab.getState().circuit.devices.some((d) => d.kind === "junction")
    ).toBe(true);
  });

  it("automatically creates a junction when pulling a wire endpoint onto another wire", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });
    s.setPlacing("lamp");
    s.placeAt(5, 5);
    s.setPlacing("lamp");
    s.placeAt(15, 5);
    s.setPlacing("lamp");
    s.placeAt(10, 15);

    const [symA, symB, symC] = useLab.getState().circuit.symbols;
    // First wire: from symA to symB
    s.clickPort({ symbolId: symA.id, term: "1" });
    s.clickPort({ symbolId: symB.id, term: "1" });

    const firstWire = useLab.getState().circuit.wires[0];
    expect(firstWire).toBeDefined();

    // Start drawing a new wire from symC
    s.clickPort({ symbolId: symC.id, term: "1" });
    expect(useLab.getState().wiringFrom).toEqual({ symbolId: symC.id, term: "1" });

    // Connect to first wire at point along its horizontal run (x: 200, y: 92)
    s.connectToWire(firstWire.id, { x: 200, y: 92 });

    // wiringFrom should be reset
    expect(useLab.getState().wiringFrom).toBeNull();

    const currentCircuit = useLab.getState().circuit;
    // Total wires should be 3 (first wire split into 2 + new incoming wire)
    expect(currentCircuit.wires.length).toBe(3);

    // Junction should exist at intersection
    const junctionSym = currentCircuit.symbols.find((sym) => {
      const dev = currentCircuit.devices.find((d) => d.id === sym.deviceId);
      return dev?.kind === "junction";
    });
    expect(junctionSym).toBeDefined();

    // All 3 wires should connect to this junction
    const connectedWires = currentCircuit.wires.filter(
      (w) => w.a.symbolId === junctionSym!.id || w.b.symbolId === junctionSym!.id
    );
    expect(connectedWires.length).toBe(3);
  });

  it("supports dragging junction points in multiple directions with connected wires following", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });
    s.setPlacing("lamp");
    s.placeAt(4, 4);
    s.setPlacing("lamp");
    s.placeAt(16, 4);
    s.setPlacing("lamp");
    s.placeAt(10, 16);

    const [symA, symB, symC] = useLab.getState().circuit.symbols;
    // Connect symA to symB
    s.clickPort({ symbolId: symA.id, term: "1" });
    s.clickPort({ symbolId: symB.id, term: "1" });
    const wire1 = useLab.getState().circuit.wires[0];

    // Add junction on wire1
    s.addJunctionOnWire(wire1.id);
    const junctionSym = useLab.getState().circuit.symbols.find((sym) => {
      const dev = useLab.getState().circuit.devices.find((d) => d.id === sym.deviceId);
      return dev?.kind === "junction";
    })!;
    expect(junctionSym).toBeDefined();
    const initialPos = { x: junctionSym.x, y: junctionSym.y };

    // Connect third lamp (symC) to the junction
    s.clickPort({ symbolId: symC.id, term: "1" });
    s.clickPort({ symbolId: junctionSym.id, term: "1" });
    expect(useLab.getState().circuit.wires.length).toBe(3);

    // 1. Drag junction downwards (+Y direction)
    s.moveGroup([{ id: junctionSym.id, x: initialPos.x, y: initialPos.y + 4 }]);
    let symAfterY = useLab.getState().circuit.symbols.find((sym) => sym.id === junctionSym.id)!;
    expect(symAfterY.y).toBe(initialPos.y + 4);
    expect(symAfterY.x).toBe(initialPos.x);

    // 2. Drag junction to the right (+X direction)
    s.moveGroup([{ id: junctionSym.id, x: initialPos.x + 3, y: initialPos.y + 4 }]);
    let symAfterX = useLab.getState().circuit.symbols.find((sym) => sym.id === junctionSym.id)!;
    expect(symAfterX.x).toBe(initialPos.x + 3);
    expect(symAfterX.y).toBe(initialPos.y + 4);

    // 3. Drag junction diagonally (-X, -Y direction)
    s.moveGroup([{ id: junctionSym.id, x: initialPos.x - 2, y: initialPos.y - 2 }]);
    let symAfterDiag = useLab.getState().circuit.symbols.find((sym) => sym.id === junctionSym.id)!;
    expect(symAfterDiag.x).toBe(initialPos.x - 2);
    expect(symAfterDiag.y).toBe(initialPos.y - 2);

    // 4. Verify all connected wires route cleanly to the new multi-directional junction position
    const c = useLab.getState().circuit;
    for (const w of c.wires) {
      const route = wireRoute(c, w.a, w.b, w.jog);
      expect(route.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("allows dragging wires anytime and adjusting jog offset", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });
    s.setPlacing("lamp");
    s.placeAt(4, 4);
    s.setPlacing("lamp");
    s.placeAt(16, 4);

    const [symA, symB] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: symA.id, term: "1" });
    s.clickPort({ symbolId: symB.id, term: "1" });

    const wire = useLab.getState().circuit.wires[0];
    expect(wire).toBeDefined();

    // Select the wire
    s.select({ type: "wire", id: wire.id });
    expect(useLab.getState().selected).toEqual({ type: "wire", id: wire.id });

    // Drag wire along Y axis
    s.setWireJog(wire.id, { axis: "y", pos: 8 * 22 });
    let updatedWire = useLab.getState().circuit.wires.find((w) => w.id === wire.id)!;
    expect(updatedWire.jog?.pos).toBe(176);
    expect(updatedWire.jog?.y).toBe(176);

    // Straighten wire
    s.straightenWire(wire.id);
    updatedWire = useLab.getState().circuit.wires.find((w) => w.id === wire.id)!;
    expect(updatedWire.jog).toBeUndefined();
  });

  it("independently drags vertical and horizontal wire segments without affecting the other axis", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Place contactor coil and lamp
    s.setPlacing("km-coil");
    s.placeAt(4, 4);
    s.setPlacing("lamp");
    s.placeAt(16, 12);

    const [symA, symB] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: symA.id, term: "A1" });
    s.clickPort({ symbolId: symB.id, term: "1" });

    const wire = useLab.getState().circuit.wires[0];
    expect(wire).toBeDefined();

    // 1. Drag vertical segment along X axis
    s.setWireJog(wire.id, { axis: "x", pos: 10 * 22 });
    let w = useLab.getState().circuit.wires.find((item) => item.id === wire.id)!;
    expect(w.jog?.x).toBe(220);
    expect(w.jog?.y).toBeUndefined();

    // 2. Drag horizontal segment along Y axis without altering X
    s.setWireJog(wire.id, { axis: "y", pos: 8 * 22 });
    w = useLab.getState().circuit.wires.find((item) => item.id === wire.id)!;
    expect(w.jog?.x).toBe(220);
    expect(w.jog?.y).toBe(176);

    // Verify route contains both x = 220 and y = 176
    const circuit = useLab.getState().circuit;
    const pts = wireRoute(circuit, w.a, w.b, w.jog);
    expect(pts.some((p) => p.x === 220)).toBe(true);
    expect(pts.some((p) => p.y === 176)).toBe(true);

    // 3. Move vertical segment to x = 264 (12 * 22), horizontal segment y = 176 must remain unchanged
    s.setWireJog(wire.id, { axis: "x", pos: 12 * 22 });
    w = useLab.getState().circuit.wires.find((item) => item.id === wire.id)!;
    expect(w.jog?.x).toBe(264);
    expect(w.jog?.y).toBe(176);

    // 4. Straighten wire resets all jog coordinates
    s.straightenWire(wire.id);
    w = useLab.getState().circuit.wires.find((item) => item.id === wire.id)!;
    expect(w.jog).toBeUndefined();
  });

  it("creates a junction point when clicking on blank paper during wiring and allows flexible routing", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });
    s.setPlacing("lamp");
    s.placeAt(4, 4);
    s.setPlacing("lamp");
    s.placeAt(20, 16);

    const [symA, symB] = useLab.getState().circuit.symbols;

    // Start wiring from symA
    s.clickPort({ symbolId: symA.id, term: "1" });
    expect(useLab.getState().wiringFrom).toEqual({ symbolId: symA.id, term: "1" });

    // Click on blank paper at grid (12, 4) -> creates junction point and connects
    s.addJunctionAndConnect(12, 4);
    expect(useLab.getState().circuit.wires.length).toBe(1);
    const jSym1 = useLab.getState().circuit.symbols.find((sym) => {
      const dev = useLab.getState().circuit.devices.find((d) => d.id === sym.deviceId);
      return dev?.kind === "junction";
    })!;
    expect(jSym1).toBeDefined();
    expect(jSym1.x).toBe(12);
    expect(jSym1.y).toBe(4);
    // wiringFrom continues from the new junction point
    expect(useLab.getState().wiringFrom).toEqual({ symbolId: jSym1.id, term: "1" });

    // Click on another blank space at grid (12, 16) -> creates second junction point
    s.addJunctionAndConnect(12, 16);
    expect(useLab.getState().circuit.wires.length).toBe(2);
    const jSymbols = useLab.getState().circuit.symbols.filter((sym) => {
      const dev = useLab.getState().circuit.devices.find((d) => d.id === sym.deviceId);
      return dev?.kind === "junction";
    });
    expect(jSymbols.length).toBe(2);

    // Finally click on symB to complete wiring
    s.clickPort({ symbolId: symB.id, term: "1" });
    expect(useLab.getState().wiringFrom).toBeNull();
    expect(useLab.getState().circuit.wires.length).toBe(3);

    // Undo should step back through each junction connection
    s.undo();
    expect(useLab.getState().circuit.wires.length).toBe(2);
    s.undo();
    expect(useLab.getState().circuit.wires.length).toBe(1);
  });

  it("identifies mobile landscape and touch device conditions correctly", () => {
    // Helper function matching the detection logic in App.tsx and CSS
    const isMobileMode = (width: number, height: number, isTouch: boolean) => {
      const isLandscapeMobile = height <= 550 && width <= 1024;
      const isSmallWidth = width <= 768;
      const isTouchTabletOrPhone = isTouch && width <= 1024;
      return isSmallWidth || isLandscapeMobile || isTouchTabletOrPhone;
    };

    // 1. Phone portrait (e.g. iPhone 14 Pro: 393 x 852)
    expect(isMobileMode(393, 852, true)).toBe(true);
    expect(isMobileMode(393, 852, false)).toBe(true);

    // 2. Phone landscape (e.g. iPhone 14 Pro: 852 x 393) -> width > 768, height <= 550
    expect(isMobileMode(852, 393, true)).toBe(true);
    expect(isMobileMode(852, 393, false)).toBe(true); // Should still be mobile due to height <= 550

    // 3. Android phone landscape (e.g. Pixel 7: 915 x 412)
    expect(isMobileMode(915, 412, true)).toBe(true);

    // 4. iPad portrait (768 x 1024)
    expect(isMobileMode(768, 1024, true)).toBe(true);

    // 5. iPad landscape (1024 x 768) with touch
    expect(isMobileMode(1024, 768, true)).toBe(true);

    // 6. Desktop 1080p (1920 x 1080) without touch -> Desktop mode
    expect(isMobileMode(1920, 1080, false)).toBe(false);

    // 7. Desktop laptop (1366 x 768) without touch -> Desktop mode
    expect(isMobileMode(1366, 768, false)).toBe(false);
  });

  it("snaps components and wire jogs strictly to the grid", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    s.setPlacing("lamp");
    s.placeAt(4.4, 6.7);
    const sym = useLab.getState().circuit.symbols[0];
    expect(sym.x).toBe(4);
    expect(sym.y).toBe(7);

    // moveSymbol should snap to whole integer grid
    s.moveSymbol(sym.id, 10.3, 14.8);
    const movedSym = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(movedSym.x).toBe(10);
    expect(movedSym.y).toBe(15);

    // Wire jog position should snap to integer multiples of GRID (22)
    s.setPlacing("lamp");
    s.placeAt(20, 15);
    const sym2 = useLab.getState().circuit.symbols[1];
    s.clickPort({ symbolId: sym.id, term: "1" });
    s.clickPort({ symbolId: sym2.id, term: "1" });
    const wire = useLab.getState().circuit.wires[0];
    expect(wire).toBeDefined();

    // Set non-integer jog pos (e.g. 105.7 px -> should snap to Math.round(105.7 / 22) * 22 = 5 * 22 = 110)
    s.setWireJog(wire.id, { axis: "y", pos: 105.7 });
    const jogWire = useLab.getState().circuit.wires.find((w) => w.id === wire.id)!;
    expect(jogWire.jog?.pos).toBe(110);
  });

  it("only displays junction dot when 3 or more wire branches meet", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    s.setPlacing("lamp");
    s.placeAt(4, 4);
    s.setPlacing("lamp");
    s.placeAt(20, 16);
    const [symA, symB] = useLab.getState().circuit.symbols;

    // Route through blank paper -> creates 1 junction point with 2 connected wires
    s.clickPort({ symbolId: symA.id, term: "1" });
    s.addJunctionAndConnect(12, 4);
    s.clickPort({ symbolId: symB.id, term: "1" });

    const c = useLab.getState().circuit;
    const jSym = c.symbols.find((sym) => {
      const dev = c.devices.find((d) => d.id === sym.deviceId);
      return dev?.kind === "junction";
    })!;
    expect(jSym).toBeDefined();

    const connectedWiresAtWaypoint = c.wires.filter(
      (w) => w.a.symbolId === jSym.id || w.b.symbolId === jSym.id
    );
    // Waypoint junction has exactly 2 wires connected -> < 3 -> should NOT display black dot
    expect(connectedWiresAtWaypoint.length).toBe(2);

    // Now add a 3rd wire connecting to this junction
    s.setPlacing("lamp");
    s.placeAt(12, 24);
    const symC = useLab.getState().circuit.symbols.find((x) => x.x === 12 && x.y === 24)!;
    s.clickPort({ symbolId: symC.id, term: "1" });
    s.clickPort({ symbolId: jSym.id, term: "1" });

    const cAfter3rd = useLab.getState().circuit;
    const connectedWiresAfter3rd = cAfter3rd.wires.filter(
      (w) => w.a.symbolId === jSym.id || w.b.symbolId === jSym.id
    );
    // Now has 3 wires connected -> >= 3 -> displays thick black dot
    expect(connectedWiresAfter3rd.length).toBe(3);
  });

  it("has complete translations for mobile menu keys in all languages", () => {
    const requiredKeys = [
      "toolbar.menu",
      "mobileMenu.title",
      "mobileMenu.project",
      "mobileMenu.examples",
      "mobileMenu.preferences",
      "mobileMenu.close",
      "mobileMenu.components",
      "mobileMenu.wires",
      "toolbar.editing",
      "toolbar.wiring",
      "toolbar.editingTip",
      "toolbar.wiringTip",
      "ctx.addJunctionHere",
      "ctx.resetTagPosition",
      "inspector.resetTagPosition",
    ];

    for (const key of requiredKeys) {
      expect(TRANSLATIONS.en[key]).toBeDefined();
      expect(TRANSLATIONS.en[key].length).toBeGreaterThan(0);
      expect(TRANSLATIONS.zh[key]).toBeDefined();
      expect(TRANSLATIONS.zh[key].length).toBeGreaterThan(0);
    }
  });

  it("manages EditSubMode between editing and wiring properly", () => {
    const s = useLab.getState();
    s.setMode("edit");
    expect(useLab.getState().editSubMode).toBe("editing");

    // Toggle to wiring
    s.toggleEditSubMode();
    expect(useLab.getState().editSubMode).toBe("wiring");

    // Setting wiringFrom and then switching back to editing clears wiringFrom & hoverPort
    s.clickPort({ symbolId: "sym1", term: "1" });
    expect(useLab.getState().wiringFrom).toEqual({ symbolId: "sym1", term: "1" });

    s.setEditSubMode("editing");
    expect(useLab.getState().editSubMode).toBe("editing");
    expect(useLab.getState().wiringFrom).toBeNull();
    expect(useLab.getState().hoverPort).toBeNull();

    // Switching mode to run resets wiring
    s.setEditSubMode("wiring");
    s.clickPort({ symbolId: "sym1", term: "1" });
    s.setMode("run");
    expect(useLab.getState().wiringFrom).toBeNull();
  });

  it("supports addJunctionAt to place junction points at arbitrary coordinates with undo", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    s.addJunctionAt(15.4, 22.8);
    const c = useLab.getState().circuit;
    expect(c.symbols.length).toBe(1);
    expect(c.devices.length).toBe(1);
    expect(c.devices[0].kind).toBe("junction");
    expect(c.symbols[0].x).toBe(15);
    expect(c.symbols[0].y).toBe(23);
    expect(useLab.getState().selectedIds).toContain(c.symbols[0].id);

    // Undo removes the junction
    s.undo();
    expect(useLab.getState().circuit.symbols.length).toBe(0);
    expect(useLab.getState().circuit.devices.length).toBe(0);

    // Redo restores it
    s.redo();
    expect(useLab.getState().circuit.symbols.length).toBe(1);
    expect(useLab.getState().circuit.devices.length).toBe(1);
  });

  it("supports dragging component tag position smoothly without snapping to grid, resetting tag offset, and undo/redo", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Place a contactor coil
    s.setPlacing("km-coil");
    s.placeAt(10, 10);

    const sym = useLab.getState().circuit.symbols[0];
    expect(sym).toBeDefined();
    expect(sym.tagOffset).toBeUndefined();

    // Set tag offset with fractional values (e.g. user drags the tag smoothly without snapping to grid)
    s.pushHistory();
    s.setSymbolTagOffset(sym.id, { dx: 1.45, dy: -2.35 });

    let updatedSym = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updatedSym.tagOffset).toEqual({ dx: 1.45, dy: -2.35 });

    // Moving symbol keeps tagOffset intact
    s.moveSymbol(sym.id, 14, 14);
    updatedSym = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updatedSym.x).toBe(14);
    expect(updatedSym.y).toBe(14);
    expect(updatedSym.tagOffset).toEqual({ dx: 1.45, dy: -2.35 });

    // Resetting tag offset removes it
    s.resetSymbolTagOffset(sym.id);
    updatedSym = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updatedSym.tagOffset).toBeUndefined();

    // Undo restores the custom tag offset
    s.undo();
    updatedSym = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updatedSym.tagOffset).toEqual({ dx: 1.45, dy: -2.35 });

    // Redo clears the tag offset again
    s.redo();
    updatedSym = useLab.getState().circuit.symbols.find((x) => x.id === sym.id)!;
    expect(updatedSym.tagOffset).toBeUndefined();
  });

  it("supports multi-wire selection, merging connected wires at optimal junction point, and undo/redo", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Place 3 lamps
    s.setPlacing("lamp");
    s.placeAt(4, 4);
    s.setPlacing("lamp");
    s.placeAt(16, 4);
    s.setPlacing("lamp");
    s.placeAt(10, 14);

    const [l1, l2, l3] = useLab.getState().circuit.symbols;

    // Connect l1 to l2, and l3 to l1
    s.clickPort({ symbolId: l1.id, term: "1" });
    s.clickPort({ symbolId: l2.id, term: "1" });

    s.clickPort({ symbolId: l3.id, term: "1" });
    s.clickPort({ symbolId: l1.id, term: "1" });

    expect(useLab.getState().circuit.wires.length).toBe(2);
    const [w1, w2] = useLab.getState().circuit.wires;

    // Select both wires via selectWireToggle or selectWireIds
    s.selectWireIds([w1.id, w2.id]);
    expect(useLab.getState().selectedWireIds).toEqual([w1.id, w2.id]);

    // Merge wires
    s.mergeSelectedWires();

    const c = useLab.getState().circuit;
    // Should have created a junction point symbol and 3 wire segments
    const junctionSym = c.symbols.find((sym) => {
      const dev = c.devices.find((d) => d.id === sym.deviceId);
      return dev?.kind === "junction";
    });
    expect(junctionSym).toBeDefined();
    expect(c.wires.length).toBe(3);
    expect(useLab.getState().selected?.id).toBe(junctionSym?.id);

    // Undo should restore original 2 wires
    s.undo();
    expect(useLab.getState().circuit.wires.length).toBe(2);
    expect(useLab.getState().circuit.symbols.length).toBe(3);

    // Redo should re-apply the merge
    s.redo();
    expect(useLab.getState().circuit.wires.length).toBe(3);
    expect(useLab.getState().circuit.symbols.length).toBe(4);
  });

  it("coordinates pointerDevice and toggleIo for limit switches sharing identical tags", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "run" });

    // 1. Place 1 NO + 1 NC with same tag SQ1
    s.setPlacing("limit-no");
    s.placeAt(4, 4);
    s.setPlacing("limit-nc");
    s.placeAt(4, 10);

    const [dNo, dNc] = useLab.getState().circuit.devices;
    s.updateDevice(dNo.id, { tag: "SQ1" });
    s.updateDevice(dNc.id, { tag: "SQ1" });

    // Test pointerDevice down/up
    s.pointerDevice(dNo.id, true);
    expect(useLab.getState().held).toContain(dNo.id);
    expect(useLab.getState().held).toContain(dNc.id);

    s.pointerDevice(dNo.id, false);
    expect(useLab.getState().held).not.toContain(dNo.id);
    expect(useLab.getState().held).not.toContain(dNc.id);

    // Test toggleIo actuated
    s.toggleIo(dNo.id, "actuated");
    expect(useLab.getState().snapshot.runtime[dNo.id]?.actuated).toBe(true);
    expect(useLab.getState().snapshot.runtime[dNc.id]?.actuated).toBe(true);

    s.toggleIo(dNc.id, "actuated");
    expect(useLab.getState().snapshot.runtime[dNo.id]?.actuated).toBe(false);
    expect(useLab.getState().snapshot.runtime[dNc.id]?.actuated).toBe(false);

    // 2. Test 2 NO switches with same tag SQ2 (mutual exclusion)
    s.setPlacing("limit-no");
    s.placeAt(14, 4);
    s.setPlacing("limit-no");
    s.placeAt(14, 10);

    const dNo1 = useLab.getState().circuit.devices[2];
    const dNo2 = useLab.getState().circuit.devices[3];
    s.updateDevice(dNo1.id, { tag: "SQ2" });
    s.updateDevice(dNo2.id, { tag: "SQ2" });

    s.pointerDevice(dNo1.id, true);
    expect(useLab.getState().held).toContain(dNo1.id);
    expect(useLab.getState().held).not.toContain(dNo2.id);

    s.pointerDevice(dNo2.id, true);
    expect(useLab.getState().held).toContain(dNo2.id);
    expect(useLab.getState().held).not.toContain(dNo1.id);

    s.pointerDevice(dNo2.id, false);
    expect(useLab.getState().held).not.toContain(dNo2.id);

    s.toggleIo(dNo1.id, "actuated");
    expect(useLab.getState().snapshot.runtime[dNo1.id]?.actuated).toBe(true);
    expect(useLab.getState().snapshot.runtime[dNo2.id]?.actuated).toBe(false);

    s.toggleIo(dNo2.id, "actuated");
    expect(useLab.getState().snapshot.runtime[dNo1.id]?.actuated).toBe(false);
    expect(useLab.getState().snapshot.runtime[dNo2.id]?.actuated).toBe(true);
  });

  it("allows selecting, jogging, and deleting wire connected between different terminals of the same component", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Place a push button (pb-no) with terminals 1 and 2 (labels 13 and 14)
    s.setPlacing("pb-no");
    s.placeAt(4, 4);

    const btn = useLab.getState().circuit.symbols[0];

    // Connect terminal 1 to terminal 2 on the same symbol
    s.clickPort({ symbolId: btn.id, term: "1" });
    s.clickPort({ symbolId: btn.id, term: "2" });

    expect(useLab.getState().circuit.wires.length).toBe(1);
    const wire = useLab.getState().circuit.wires[0];

    // Select the wire
    s.select({ type: "wire", id: wire.id });
    expect(useLab.getState().selected?.id).toBe(wire.id);
    expect(useLab.getState().selectedWireIds).toContain(wire.id);

    // Set jog on wire (drag wire)
    s.setWireJog(wire.id, { axis: "y", pos: 22 });
    const updatedWire = useLab.getState().circuit.wires.find((w) => w.id === wire.id);
    expect(updatedWire?.jog?.y).toBe(22);

    // Delete selected wire
    s.deleteSelected();
    expect(useLab.getState().circuit.wires.length).toBe(0);
    expect(useLab.getState().circuit.symbols.length).toBe(1); // Button symbol remains intact

    // Undo restores the wire
    s.undo();
    expect(useLab.getState().circuit.wires.length).toBe(1);
  });

  it("updates timer runtime and delay progression when timer coil is energized", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Place mains and timer-on
    s.setPlacing("mains-3ph");
    s.placeAt(0, 0);
    s.setPlacing("timer-on");
    s.placeAt(6, 0);

    const [, ktDev] = useLab.getState().circuit.devices;
    s.updateDevice(ktDev.id, { delayMs: 3000 });

    const [gSym, ktSym] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: gSym.id, term: "L1" });
    s.clickPort({ symbolId: ktSym.id, term: "A1" });
    s.clickPort({ symbolId: ktSym.id, term: "A2" });
    s.clickPort({ symbolId: gSym.id, term: "N" });

    // Switch to run mode and step simulation
    useLab.setState({ mode: "run" });
    s.step(); // initial step to evaluate topology

    // Step simulation 10 times (500ms)
    for (let i = 0; i < 10; i++) s.step();
    let rt = useLab.getState().snapshot.runtime[ktDev.id];
    expect(rt?.energized).toBe(true);
    expect(rt?.elapsedMs).toBeGreaterThanOrEqual(500);
    expect(rt?.done).toBe(false);

    // Step past delay (additional 60 steps = 3000ms)
    for (let i = 0; i < 60; i++) s.step();
    rt = useLab.getState().snapshot.runtime[ktDev.id];
    expect(rt?.energized).toBe(true);
    expect(rt?.elapsedMs).toBe(3000);
    expect(rt?.done).toBe(true);
  });

  it("switches contact variant dynamically and remaps connected wire terminals", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Place timer-on device (coil) and attach delayed-no contact
    s.setPlacing("timer-on");
    s.placeAt(0, 0);
    s.setPlacing("timer-on-no");
    s.placeAt(6, 0);

    const [ktDev] = useLab.getState().circuit.devices;
    const [, contactSym] = useLab.getState().circuit.symbols;
    s.rebind(contactSym.id, ktDev.id);

    // Place lamp
    s.setPlacing("lamp");
    s.placeAt(12, 0);
    const [, , lampSym] = useLab.getState().circuit.symbols;

    // Connect contact terminal 18 to lamp terminal 1
    s.clickPort({ symbolId: contactSym.id, term: "18" });
    s.clickPort({ symbolId: lampSym.id, term: "1" });

    expect(useLab.getState().circuit.wires.length).toBe(1);
    expect(useLab.getState().circuit.wires[0].a.term).toBe("18");

    // Switch contact variant from delayed-no (15-18) to delayed-nc (15-16)
    s.setSymbolVariant(contactSym.id, "delayed-nc");

    const updatedSym = useLab.getState().circuit.symbols.find((x) => x.id === contactSym.id);
    expect(updatedSym?.variant).toBe("delayed-nc");
    const updatedWire = useLab.getState().circuit.wires[0];
    // Wire terminal should be seamlessly remapped from 18 to 16
    expect(updatedWire.a.term).toBe("16");
  });

  it("tests TON NCTO (常閉延時斷開) opening circuit after delay and NOTC closing circuit after delay", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Mains
    s.setPlacing("mains-3ph");
    s.placeAt(0, 0);

    // Timer ON coil
    s.setPlacing("timer-on");
    s.placeAt(8, 0);

    // TON NC contact (15-16)
    s.setPlacing("timer-on-nc");
    s.placeAt(8, 6);

    // Lamp (Load)
    s.setPlacing("lamp");
    s.placeAt(16, 6);

    const [, ktDev, lampDev] = useLab.getState().circuit.devices;
    const [gSym, ktSym, ncSym, lampSym] = useLab.getState().circuit.symbols;

    s.updateDevice(ktDev.id, { delayMs: 2000 });
    s.rebind(ncSym.id, ktDev.id);

    // Wire coil: L1 -> A1, A2 -> N
    s.clickPort({ symbolId: gSym.id, term: "L1" });
    s.clickPort({ symbolId: ktSym.id, term: "A1" });
    s.clickPort({ symbolId: ktSym.id, term: "A2" });
    s.clickPort({ symbolId: gSym.id, term: "N" });

    // Wire load path through NC contact: L1 -> 15, 16 -> Lamp 1, Lamp 2 -> N
    s.clickPort({ symbolId: gSym.id, term: "L1" });
    s.clickPort({ symbolId: ncSym.id, term: "15" });
    s.clickPort({ symbolId: ncSym.id, term: "16" });
    s.clickPort({ symbolId: lampSym.id, term: "1" });
    s.clickPort({ symbolId: lampSym.id, term: "2" });
    s.clickPort({ symbolId: gSym.id, term: "N" });

    // Start simulation
    useLab.setState({ mode: "run" });
    s.step();

    // 1. Initially (during 2.0s timing), NC contact is closed, lamp is powered on!
    for (let i = 0; i < 10; i++) s.step(); // 500ms elapsed
    let snap = useLab.getState().snapshot;
    expect(snap.runtime[lampDev.id]?.energized).toBe(true);
    expect(snap.runtime[ktDev.id]?.done).toBe(false);

    // 2. After 2.0s delay (done), NC contact opens and lamp is powered off!
    for (let i = 0; i < 40; i++) s.step(); // total > 2000ms
    snap = useLab.getState().snapshot;
    expect(snap.runtime[ktDev.id]?.done).toBe(true);
    expect(snap.runtime[lampDev.id]?.energized).toBe(false);
  });
});
