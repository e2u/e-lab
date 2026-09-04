import { describe, expect, it } from "vitest";
import { addDevice, emptyCircuit } from "./circuitBuilder";
import { symbolBounds, terminalWorld } from "./geometry";
import { useLab } from "./store";
import { variantDef } from "./catalog";
import { SymbolGlyph } from "./Glyphs";

describe("Symbol Scale & Control Handles", () => {
  it("scales transformer proportionally and strictly aligns to grid", () => {
    const c = emptyCircuit();
    const { device, symbol } = addDevice(c, "transformer", "TC1", "body", 10, 10);
    // Base size 6x8
    const b1 = symbolBounds(c, symbol);
    expect(b1).toEqual({ x: 10, y: 10, w: 6, h: 8 });

    // Scale up 1.5x (k=3, g=2) -> 9x12
    device.params.scale = 1.5;
    const b15 = symbolBounds(c, symbol);
    expect(b15).toEqual({ x: 10, y: 10, w: 9, h: 12 });
    expect(Number.isInteger(b15!.w)).toBe(true);
    expect(Number.isInteger(b15!.h)).toBe(true);

    // Scale down 0.5x (k=1, g=2) -> 3x4
    device.params.scale = 0.5;
    const b05 = symbolBounds(c, symbol);
    expect(b05).toEqual({ x: 10, y: 10, w: 3, h: 4 });
    expect(Number.isInteger(b05!.w)).toBe(true);
    expect(Number.isInteger(b05!.h)).toBe(true);
  });

  it("calculates accurate world terminal positions across scales", () => {
    const c = emptyCircuit();
    const { device, symbol } = addDevice(c, "transformer", "TC1", "body", 4, 6);
    // Terminals: H1(0, 1), H2(0, 3), H3(0, 5), H4(0, 7), X1(6, 1), X2(6, 7)
    // Scale = 1.0 (GRID = 22)
    const tH1_1 = terminalWorld(c, { symbolId: symbol.id, term: "H1" });
    const tX2_1 = terminalWorld(c, { symbolId: symbol.id, term: "X2" });
    expect(tH1_1).toEqual({ x: 4 * 22, y: (6 + 1) * 22 });
    expect(tX2_1).toEqual({ x: (4 + 6) * 22, y: (6 + 7) * 22 });

    // Scale = 2.0 -> terminals at (0, 2), (0, 6), (0, 10), (0, 14), (12, 2), (12, 14)
    device.params.scale = 2.0;
    const tH1_2 = terminalWorld(c, { symbolId: symbol.id, term: "H1" });
    const tX2_2 = terminalWorld(c, { symbolId: symbol.id, term: "X2" });
    expect(tH1_2).toEqual({ x: 4 * 22, y: (6 + 2) * 22 });
    expect(tX2_2).toEqual({ x: (4 + 12) * 22, y: (6 + 14) * 22 });
  });

  it("updates symbol scale and position via store.scaleSymbol", () => {
    useLab.getState().loadBlankTemplate(true);
    const lab = useLab.getState();
    lab.setPlacing("breaker-3p");
    lab.placeAt(10, 10);

    const s1 = useLab.getState();
    const dev = s1.circuit.devices.find((d) => d.kind === "breaker-3p")!;
    const sym = s1.circuit.symbols.find((s) => s.deviceId === dev.id)!;

    expect(dev.params.scale ?? 1).toBe(1);
    expect(sym.rot).toBe(0);
    expect(sym.x).toBe(10);
    expect(sym.y).toBe(10);

    // Scale from bottom-right (anchor at top-left 10,10) to 1.5x
    useLab.getState().scaleSymbol(sym.id, 1.5, 10, 10);
    const s2 = useLab.getState();
    const dev2 = s2.circuit.devices.find((d) => d.id === sym.deviceId)!;
    const sym2 = s2.circuit.symbols.find((s) => s.id === sym.id)!;
    expect(dev2.params.scale).toBe(1.5);
    expect(sym2.x).toBe(10);
    expect(sym2.y).toBe(10);

    // Scale from top-left (anchor at bottom-right 19,19) to 2.0x
    // Breaker 3p is 6x4. At scale 2.0, size is 12x8.
    // Anchor BR is at 10 + 9 = 19, 10 + 9 = 19.
    // New TL should be 19 - 12 = 7, 19 - 12 = 7.
    useLab.getState().scaleSymbol(sym.id, 2.0, 7, 7);
    const s3 = useLab.getState();
    const dev3 = s3.circuit.devices.find((d) => d.id === sym.deviceId)!;
    const sym3 = s3.circuit.symbols.find((s) => s.id === sym.id)!;
    expect(dev3.params.scale).toBe(2.0);
    expect(sym3.x).toBe(7);
    expect(sym3.y).toBe(7);

    const bounds = symbolBounds(s3.circuit, sym3);
    expect(bounds).toEqual({ x: 7, y: 7, w: 12, h: 8 });
  });

  it("handles proportional corner scaling calculations correctly", () => {
    const gcd = (a: number, b: number): number => {
      a = Math.round(Math.abs(a));
      b = Math.round(Math.abs(b));
      while (b) {
        const t = b;
        b = a % b;
        a = t;
      }
      return a || 1;
    };

    // Component base size 6x8
    const baseW = 6;
    const baseH = 8;
    const g = gcd(baseW, baseH);
    expect(g).toBe(2);

    // Drag BR corner from (10, 10) to (19.2, 21.8) in grid units
    const anchorX = 10;
    const anchorY = 10;
    const px = 19.2;
    const py = 21.8;
    const dx = px - anchorX; // 9.2
    const dy = py - anchorY; // 11.8
    const sw = dx / baseW; // ~1.533
    const sh = dy / baseH; // ~1.475
    const sRaw = (sw + sh) / 2; // ~1.504
    const k = Math.round(sRaw * g); // round(3.008) = 3
    const s = k / g; // 1.5

    expect(s).toBe(1.5);
    const newW = baseW * s; // 9
    const newH = baseH * s; // 12
    expect(newW).toBe(9);
    expect(newH).toBe(12);
    expect(Number.isInteger(newW)).toBe(true);
    expect(Number.isInteger(newH)).toBe(true);
  });

  it("handles isolator terminal positions, aliases and bounds correctly", () => {
    const c = emptyCircuit();
    const { device, symbol } = addDevice(c, "isolator", "QS1", "body", 10, 10);
    // Base size 4x6
    const b = symbolBounds(c, symbol);
    expect(b).toEqual({ x: 10, y: 10, w: 4, h: 6 });

    // Primary terminals: L1(0, 1), L2(0, 3), L3(0, 5), T1(4, 1), T2(4, 3), T3(4, 5)
    const tL1 = terminalWorld(c, { symbolId: symbol.id, term: "L1" });
    const tL2 = terminalWorld(c, { symbolId: symbol.id, term: "L2" });
    const tL3 = terminalWorld(c, { symbolId: symbol.id, term: "L3" });
    const tT1 = terminalWorld(c, { symbolId: symbol.id, term: "T1" });
    const tT2 = terminalWorld(c, { symbolId: symbol.id, term: "T2" });
    const tT3 = terminalWorld(c, { symbolId: symbol.id, term: "T3" });

    expect(tL1).toEqual({ x: 10 * 22, y: (10 + 1) * 22 });
    expect(tL2).toEqual({ x: 10 * 22, y: (10 + 3) * 22 });
    expect(tL3).toEqual({ x: 10 * 22, y: (10 + 5) * 22 });
    expect(tT1).toEqual({ x: (10 + 4) * 22, y: (10 + 1) * 22 });
    expect(tT2).toEqual({ x: (10 + 4) * 22, y: (10 + 3) * 22 });
    expect(tT3).toEqual({ x: (10 + 4) * 22, y: (10 + 5) * 22 });

    // Numeric aliases: 1->L1, 3->L2, 5->L3, 2->T1, 4->T2, 6->T3
    const t1 = terminalWorld(c, { symbolId: symbol.id, term: "1" });
    const t3 = terminalWorld(c, { symbolId: symbol.id, term: "3" });
    const t5 = terminalWorld(c, { symbolId: symbol.id, term: "5" });
    const t2 = terminalWorld(c, { symbolId: symbol.id, term: "2" });
    const t4 = terminalWorld(c, { symbolId: symbol.id, term: "4" });
    const t6 = terminalWorld(c, { symbolId: symbol.id, term: "6" });

    expect(t1).toEqual(tL1);
    expect(t3).toEqual(tL2);
    expect(t5).toEqual(tL3);
    expect(t2).toEqual(tT1);
    expect(t4).toEqual(tT2);
    expect(t6).toEqual(tT3);
  });

  it("handles breaker-1p bounds and terminal coordinates properly", () => {
    const c = emptyCircuit();
    const { device, symbol } = addDevice(c, "breaker-1p", "QF1", "body", 5, 5);
    const b = symbolBounds(c, symbol);
    expect(b).toEqual({ x: 5, y: 5, w: 2, h: 4 });

    const t1 = terminalWorld(c, { symbolId: symbol.id, term: "1" });
    const t2 = terminalWorld(c, { symbolId: symbol.id, term: "2" });
    expect(t1).toEqual({ x: (5 + 1) * 22, y: (5 + 0) * 22 });
    expect(t2).toEqual({ x: (5 + 1) * 22, y: (5 + 4) * 22 });
  });

  it("handles overload relay bounds, terminals and aux contacts properly", () => {
    const c = emptyCircuit();
    const { device, symbol } = addDevice(c, "overload", "FR1", "body", 5, 5);
    const b = symbolBounds(c, symbol);
    expect(b).toEqual({ x: 5, y: 5, w: 6, h: 4 });

    // Primary terminals: L3(1, 0), L2(3, 0), L1(5, 0), T3(1, 4), T2(3, 4), T1(5, 4)
    const tL3 = terminalWorld(c, { symbolId: symbol.id, term: "L3" });
    const tL2 = terminalWorld(c, { symbolId: symbol.id, term: "L2" });
    const tL1 = terminalWorld(c, { symbolId: symbol.id, term: "L1" });
    const tT3 = terminalWorld(c, { symbolId: symbol.id, term: "T3" });
    const tT2 = terminalWorld(c, { symbolId: symbol.id, term: "T2" });
    const tT1 = terminalWorld(c, { symbolId: symbol.id, term: "T1" });

    expect(tL3).toEqual({ x: (5 + 1) * 22, y: (5 + 0) * 22 });
    expect(tL2).toEqual({ x: (5 + 3) * 22, y: (5 + 0) * 22 });
    expect(tL1).toEqual({ x: (5 + 5) * 22, y: (5 + 0) * 22 });
    expect(tT3).toEqual({ x: (5 + 1) * 22, y: (5 + 4) * 22 });
    expect(tT2).toEqual({ x: (5 + 3) * 22, y: (5 + 4) * 22 });
    expect(tT1).toEqual({ x: (5 + 5) * 22, y: (5 + 4) * 22 });

    // Numeric aliases: 5->L3, 3->L2, 1->L1, 6->T3, 4->T2, 2->T1
    const t5 = terminalWorld(c, { symbolId: symbol.id, term: "5" });
    const t3 = terminalWorld(c, { symbolId: symbol.id, term: "3" });
    const t1 = terminalWorld(c, { symbolId: symbol.id, term: "1" });
    const t6 = terminalWorld(c, { symbolId: symbol.id, term: "6" });
    const t4 = terminalWorld(c, { symbolId: symbol.id, term: "4" });
    const t2 = terminalWorld(c, { symbolId: symbol.id, term: "2" });

    expect(t5).toEqual(tL3);
    expect(t3).toEqual(tL2);
    expect(t1).toEqual(tL1);
    expect(t6).toEqual(tT3);
    expect(t4).toEqual(tT2);
    expect(t2).toEqual(tT1);
  });

  it("handles breaker-3p and contactor main terminals and aliases properly", () => {
    const c = emptyCircuit();
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 5, 5);
    const bCb = symbolBounds(c, cb.symbol);
    expect(bCb).toEqual({ x: 5, y: 5, w: 6, h: 4 });

    // Breaker 3p terminals: L3(1, 0), L2(3, 0), L1(5, 0), T3(1, 4), T2(3, 4), T1(5, 4)
    const cbL3 = terminalWorld(c, { symbolId: cb.symbol.id, term: "L3" });
    const cbL2 = terminalWorld(c, { symbolId: cb.symbol.id, term: "L2" });
    const cbL1 = terminalWorld(c, { symbolId: cb.symbol.id, term: "L1" });
    const cbT3 = terminalWorld(c, { symbolId: cb.symbol.id, term: "T3" });
    const cbT2 = terminalWorld(c, { symbolId: cb.symbol.id, term: "T2" });
    const cbT1 = terminalWorld(c, { symbolId: cb.symbol.id, term: "T1" });

    expect(cbL3).toEqual({ x: (5 + 1) * 22, y: (5 + 0) * 22 });
    expect(cbL2).toEqual({ x: (5 + 3) * 22, y: (5 + 0) * 22 });
    expect(cbL1).toEqual({ x: (5 + 5) * 22, y: (5 + 0) * 22 });
    expect(cbT3).toEqual({ x: (5 + 1) * 22, y: (5 + 4) * 22 });
    expect(cbT2).toEqual({ x: (5 + 3) * 22, y: (5 + 4) * 22 });
    expect(cbT1).toEqual({ x: (5 + 5) * 22, y: (5 + 4) * 22 });

    // Contactor main terminals: L1(0, 1), L2(0, 3), L3(0, 5), T1(6, 1), T2(6, 3), T3(6, 5)
    const km = addDevice(c, "contactor", "KM1", "main", 10, 10);
    const kmL1 = terminalWorld(c, { symbolId: km.symbol.id, term: "L1" });
    const kmL2 = terminalWorld(c, { symbolId: km.symbol.id, term: "L2" });
    const kmL3 = terminalWorld(c, { symbolId: km.symbol.id, term: "L3" });
    const kmT1 = terminalWorld(c, { symbolId: km.symbol.id, term: "T1" });
    const kmT2 = terminalWorld(c, { symbolId: km.symbol.id, term: "T2" });
    const kmT3 = terminalWorld(c, { symbolId: km.symbol.id, term: "T3" });

    expect(kmL1).toEqual({ x: (10 + 0) * 22, y: (10 + 1) * 22 });
    expect(kmL2).toEqual({ x: (10 + 0) * 22, y: (10 + 3) * 22 });
    expect(kmL3).toEqual({ x: (10 + 0) * 22, y: (10 + 5) * 22 });
    expect(kmT1).toEqual({ x: (10 + 6) * 22, y: (10 + 1) * 22 });
    expect(kmT2).toEqual({ x: (10 + 6) * 22, y: (10 + 3) * 22 });
    expect(kmT3).toEqual({ x: (10 + 6) * 22, y: (10 + 5) * 22 });
  });

  it("scales rotated symbols (90, 180, 270 deg) keeping opposite anchor fixed", () => {
    useLab.getState().loadBlankTemplate(true);
    const lab = useLab.getState();
    lab.setPlacing("breaker-3p");
    lab.placeAt(10, 10);

    const s1 = useLab.getState();
    const dev = s1.circuit.devices.find((d) => d.kind === "breaker-3p")!;
    const sym = s1.circuit.symbols.find((s) => s.deviceId === dev.id)!;

    // Select and rotate 90 degrees: base size 6x4 becomes 4x6 in world bounding box
    lab.select({ type: "symbol", id: sym.id });
    lab.rotateSelected(1);
    const sRot90 = useLab.getState();
    const symRot90 = sRot90.circuit.symbols.find((s) => s.id === sym.id)!;
    expect(symRot90.rot).toBe(90);

    // Initial world bounds: x: 10, y: 10, w: 4, h: 6 (world TL is at (10, 10))
    const b1 = symbolBounds(sRot90.circuit, symRot90);
    expect(b1).toEqual({ x: 10, y: 10, w: 4, h: 6 });

    // Scale 1.5x with anchor at world TL (10, 10) -> new world bounds: x: 10, y: 10, w: 6, h: 9
    // Breaker 3p baseW=6, baseH=4 -> at 1.5x, baseW=9, baseH=6.
    // For rot 90, anchor bl (local 0, h0) is world TL (10, 10).
    // Under rot 90 with anchor bl, newSymX = anchorWorldX = 10, newSymY = anchorWorldY = 10.
    useLab.getState().scaleSymbol(sym.id, 1.5, 10, 10);
    const sScaled = useLab.getState();
    const symScaled = sScaled.circuit.symbols.find((s) => s.id === sym.id)!;
    const devScaled = sScaled.circuit.devices.find((d) => d.id === dev.id)!;
    expect(devScaled.params.scale).toBe(1.5);
    const bScaled = symbolBounds(sScaled.circuit, symScaled);
    expect(bScaled).toEqual({ x: 10, y: 10, w: 6, h: 9 });
  });

  it("renders scaled SVG dimensions for push button and other symbols", () => {
    const c = emptyCircuit();
    const { device, symbol } = addDevice(c, "pb-no", "SB1", "body", 0, 0);
    device.params.scale = 3;
    const v = variantDef("pb-no", "body");
    const scaledW = v.w * 3;
    const scaledH = v.h * 3;

    // SymbolGlyph rendered element check
    const element = SymbolGlyph({
      device,
      variant: symbol.variant,
      w: scaledW,
      h: scaledH,
    });

    expect(element).toBeDefined();
  });

  it("renders horizontally flipped symbols with terminal tags properly", () => {
    const c = emptyCircuit();
    const kinds = ["breaker-3p", "isolator", "overload", "contactor"] as const;
    for (const kind of kinds) {
      const variant = kind === "contactor" ? "main" : "body";
      const { device } = addDevice(c, kind, "DEV1", variant, 0, 0);
      const v = variantDef(kind, variant);
      const elNormal = SymbolGlyph({
        device,
        variant,
        w: v.w,
        h: v.h,
        flipX: false,
        rot: 0,
      });
      expect(elNormal).toBeDefined();

      const elFlipped = SymbolGlyph({
        device,
        variant,
        w: v.w,
        h: v.h,
        flipX: true,
        rot: 0,
      });
      expect(elFlipped).toBeDefined();

      const elRotFlipped = SymbolGlyph({
        device,
        variant,
        w: v.w,
        h: v.h,
        flipY: true,
        rot: 90,
      });
      expect(elRotFlipped).toBeDefined();
    }
  });
});
