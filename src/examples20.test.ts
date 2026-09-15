import { describe, expect, it } from "vitest";
import { ALL_20_EXAMPLES, ex21TimerSsOffDualMotor, ex22TimerSsOffThreeMotor } from "./examplesBuilder";
import { isCircuit, makeDoc, parseDoc } from "./persist";
import { emptySnapshot, tick } from "./sim/engine";
import { variantDef } from "./catalog";
import { loadExampleJson } from "./examples/index";
import { t } from "./i18n";
import fs from "node:fs";
import path from "node:path";

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
      expect(doc?.circuit).toBeDefined();
      expect(isCircuit(doc?.circuit)).toBe(true);
    }
  });

  it("loads Base Template and Project examples from JSON", async () => {
    const extraIds = [
      "base-template",
      "project-01",
      "project-02",
      "project-03",
      "project-11",
      "project-12",
      "21-timer-ss-off-dual-motor",
      "22-timer-ss-off-three-motor",
    ];
    for (const id of extraIds) {
      const doc = await loadExampleJson(id);
      expect(doc, `Example ${id} must load via dynamic import`).not.toBeNull();
      expect(doc?.circuit).toBeDefined();
      expect(isCircuit(doc?.circuit)).toBe(true);
    }
  });

  it("builds and verifies 21-timer-ss-off-dual-motor example JSON", () => {
    const circuit = ex21TimerSsOffDualMotor();
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

    // Save JSON doc
    const doc = makeDoc(circuit, "21-timer-ss-off-dual-motor");
    const jsonPath = path.resolve(__dirname, "examples", "21-timer-ss-off-dual-motor.json");
    fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), "utf-8");
  });

  it("builds and verifies 22-timer-ss-off-three-motor example JSON", () => {
    const circuit = ex22TimerSsOffThreeMotor();
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

    // Save JSON doc
    const doc = makeDoc(circuit, "22-timer-ss-off-three-motor");
    const jsonPath = path.resolve(__dirname, "examples", "22-timer-ss-off-three-motor.json");
    fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), "utf-8");

    // Full sequence test of ex22
    const startPb = circuit.devices.find((d) => d.tag === "PB_START")!;
    const disc1 = circuit.devices.find((d) => d.tag === "DISC1")!;
    const cb1 = circuit.devices.find((d) => d.tag === "CB1")!;
    const m1 = circuit.devices.find((d) => d.tag === "M1")!;
    const m2 = circuit.devices.find((d) => d.tag === "M2")!;
    const m3 = circuit.devices.find((d) => d.tag === "M3")!;

    let currentSnap = initialSnap;
    // Close isolator and breaker
    currentSnap.runtime[disc1.id].on = true;
    currentSnap.runtime[cb1.id].tripped = false;

    // Press start and simulate 18 seconds
    for (let t = 0; t <= 18000; t += 100) {
      const held = t <= 200 ? new Set([startPb.id]) : new Set<string>();
      currentSnap = tick(circuit, currentSnap.runtime, { held, process: { temperature: 25, pressure: 0, level: 0, flow: 1, limitHit: false, proxHit: false, photoHit: false } }, 100, t);

      // Verify each stage runs exclusively
      if (t >= 1000 && t <= 4800) {
        expect(currentSnap.runtime[m1.id]?.energized, `t=${t} M1 should run`).toBe(true);
        expect(currentSnap.runtime[m2.id]?.energized, `t=${t} M2 should not run`).toBe(false);
        expect(currentSnap.runtime[m3.id]?.energized, `t=${t} M3 should not run`).toBe(false);
      } else if (t >= 6000 && t <= 9800) {
        expect(currentSnap.runtime[m1.id]?.energized, `t=${t} M1 should not run`).toBe(false);
        expect(currentSnap.runtime[m2.id]?.energized, `t=${t} M2 should run`).toBe(true);
        expect(currentSnap.runtime[m3.id]?.energized, `t=${t} M3 should not run`).toBe(false);
      } else if (t >= 11000 && t <= 14800) {
        expect(currentSnap.runtime[m1.id]?.energized, `t=${t} M1 should not run`).toBe(false);
        expect(currentSnap.runtime[m2.id]?.energized, `t=${t} M2 should not run`).toBe(false);
        expect(currentSnap.runtime[m3.id]?.energized, `t=${t} M3 should run`).toBe(true);
      } else if (t >= 16000 && t <= 18000) {
        expect(currentSnap.runtime[m1.id]?.energized, `t=${t} M1 should run (cycle 2)`).toBe(true);
        expect(currentSnap.runtime[m2.id]?.energized, `t=${t} M2 should not run (cycle 2)`).toBe(false);
        expect(currentSnap.runtime[m3.id]?.energized, `t=${t} M3 should not run (cycle 2)`).toBe(false);
      }
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
    const sbStart = circuit.devices.find((d) => d.tag === "PB2")!;
    const ka1 = circuit.devices.find((d) => d.tag === "CR1")!;
    const hl1 = circuit.devices.find((d) => d.tag === "LT1")!;

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
