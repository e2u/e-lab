import { describe, expect, it } from "vitest";
import type { DeviceRuntime, SimSnapshot, WireLive } from "../types";
import { faultVisualKey, inspectorRuntimeKey, runtimeVisualKey, schematicVisualKey } from "./visualSnapshot";

function rt(patch: Partial<DeviceRuntime> = {}): DeviceRuntime {
  return {
    energized: false,
    energizedAlt: false,
    actuated: false,
    on: true,
    tripped: false,
    position: 0,
    elapsedMs: 0,
    count: 0,
    done: false,
    rpm: 0,
    direction: 0,
    lit: false,
    prevEnergized: false,
    prevPulse: false,
    starDelta: null,
    ...patch,
  };
}

function wire(patch: Partial<WireLive> = {}): WireLive {
  return { live: false, kind: null, dir: 0, ...patch };
}

function snap(runtime: Record<string, DeviceRuntime>, wires: Record<string, WireLive> = {}): SimSnapshot {
  return { runtime, wires, potentials: {}, faults: [], timeMs: 0 };
}

describe("schematic visual key", () => {
  it("ignores rpm creep once the rotor is already spinning", () => {
    const a = snap({ m: rt({ energized: true, direction: 1, rpm: 0.81 }) });
    const b = snap({ m: rt({ energized: true, direction: 1, rpm: 0.86 }) });
    expect(schematicVisualKey(a)).toBe(schematicVisualKey(b));
    expect(inspectorRuntimeKey(a.runtime)).not.toBe(inspectorRuntimeKey(b.runtime));
  });

  it("updates the schematic when spin crosses the bench threshold", () => {
    const stopped = snap({ m: rt({ energized: true, rpm: 0.05 }) });
    const spinning = snap({ m: rt({ energized: true, rpm: 0.25 }) });
    expect(runtimeVisualKey(stopped.runtime)).not.toBe(runtimeVisualKey(spinning.runtime));
  });

  it("buckets timer elapsed to the 0.1s badge", () => {
    const a = snap({ t: rt({ energized: true, elapsedMs: 1000 }) });
    const b = snap({ t: rt({ energized: true, elapsedMs: 1040 }) });
    const c = snap({ t: rt({ energized: true, elapsedMs: 1060 }) });
    expect(schematicVisualKey(a)).toBe(schematicVisualKey(b));
    expect(schematicVisualKey(a)).not.toBe(schematicVisualKey(c));
  });

  it("lets the bench ignore a running timer", () => {
    const a = { t: rt({ energized: true, elapsedMs: 1000 }) };
    const b = { t: rt({ energized: true, elapsedMs: 1600 }) };
    expect(runtimeVisualKey(a, { elapsed: false })).toBe(runtimeVisualKey(b, { elapsed: false }));
    expect(schematicVisualKey(snap(a))).not.toBe(schematicVisualKey(snap(b)));
  });

  it("tracks wire live state and coil pickup", () => {
    const dead = snap({ k: rt() }, { w: wire() });
    const live = snap({ k: rt({ energized: true }) }, { w: wire({ live: true, kind: "L1", dir: 1 }) });
    expect(schematicVisualKey(dead)).not.toBe(schematicVisualKey(live));
  });

  it("fingerprints the status-bar fault", () => {
    expect(faultVisualKey(undefined)).toBe("");
    expect(faultVisualKey({ level: "error", message: "短路", msgKey: "fault.shortCircuit", msgParams: { a: "L1", b: "L2" } }))
      .toBe(faultVisualKey({ level: "error", message: "短路", msgKey: "fault.shortCircuit", msgParams: { b: "L2", a: "L1" } }));
    expect(faultVisualKey({ message: "斷線", msgKey: "fault.brokenWire" }))
      .not.toBe(faultVisualKey({ message: "其他", msgKey: "fault.brokenWire" }));
  });
});
