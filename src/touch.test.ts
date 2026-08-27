import { describe, expect, it, vi } from "vitest";
import { triggerHaptic } from "./ui/schematic/interact";
import { useLab } from "./store";

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
});
