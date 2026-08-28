import { describe, expect, it, beforeEach } from "vitest";
import { computeVoltage, tick } from "./sim/engine";
import { CATALOG, KINDS } from "./catalog";
import { t, setLang } from "./i18n";
import { useLab } from "./store";
import type { Circuit, DeviceRuntime, Potential } from "./types";

describe("Meters & Historical Curves", () => {
  beforeEach(() => {
    useLab.setState({
      meterHistory: {},
      timeMs: 0,
      mode: "run",
    });
  });

  describe("Catalog & Metadata", () => {
    it("should register voltmeter and ammeter in catalog", () => {
      expect(KINDS.voltmeter).toBeDefined();
      expect(KINDS.ammeter).toBeDefined();

      const vmItem = CATALOG.find((c) => c.kind === "voltmeter");
      const amItem = CATALOG.find((c) => c.kind === "ammeter");

      expect(vmItem).toBeDefined();
      expect(amItem).toBeDefined();
      expect(vmItem?.group).toBe("儀表與測量");
      expect(amItem?.group).toBe("儀表與測量");
    });

    it("should provide multi-language translations for meters", () => {
      setLang("en");
      expect(t("comp.voltmeter")).toBe("Voltmeter");
      expect(t("comp.ammeter")).toBe("Clamp Meter");
      expect(t("meters.voltageCurve")).toBe("Voltage Curve");
      expect(t("meters.max")).toBe("Max");

      setLang("zh");
      expect(t("comp.voltmeter")).toBe("電壓表");
      expect(t("comp.ammeter")).toBe("鉗形電流表");
      expect(t("meters.voltageCurve")).toBe("電壓歷史曲線");
      expect(t("meters.max")).toBe("最大值");
    });
  });

  describe("Voltmeter Calculations", () => {
    it("should calculate 480V line-to-line voltage", () => {
      const potsA: Potential[] = [{ kind: "L1", sourceId: "src1" }];
      const potsB: Potential[] = [{ kind: "L2", sourceId: "src1" }];
      expect(computeVoltage(potsA, potsB)).toBe(480);
    });

    it("should calculate 277V line-to-neutral voltage", () => {
      const potsA: Potential[] = [{ kind: "L1", sourceId: "src1" }];
      const potsB: Potential[] = [{ kind: "N", sourceId: "src1" }];
      expect(computeVoltage(potsA, potsB)).toBe(277);
    });

    it("should calculate 277V line-to-ground voltage", () => {
      const potsA: Potential[] = [{ kind: "L3", sourceId: "src1" }];
      const potsB: Potential[] = [{ kind: "PE", sourceId: "src1" }];
      expect(computeVoltage(potsA, potsB)).toBe(277);
    });

    it("should return 0V for same-phase or disconnected nodes", () => {
      const potsA: Potential[] = [{ kind: "L1", sourceId: "src1" }];
      const potsB: Potential[] = [{ kind: "L1", sourceId: "src1" }];
      expect(computeVoltage(potsA, potsB)).toBe(0);

      expect(computeVoltage([], potsA)).toBe(0);
      expect(computeVoltage([], [])).toBe(0);
    });

    it("should calculate 120V for transformer secondary", () => {
      const potsA: Potential[] = [{ kind: "L1", sourceId: "xf-tr1" }];
      const potsB: Potential[] = [{ kind: "N", sourceId: "xf-tr1" }];
      expect(computeVoltage(potsA, potsB)).toBe(120);
    });

    it("should simulate a live voltmeter in a circuit", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye" } },
          { id: "vm1", kind: "voltmeter", tag: "VM1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "vm1", variant: "body", x: 10, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "1" } },
          { id: "w2", a: { symbolId: "s1", term: "N" }, b: { symbolId: "s2", term: "2" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        vm1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.vm1.meterValue).toBe(277);
      expect(snap.runtime.vm1.meterUnit).toBe("V");
      expect(snap.runtime.vm1.energized).toBe(true);
    });

    it("should measure custom voltage set on 3-phase mains supply", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye", voltage: 380 } },
          { id: "vm1", kind: "voltmeter", tag: "VM1", params: {} },
          { id: "vm2", kind: "voltmeter", tag: "VM2", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "vm1", variant: "body", x: 10, y: 0, rot: 0 },
          { id: "s3", deviceId: "vm2", variant: "body", x: 10, y: 6, rot: 0 },
        ],
        wires: [
          // vm1: Line-to-Line (L1 to L2 -> 380V)
          { id: "w1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "1" } },
          { id: "w2", a: { symbolId: "s1", term: "L2" }, b: { symbolId: "s2", term: "2" } },
          // vm2: Line-to-Neutral (L1 to N -> 220V)
          { id: "w3", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s3", term: "1" } },
          { id: "w4", a: { symbolId: "s1", term: "N" }, b: { symbolId: "s3", term: "2" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        vm1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        vm2: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.vm1.meterValue).toBe(380);
      expect(snap.runtime.vm2.meterValue).toBe(220);
    });
  });

  describe("Ammeter Calculations", () => {
    it("should simulate an ammeter measuring lamp current", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye" } },
          { id: "am1", kind: "ammeter", tag: "AM1", params: {} },
          { id: "hl1", kind: "lamp", tag: "HL1", params: { color: "green" } },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "am1", variant: "body", x: 6, y: 0, rot: 0 },
          { id: "s3", deviceId: "hl1", variant: "body", x: 12, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "1" } },
          { id: "w2", a: { symbolId: "s2", term: "2" }, b: { symbolId: "s3", term: "1" } },
          { id: "w3", a: { symbolId: "s3", term: "2" }, b: { symbolId: "s1", term: "N" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        am1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        hl1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.hl1.lit).toBe(true);
      expect(snap.runtime.am1.meterValue).toBe(0.05);
      expect(snap.runtime.am1.meterUnit).toBe("A");
      expect(snap.runtime.am1.energized).toBe(true);
    });

    it("should measure 0A when circuit is open", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye" } },
          { id: "am1", kind: "ammeter", tag: "AM1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "am1", variant: "body", x: 6, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "1" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        am1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.am1.meterValue).toBe(0);
      expect(snap.runtime.am1.energized).toBe(false);
    });

    it("should measure current by clamping directly onto a wire without breaking the circuit", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye" } },
          { id: "m1", kind: "motor-3ph", tag: "M1", params: {} },
          { id: "cm1", kind: "ammeter", tag: "CM1", params: { clampedWireId: "w_main_l1" } },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "m1", variant: "body", x: 12, y: 0, rot: 0 },
          { id: "s3", deviceId: "cm1", variant: "body", x: 6, y: 0, rot: 0 },
        ],
        wires: [
          // Continuous direct unbroken wire between source and motor
          { id: "w_main_l1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "U" } },
          { id: "w_main_l2", a: { symbolId: "s1", term: "L2" }, b: { symbolId: "s2", term: "V" } },
          { id: "w_main_l3", a: { symbolId: "s1", term: "L3" }, b: { symbolId: "s2", term: "W" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        m1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        cm1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      // Motor runs and clamp meter measures 8.5A directly through clamped wire
      expect(snap.runtime.m1.energized).toBe(true);
      expect(snap.runtime.cm1.meterValue).toBe(8.5);
      expect(snap.runtime.cm1.meterUnit).toBe("A");
      expect(snap.runtime.cm1.energized).toBe(true);
    });

    it("should allow quick attaching clamp meter in store", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye" } },
          { id: "hl1", kind: "lamp", tag: "HL1", params: { color: "green" } },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "hl1", variant: "body", x: 10, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w_lamp_1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "1" } },
          { id: "w_lamp_2", a: { symbolId: "s2", term: "2" }, b: { symbolId: "s1", term: "N" } },
        ],
      };

      useLab.setState({
        circuit,
        mode: "run",
        meterHistory: {},
      });

      // Quick attach clamp meter to w_lamp_1
      useLab.getState().quickAttachClampMeter("w_lamp_1");

      const state = useLab.getState();
      const cmDev = state.circuit.devices.find((d) => d.kind === "ammeter");
      expect(cmDev).toBeDefined();
      expect(cmDev?.params.clampedWireId).toBe("w_lamp_1");

      // Step simulation
      state.step();
      const updatedRuntime = useLab.getState().snapshot.runtime;
      expect(updatedRuntime[cmDev!.id].meterValue).toBe(0.05);
      expect(updatedRuntime[cmDev!.id].energized).toBe(true);
    });

    it("should automatically detect wire under clamp meter symbol without explicit clampedWireId", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye", maxCurrent: 400 } },
          { id: "m1", kind: "motor-3ph", tag: "M1", params: {} },
          // No clampedWireId in params
          { id: "cm1", kind: "ammeter", tag: "CM1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "m1", variant: "body", x: 12, y: 0, rot: 0 },
          // Place symbol directly on the wire path
          { id: "s3", deviceId: "cm1", variant: "body", x: 5, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w_l1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "U" } },
          { id: "w_l2", a: { symbolId: "s1", term: "L2" }, b: { symbolId: "s2", term: "V" } },
          { id: "w_l3", a: { symbolId: "s1", term: "L3" }, b: { symbolId: "s2", term: "W" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        m1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        cm1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.m1.energized).toBe(true);
      expect(snap.runtime.cm1.meterValue).toBe(8.5);
      expect(snap.runtime.cm1.energized).toBe(true);
    });

    it("should measure transformer primary current when clamped onto transformer feed wire", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye", voltage: 480, maxCurrent: 400 } },
          { id: "tc1", kind: "transformer", tag: "TC1", params: { ratio: "480/120" } },
          { id: "cm1", kind: "ammeter", tag: "CM1", params: { clampedWireId: "w_h1" } },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "tc1", variant: "body", x: 10, y: 0, rot: 0 },
          { id: "s3", deviceId: "cm1", variant: "body", x: 5, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w_h1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "H1" } },
          { id: "w_h2", a: { symbolId: "s1", term: "L2" }, b: { symbolId: "s2", term: "H2" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        tc1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        cm1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.tc1.energized).toBe(true);
      expect(snap.runtime.cm1.meterValue).toBe(0.25);
      expect(snap.runtime.cm1.energized).toBe(true);
    });

    it("should scale branch current proportionally when motor rated power is changed", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye", voltage: 480, maxCurrent: 400 } },
          // Motor customized to 11 kW (approx double of default 5.5 kW)
          { id: "m1", kind: "motor-3ph", tag: "M1", params: { power: 11 } },
          { id: "cm1", kind: "ammeter", tag: "CM1", params: { clampedWireId: "w_l1" } },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "m1", variant: "body", x: 12, y: 0, rot: 0 },
          { id: "s3", deviceId: "cm1", variant: "body", x: 5, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w_l1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "U" } },
          { id: "w_l2", a: { symbolId: "s1", term: "L2" }, b: { symbolId: "s2", term: "V" } },
          { id: "w_l3", a: { symbolId: "s1", term: "L3" }, b: { symbolId: "s2", term: "W" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        m1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        cm1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.m1.energized).toBe(true);
      // 11 kW -> 17.0 A
      expect(snap.runtime.cm1.meterValue).toBe(17.0);
    });

    it("should compute single phase and DC motor current with custom power", () => {
      const circuit1ph: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye" } },
          // 1ph motor with 3.0 kW
          { id: "m1", kind: "motor-1ph", tag: "M1", params: { power: 3.0 } },
          { id: "cm1", kind: "ammeter", tag: "CM1", params: { clampedWireId: "w_u1" } },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "m1", variant: "body", x: 12, y: 0, rot: 0 },
          { id: "s3", deviceId: "cm1", variant: "body", x: 5, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w_u1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "U1" } },
          { id: "w_u2", a: { symbolId: "s1", term: "N" }, b: { symbolId: "s2", term: "U2" } },
        ],
      };

      const rt: Record<string, DeviceRuntime> = {
        g1: { energized: true, energizedAlt: false, actuated: false, on: true, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        m1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
        cm1: { energized: false, energizedAlt: false, actuated: false, on: false, tripped: false, position: 0, elapsedMs: 0, count: 0, done: false, rpm: 0, direction: 0, lit: false, prevEnergized: false, prevPulse: false, starDelta: null },
      };

      const snap = tick(circuit1ph, rt, { held: new Set(), process: { temperature: 20, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false } }, 50, 50);

      expect(snap.runtime.m1.energized).toBe(true);
      // 3.0 kW -> 8.4 A (3.0/1.5 * 4.2)
      expect(snap.runtime.cm1.meterValue).toBe(8.4);
    });
  });

  describe("Store Historical Data Points", () => {
    it("should record meter data points on simulation steps", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye" } },
          { id: "vm1", kind: "voltmeter", tag: "VM1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "g1", variant: "wye", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "vm1", variant: "body", x: 10, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s1", term: "L1" }, b: { symbolId: "s2", term: "1" } },
          { id: "w2", a: { symbolId: "s1", term: "N" }, b: { symbolId: "s2", term: "2" } },
        ],
      };

      useLab.setState({
        circuit,
        mode: "run",
        meterHistory: {},
        timeMs: 0,
      });

      // Run multiple steps
      useLab.getState().step();
      useLab.getState().step();
      useLab.getState().step();

      const history = useLab.getState().meterHistory.vm1;
      expect(history).toBeDefined();
      expect(history.length).toBe(3);
      expect(history[0].value).toBe(277);
      expect(history[2].value).toBe(277);
      expect(history[2].time).toBeGreaterThan(history[0].time);
    });

    it("should clear meter history when requested", () => {
      useLab.setState({
        meterHistory: {
          vm1: [{ time: 0.1, value: 277 }, { time: 0.2, value: 277 }],
          am1: [{ time: 0.1, value: 8.5 }],
        },
      });

      // Clear specific device
      useLab.getState().clearMeterHistory("vm1");
      expect(useLab.getState().meterHistory.vm1).toBeUndefined();
      expect(useLab.getState().meterHistory.am1).toBeDefined();

      // Clear all
      useLab.getState().clearMeterHistory();
      expect(Object.keys(useLab.getState().meterHistory).length).toBe(0);
    });

    it("should reset meter history on simulation reset", () => {
      useLab.setState({
        meterHistory: {
          vm1: [{ time: 0.1, value: 277 }],
        },
      });

      useLab.getState().resetSim();
      expect(Object.keys(useLab.getState().meterHistory).length).toBe(0);
    });
  });
});
