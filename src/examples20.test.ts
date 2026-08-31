import { describe, expect, it } from "vitest";
import { ALL_20_EXAMPLES } from "./examplesBuilder";
import { isCircuit, makeDoc, parseDoc } from "./persist";
import { emptySnapshot, tick } from "./sim/engine";
import { variantDef } from "./catalog";
import { loadExampleJson } from "./examples/index";
import { t } from "./i18n";

describe("20 Progressive Example Circuits", () => {
  it("should generate all 20 valid circuit models and verify simulations", () => {
    expect(ALL_20_EXAMPLES.length).toBe(20);

    for (const ex of ALL_20_EXAMPLES) {
      const circuit = ex.build();
      expect(isCircuit(circuit)).toBe(true);
      expect(circuit.devices.length).toBeGreaterThan(0);
      expect(circuit.symbols.length).toBeGreaterThan(0);
      expect(circuit.wires.length).toBeGreaterThan(0);

      // Verify all terminals in wires exist in catalog
      for (const wire of circuit.wires) {
        const symA = circuit.symbols.find((s) => s.id === wire.a.symbolId);
        const symB = circuit.symbols.find((s) => s.id === wire.b.symbolId);
        expect(symA, `Symbol ${wire.a.symbolId} in wire ${wire.id} must exist`).toBeDefined();
        expect(symB, `Symbol ${wire.b.symbolId} in wire ${wire.id} must exist`).toBeDefined();

        const devA = circuit.devices.find((d) => d.id === symA!.deviceId);
        const devB = circuit.devices.find((d) => d.id === symB!.deviceId);
        expect(devA).toBeDefined();
        expect(devB).toBeDefined();

        const vDefA = variantDef(devA!.kind, symA!.variant);
        const vDefB = variantDef(devB!.kind, symB!.variant);
        const hasTermA = vDefA.terminals.some((t) => t.id === wire.a.term);
        const hasTermB = vDefB.terminals.some((t) => t.id === wire.b.term);
        expect(hasTermA, `Terminal ${wire.a.term} in ${devA!.kind}:${symA!.variant} must exist`).toBe(true);
        expect(hasTermB, `Terminal ${wire.b.term} in ${devB!.kind}:${symB!.variant} must exist`).toBe(true);
      }

      // Verify simulation runs without faults/errors and wires have assigned phase kinds
      const initialSnap = emptySnapshot(circuit);
      const coloredWires = Object.values(initialSnap.wires).filter((w) => w.kind !== null);
      expect(coloredWires.length).toBeGreaterThan(0);
      const snap = tick(
        circuit,
        initialSnap.runtime,
        { held: new Set(), process: { temperature: 25, pressure: 0, level: 0, flow: 1, limitHit: false, proxHit: false, photoHit: false } },
        50,
        0
      );
      expect(snap).toBeDefined();
      expect(snap.faults.filter((f) => f.level === "error")).toEqual([]);

      // Verify doc serialization and parsing
      const doc = makeDoc(circuit, ex.id);
      const parsed = parseDoc(doc);
      expect(parsed).not.toBeNull();
      expect(parsed?.circuit.devices.length).toBe(circuit.devices.length);
    }
  });

  it("should dynamically import and load every example via loadExampleJson", async () => {
    for (const ex of ALL_20_EXAMPLES) {
      const doc = await loadExampleJson(ex.id);
      expect(doc, `Example ${ex.id} must load via dynamic import`).not.toBeNull();
      expect(doc.circuit).toBeDefined();
      expect(isCircuit(doc.circuit)).toBe(true);
    }
  });

  it("should have bilingual title translations for all 20 examples", () => {
    for (const ex of ALL_20_EXAMPLES) {
      const enTitle = t(`example.${ex.id}.title`);
      expect(enTitle).not.toBe(`example.${ex.id}.title`);
      expect(enTitle).toContain("#");
    }
  });

  it("should test interactive self-holding simulation on 04-relay-self-holding", () => {
    const ex = ALL_20_EXAMPLES.find((e) => e.id === "04-relay-self-holding")!;
    const circuit = ex.build();
    const sbStart = circuit.devices.find((d) => d.tag === "SB2")!;
    const ka1 = circuit.devices.find((d) => d.tag === "KA1")!;
    const hl1 = circuit.devices.find((d) => d.tag === "HL1")!;

    let snap = emptySnapshot(circuit);
    const process = { temperature: 25, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false };

    // Initially off
    snap = tick(circuit, snap.runtime, { held: new Set(), process }, 50, 0);
    expect(snap.runtime[ka1.id]?.energized).toBeFalsy();
    expect(snap.runtime[hl1.id]?.lit).toBeFalsy();

    // Press start button -> KA1 energizes, HL1 lights up
    snap = tick(circuit, snap.runtime, { held: new Set([sbStart.id]), process }, 50, 50);
    expect(snap.runtime[ka1.id]?.energized).toBe(true);
    expect(snap.runtime[hl1.id]?.lit).toBe(true);

    // Release start button -> KA1 maintains energized state via self-holding contact
    snap = tick(circuit, snap.runtime, { held: new Set(), process }, 50, 100);
    expect(snap.runtime[ka1.id]?.energized).toBe(true);
    expect(snap.runtime[hl1.id]?.lit).toBe(true);
  });
});
