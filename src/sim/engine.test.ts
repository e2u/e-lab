import { describe, expect, it } from "vitest";
import { addDevice, addSymbol, addWire, emptyCircuit, splitWireAt } from "../circuitBuilder";
import { GRID } from "../types";
import { wireRoute } from "../geometry";
import { selectorReversing, selfHoldMotor, starDeltaStart } from "../examples";
import { createRuntime, tick } from "./engine";
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const sb = addDevice(c, "pb-no", "SB1", "body", 4, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 8, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const st = addDevice(c, "temp-no", "ST1", "body", 6, 0, { setpoint: 60 });
    const hl = addDevice(c, "lamp", "HL1", "body", 12, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 8, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const sb = addDevice(c, "pb-nc", "SB1", "body", 4, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 8, 0);
    addWire(c, g.symbol, "L1", sb.symbol, "1");
    addWire(c, sb.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");

    expect(run(c, []).runtime[hl.device.id].lit).toBe(true);
    expect(run(c, [sb.device.id]).runtime[hl.device.id].lit).toBe(false);
  });

  it("holds a contactor after start is released", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const stop = addDevice(c, "pb-nc", "SB1", "body", 4, 0);
    const start = addDevice(c, "pb-no", "SB2", "body", 8, 0);
    const km = addDevice(c, "contactor", "KM1", "coil", 12, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const m = addDevice(c, "motor-3ph", "M1", "body", 8, 0);
    addWire(c, g.symbol, "L1", m.symbol, "U");
    addWire(c, g.symbol, "L2", m.symbol, "V");
    addWire(c, g.symbol, "L3", m.symbol, "W");
    const fwd = run(c, [], 8);
    expect(fwd.runtime[m.device.id].energized).toBe(true);
    expect(fwd.runtime[m.device.id].direction).toBe(1);

    const c2 = emptyCircuit();
    const g2 = addDevice(c2, "mains-3ph", "G2", "body", 0, 0);
    const m2 = addDevice(c2, "motor-3ph", "M2", "body", 8, 0);
    addWire(c2, g2.symbol, "L1", m2.symbol, "U");
    addWire(c2, g2.symbol, "L3", m2.symbol, "V");
    addWire(c2, g2.symbol, "L2", m2.symbol, "W");
    const rev = run(c2, [], 8);
    expect(rev.runtime[m2.device.id].direction).toBe(-1);
  });

  it("isolates transformer secondary until primary is live", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const tc = addDevice(c, "transformer", "TC1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 14, 0);
    addWire(c, g.symbol, "L1", tc.symbol, "P1");
    addWire(c, g.symbol, "L2", tc.symbol, "P2");
    addWire(c, tc.symbol, "S1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", tc.symbol, "S2");
    expect(run(c).runtime[hl.device.id].lit).toBe(true);
  });

  it("delays a TON contact", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const kt = addDevice(c, "timer-on", "KT1", "coil", 6, 0, { delayMs: 120 });
    const ktNo = addSymbol(c, kt.device.id, "delayed-no", 10, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 14, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const fr = addDevice(c, "overload", "FR1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 14, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const fr = addDevice(c, "overload", "FR1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 14, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const kt = addDevice(c, "timer-on", "KT1", "coil", 6, 0, { delayMs: 5000 });
    const ktInst = addSymbol(c, kt.device.id, "inst-no", 10, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 14, 0);
    addWire(c, g.symbol, "L1", kt.symbol, "A1");
    addWire(c, kt.symbol, "A2", g.symbol, "N");
    addWire(c, g.symbol, "L1", ktInst, "21");
    addWire(c, ktInst, "24", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, [], 2, 50).runtime[hl.device.id].lit).toBe(true);
  });

  it("keeps e-stop NC 11-12 closed until latched", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const sb = addDevice(c, "estop-nc", "SB0", "body", 4, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 8, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const sb = addDevice(c, "estop-no", "SB1", "body", 4, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 8, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const fs = addDevice(c, "foot-no", "SF1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 12, 0);
    addWire(c, g.symbol, "L1", fs.symbol, "1");
    addWire(c, fs.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, []).runtime[hl.device.id].lit).toBe(false);
    expect(run(c, [fs.device.id]).runtime[hl.device.id].lit).toBe(true);
  });

  it("opens a foot-switch NC while held", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const fs = addDevice(c, "foot-nc", "SF1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 12, 0);
    addWire(c, g.symbol, "L1", fs.symbol, "1");
    addWire(c, fs.symbol, "2", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c, []).runtime[hl.device.id].lit).toBe(true);
    expect(run(c, [fs.device.id]).runtime[hl.device.id].lit).toBe(false);
  });

  it("closes an SPST toggle when thrown", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const sw = addDevice(c, "toggle-spst", "SA1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 12, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const sw = addDevice(c, "toggle-spdt", "SA1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 12, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const sw = addDevice(c, "toggle-dpst", "SA1", "body", 6, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 12, 0);
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
    const start = c.devices.find((d) => d.tag === "SB2")!;
    const stop = c.devices.find((d) => d.tag === "SB1")!;
    const km = c.devices.find((d) => d.tag === "KM1")!;
    const motor = c.devices.find((d) => d.tag === "M1")!;
    const lamp = c.devices.find((d) => d.tag === "HL1")!;

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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 8, 0);
    addWire(c, g.symbol, "L1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    expect(run(c).runtime[hl.device.id].lit).toBe(true);
    c.wires[0].broken = true;
    expect(run(c).runtime[hl.device.id].lit).toBe(false);
  });

  it("keeps a welded contactor closed after the coil drops", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const km = addDevice(c, "contactor", "KM1", "coil", 6, 0);
    const main = addSymbol(c, km.device.id, "main", 12, 0);
    const m = addDevice(c, "motor-3ph", "M1", "body", 20, 0);
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
    const kt = c.devices.find((d) => d.tag === "KT1")!;
    kt.params.delayMs = 400;
    const start = c.devices.find((d) => d.tag === "SB2")!;
    const kmL = c.devices.find((d) => d.tag === "KM1")!;
    const kmY = c.devices.find((d) => d.tag === "KM2")!;
    const kmD = c.devices.find((d) => d.tag === "KM3")!;
    const motor = c.devices.find((d) => d.tag === "M1")!;

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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const kt = addDevice(c, "timer-on", "KT1", "coil", 6, 0, { delayMs: 200 });
    const ktNc = addSymbol(c, kt.device.id, "delayed-nc", 10, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 14, 0);
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
    const sa = c.devices.find((d) => d.tag === "SA1")!;
    const f = c.devices.find((d) => d.tag === "F")!;
    const r = c.devices.find((d) => d.tag === "R")!;
    const motor = c.devices.find((d) => d.tag === "M1")!;

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

  it("connects distant halves through matching net labels", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const a = addDevice(c, "net-label", "L1", "body", 4, 0);
    const b = addDevice(c, "net-label", "L1", "body", 20, 0);
    const n = addDevice(c, "net-label", "N", "body", 20, 4);
    const hl = addDevice(c, "lamp", "HL1", "body", 24, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const a = addDevice(c, "net-label", "L1", "body", 4, 0);
    const other = addDevice(c, "net-label", "L2", "body", 20, 0);
    const blank = addDevice(c, "net-label", "  ", "body", 20, 2);
    const blank2 = addDevice(c, "net-label", "", "body", 22, 2);
    const hl = addDevice(c, "lamp", "HL1", "body", 24, 0);
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
    const g = addDevice(c, "mains-3ph", "G1", "body", 0, 0);
    const hl = addDevice(c, "lamp", "HL1", "body", 20, 2);
    const hl2 = addDevice(c, "lamp", "HL2", "body", 12, 10);
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
});
