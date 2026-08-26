import { describe, expect, it } from "vitest";
import { useLab } from "./store";

describe("sidebar collapse feature", () => {
  it("initializes with panels open by default", () => {
    const s = useLab.getState();
    expect(typeof s.paletteOpen).toBe("boolean");
    expect(typeof s.sideOpen).toBe("boolean");
  });

  it("toggles palette and persists state", () => {
    const s = useLab.getState();
    const initialPalette = s.paletteOpen;
    s.togglePalette();
    expect(useLab.getState().paletteOpen).toBe(!initialPalette);
    s.setPaletteOpen(initialPalette);
    expect(useLab.getState().paletteOpen).toBe(initialPalette);
  });

  it("toggles side panel and persists state", () => {
    const s = useLab.getState();
    const initialSide = s.sideOpen;
    s.toggleSide();
    expect(useLab.getState().sideOpen).toBe(!initialSide);
    s.setSideOpen(initialSide);
    expect(useLab.getState().sideOpen).toBe(initialSide);
  });
});
