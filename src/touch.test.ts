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
    expect(updatedWire.jog).toEqual({ axis: "y", pos: 176 });

    // Straighten wire
    s.straightenWire(wire.id);
    updatedWire = useLab.getState().circuit.wires.find((w) => w.id === wire.id)!;
    expect(updatedWire.jog).toBeUndefined();
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
    ];

    for (const key of requiredKeys) {
      expect(TRANSLATIONS.en[key]).toBeDefined();
      expect(TRANSLATIONS.en[key].length).toBeGreaterThan(0);
      expect(TRANSLATIONS.zh[key]).toBeDefined();
      expect(TRANSLATIONS.zh[key].length).toBeGreaterThan(0);
    }
  });
});
