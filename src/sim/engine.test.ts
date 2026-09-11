import { describe, expect, it } from "vitest";
import { addDevice, addSymbol, addWire, emptyCircuit, splitWireAt } from "../circuitBuilder";
import { GRID, type DeviceKind } from "../types";
import { KINDS } from "../catalog";
import { wireRoute } from "../geometry";
import { selectorReversing, selfHoldMotor, starDeltaStart } from "../examples";
import { createRuntime, emptySnapshot, PHASE_COLOR, tick } from "./engine";
import type { ProcessVars } from "../types";

const process: ProcessVars = {
  temperature: 25,
  pressure: 1,
  level: 20,
  flow: 0,
  limitHit: false,
  proxHit: false,
  photoHit: false,
};

function run(
  circuit: ReturnType<typeof emptyCircuit>,
  held: string[] = [],
  steps = 2,
  dt = 50,
) {
  let snap = tick(circuit, createRuntime(circuit), { held: new Set(held), process }, dt, 0);
  for (let i = 1; i < steps; i += 1) {
    snap = tick(circuit, snap.runtime, { held: new Set(held), process }, dt, i * dt);
  }
  return snap;
}

describe("sim engine", () => {
  it("lights a lamp through a NO pushbutton", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sb = addDevice(c, "pb-no", "PB1", "body", 4, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    addWire(c, g.symbol, "L1", sb.symbol, "1");
    addWire(c, sb.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");

    const off = run(c, []);
    expect(off.runtime[hl.device.id].lit).toBe(false);

    const on = run(c, [sb.device.id]);
    expect(on.runtime[hl.device.id].lit).toBe(true);
    const wL = c.wires[0];
    const wN = c.wires[2];
    expect(on.wires[wL.id].dir).toBe(1);
    expect(on.wires[wN.id].dir).toBe(1);
  });

  it("closes a temperature NO switch when process temperature exceeds setpoint", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const st = addDevice(c, "temp-no", "TAS1", "body", 6, 0, { setpoint: 60 });
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 0);
    addWire(c, g.symbol, "L1", st.symbol, "1");
    addWire(c, st.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    const cold = tick(c, createRuntime(c), { held: new Set(), process }, 50, 50);
    expect(cold.runtime[hl.device.id].lit).toBe(false);
    const hot = tick(c, createRuntime(c), { held: new Set(), process: { ...process, temperature: 80 } }, 50, 50);
    expect(hot.runtime[st.device.id].actuated).toBe(true);
    expect(hot.runtime[hl.device.id].lit).toBe(true);
  });

  it("animates L→N even if a return wire is drawn N first", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    addWire(c, g.symbol, "N", hl.symbol, "2");
    addWire(c, hl.symbol, "1", g.symbol, "L1");
    const snap = run(c, [], 3);
    const toLamp = c.wires[1];
    const fromLamp = c.wires[0];
    expect(snap.runtime[hl.device.id].lit).toBe(true);
    expect(snap.wires[toLamp.id].dir).toBe(-1);
    expect(snap.wires[fromLamp.id].dir).toBe(-1);
  });

  it("NC stop is closed until pressed", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sb = addDevice(c, "pb-nc", "PB1", "body", 4, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    addWire(c, g.symbol, "L1", sb.symbol, "1");
    addWire(c, sb.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");

    expect(run(c, []).runtime[hl.device.id].lit).toBe(true);
    expect(run(c, [sb.device.id]).runtime[hl.device.id].lit).toBe(false);
  });

  it("holds a contactor after start is released", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const stop = addDevice(c, "pb-nc", "PB1", "body", 4, 0);
    const start = addDevice(c, "pb-no", "PB2", "body", 8, 0);
    const km = addDevice(c, "contactor", "M1", "coil", 12, 0);
    const aux = addSymbol(c, km.device.id, "aux-no", 8, 4);

    addWire(c, g.symbol, "L1", stop.symbol, "1");
    addWire(c, stop.symbol, "2", start.symbol, "1");
    addWire(c, stop.symbol, "2", aux, "13");
    addWire(c, start.symbol, "2", km.symbol, "A1");
    addWire(c, aux, "14", km.symbol, "A1");
    addWire(c, km.symbol, "A2", g.symbol, "N");

    let snap = run(c, []);
    expect(snap.runtime[km.device.id].energized).toBe(false);

    snap = tick(c, snap.runtime, { held: new Set([start.device.id]), process }, 50, 50);
    snap = tick(c, snap.runtime, { held: new Set([start.device.id]), process }, 50, 100);
    expect(snap.runtime[km.device.id].energized).toBe(true);

    snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 150);
    snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 200);
    expect(snap.runtime[km.device.id].energized).toBe(true);

    snap = tick(c, snap.runtime, { held: new Set([stop.device.id]), process }, 50, 250);
    snap = tick(c, snap.runtime, { held: new Set([stop.device.id]), process }, 50, 300);
    expect(snap.runtime[km.device.id].energized).toBe(false);
  });

  it("runs a 3-phase motor forward and reverse", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const m = addDevice(c, "motor-3ph", "MTR1", "body", 8, 0);
    addWire(c, g.symbol, "L1", m.symbol, "U");
    addWire(c, g.symbol, "L2", m.symbol, "V");
    addWire(c, g.symbol, "L3", m.symbol, "W");
    const fwd = run(c, [], 8);
    expect(fwd.runtime[m.device.id].energized).toBe(true);
    expect(fwd.runtime[m.device.id].direction).toBe(1);

    const c2 = emptyCircuit();
    const g2 = addDevice(c2, "mains-3ph", "PWR2", "body", 0, 0);
    const m2 = addDevice(c2, "motor-3ph", "MTR2", "body", 8, 0);
    addWire(c2, g2.symbol, "L1", m2.symbol, "U");
    addWire(c2, g2.symbol, "L3", m2.symbol, "V");
    addWire(c2, g2.symbol, "L2", m2.symbol, "W");
    const rev = run(c2, [], 8);
    expect(rev.runtime[m2.device.id].direction).toBe(-1);
  });

  it("isolates transformer secondary until primary is live", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const tc = addDevice(c, "transformer", "T1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);
    addWire(c, g.symbol, "L1", tc.symbol, "H1");
    addWire(c, g.symbol, "L2", tc.symbol, "H2");
    addWire(c, tc.symbol, "X1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", tc.symbol, "X2");
    expect(run(c).runtime[hl.device.id].lit).toBe(true);
  });

  it("delays a TON contact", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const kt = addDevice(c, "timer-on", "KT1", "coil", 6, 0, { delayMs: 120 });
    const ktNo = addSymbol(c, kt.device.id, "delayed-no", 10, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);
    addWire(c, g.symbol, "L1", kt.symbol, "A1");
    addWire(c, kt.symbol, "A2", g.symbol, "N");
    addWire(c, g.symbol, "L1", ktNo, "15");
    addWire(c, ktNo, "18", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");

    const early = run(c, [], 1, 50);
    expect(early.runtime[kt.device.id].done).toBe(false);
    expect(early.runtime[hl.device.id].lit).toBe(false);

    const late = run(c, [], 6, 50);
    expect(late.runtime[kt.device.id].done).toBe(true);
    expect(late.runtime[hl.device.id].lit).toBe(true);
  });

  it("opens overload 95-96 when tripped", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const fr = addDevice(c, "overload", "OL1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);
    addWire(c, g.symbol, "L1", fr.symbol, "95");
    addWire(c, fr.symbol, "96", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");

    expect(run(c).runtime[hl.device.id].lit).toBe(true);
    const rt = createRuntime(c);
    rt[fr.device.id].tripped = true;
    const snap = tick(c, rt, { held: new Set(), process }, 50, 50);
    expect(snap.runtime[hl.device.id].lit).toBe(false);
  });

  it("closes overload 97-98 when tripped", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const fr = addDevice(c, "overload", "OL1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);
    addWire(c, g.symbol, "L1", fr.symbol, "97");
    addWire(c, fr.symbol, "98", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");

    expect(run(c).runtime[hl.device.id].lit).toBe(false);
    const rt = createRuntime(c);
    rt[fr.device.id].tripped = true;
    const snap = tick(c, rt, { held: new Set(), process }, 50, 50);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
  });

  it("closes timer instantaneous 21-24 while the coil is on", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const kt = addDevice(c, "timer-on", "KT1", "coil", 6, 0, { delayMs: 5000 });
    const ktInst = addSymbol(c, kt.device.id, "inst-no", 10, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);
    addWire(c, g.symbol, "L1", kt.symbol, "A1");
    addWire(c, kt.symbol, "A2", g.symbol, "N");
    addWire(c, g.symbol, "L1", ktInst, "21");
    addWire(c, ktInst, "24", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, [], 2, 50).runtime[hl.device.id].lit).toBe(true);
  });

  it("keeps e-stop NC 11-12 closed until latched", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sb = addDevice(c, "estop-nc", "PB0", "body", 4, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    addWire(c, g.symbol, "L1", sb.symbol, "11");
    addWire(c, sb.symbol, "12", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, []).runtime[hl.device.id].lit).toBe(true);
    const rt = createRuntime(c);
    rt[sb.device.id].actuated = true;
    const snap = tick(c, rt, { held: new Set(), process }, 50, 50);
    expect(snap.runtime[hl.device.id].lit).toBe(false);
  });

  it("closes e-stop NO 13-14 when latched", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sb = addDevice(c, "estop-no", "PB1", "body", 4, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    addWire(c, g.symbol, "L1", sb.symbol, "13");
    addWire(c, sb.symbol, "14", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, []).runtime[hl.device.id].lit).toBe(false);
    const rt = createRuntime(c);
    rt[sb.device.id].actuated = true;
    const snap = tick(c, rt, { held: new Set(), process }, 50, 50);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
  });

  it("closes a foot-switch NO while held", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const fs = addDevice(c, "foot-no", "FTS1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 0);
    addWire(c, g.symbol, "L1", fs.symbol, "1");
    addWire(c, fs.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, []).runtime[hl.device.id].lit).toBe(false);
    expect(run(c, [fs.device.id]).runtime[hl.device.id].lit).toBe(true);
  });

  it("opens a foot-switch NC while held", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const fs = addDevice(c, "foot-nc", "FTS1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 0);
    addWire(c, g.symbol, "L1", fs.symbol, "1");
    addWire(c, fs.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, []).runtime[hl.device.id].lit).toBe(true);
    expect(run(c, [fs.device.id]).runtime[hl.device.id].lit).toBe(false);
  });

  it("closes an SPST toggle when thrown", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sw = addDevice(c, "toggle-spst", "TGS1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 0);
    addWire(c, g.symbol, "L1", sw.symbol, "1");
    addWire(c, sw.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c).runtime[hl.device.id].lit).toBe(false);
    const rt = createRuntime(c);
    rt[sw.device.id].actuated = true;
    expect(tick(c, rt, { held: new Set(), process }, 50, 50).runtime[hl.device.id].lit).toBe(true);
  });

  it("throws an SPDT toggle from NC to NO", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sw = addDevice(c, "toggle-spdt", "TGS1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 0);
    addWire(c, g.symbol, "L1", sw.symbol, "1");
    addWire(c, sw.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c).runtime[hl.device.id].lit).toBe(true);
    const rt = createRuntime(c);
    rt[sw.device.id].actuated = true;
    expect(tick(c, rt, { held: new Set(), process }, 50, 50).runtime[hl.device.id].lit).toBe(false);
  });

  it("closes both poles of a DPST toggle when thrown", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sw = addDevice(c, "toggle-dpst", "TGS1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 0);
    addWire(c, g.symbol, "L1", sw.symbol, "1");
    addWire(c, sw.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c).runtime[hl.device.id].lit).toBe(false);
    const rt = createRuntime(c);
    rt[sw.device.id].actuated = true;
    expect(tick(c, rt, { held: new Set(), process }, 50, 50).runtime[hl.device.id].lit).toBe(true);
  });

  it("runs the textbook DOL self-hold example", () => {
    const c = selfHoldMotor();
    const start = c.devices.find((d) => d.tag === "PB2")!;
    const stop = c.devices.find((d) => d.tag === "PB1")!;
    const km = c.devices.find((d) => d.kind === "contactor" && d.tag === "M1")!;
    const motor = c.devices.find((d) => d.kind === "motor-3ph")!;
    const lamp = c.devices.find((d) => d.tag === "LT1")!;

    let snap = run(c, []);
    expect(snap.runtime[km.id].energized).toBe(false);

    snap = tick(c, snap.runtime, { held: new Set([start.id]), process }, 50, 50);
    snap = tick(c, snap.runtime, { held: new Set([start.id]), process }, 50, 100);
    snap = tick(c, snap.runtime, { held: new Set([start.id]), process }, 50, 150);
    expect(snap.runtime[km.id].energized).toBe(true);
    expect(snap.runtime[lamp.id].lit).toBe(true);

    snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 200);
    snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 250);
    expect(snap.runtime[km.id].energized).toBe(true);
    expect(snap.runtime[motor.id].energized).toBe(true);
    expect(snap.runtime[motor.id].direction).toBe(1);

    snap = tick(c, snap.runtime, { held: new Set([stop.id]), process }, 50, 300);
    snap = tick(c, snap.runtime, { held: new Set([stop.id]), process }, 50, 350);
    expect(snap.runtime[km.id].energized).toBe(false);
    expect(snap.runtime[motor.id].energized).toBe(false);
  });

  it("opens a broken wire", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    addWire(c, g.symbol, "L1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c).runtime[hl.device.id].lit).toBe(true);
    c.wires[0].broken = true;
    expect(run(c).runtime[hl.device.id].lit).toBe(false);
  });

  it("keeps a welded contactor closed after the coil drops", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const km = addDevice(c, "contactor", "M1", "coil", 6, 0);
    const main = addSymbol(c, km.device.id, "main", 12, 0);
    const m = addDevice(c, "motor-3ph", "MTR1", "body", 20, 0);
    addWire(c, g.symbol, "L1", km.symbol, "A1");
    addWire(c, km.symbol, "A2", g.symbol, "N");
    addWire(c, g.symbol, "L1", main, "L1");
    addWire(c, g.symbol, "L2", main, "L2");
    addWire(c, g.symbol, "L3", main, "L3");
    addWire(c, main, "T1", m.symbol, "U");
    addWire(c, main, "T2", m.symbol, "V");
    addWire(c, main, "T3", m.symbol, "W");

    let snap = run(c, [], 3);
    expect(snap.runtime[km.device.id].energized).toBe(true);
    expect(snap.runtime[m.device.id].energized).toBe(true);

    km.device.params.welded = true;
    c.wires = c.wires.filter((w) => w.a.term !== "A1" && w.b.term !== "A1");
    snap = run(c, [], 4);
    expect(snap.runtime[km.device.id].energized).toBe(false);
    expect(snap.runtime[m.device.id].energized).toBe(true);
  });

  it("switches star-delta after the timer", () => {
    const c = starDeltaStart();
    const kt = c.devices.find((d) => d.tag === "TR1")!;
    kt.params.delayMs = 400;
    const start = c.devices.find((d) => d.tag === "PB2")!;
    const kmL = c.devices.find((d) => d.kind === "contactor" && d.tag === "M1")!;
    const kmY = c.devices.find((d) => d.kind === "contactor" && d.tag === "M2")!;
    const kmD = c.devices.find((d) => d.kind === "contactor" && d.tag === "M3")!;
    const motor = c.devices.find((d) => d.kind === "motor-3ph")!;

    let snap = run(c, [start.id], 5, 50);
    expect(snap.runtime[kmL.id].energized).toBe(true);
    expect(snap.runtime[kmY.id].energized).toBe(true);
    expect(snap.runtime[kmD.id].energized).toBe(false);
    expect(snap.runtime[motor.id].energized).toBe(true);

    snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 300);
    for (let i = 0; i < 16; i += 1) {
      snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 350 + i * 50);
    }
    expect(snap.runtime[kmL.id].energized).toBe(true);
    expect(snap.runtime[kmY.id].energized).toBe(false);
    expect(snap.runtime[kmD.id].energized).toBe(true);
    expect(snap.runtime[motor.id].energized).toBe(true);
  });

  it("uses delayed NC 15-16 before a TON times out", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const kt = addDevice(c, "timer-on", "KT1", "coil", 6, 0, { delayMs: 200 });
    const ktNc = addSymbol(c, kt.device.id, "delayed-nc", 10, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);
    addWire(c, g.symbol, "L1", kt.symbol, "A1");
    addWire(c, kt.symbol, "A2", g.symbol, "N");
    addWire(c, g.symbol, "L1", ktNc, "15");
    addWire(c, ktNc, "16", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");

    const early = run(c, [], 2, 50);
    expect(early.runtime[hl.device.id].lit).toBe(true);
    const late = run(c, [], 8, 50);
    expect(late.runtime[kt.device.id].done).toBe(true);
    expect(late.runtime[hl.device.id].lit).toBe(false);
  });

  it("reverses a motor with a FWD-OFF-REV selector", () => {
    const c = selectorReversing();
    const start = c.devices.find((d) => d.tag === "START")!;
    const stop = c.devices.find((d) => d.tag === "STOP")!;
    const sa = c.devices.find((d) => d.tag === "SS1")!;
    const f = c.devices.find((d) => d.tag === "F")!;
    const r = c.devices.find((d) => d.tag === "R")!;
    const motor = c.devices.find((d) => d.kind === "motor-3ph")!;

    const rt = createRuntime(c);
    rt[sa.id].position = 1;
    let snap = tick(c, rt, { held: new Set([start.id]), process }, 50, 50);
    for (let i = 0; i < 4; i += 1) {
      snap = tick(c, snap.runtime, { held: new Set([start.id]), process }, 50, 100 + i * 50);
    }
    expect(snap.runtime[f.id].energized).toBe(true);
    expect(snap.runtime[r.id].energized).toBe(false);
    expect(snap.runtime[motor.id].direction).toBe(1);

    snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 400);
    snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 450);
    expect(snap.runtime[f.id].energized).toBe(true);

    snap = tick(c, snap.runtime, { held: new Set([stop.id]), process }, 50, 500);
    snap = tick(c, snap.runtime, { held: new Set([stop.id]), process }, 50, 550);
    expect(snap.runtime[f.id].energized).toBe(false);

    snap.runtime[sa.id].position = 2;
    snap = tick(c, snap.runtime, { held: new Set([start.id]), process }, 50, 600);
    for (let i = 0; i < 4; i += 1) {
      snap = tick(c, snap.runtime, { held: new Set([start.id]), process }, 50, 650 + i * 50);
    }
    expect(snap.runtime[r.id].energized).toBe(true);
    expect(snap.runtime[f.id].energized).toBe(false);
    expect(snap.runtime[motor.id].direction).toBe(-1);
  });

  it("supports wiring to both COM (top-left) and COM2 (bottom-left) on selector-3", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const sa = addDevice(c, "selector-3", "SS1", "body", 6, 0);
    const hlF = addDevice(c, "lamp", "LT_F", "body", 16, 0);
    const hlR = addDevice(c, "lamp", "LT_R", "body", 16, 6);

    // Wire power directly to bottom-left terminal COM2
    addWire(c, g.symbol, "L1", sa.symbol, "COM2");
    addWire(c, sa.symbol, "FWD", hlF.symbol, "1");
    addWire(c, hlF.symbol, "2", g.symbol, "N");
    addWire(c, sa.symbol, "REV", hlR.symbol, "1");
    addWire(c, hlR.symbol, "2", g.symbol, "N");

    const rt = createRuntime(c);
    // Position 0 (OFF)
    rt[sa.device.id].position = 0;
    let snap = tick(c, rt, { held: new Set(), process }, 50, 50);
    expect(snap.runtime[hlF.device.id].lit).toBe(false);
    expect(snap.runtime[hlR.device.id].lit).toBe(false);

    // Position 1 (FWD)
    rt[sa.device.id].position = 1;
    snap = tick(c, rt, { held: new Set(), process }, 50, 100);
    expect(snap.runtime[hlF.device.id].lit).toBe(true);
    expect(snap.runtime[hlR.device.id].lit).toBe(false);

    // Position 2 (REV)
    rt[sa.device.id].position = 2;
    snap = tick(c, rt, { held: new Set(), process }, 50, 150);
    expect(snap.runtime[hlF.device.id].lit).toBe(false);
    expect(snap.runtime[hlR.device.id].lit).toBe(true);
  });

  it("connects distant halves through matching net labels", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const a = addDevice(c, "net-label", "L1", "body", 4, 0);
    const b = addDevice(c, "net-label", "L1", "body", 20, 0);
    const n = addDevice(c, "net-label", "N", "body", 20, 4);
    const hl = addDevice(c, "lamp", "LT1", "body", 24, 0);
    addWire(c, g.symbol, "L1", a.symbol, "1");
    addWire(c, g.symbol, "N", n.symbol, "1");
    addWire(c, b.symbol, "1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", n.symbol, "1");

    const snap = run(c, [], 2);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
    expect(snap.runtime[a.device.id].energized).toBe(true);
    expect(snap.runtime[b.device.id].energized).toBe(true);
    const feed = c.wires[2];
    const ret = c.wires[3];
    expect(snap.wires[feed.id].live).toBe(true);
    expect(snap.wires[feed.id].dir).toBe(1);
    expect(snap.wires[ret.id].dir).toBe(1);
  });

  it("does not bridge net labels with different or empty tags", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const a = addDevice(c, "net-label", "L1", "body", 4, 0);
    const other = addDevice(c, "net-label", "L2", "body", 20, 0);
    const blank = addDevice(c, "net-label", "  ", "body", 20, 2);
    const blank2 = addDevice(c, "net-label", "", "body", 22, 2);
    const hl = addDevice(c, "lamp", "LT1", "body", 24, 0);
    addWire(c, g.symbol, "L1", a.symbol, "1");
    addWire(c, other.symbol, "1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    addWire(c, blank.symbol, "1", blank2.symbol, "1");

    const snap = run(c, [], 2);
    expect(snap.runtime[hl.device.id].lit).toBe(false);
    expect(snap.runtime[other.device.id].energized).toBe(false);
    expect(snap.runtime[blank.device.id].energized).toBe(false);
  });

  it("lights a lamp tapped off the middle of another wire", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 20, 2);
    const hl2 = addDevice(c, "lamp", "LT2", "body", 12, 10);
    addWire(c, g.symbol, "L1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    addWire(c, hl2.symbol, "2", g.symbol, "N");
    const feed = c.wires[0];
    const pts = wireRoute(c, feed.a, feed.b);
    const mid = pts[Math.floor(pts.length / 2)];
    const port = splitWireAt(c, feed.id, Math.round(mid.x / GRID), Math.round(mid.y / GRID));
    expect(port).not.toBeNull();
    addWire(c, port!.symbolId, port!.term, hl2.symbol, "1");
    const snap = run(c, [], 2);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
    expect(snap.runtime[hl2.device.id].lit).toBe(true);
  });

  it("seeds PE potential from a ground component and tracks energized state", () => {
    const c = emptyCircuit();
    const gnd = addDevice(c, "ground", "GND1", "body", 0, 0);
    const nl = addDevice(c, "net-label", "PE", "body", 6, 0);
    addWire(c, gnd.symbol, "1", nl.symbol, "1");

    const snap = run(c, [], 2);
    expect(snap.runtime[gnd.device.id].energized).toBe(true);
    expect(snap.runtime[nl.device.id].energized).toBe(true);
    const w = c.wires[0];
    expect(snap.wires[w.id].kind).toBe("PE");
  });

  it("supports Wye and Delta supply modes for 3-phase mains", () => {
    const cWye = emptyCircuit();
    const gWye = addDevice(cWye, "mains-3ph", "PWR1", "wye", 0, 0, { supplyType: "wye" });
    const hlWye = addDevice(cWye, "lamp", "LT1", "body", 6, 0);
    addWire(cWye, gWye.symbol, "L1", hlWye.symbol, "1");
    addWire(cWye, hlWye.symbol, "2", gWye.symbol, "N");

    const snapWye = run(cWye, [], 2);
    expect(snapWye.runtime[hlWye.device.id].lit).toBe(true);

    const cDelta = emptyCircuit();
    const gDelta = addDevice(cDelta, "mains-3ph", "PWR2", "delta", 0, 0, { supplyType: "delta" });
    const mDelta = addDevice(cDelta, "motor-3ph", "MTR1", "body", 10, 0);
    addWire(cDelta, gDelta.symbol, "L1", mDelta.symbol, "U");
    addWire(cDelta, gDelta.symbol, "L2", mDelta.symbol, "V");
    addWire(cDelta, gDelta.symbol, "L3", mDelta.symbol, "W");

    const snapDelta = run(cDelta, [], 2);
    expect(snapDelta.runtime[mDelta.device.id].direction).toBe(1);
    expect(snapDelta.runtime[mDelta.device.id].energized).toBe(true);
  });

  it("does not trigger short circuit when multiple PE grounds connect together", () => {
    const c = emptyCircuit();
    const gMains = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0, { supplyType: "delta" });
    const gnd = addDevice(c, "ground", "GND1", "body", 6, 6);
    const nl = addDevice(c, "net-label", "G", "body", 6, 2);

    addWire(c, gMains.symbol, "PE", nl.symbol, "1");
    addWire(c, gnd.symbol, "1", nl.symbol, "1");

    const snap = run(c, [], 2);
    const shortFaults = snap.faults.filter((f) => f.msgKey === "fault.shortCircuit");
    expect(shortFaults.length).toBe(0);
    expect(snap.runtime[gMains.device.id].short).toBeFalsy();
    expect(snap.runtime[gnd.device.id].short).toBeFalsy();
    expect(Object.values(snap.wires).every((w) => !w.short)).toBe(true);
  });

  it("does not trigger short circuit when transformer secondary X2 is connected to ground PE", () => {
    const c = emptyCircuit();
    const gMains = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0, { supplyType: "delta" });
    const pe1 = addDevice(c, "ground", "GND1", "body", 6, 12);
    const nlG = addDevice(c, "net-label", "G", "body", 6, 10);
    const nlL1 = addDevice(c, "net-label", "L1", "body", 10, 0);
    const nlL2 = addDevice(c, "net-label", "L2", "body", 10, 2);

    // Mains ground and phases
    addWire(c, gMains.symbol, "PE", nlG.symbol, "1");
    addWire(c, pe1.symbol, "1", nlG.symbol, "1");
    addWire(c, gMains.symbol, "L1", nlL1.symbol, "1");
    addWire(c, gMains.symbol, "L2", nlL2.symbol, "1");

    // Transformer
    const tc1 = addDevice(c, "transformer", "T1", "body", 16, 4);
    const tcL1 = addDevice(c, "net-label", "L1", "body", 16, 0);
    const tcL2 = addDevice(c, "net-label", "L2", "body", 14, 0);
    addWire(c, tcL1.symbol, "1", tc1.symbol, "H1");
    addWire(c, tcL2.symbol, "1", tc1.symbol, "H2");

    // Secondary X1 -> A1, X2 -> A2 and PE2
    const nlA1 = addDevice(c, "net-label", "A1", "body", 16, 10);
    const nlA2 = addDevice(c, "net-label", "A2", "body", 14, 10);
    const pe2 = addDevice(c, "ground", "GND2", "body", 12, 10);
    addWire(c, tc1.symbol, "X1", nlA1.symbol, "1");
    addWire(c, tc1.symbol, "X2", nlA2.symbol, "1");
    addWire(c, pe2.symbol, "1", nlA2.symbol, "1");

    // Load between A1 and A2
    const hl = addDevice(c, "lamp", "LT1", "body", 22, 10);
    const loadA1 = addDevice(c, "net-label", "A1", "body", 22, 8);
    const loadA2 = addDevice(c, "net-label", "A2", "body", 22, 12);
    addWire(c, loadA1.symbol, "1", hl.symbol, "1");
    addWire(c, loadA2.symbol, "1", hl.symbol, "2");

    const snap = run(c, [], 2);
    const shortFaults = snap.faults.filter((f) => f.msgKey === "fault.shortCircuit");
    expect(shortFaults.length).toBe(0);
    expect(snap.runtime[tc1.device.id].short).toBeFalsy();
    expect(snap.runtime[pe2.device.id].short).toBeFalsy();
    expect(snap.runtime[hl.device.id].lit).toBe(true);
    expect(Object.values(snap.wires).every((w) => !w.short)).toBe(true);
  });

  it("detects short circuit when BOTH X1 and X2 of transformer secondary are connected to PE", () => {
    const c = emptyCircuit();
    const gMains = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0, { supplyType: "delta" });
    const tc1 = addDevice(c, "transformer", "T1", "body", 10, 0);
    addWire(c, gMains.symbol, "L1", tc1.symbol, "H1");
    addWire(c, gMains.symbol, "L2", tc1.symbol, "H2");

    const pe = addDevice(c, "ground", "GND", "body", 10, 8);
    // Short secondary by connecting both X1 and X2 to the same PE ground
    addWire(c, tc1.symbol, "X1", pe.symbol, "1");
    addWire(c, tc1.symbol, "X2", pe.symbol, "1");

    const snap = run(c, [], 2);
    const shortFaults = snap.faults.filter((f) => f.msgKey === "fault.shortCircuit");
    expect(shortFaults.length).toBeGreaterThan(0);
    expect(snap.runtime[tc1.device.id].short).toBe(true);
  });

  it("detects direct short circuits and flags runtime and wires with short strobe state", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "wye", 0, 0);
    // Directly short L1 and L2
    addWire(c, g.symbol, "L1", g.symbol, "L2");

    const snap = run(c, [], 2);
    const shortFaults = snap.faults.filter((f) => f.msgKey === "fault.shortCircuit");
    expect(shortFaults.length).toBeGreaterThan(0);
    expect(snap.runtime[g.device.id].short).toBe(true);
    expect(snap.wires[c.wires[0].id].short).toBe(true);
  });

  it("treats each overload 95-96 symbol as its own pole so two copies do not short X1 to X2", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0, { supplyType: "delta" });
    const xf = addDevice(c, "transformer", "T1", "body", 6, 0);
    addWire(c, g.symbol, "L1", xf.symbol, "H1");
    addWire(c, g.symbol, "L2", xf.symbol, "H2");

    const stop = addDevice(c, "pb-nc", "Stop", "body", 2, 10);
    const start = addDevice(c, "pb-no", "Start", "body", 6, 10);
    const ol1 = addDevice(c, "overload", "OL1", "body", 20, 0);
    const ol2 = addDevice(c, "overload", "OL2", "body", 26, 0);
    const ol1Start = addSymbol(c, ol1.device.id, "aux-nc", 10, 10);
    const ol2Start = addSymbol(c, ol2.device.id, "aux-nc", 10, 12);
    const cr = addDevice(c, "relay", "CR1", "coil", 14, 10);
    const m1 = addDevice(c, "contactor", "M1", "coil", 18, 10);
    const m2 = addDevice(c, "contactor", "M2", "coil", 18, 14);
    const ol1Coil = addSymbol(c, ol1.device.id, "aux-nc", 22, 10);
    const ol2Coil = addSymbol(c, ol2.device.id, "aux-nc", 22, 14);

    addWire(c, xf.symbol, "X1", stop.symbol, "1");
    addWire(c, stop.symbol, "2", start.symbol, "1");
    addWire(c, start.symbol, "2", ol1Start, "95");
    addWire(c, start.symbol, "2", ol2Start, "95");
    addWire(c, ol1Start, "96", cr.symbol, "A1");
    addWire(c, ol2Start, "96", cr.symbol, "A1");
    addWire(c, cr.symbol, "A1", m1.symbol, "A1");
    addWire(c, cr.symbol, "A1", m2.symbol, "A1");
    addWire(c, cr.symbol, "A2", xf.symbol, "X2");
    addWire(c, m1.symbol, "A2", ol1Coil, "95");
    addWire(c, ol1Coil, "96", xf.symbol, "X2");
    addWire(c, m2.symbol, "A2", ol2Coil, "95");
    addWire(c, ol2Coil, "96", xf.symbol, "X2");

    const idle = run(c, []);
    expect(idle.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);

    const started = run(c, [start.device.id]);
    expect(started.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);
    expect(started.runtime[cr.device.id].energized).toBe(true);
    expect(started.runtime[m1.device.id].energized).toBe(true);
    expect(started.runtime[m2.device.id].energized).toBe(true);

    const tripped = createRuntime(c);
    tripped[ol1.device.id].tripped = true;
    const afterTrip = tick(c, tripped, { held: new Set([start.device.id]), process }, 50, 50);
    expect(afterTrip.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);
    expect(afterTrip.runtime[m1.device.id].energized).toBe(false);
  });

  describe("parallel aux contacts do not short", () => {
    function shorts(snap: ReturnType<typeof run>) {
      return snap.faults.filter((f) => f.msgKey === "fault.shortCircuit");
    }

    const CASES: {
      kind: DeviceKind;
      hostVariant: string;
      contactVariant: string;
      label: string;
    }[] = [];
    for (const kind of ["contactor", "relay", "timer-on", "timer-off", "overload"] as const) {
      const hostVariant = kind === "overload" ? "body" : "coil";
      for (const contactVariant of Object.keys(KINDS[kind].variants)) {
        if (contactVariant === "coil" || contactVariant === "body" || contactVariant === "main") continue;
        CASES.push({ kind, hostVariant, contactVariant, label: `${kind} ${contactVariant}` });
      }
    }

    function build(kind: DeviceKind, hostVariant: string, contactVariant: string, layout: "parallel" | "split") {
      const terms = KINDS[kind].variants[contactVariant].terminals.map((t) => t.id);
      const tA = terms[0];
      const tB = terms[terms.length - 1];
      const c = emptyCircuit();
      const g = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0, { supplyType: "delta" });
      const xf = addDevice(c, "transformer", "T1", "body", 4, 0);
      addWire(c, g.symbol, "L1", xf.symbol, "H1");
      addWire(c, g.symbol, "L2", xf.symbol, "H2");
      const host = addDevice(c, kind, "D1", hostVariant, 8, 0, kind.startsWith("timer") ? { delayMs: 80 } : {});
      const p1 = addSymbol(c, host.device.id, contactVariant, 8, 8);
      const p2 = addSymbol(c, host.device.id, contactVariant, 8, 12);
      const hl = addDevice(c, "lamp", "LT1", "body", 16, 8);
      if (layout === "parallel") {
        addWire(c, xf.symbol, "X1", p1, tA);
        addWire(c, xf.symbol, "X1", p2, tA);
        addWire(c, p1, tB, hl.symbol, "1");
        addWire(c, p2, tB, hl.symbol, "1");
        addWire(c, hl.symbol, "2", xf.symbol, "X2");
      } else {
        addWire(c, xf.symbol, "X1", p1, tA);
        addWire(c, p1, tB, hl.symbol, "1");
        addWire(c, hl.symbol, "2", p2, tA);
        addWire(c, p2, tB, xf.symbol, "X2");
      }
      return { c, xf, host, hl };
    }

    function activate(c: ReturnType<typeof emptyCircuit>, hostId: string, kind: DeviceKind, contactVariant: string) {
      if (kind === "overload") {
        const rt = createRuntime(c);
        rt[hostId].tripped = true;
        return tick(c, rt, { held: new Set(), process }, 50, 50);
      }
      const hostSym = c.symbols.find((s) => s.deviceId === hostId && s.variant === "coil");
      const xf = c.devices.find((d) => d.kind === "transformer")!;
      const xfSym = c.symbols.find((s) => s.deviceId === xf.id)!;
      if (hostSym) {
        addWire(c, xfSym, "X1", hostSym, "A1");
        addWire(c, hostSym, "A2", xfSym, "X2");
      }
      const steps = kind.startsWith("timer") && contactVariant.startsWith("delayed") ? 6 : 3;
      return run(c, [], steps, 50);
    }

    it("covers every attachable NC/NO/timer contact variant", () => {
      expect(CASES.map((x) => x.label).sort()).toEqual(
        [
          "contactor aux-nc",
          "contactor aux-nc2",
          "contactor aux-no",
          "contactor aux-no2",
          "overload aux-nc",
          "overload aux-no",
          "relay aux-nc",
          "relay aux-nc2",
          "relay aux-no",
          "relay aux-no2",
          "timer-off delayed-nc",
          "timer-off delayed-no",
          "timer-off inst-nc",
          "timer-off inst-no",
          "timer-on delayed-nc",
          "timer-on delayed-no",
          "timer-on inst-nc",
          "timer-on inst-no",
        ].sort(),
      );
    });

    for (const layout of ["parallel", "split"] as const) {
      for (const spec of CASES) {
        it(`${spec.label} two copies ${layout} never short X1/X2`, () => {
          const idleClosed = spec.contactVariant.includes("-nc");
          const { c, host, hl } = build(spec.kind, spec.hostVariant, spec.contactVariant, layout);
          const idle = run(c, []);
          expect(shorts(idle), `${spec.label} idle ${layout}`).toHaveLength(0);
          expect(idle.runtime[hl.device.id].lit).toBe(idleClosed);

          const active = activate(c, host.device.id, spec.kind, spec.contactVariant);
          expect(shorts(active), `${spec.label} active ${layout}`).toHaveLength(0);
          expect(active.runtime[hl.device.id].lit).toBe(!idleClosed);
        });
      }
    }

    it("contactor NO || NC of the same coil stays conducting and does not short", () => {
      const c = emptyCircuit();
      const g = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0, { supplyType: "delta" });
      const xf = addDevice(c, "transformer", "T1", "body", 4, 0);
      addWire(c, g.symbol, "L1", xf.symbol, "H1");
      addWire(c, g.symbol, "L2", xf.symbol, "H2");
      const km = addDevice(c, "contactor", "M1", "coil", 8, 0);
      const no = addSymbol(c, km.device.id, "aux-no", 8, 8);
      const nc = addSymbol(c, km.device.id, "aux-nc", 8, 12);
      const hl = addDevice(c, "lamp", "LT1", "body", 16, 8);
      addWire(c, xf.symbol, "X1", no, "13");
      addWire(c, xf.symbol, "X1", nc, "21");
      addWire(c, no, "14", hl.symbol, "1");
      addWire(c, nc, "22", hl.symbol, "1");
      addWire(c, hl.symbol, "2", xf.symbol, "X2");

      const idle = run(c, []);
      expect(shorts(idle)).toHaveLength(0);
      expect(idle.runtime[hl.device.id].lit).toBe(true);

      addWire(c, xf.symbol, "X1", km.symbol, "A1");
      addWire(c, km.symbol, "A2", xf.symbol, "X2");
      const on = run(c, [], 3);
      expect(shorts(on)).toHaveLength(0);
      expect(on.runtime[km.device.id].energized).toBe(true);
      expect(on.runtime[hl.device.id].lit).toBe(true);
    });
  });

  describe("coil and contacts are internally isolated until wired", () => {
    const HOSTS: { kind: DeviceKind; hostVariant: string }[] = [
      { kind: "contactor", hostVariant: "coil" },
      { kind: "relay", hostVariant: "coil" },
      { kind: "timer-on", hostVariant: "coil" },
      { kind: "timer-off", hostVariant: "coil" },
      { kind: "overload", hostVariant: "body" },
    ];

    function powerHost(
      c: ReturnType<typeof emptyCircuit>,
      xfSym: ReturnType<typeof addDevice>["symbol"],
      host: ReturnType<typeof addDevice>,
      hostVariant: string,
    ) {
      if (hostVariant === "coil") {
        addWire(c, xfSym, "X1", host.symbol, "A1");
        addWire(c, host.symbol, "A2", xfSym, "X2");
      } else {
        // Feed only the line side. Completing L1-T1 to X2 would short because
        // the thermal path is a closed bridge until the relay trips.
        addWire(c, xfSym, "X1", host.symbol, "L1");
      }
    }

    for (const host of HOSTS) {
      const contactVariants = Object.keys(KINDS[host.kind].variants).filter(
        (v) => v !== "coil" && v !== "body" && v !== "main",
      );
      for (const contactVariant of contactVariants) {
        it(`${host.kind} ${host.hostVariant} does not feed ${contactVariant} without contact wiring`, () => {
          const terms = KINDS[host.kind].variants[contactVariant].terminals.map((t) => t.id);
          const c = emptyCircuit();
          const g = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0, { supplyType: "delta" });
          const xf = addDevice(c, "transformer", "T1", "body", 4, 0);
          addWire(c, g.symbol, "L1", xf.symbol, "H1");
          addWire(c, g.symbol, "L2", xf.symbol, "H2");
          const dev = addDevice(c, host.kind, "D1", host.hostVariant, 8, 0, { delayMs: 80 });
          const pole = addSymbol(c, dev.device.id, contactVariant, 8, 8);
          const hl = addDevice(c, "lamp", "LT1", "body", 16, 8);

          powerHost(c, xf.symbol, dev, host.hostVariant);
          addWire(c, pole, terms[0], hl.symbol, "1");
          addWire(c, hl.symbol, "2", xf.symbol, "X2");

          const idle = run(c, [], 3, 50);
          expect(idle.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);
          expect(idle.runtime[hl.device.id].lit, `${host.kind} ${contactVariant} idle leak`).toBe(false);

          if (host.kind === "overload") {
            const rt = createRuntime(c);
            rt[dev.device.id].tripped = true;
            const tripped = tick(c, rt, { held: new Set(), process }, 50, 50);
            expect(tripped.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);
            expect(tripped.runtime[hl.device.id].lit, `${host.kind} ${contactVariant} tripped leak`).toBe(false);
          } else {
            const late = run(c, [], 6, 50);
            expect(late.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);
            expect(late.runtime[hl.device.id].lit, `${host.kind} ${contactVariant} energized leak`).toBe(false);
          }

          const other = addDevice(c, "lamp", "LT2", "body", 20, 8);
          addWire(c, pole, terms[terms.length - 1], other.symbol, "1");
          addWire(c, other.symbol, "2", xf.symbol, "X2");
          const bothPins = run(c, [], 6, 50);
          expect(bothPins.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);
          expect(bothPins.runtime[hl.device.id].lit, `${host.kind} ${contactVariant} pinA leak`).toBe(false);
          expect(bothPins.runtime[other.device.id].lit, `${host.kind} ${contactVariant} pinB leak`).toBe(false);
        });
      }
    }
  });

  it("colors wires according to their phase in both edit and run modes", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "wye", 0, 0);
    const m = addDevice(c, "motor-3ph", "MTR1", "body", 12, 0);
    const gnd = addDevice(c, "ground", "GND1", "body", 12, 8);
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 12);

    const wL1 = addWire(c, g.symbol, "L1", m.symbol, "U");
    const wL2 = addWire(c, g.symbol, "L2", m.symbol, "V");
    const wL3 = addWire(c, g.symbol, "L3", m.symbol, "W");
    const wN = addWire(c, g.symbol, "N", hl.symbol, "2");
    const wPE = addWire(c, g.symbol, "PE", gnd.symbol, "1");

    // In edit mode (emptySnapshot)
    const editSnap = emptySnapshot(c);
    expect(editSnap.wires[wL1.id].kind).toBe("L1");
    expect(editSnap.wires[wL2.id].kind).toBe("L2");
    expect(editSnap.wires[wL3.id].kind).toBe("L3");
    expect(editSnap.wires[wN.id].kind).toBe("N");
    expect(editSnap.wires[wPE.id].kind).toBe("PE");

    expect(PHASE_COLOR["L1"]).toBe("#a65628");
    expect(PHASE_COLOR["L2"]).toBe("#ff7f00");
    expect(PHASE_COLOR["L3"]).toBe("#eccd26");
    expect(PHASE_COLOR["N"]).toBe("#6b7280");
    expect(PHASE_COLOR["PE"]).toBe("#2ca02c");
    expect(PHASE_COLOR["DC+"]).toBe("#dc2626");
    expect(PHASE_COLOR["DC-"]).toBe("#7dd3fc");
    expect(PHASE_COLOR["X1"]).toBe("#dc2626");
    expect(PHASE_COLOR["X2"]).toBe("#7dd3fc");

    // In run mode (tick)
    const runSnap = run(c, [], 2);
    expect(runSnap.wires[wL1.id].kind).toBe("L1");
    expect(runSnap.wires[wL2.id].kind).toBe("L2");
    expect(runSnap.wires[wL3.id].kind).toBe("L3");
    expect(runSnap.wires[wN.id].kind).toBe("N");
    expect(runSnap.wires[wPE.id].kind).toBe("PE");
  });

  it("colors transformer secondary X1 red and X2 light blue", () => {
    const c = emptyCircuit();
    const tc = addDevice(c, "transformer", "T1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    const wX1 = addWire(c, tc.symbol, "X1", hl.symbol, "1");
    const wX2 = addWire(c, hl.symbol, "2", tc.symbol, "X2");

    const editSnap = emptySnapshot(c);
    expect(editSnap.wires[wX1.id].kind).toBe("X1");
    expect(editSnap.wires[wX2.id].kind).toBe("X2");
    expect(PHASE_COLOR[editSnap.wires[wX1.id].kind!]).toBe("#dc2626");
    expect(PHASE_COLOR[editSnap.wires[wX2.id].kind!]).toBe("#7dd3fc");
  });

  it("colors DC supply wires correctly with DC+ and DC- phases", () => {
    const c = emptyCircuit();
    const dc = addDevice(c, "dc-supply", "DC1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 8, 0);
    const wPos = addWire(c, dc.symbol, "+", hl.symbol, "1");
    const wNeg = addWire(c, dc.symbol, "-", hl.symbol, "2");

    const editSnap = emptySnapshot(c);
    expect(editSnap.wires[wPos.id].kind).toBe("DC+");
    expect(editSnap.wires[wNeg.id].kind).toBe("DC-");

    const runSnap = run(c, [], 2);
    expect(runSnap.wires[wPos.id].kind).toBe("DC+");
    expect(runSnap.wires[wNeg.id].kind).toBe("DC-");
  });

  it("colors ground / earth wires green (PE) when connected to ground or PE net label", () => {
    const c = emptyCircuit();
    const gnd1 = addDevice(c, "ground", "GND1", "body", 0, 0);
    const gnd2 = addDevice(c, "ground", "GND2", "body", 8, 0);
    const m = addDevice(c, "motor-3ph", "MTR1", "body", 0, 6);
    const nlPE = addDevice(c, "net-label", "PE", "body", 8, 6);

    const wGnd = addWire(c, gnd1.symbol, "1", gnd2.symbol, "1");
    const wMotorPE = addWire(c, m.symbol, "PE", nlPE.symbol, "1");

    const editSnap = emptySnapshot(c);
    expect(editSnap.wires[wGnd.id].kind).toBe("PE");
    expect(editSnap.wires[wMotorPE.id].kind).toBe("PE");
    expect(PHASE_COLOR[editSnap.wires[wGnd.id].kind!]).toBe("#2ca02c");
    expect(PHASE_COLOR[editSnap.wires[wMotorPE.id].kind!]).toBe("#2ca02c");

    const runSnap = run(c, [], 2);
    expect(runSnap.wires[wGnd.id].kind).toBe("PE");
    expect(runSnap.wires[wMotorPE.id].kind).toBe("PE");
  });

  it("energizes and runs single-phase motor (motor-1ph) with live voltage between U1/1 and U2/2", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "wye", 0, 0);
    const m1 = addDevice(c, "motor-1ph", "MTR1", "body", 12, 0);

    addWire(c, g.symbol, "L1", m1.symbol, "U1");
    addWire(c, g.symbol, "N", m1.symbol, "U2");

    const snap = run(c, [], 5);
    expect(snap.runtime[m1.device.id].energized).toBe(true);
    expect(snap.runtime[m1.device.id].direction).toBe(1);
    expect(snap.runtime[m1.device.id].rpm).toBeGreaterThan(0.5);
  });

  describe("same-tag limit switches mutual exclusion and linkage (up to 2)", () => {
    it("coordinates 1 NO + 1 NC limit switch with same tag (SQ1) as linked contacts", () => {
      const c = emptyCircuit();
      const g = addDevice(c, "mains-3ph", "PWR1", "wye", 0, 0);
      const sqNo = addDevice(c, "limit-no", "LS1", "body", 6, 0);
      const sqNc = addDevice(c, "limit-nc", "LS1", "body", 6, 6);
      const hl1 = addDevice(c, "lamp", "LT1", "body", 12, 0);
      const hl2 = addDevice(c, "lamp", "LT2", "body", 12, 6);

      addWire(c, g.symbol, "L1", sqNo.symbol, "1");
      addWire(c, sqNo.symbol, "2", hl1.symbol, "1");
      addWire(c, hl1.symbol, "2", g.symbol, "N");

      addWire(c, g.symbol, "L1", sqNc.symbol, "1");
      addWire(c, sqNc.symbol, "2", hl2.symbol, "1");
      addWire(c, hl2.symbol, "2", g.symbol, "N");

      // Initially unactuated: NO is open (HL1 OFF), NC is closed (HL2 ON)
      const snap0 = run(c, [], 2);
      expect(snap0.runtime[sqNo.device.id].actuated).toBe(false);
      expect(snap0.runtime[sqNc.device.id].actuated).toBe(false);
      expect(snap0.runtime[hl1.device.id].lit).toBe(false);
      expect(snap0.runtime[hl2.device.id].lit).toBe(true);

      // When held/actuated: NO closes (HL1 ON), NC opens (HL2 OFF)
      const snapHeld = run(c, [sqNo.device.id], 2);
      expect(snapHeld.runtime[sqNo.device.id].actuated).toBe(true);
      expect(snapHeld.runtime[sqNc.device.id].actuated).toBe(true);
      expect(snapHeld.runtime[hl1.device.id].lit).toBe(true);
      expect(snapHeld.runtime[hl2.device.id].lit).toBe(false);

      // Actuating the NC switch also actuates the NO switch of the same physical device
      const snapHeldNc = run(c, [sqNc.device.id], 2);
      expect(snapHeldNc.runtime[sqNo.device.id].actuated).toBe(true);
      expect(snapHeldNc.runtime[sqNc.device.id].actuated).toBe(true);
      expect(snapHeldNc.runtime[hl1.device.id].lit).toBe(true);
      expect(snapHeldNc.runtime[hl2.device.id].lit).toBe(false);
    });

    it("enforces mutual exclusion for 2 NO limit switches with same tag (SQ1)", () => {
      const c = emptyCircuit();
      const g = addDevice(c, "mains-3ph", "PWR1", "wye", 0, 0);
      const sq1 = addDevice(c, "limit-no", "LS1", "body", 6, 0);
      const sq2 = addDevice(c, "limit-no", "LS1", "body", 6, 6);
      const hl1 = addDevice(c, "lamp", "LT1", "body", 12, 0);
      const hl2 = addDevice(c, "lamp", "LT2", "body", 12, 6);

      addWire(c, g.symbol, "L1", sq1.symbol, "1");
      addWire(c, sq1.symbol, "2", hl1.symbol, "1");
      addWire(c, hl1.symbol, "2", g.symbol, "N");

      addWire(c, g.symbol, "L1", sq2.symbol, "1");
      addWire(c, sq2.symbol, "2", hl2.symbol, "1");
      addWire(c, hl2.symbol, "2", g.symbol, "N");

      // Actuating sq1 makes sq1 closed and forces sq2 open
      const snap1 = run(c, [sq1.device.id], 2);
      expect(snap1.runtime[sq1.device.id].actuated).toBe(true);
      expect(snap1.runtime[sq2.device.id].actuated).toBe(false);
      expect(snap1.runtime[hl1.device.id].lit).toBe(true);
      expect(snap1.runtime[hl2.device.id].lit).toBe(false);

      // Actuating sq2 makes sq2 closed and forces sq1 open
      const snap2 = run(c, [sq2.device.id], 2);
      expect(snap2.runtime[sq1.device.id].actuated).toBe(false);
      expect(snap2.runtime[sq2.device.id].actuated).toBe(true);
      expect(snap2.runtime[hl1.device.id].lit).toBe(false);
      expect(snap2.runtime[hl2.device.id].lit).toBe(true);
    });

    it("enforces mutual exclusion for 2 NC limit switches with same tag (SQ1)", () => {
      const c = emptyCircuit();
      const g = addDevice(c, "mains-3ph", "PWR1", "wye", 0, 0);
      const sq1 = addDevice(c, "limit-nc", "LS1", "body", 6, 0);
      const sq2 = addDevice(c, "limit-nc", "LS1", "body", 6, 6);
      const hl1 = addDevice(c, "lamp", "LT1", "body", 12, 0);
      const hl2 = addDevice(c, "lamp", "LT2", "body", 12, 6);

      addWire(c, g.symbol, "L1", sq1.symbol, "1");
      addWire(c, sq1.symbol, "2", hl1.symbol, "1");
      addWire(c, hl1.symbol, "2", g.symbol, "N");

      addWire(c, g.symbol, "L1", sq2.symbol, "1");
      addWire(c, sq2.symbol, "2", hl2.symbol, "1");
      addWire(c, hl2.symbol, "2", g.symbol, "N");

      // By default in createRuntime / tick, 2 NC with same tag cannot both be conducting simultaneously
      const snap0 = run(c, [], 2);
      const conducting1 = !snap0.runtime[sq1.device.id].actuated;
      const conducting2 = !snap0.runtime[sq2.device.id].actuated;
      // Exactly one is conducting (not both)
      expect(conducting1 !== conducting2).toBe(true);

      // Actuating sq1 explicitly opens sq1 (actuated=true) and allows sq2 to conduct (actuated=false)
      const snap1 = run(c, [sq1.device.id], 2);
      expect(snap1.runtime[sq1.device.id].actuated).toBe(true);
      expect(snap1.runtime[sq2.device.id].actuated).toBe(false);
      expect(snap1.runtime[hl1.device.id].lit).toBe(false);
      expect(snap1.runtime[hl2.device.id].lit).toBe(true);

      // Actuating sq2 explicitly opens sq2 (actuated=true) and allows sq1 to conduct (actuated=false)
      const snap2 = run(c, [sq2.device.id], 2);
      expect(snap2.runtime[sq1.device.id].actuated).toBe(false);
      expect(snap2.runtime[sq2.device.id].actuated).toBe(true);
      expect(snap2.runtime[hl1.device.id].lit).toBe(true);
      expect(snap2.runtime[hl2.device.id].lit).toBe(false);
    });
  });

  describe("preset counter and reset terminals", () => {
    it("counts pulses on rising edges of A1-A2, trips output contact 1-2, and resets via R1-R2", () => {
      const c = emptyCircuit();
      const g = addDevice(c, "dc-supply", "PWS1", "body", 0, 0);
      const pbPulse = addDevice(c, "pb-no", "PB_PULSE", "body", 6, 0);
      const pbReset = addDevice(c, "pb-no", "PB_RST", "body", 6, 6);
      const ct = addDevice(c, "counter", "CTR1", "body", 12, 0, { preset: 3 });
      const hlDone = addDevice(c, "lamp", "LT_DONE", "body", 18, 0);

      // Pulse circuit (A1 - A2)
      addWire(c, g.symbol, "+", pbPulse.symbol, "1");
      addWire(c, pbPulse.symbol, "2", ct.symbol, "A1");
      addWire(c, ct.symbol, "A2", g.symbol, "-");

      // Reset circuit (R1 - R2)
      addWire(c, g.symbol, "+", pbReset.symbol, "1");
      addWire(c, pbReset.symbol, "2", ct.symbol, "R1");
      addWire(c, ct.symbol, "R2", g.symbol, "-");

      // Output load circuit (1 - 2)
      addWire(c, g.symbol, "+", ct.symbol, "1");
      addWire(c, ct.symbol, "2", hlDone.symbol, "1");
      addWire(c, hlDone.symbol, "2", g.symbol, "-");

      let snap = tick(c, createRuntime(c), { held: new Set(), process }, 50, 0);
      expect(snap.runtime[ct.device.id].count).toBe(0);
      expect(snap.runtime[ct.device.id].done).toBe(false);
      expect(snap.runtime[hlDone.device.id].lit).toBe(false);

      // Pulse 1: press & release
      snap = tick(c, snap.runtime, { held: new Set([pbPulse.device.id]), process }, 50, 50);
      expect(snap.runtime[ct.device.id].count).toBe(1);
      expect(snap.runtime[ct.device.id].done).toBe(false);
      snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 100);
      expect(snap.runtime[ct.device.id].count).toBe(1);

      // Pulse 2: press & release
      snap = tick(c, snap.runtime, { held: new Set([pbPulse.device.id]), process }, 50, 150);
      expect(snap.runtime[ct.device.id].count).toBe(2);
      snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 200);

      // Pulse 3: target reached (preset=3) -> done = true
      snap = tick(c, snap.runtime, { held: new Set([pbPulse.device.id]), process }, 50, 250);
      expect(snap.runtime[ct.device.id].count).toBe(3);
      expect(snap.runtime[ct.device.id].done).toBe(true);

      // Next tick (bridges update): output contact 1-2 closes, HL_DONE lights up
      snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 300);
      expect(snap.runtime[ct.device.id].done).toBe(true);
      expect(snap.runtime[hlDone.device.id].lit).toBe(true);

      // Energize Reset input via R1-R2 (press SB_RST): clears count to 0, done to false
      snap = tick(c, snap.runtime, { held: new Set([pbReset.device.id]), process }, 50, 350);
      expect(snap.runtime[ct.device.id].count).toBe(0);
      expect(snap.runtime[ct.device.id].done).toBe(false);

      // Next tick: contact 1-2 opens and HL_DONE turns off
      snap = tick(c, snap.runtime, { held: new Set([pbReset.device.id]), process }, 50, 400);
      expect(snap.runtime[hlDone.device.id].lit).toBe(false);

      // Release reset button: ready for next cycle
      snap = tick(c, snap.runtime, { held: new Set(), process }, 50, 450);
      expect(snap.runtime[ct.device.id].count).toBe(0);
      expect(snap.runtime[ct.device.id].done).toBe(false);
      expect(snap.runtime[hlDone.device.id].lit).toBe(false);
    });
  });

  it("runs ex06 with isolator properly", async () => {
    const { ex06Motor3phDol } = await import("../examplesBuilder");
    const c = ex06Motor3phDol();
    const snap0 = run(c, [], 2);
    expect(snap0.faults).toEqual([]);
  });

  it("energizes lamp through fuse-2p (body2 variant)", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "dc-supply", "PWS1", "body", 0, 0);
    const fu = addDevice(c, "fuse", "FU1", "body2", 6, 0); // 2-pole fuse
    const hl = addDevice(c, "lamp", "LT1", "body", 12, 0);

    // Connect DC+ to fuse pole 1 (terminal 3)
    addWire(c, g.symbol, "+", fu.symbol, "3");
    // Connect fuse pole 2 (terminal 2) to lamp terminal 1
    addWire(c, fu.symbol, "2", hl.symbol, "1");
    // Connect DC- to fuse pole 3 (terminal 1)
    addWire(c, g.symbol, "-", fu.symbol, "1");
    // Connect fuse pole 4 (terminal 4) to lamp terminal 2
    addWire(c, fu.symbol, "4", hl.symbol, "2");

    const snap = run(c, [], 2);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
  });

  it("energizes lamp through fuse-3p (body3 variant)", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "dc-supply", "PWS1", "body", 0, 0);
    const fu = addDevice(c, "fuse", "FU1", "body3", 6, 0); // 3-pole fuse
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);

    // Connect DC+ to fuse input pole 1 (terminal 1)
    addWire(c, g.symbol, "+", fu.symbol, "1");
    // Connect fuse output pole 1 (terminal 2) to lamp terminal 1
    addWire(c, fu.symbol, "2", hl.symbol, "1");
    // Connect DC- to fuse input pole 3 (terminal 5)
    addWire(c, g.symbol, "-", fu.symbol, "5");
    // Connect fuse output pole 3 (terminal 6) to lamp terminal 2
    addWire(c, fu.symbol, "6", hl.symbol, "2");

    const snap = run(c, [], 2);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
  });

  it("energizes lamp through fuse-2p with user-provided circuit configuration", () => {
    // This test replicates the exact wiring from the user's provided circuit
    const c = emptyCircuit();
    const g = addDevice(c, "dc-supply", "PWS1", "body", 0, 0);
    const fu = addDevice(c, "fuse", "FU1", "body2", 6, 0); // 2-pole fuse
    const hl = addDevice(c, "lamp", "LT1", "body", 14, 0);

    // User's wiring:
    // DC+ (terminal +) -> fuse terminal 3 (input pole 2)
    // fuse terminal 2 (output pole 2) -> lamp terminal 1
    // DC- (terminal -) -> fuse terminal 1 (input pole 1)
    // fuse terminal 4 (output pole 1) -> lamp terminal 2
    
    addWire(c, g.symbol, "+", fu.symbol, "3");
    addWire(c, fu.symbol, "2", hl.symbol, "1");
    addWire(c, g.symbol, "-", fu.symbol, "1");
    addWire(c, fu.symbol, "4", hl.symbol, "2");

    const snap = run(c, [], 2);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
  });
});
