import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { useLab } from "./store";
import { emptyCircuit, addDevice, addWire, addJunction, addSymbol } from "./circuitBuilder";
import { ex07OverloadAlarm } from "./examplesBuilder";
import { GRID } from "./types";
import { getConnectedWireIds, nodeKeysForPort, railBreakCuts, terminalWorld, wireRoute } from "./geometry";
import { createRuntime, tick } from "./sim/engine";

describe("autoLabelWires", () => {
  beforeEach(() => {
    useLab.setState({ autoLayoutSkipPowerWiring: false });
  });

  it("assigns unique sequential labels when wires are not connected", () => {
    const c = emptyCircuit();
    const s1 = addDevice(c, "lamp", "L1", "body", 0, 0).symbol;
    const s2 = addDevice(c, "lamp", "L2", "body", 10, 10).symbol;
    const s3 = addDevice(c, "lamp", "L3", "body", 20, 20).symbol;

    addWire(c, s1, "1", s2, "1");
    addWire(c, s2, "2", s3, "1");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    expect(useLab.getState().circuit.wires[0].label).toBe("1");
    expect(useLab.getState().circuit.wires[1].label).toBe("2");
  });

  it("assigns same label to wires sharing a terminal", () => {
    const c = emptyCircuit();
    const s1 = addDevice(c, "lamp", "L1", "body", 0, 0).symbol;
    const s2 = addDevice(c, "lamp", "L2", "body", 5, 0).symbol;
    const s3 = addDevice(c, "lamp", "L3", "body", 10, 0).symbol;

    // W1 connects L1-term1 to L2-term1
    addWire(c, s1, "1", s2, "1");
    // W2 connects L2-term1 to L3-term1 (shares L2-term1)
    addWire(c, s2, "1", s3, "1");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wLabels = useLab.getState().circuit.wires.map(w => w.label);
    expect(wLabels[0]).toBe(wLabels[1]);
  });

  it("assigns same label to wires connected via a junction", () => {
    const c = emptyCircuit();
    const s1 = addDevice(c, "lamp", "L1", "body", 0, 0).symbol;
    const j = addJunction(c, 5, 0).symbol;
    const s2 = addDevice(c, "lamp", "L2", "body", 10, 0).symbol;

    addWire(c, s1, "1", j, "1");
    addWire(c, j, "1", s2, "1");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wLabels = useLab.getState().circuit.wires.map(w => w.label);
    expect(wLabels[0]).toBe(wLabels[1]);
  });

  it("assigns wire numbers from left to right, top to bottom", () => {
    // Create three lamps aligned horizontally
    const c = emptyCircuit();
    const sLeft = addDevice(c, "lamp", "L1", "body", 4, 0).symbol;
    const sMid = addDevice(c, "lamp", "L2", "body", 12, 0).symbol;
    const sRight = addDevice(c, "lamp", "L3", "body", 20, 0).symbol;

    // Wire left lamp (should get label "1" - leftmost)
    addWire(c, sLeft, "1", sLeft, "2");
    // Wire middle lamp (should get label "2")
    addWire(c, sMid, "1", sMid, "2");
    // Wire right lamp (should get label "3" - rightmost)
    addWire(c, sRight, "1", sRight, "2");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    // Wires should be labeled 1, 2, 3 from left to right
    expect(wires[0].label).toBe("1");
    expect(wires[1].label).toBe("2");
    expect(wires[2].label).toBe("3");
  });

  it("assigns wire numbers top to bottom when x-coordinates are equal", () => {
    // Create three lamps aligned vertically
    const c = emptyCircuit();
    const sTop = addDevice(c, "lamp", "L1", "body", 4, 0).symbol;
    const sMid = addDevice(c, "lamp", "L2", "body", 4, 8).symbol;
    const sBot = addDevice(c, "lamp", "L3", "body", 4, 16).symbol;

    // Wire top lamp (should get label "1" - topmost)
    addWire(c, sTop, "1", sTop, "2");
    // Wire middle lamp (should get label "2")
    addWire(c, sMid, "1", sMid, "2");
    // Wire bottom lamp (should get label "3" - bottommost)
    addWire(c, sBot, "1", sBot, "2");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    // Wires should be labeled 1, 2, 3 from top to bottom
    expect(wires[0].label).toBe("1");
    expect(wires[1].label).toBe("2");
    expect(wires[2].label).toBe("3");
  });

  it("does not assign wire numbers to transformer internal jumpers (H1-H3, H2-H4 modes)", () => {
    // Create a single-phase transformer with internal jumper connections
    const c = emptyCircuit();
    const tSym = addDevice(c, "transformer", "T1", "body", 5, 5).symbol;

    // Add external connection to H1 (from a source)
    const s1 = addDevice(c, "fuse", "FU1", "body", 0, 5).symbol;
    addWire(c, s1, "1", tSym, "H1"); // This should get a wire number

    // Add internal jumper H1-H3 (Mode 1: input to tap) - this should NOT get a wire number
    addWire(c, tSym, "H1", tSym, "H3");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    // First wire (fuse to H1) should get wire number
    expect(wires[0].label).toBeTruthy();
    expect(parseInt(wires[0].label!)).toBeGreaterThanOrEqual(1);
    // Second wire (internal H1-H3 jumper) should have no label
    expect(wires[1].label).toBe("");
  });

  it("only reserves specific terminal labels for wire numbering", () => {
    // Test that only L1/L2/L3/N/G/PE/X1/X2 are reserved,
    // not other numeric terminal labels like 13, 14 from overload relays
    
    const c = emptyCircuit();
    
    // Add an overload relay with terminals 13 and 14
    const olSym = addDevice(c, "overload", "OL1", "body", 5, 5).symbol;
    // Add another device connected to OL's terminals 13 and 14
    const j = addJunction(c, 8, 5).symbol;
    addWire(c, olSym, "13", j, "1");
    addWire(c, j, "1", olSym, "14");
    
    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();
    
    const wires = useLab.getState().circuit.wires;
    
    // Wires connected to terminals "13" and "14" should now get wire numbers!
    // Previously these were skipped because "13" and "14" were in reservedTags
    // Now only L1/L2/L3/N/G/PE/X1/X2 are reserved
    const labels = wires.map(w => w.label).filter(l => l && l.trim());
    expect(labels.length).toBeGreaterThan(0);
  });

  it("wire numbering is sequential when non-reserved terminal labels exist", () => {
    // Verify that the 10-dual-station.json file now has sequential wire numbers
    // since we're no longer reserving numeric terminal labels like "13", "14"
    
    const filePath = '/Volumes/r1/10-dual-station.json';
    
    if (!existsSync(filePath)) {
      console.log('File not found:', filePath);
      return;
    }
    
    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    useLab.setState({ circuit: data.circuit });
    useLab.getState().autoLabelWires();
    
    const wires = useLab.getState().circuit.wires;
    
    // Get all unique wire number labels (excluding reserved ones like 90, 91, 92)
    const labels = new Set<number>();
    for (const w of wires) {
      if (w.label) {
        const num = parseInt(w.label);
        if (!isNaN(num) && num < 90) { // Exclude reserved tags 90, 91, 92
          labels.add(num);
        }
      }
    }
    
    const sortedLabels = Array.from(labels.values()).sort((a, b) => a - b);
    
    // Check for gaps - should be sequential from 1 to N without missing numbers
    const expectedCount = sortedLabels.length;
    const maxLabel = Math.max(...sortedLabels);
    
    // If sequential, max label should equal count (no gaps)
    expect(maxLabel).toBe(expectedCount);
  });

  it("high-voltage power path DISC→CB→KM→OL→Motor uses 90/10x numbers", () => {
    const c = emptyCircuit();

    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 5, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 10, 0).symbol;
    const km = addDevice(c, "contactor", "M1", "main", 15, 0).symbol;
    const ol = addDevice(c, "overload", "OL1", "body", 20, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 25, 0).symbol;

    // L1 phase: G1 → DISC1 → CB1 → KM1 main → OL → Motor
    addWire(c, g1, "L1", disc, "1");
    addWire(c, disc, "2", cb, "1");
    addWire(c, cb, "2", km, "1");
    addWire(c, km, "2", ol, "1");
    addWire(c, ol, "2", motor, "W");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    expect(wires[0].label).toBe("90");
    expect(new Set(wires.slice(1).map((w) => w.label))).toEqual(new Set(["100", "101", "102", "103"]));
    // Series segments through DISC/CB/KM/OL are distinct nets, not one shared number.
    expect(new Set(wires.map((w) => w.label)).size).toBe(wires.length);
  });

  it("numbers 3-phase HV by hop then L1/L2/L3, not one phase all the way", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 16, 0).symbol;
    const km = addDevice(c, "contactor", "M1", "main", 24, 0).symbol;
    const ol = addDevice(c, "overload", "OL1", "body", 32, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 40, 0).symbol;

    addWire(c, g1, "L1", disc, "L1");
    addWire(c, g1, "L2", disc, "L2");
    addWire(c, g1, "L3", disc, "L3");
    addWire(c, disc, "T1", cb, "L1");
    addWire(c, disc, "T2", cb, "L2");
    addWire(c, disc, "T3", cb, "L3");
    addWire(c, cb, "T1", km, "L1");
    addWire(c, cb, "T2", km, "L2");
    addWire(c, cb, "T3", km, "L3");
    addWire(c, km, "T1", ol, "L1");
    addWire(c, km, "T2", ol, "L2");
    addWire(c, km, "T3", ol, "L3");
    addWire(c, ol, "T1", motor, "U");
    addWire(c, ol, "T2", motor, "V");
    addWire(c, ol, "T3", motor, "W");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    const labelOf = (a: { id: string }, aTerm: string, b: { id: string }, bTerm: string) =>
      wires.find((w) =>
        (w.a.symbolId === a.id && w.a.term === aTerm && w.b.symbolId === b.id && w.b.term === bTerm) ||
        (w.a.symbolId === b.id && w.a.term === bTerm && w.b.symbolId === a.id && w.b.term === aTerm)
      )?.label;

    expect(labelOf(g1, "L1", disc, "L1")).toBe("90");
    expect(labelOf(g1, "L2", disc, "L2")).toBe("91");
    expect(labelOf(g1, "L3", disc, "L3")).toBe("92");
    expect(labelOf(disc, "T1", cb, "L1")).toBe("100");
    expect(labelOf(disc, "T2", cb, "L2")).toBe("101");
    expect(labelOf(disc, "T3", cb, "L3")).toBe("102");
    expect(labelOf(cb, "T1", km, "L1")).toBe("103");
    expect(labelOf(cb, "T2", km, "L2")).toBe("104");
    expect(labelOf(cb, "T3", km, "L3")).toBe("105");
    expect(labelOf(km, "T1", ol, "L1")).toBe("106");
    expect(labelOf(km, "T2", ol, "L2")).toBe("107");
    expect(labelOf(km, "T3", ol, "L3")).toBe("108");
    expect(labelOf(ol, "T1", motor, "U")).toBe("109");
    expect(labelOf(ol, "T2", motor, "V")).toBe("110");
    expect(labelOf(ol, "T3", motor, "W")).toBe("111");
  });

  it("gives transformer primary T-offs the same number as the power net they tap", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 16, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 24, 0).symbol;
    const tc = addDevice(c, "transformer", "T1", "body", 8, 12).symbol;

    addWire(c, g1, "L1", disc, "L1");
    addWire(c, g1, "L2", disc, "L2");
    addWire(c, g1, "L3", disc, "L3");
    addWire(c, disc, "T1", cb, "L1");
    addWire(c, disc, "T2", cb, "L2");
    addWire(c, disc, "T3", cb, "L3");
    addWire(c, cb, "T1", motor, "U");
    addWire(c, cb, "T2", motor, "V");
    addWire(c, cb, "T3", motor, "W");
    addWire(c, disc, "T1", tc, "H1");
    addWire(c, disc, "T2", tc, "H4");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    const labelOf = (a: { id: string }, aTerm: string, b: { id: string }, bTerm: string) =>
      wires.find((w) =>
        (w.a.symbolId === a.id && w.a.term === aTerm && w.b.symbolId === b.id && w.b.term === bTerm) ||
        (w.a.symbolId === b.id && w.a.term === bTerm && w.b.symbolId === a.id && w.b.term === aTerm)
      )?.label;

    expect(labelOf(disc, "T1", cb, "L1")).toBe("100");
    expect(labelOf(disc, "T2", cb, "L2")).toBe("101");
    expect(labelOf(disc, "T1", tc, "H1")).toBe("100");
    expect(labelOf(disc, "T2", tc, "H4")).toBe("101");
  });

  it("numbers transformer-fuse spurs after the motor 3-phase path, not in the middle", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 16, 0).symbol;
    const km = addDevice(c, "contactor", "M1", "main", 24, 0).symbol;
    const ol = addDevice(c, "overload", "OL1", "body", 32, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 40, 0).symbol;
    const fu1 = addDevice(c, "fuse", "FU1", "body", 12, 10).symbol;
    const fu2 = addDevice(c, "fuse", "FU2", "body", 12, 14).symbol;
    const tc = addDevice(c, "transformer", "T1", "body", 18, 10).symbol;

    addWire(c, g1, "L1", disc, "L1");
    addWire(c, g1, "L2", disc, "L2");
    addWire(c, g1, "L3", disc, "L3");
    addWire(c, disc, "T1", cb, "L1");
    addWire(c, disc, "T2", cb, "L2");
    addWire(c, disc, "T3", cb, "L3");
    addWire(c, cb, "T1", km, "L1");
    addWire(c, cb, "T2", km, "L2");
    addWire(c, cb, "T3", km, "L3");
    addWire(c, km, "T1", ol, "L1");
    addWire(c, km, "T2", ol, "L2");
    addWire(c, km, "T3", ol, "L3");
    addWire(c, ol, "T1", motor, "U");
    addWire(c, ol, "T2", motor, "V");
    addWire(c, ol, "T3", motor, "W");
    addWire(c, disc, "T1", fu1, "1");
    addWire(c, disc, "T2", fu2, "1");
    addWire(c, fu1, "2", tc, "H1");
    addWire(c, fu2, "2", tc, "H4");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    const labelOf = (a: { id: string }, aTerm: string, b: { id: string }, bTerm: string) =>
      wires.find((w) =>
        (w.a.symbolId === a.id && w.a.term === aTerm && w.b.symbolId === b.id && w.b.term === bTerm) ||
        (w.a.symbolId === b.id && w.a.term === bTerm && w.b.symbolId === a.id && w.b.term === aTerm)
      )?.label;

    expect(labelOf(disc, "T1", cb, "L1")).toBe("100");
    expect(labelOf(disc, "T2", cb, "L2")).toBe("101");
    expect(labelOf(disc, "T3", cb, "L3")).toBe("102");
    expect(labelOf(cb, "T1", km, "L1")).toBe("103");
    expect(labelOf(cb, "T2", km, "L2")).toBe("104");
    expect(labelOf(cb, "T3", km, "L3")).toBe("105");
    expect(labelOf(ol, "T1", motor, "U")).toBe("109");
    expect(labelOf(ol, "T2", motor, "V")).toBe("110");
    expect(labelOf(ol, "T3", motor, "W")).toBe("111");
    const h1 = parseInt(labelOf(fu1, "2", tc, "H1")!, 10);
    const h4 = parseInt(labelOf(fu2, "2", tc, "H4")!, 10);
    expect(h1).toBeGreaterThanOrEqual(112);
    expect(h4).toBeGreaterThanOrEqual(112);
    expect(h1).not.toBe(h4);
  });

  it("does not give the same number to series segments through a power device", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 5, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 10, 0).symbol;

    addWire(c, g1, "L1", disc, "1");
    addWire(c, disc, "2", motor, "U");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const [line, load] = useLab.getState().circuit.wires;
    expect(line.label).toBe("90");
    expect(load.label).toBe("100");
    expect(load.label).not.toBe(line.label);
  });

  it("keeps transformer secondary / control circuit on 1, 2, 3… numbering", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const tc = addDevice(c, "transformer", "T1", "body", 8, 0).symbol;
    const pb = addDevice(c, "pb-no", "PB1", "body", 14, 8).symbol;
    const lamp = addDevice(c, "lamp", "LT1", "body", 20, 8).symbol;

    addWire(c, g1, "L1", tc, "H1");
    addWire(c, g1, "L2", tc, "H4");
    addWire(c, tc, "X1", pb, "1");
    addWire(c, pb, "2", lamp, "1");
    addWire(c, lamp, "2", tc, "X2");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    expect(wires[0].label).toBe("90");
    expect(wires[1].label).toBe("91");
    expect(wires[2].label).toBe("1");
    expect(wires[3].label).toBe("3");
    expect(wires[4].label).toBe("2");
  });

  it("does not leak HV numbering through a contactor coil", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const km = addDevice(c, "contactor", "M1", "main", 10, 0);
    const kmCoil = addSymbol(c, km.device.id, "coil", 10, 10);
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 16, 0).symbol;
    const tc = addDevice(c, "transformer", "T1", "body", 4, 10).symbol;
    const pb = addDevice(c, "pb-no", "PB1", "body", 8, 10).symbol;

    addWire(c, g1, "L1", km.symbol, "1");
    addWire(c, km.symbol, "2", motor, "U");
    addWire(c, g1, "L2", tc, "H1");
    addWire(c, tc, "X1", pb, "1");
    addWire(c, pb, "2", kmCoil, "A1");
    addWire(c, kmCoil, "A2", tc, "X2");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    expect(wires[0].label).toBe("90");
    expect(wires[1].label).toBe("100");
    expect(wires[2].label).toBe("91");
    expect(wires[3].label).toBe("1");
    expect(wires[4].label).toBe("3");
    expect(wires[5].label).toBe("2");
  });

  it("labels example 07 power path as 10x and control path as 1, 2, 3…", () => {
    const c = ex07OverloadAlarm();
    const byKind = (kind: string, variant?: string) =>
      c.symbols.find((s) => {
        const d = c.devices.find((dev) => dev.id === s.deviceId);
        return d?.kind === kind && (variant === undefined || s.variant === variant);
      })!;

    const g1 = byKind("mains-3ph");
    const qf = byKind("breaker-3p");
    const kmMain = byKind("contactor", "main");
    const ol = byKind("overload", "body");
    const motor = byKind("motor-3ph");
    const tc = byKind("transformer");
    const start = byKind("pb-no");
    const stop = byKind("pb-nc");
    const coil = byKind("contactor", "coil");
    const frNc = byKind("overload", "aux-nc");
    const frNo = byKind("overload", "aux-no");
    const alarm = byKind("alarm");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    const labelOf = (a: { id: string }, aTerm: string, b: { id: string }, bTerm: string) =>
      wires.find((w) =>
        (w.a.symbolId === a.id && w.a.term === aTerm && w.b.symbolId === b.id && w.b.term === bTerm) ||
        (w.a.symbolId === b.id && w.a.term === bTerm && w.b.symbolId === a.id && w.b.term === aTerm)
      )?.label;

    expect(labelOf(g1, "L1", qf, "L1")).toBe("90");
    expect(labelOf(g1, "L2", qf, "L2")).toBe("91");
    expect(labelOf(g1, "L3", qf, "L3")).toBe("92");
    expect(labelOf(qf, "T1", kmMain, "L1")).toBe("100");
    expect(labelOf(qf, "T2", kmMain, "L2")).toBe("101");
    expect(labelOf(qf, "T3", kmMain, "L3")).toBe("102");
    expect(labelOf(qf, "T1", tc, "H1")).toBe("100");
    expect(labelOf(qf, "T2", tc, "H2")).toBe("101");
    expect(labelOf(ol, "T1", motor, "U")).toBe("106");
    expect(labelOf(ol, "T2", motor, "V")).toBe("107");
    expect(labelOf(ol, "T3", motor, "W")).toBe("108");
    expect(wires.find((w) => w.a.term === "X1" || w.b.term === "X1")?.label).toBe("1");
    expect(labelOf(frNc, "96", stop, "1")).toBe("3");
    expect(labelOf(stop, "2", start, "1")).toBe("4");
    expect(labelOf(start, "2", coil, "A1")).toBe("5");
    expect(labelOf(frNo, "98", alarm, "1")).toBe("6");
  });

  it("finishes the X1→coil path before numbering an indicator branch", () => {
    const c = emptyCircuit();
    const tc = addDevice(c, "transformer", "T1", "body", 0, 10).symbol;
    const stop = addDevice(c, "pb-nc", "PB1", "body", 8, 10).symbol;
    const start = addDevice(c, "pb-no", "PB2", "body", 16, 10).symbol;
    const km = addDevice(c, "contactor", "M1", "coil", 24, 10).symbol;
    const frNo = addDevice(c, "overload", "OL1", "aux-no", 8, 20).symbol;
    const alarm = addDevice(c, "alarm", "AL1", "body", 16, 20).symbol;

    addWire(c, tc, "X1", stop, "1");
    addWire(c, stop, "2", start, "1");
    addWire(c, start, "2", km, "A1");
    addWire(c, km, "A2", tc, "X2");
    addWire(c, tc, "X1", frNo, "97");
    addWire(c, frNo, "98", alarm, "1");
    addWire(c, alarm, "2", tc, "X2");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    const labelOf = (a: { id: string }, aTerm: string, b: { id: string }, bTerm: string) =>
      wires.find((w) =>
        (w.a.symbolId === a.id && w.a.term === aTerm && w.b.symbolId === b.id && w.b.term === bTerm) ||
        (w.a.symbolId === b.id && w.a.term === bTerm && w.b.symbolId === a.id && w.b.term === aTerm)
      )?.label;

    expect(labelOf(tc, "X1", stop, "1")).toBe("1");
    expect(labelOf(stop, "2", start, "1")).toBe("3");
    expect(labelOf(start, "2", km, "A1")).toBe("4");
    expect(labelOf(km, "A2", tc, "X2")).toBe("2");
    // Alarm rung is a branch off X1 — numbered after the coil path, not inserted as 3.
    expect(labelOf(frNo, "98", alarm, "1")).toBe("5");
  });

  it("skipPowerWiring leaves HV wires unlabeled and still numbers control wires", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const tc = addDevice(c, "transformer", "T1", "body", 8, 0).symbol;
    const pb = addDevice(c, "pb-no", "PB1", "body", 14, 8).symbol;
    const lamp = addDevice(c, "lamp", "LT1", "body", 20, 8).symbol;

    addWire(c, g1, "L1", tc, "H1");
    addWire(c, g1, "L2", tc, "H4");
    addWire(c, tc, "X1", pb, "1");
    addWire(c, pb, "2", lamp, "1");
    addWire(c, lamp, "2", tc, "X2");

    useLab.setState({ circuit: c, autoLayoutSkipPowerWiring: false });
    useLab.getState().autoLabelWires();
    expect(useLab.getState().circuit.wires[0].label).toBe("90");
    expect(useLab.getState().circuit.wires[1].label).toBe("91");

    useLab.setState({ autoLayoutSkipPowerWiring: true });
    useLab.getState().autoLabelWires();

    const wires = useLab.getState().circuit.wires;
    expect(wires[0].label || "").toBe("");
    expect(wires[1].label || "").toBe("");
    expect(wires[2].label).toBe("1");
    expect(wires[3].label).toBe("3");
    expect(wires[4].label).toBe("2");
  });
});

describe("wire label instances", () => {
  it("hides one copy of a wire number without deleting the wire", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "LT1", "body", 0, 0).symbol;
    const b = addDevice(c, "lamp", "LT2", "body", 10, 0).symbol;
    const w = addWire(c, a, "1", b, "2");
    w.label = "2";
    useLab.setState({ circuit: c, selected: { type: "wire-label", id: `${w.id}@0.500` } });
    useLab.getState().hideWireLabelInstance(w.id, 0.5);
    const marks = useLab.getState().circuit.wires[0].labelMarks;
    expect(marks?.some((m) => m.hidden && Math.abs(m.t - 0.5) < 0.04)).toBe(true);
    expect(useLab.getState().circuit.wires).toHaveLength(1);
  });

  it("adds a visible wire number at a world point on the selected wire", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 0, 4);
    const b = addJunction(c, 10, 4);
    const w = addWire(c, a.symbol, "1", b.symbol, "1");
    w.label = "7";
    useLab.setState({ circuit: c });
    useLab.getState().addWireLabelAt(w.id, { x: 7 * GRID, y: 4 * GRID });
    const marks = useLab.getState().circuit.wires[0].labelMarks ?? [];
    expect(marks.some((m) => !m.hidden && m.t > 0.55 && m.t < 0.85)).toBe(true);
  });

  it("pins a dragged copy along the same wire", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "LT1", "body", 0, 0).symbol;
    const b = addDevice(c, "lamp", "LT2", "body", 10, 0).symbol;
    const w = addWire(c, a, "1", b, "2");
    w.label = "2";
    useLab.setState({ circuit: c });
    useLab.getState().pinWireLabel(w.id, 0.5, 0.8);
    const marks = useLab.getState().circuit.wires[0].labelMarks ?? [];
    expect(marks.some((m) => m.hidden && Math.abs(m.t - 0.5) < 0.04)).toBe(true);
    expect(marks.some((m) => !m.hidden && Math.abs(m.t - 0.8) < 0.04)).toBe(true);
  });
});

describe("device binding ghosts", () => {
  it("drops a device with no remaining symbols after rebind", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "relay", "CR1", "coil", 0, 0);
    const ghost = addDevice(c, "relay", "CR1", "aux-no", 8, 0);
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().rebind(ghost.symbol.id, a.device.id);
    const next = useLab.getState().circuit;
    expect(next.devices.filter((d) => d.kind === "relay")).toHaveLength(1);
    expect(next.symbols.filter((s) => s.deviceId === a.device.id)).toHaveLength(2);
  });

  it("merges attach-only duplicate tags onto the host device on load", () => {
    const c = emptyCircuit();
    const host = addDevice(c, "overload", "OL1", "body", 0, 0);
    const ghost = addDevice(c, "overload", "OL1", "aux-nc", 8, 0);
    useLab.getState().loadCircuit(c);
    const next = useLab.getState().circuit;
    expect(next.devices.filter((d) => d.kind === "overload")).toHaveLength(1);
    expect(next.symbols.every((s) => s.deviceId === host.device.id)).toBe(true);
    expect(next.symbols.some((s) => s.variant === "aux-nc")).toBe(true);
    expect(ghost.device.id).not.toBe(host.device.id);
  });
});

describe("connectOverlappingTerminals", () => {
  it("adds a wire when a moved symbol's terminal lands on another terminal", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "pb-no", "PB1", "body", 0, 0);
    const b = addDevice(c, "pb-no", "PB2", "body", 6, 0);
    useLab.setState({ circuit: c, mode: "edit", isDirty: false });
    useLab.getState().moveGroup([{ id: a.symbol.id, x: 2, y: 0 }]);
    useLab.getState().connectOverlappingTerminals([a.symbol.id]);
    const wires = useLab.getState().circuit.wires;
    expect(wires).toHaveLength(1);
    expect(wires[0].a).toEqual({ symbolId: a.symbol.id, term: "2" });
    expect(wires[0].b).toEqual({ symbolId: b.symbol.id, term: "1" });
  });

  it("moves control hot and neutral rails with a selected group", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 2, 4, { railY0: 4, railY1: 12 });
    const neu = addDevice(c, "rail-n", "N", "body", 16, 4, { railY0: 4, railY1: 12 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 8, 6);
    addWire(c, lamp.symbol, "1", hot.symbol, "y6");
    addWire(c, lamp.symbol, "2", neu.symbol, "y10");
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().selectAll();
    useLab.getState().moveGroup([
      { id: hot.symbol.id, x: 4, y: 7 },
      { id: neu.symbol.id, x: 18, y: 7 },
      { id: lamp.symbol.id, x: 10, y: 9 },
    ]);
    const next = useLab.getState().circuit;
    const hotDev = next.devices.find((d) => d.id === hot.device.id);
    const neuDev = next.devices.find((d) => d.id === neu.device.id);
    expect(next.symbols.find((s) => s.id === hot.symbol.id)).toMatchObject({ x: 4, y: 7 });
    expect(hotDev?.params.railY0).toBe(7);
    expect(hotDev?.params.railY1).toBe(15);
    expect(neuDev?.params.railY0).toBe(7);
    expect(neuDev?.params.railY1).toBe(15);
    expect(next.wires.map((w) => w.b.term).sort()).toEqual(["y13", "y9"]);
  });

  it("drops the hot-rail splice wires after the contact is dragged off", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 2, { railY0: 2, railY1: 16 });
    const pb = addDevice(c, "pb-nc", "PB1", "body", 3, 6, {}, 90);
    addWire(c, pb.symbol, "1", hot.symbol, "y6");
    addWire(c, pb.symbol, "2", hot.symbol, "y10");
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().moveGroup([{ id: pb.symbol.id, x: 10, y: 6 }]);
    expect(useLab.getState().circuit.wires).toHaveLength(0);
    useLab.getState().moveGroup([{ id: pb.symbol.id, x: 3, y: 6 }]);
    expect(useLab.getState().circuit.wires).toHaveLength(0);
  });

  it("keeps a top jumper on the rail ends and reroutes when one rail moves", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 2, 4, { railY0: 4, railY1: 12 });
    const neu = addDevice(c, "rail-n", "N", "body", 16, 4, { railY0: 4, railY1: 12 });
    const w = addWire(c, hot.symbol, "y4", neu.symbol, "y4");
    w.jog = { axis: "y", pos: 80, y: 80 };
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().moveRail("rail-l", 5, 7, 15);
    const next = useLab.getState().circuit;
    const wire = next.wires[0];
    expect(wire.a.term).toBe("y7");
    expect(wire.b.term).toBe("y7");
    expect(wire.jog).toBeUndefined();
    expect(wireRoute(next, wire.a, wire.b)).toEqual([
      { x: 5 * GRID, y: 7 * GRID },
      { x: 16 * GRID, y: 7 * GRID },
    ]);
  });

  it("keeps one wire number across a rail break", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 2, { railY0: 2, railY1: 16 });
    addDevice(c, "rail-break", "BK1", "body", 4, 6, { railY0: 6, railY1: 10 });
    const above = addDevice(c, "junction", "J1", "body", 8, 4);
    const below = addDevice(c, "junction", "J2", "body", 8, 14);
    const top = addWire(c, above.symbol, "1", hot.symbol, "y4");
    const bot = addWire(c, below.symbol, "1", hot.symbol, "y14");
    expect(nodeKeysForPort(c, { symbolId: hot.symbol.id, term: "y4" })).toEqual([`rail:${hot.device.id}`]);
    expect(nodeKeysForPort(c, { symbolId: hot.symbol.id, term: "y14" })).toEqual([`rail:${hot.device.id}`]);
    expect(getConnectedWireIds(c, top.id).has(bot.id)).toBe(true);
  });

  it("keeps a wire below a rail break straight when the component moves", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 0, { railY0: 0, railY1: 24 });
    addDevice(c, "rail-break", "BK1", "body", 4, 6, { railY0: 6, railY1: 10 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 12, 14);
    const w = addWire(c, lamp.symbol, "1", hot.symbol, "y13");
    w.jog = { axis: "x", pos: 8 * GRID, x: 8 * GRID };
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().moveGroup(
      [{ id: lamp.symbol.id, x: 12, y: 16 }],
      [{ id: w.id, jog: { ...w.jog } }],
    );
    const wire = useLab.getState().circuit.wires[0];
    expect(wire.b.term).toBe("y16");
    expect(wire.jog).toBeUndefined();
    expect(wireRoute(useLab.getState().circuit, wire.a, wire.b)).toEqual([
      { x: 13 * GRID, y: 16 * GRID },
      { x: 4 * GRID, y: 16 * GRID },
    ]);
  });

  it("slides a tap that was locked on the other side of a rail break", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 0, { railY0: 0, railY1: 24 });
    addDevice(c, "rail-break", "BK1", "body", 4, 6, { railY0: 6, railY1: 12 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 12, 16);
    const w = addWire(c, lamp.symbol, "1", hot.symbol, "y4");
    w.jog = { axis: "y", pos: 16 * GRID, y: 16 * GRID };
    useLab.setState({ circuit: c, mode: "edit" });
    const wire = useLab.getState().circuit.wires[0];
    expect(wire.b.term).toBe("y16");
    expect(wire.jog).toBeUndefined();
    expect(wireRoute(useLab.getState().circuit, wire.a, wire.b)).toEqual([
      { x: 13 * GRID, y: 16 * GRID },
      { x: 4 * GRID, y: 16 * GRID },
    ]);
    useLab.setState({ selectedIds: [lamp.symbol.id], selected: { type: "symbol", id: lamp.symbol.id } });
    useLab.getState().nudgeSelected(0, 2);
    const nudged = useLab.getState().circuit.wires[0];
    expect(nudged.b.term).toBe("y18");
    expect(nudged.jog).toBeUndefined();
    expect(wireRoute(useLab.getState().circuit, nudged.a, nudged.b)).toEqual([
      { x: 13 * GRID, y: 18 * GRID },
      { x: 4 * GRID, y: 18 * GRID },
    ]);
    useLab.getState().moveRail("rail-l", 6, 1, 22);
    const moved = useLab.getState().circuit.wires[0];
    expect(moved.b.term).toBe("y18");
    expect(wireRoute(useLab.getState().circuit, moved.a, moved.b)).toEqual([
      { x: 13 * GRID, y: 18 * GRID },
      { x: 6 * GRID, y: 18 * GRID },
    ]);
    useLab.getState().setWireJog(moved.id, { axis: "y", pos: 4 * GRID, y: 4 * GRID });
    const bent = useLab.getState().circuit.wires[0];
    expect(bent.jog).toBeUndefined();
    expect(bent.b.term).toBe("y18");
    expect(wireRoute(useLab.getState().circuit, bent.a, bent.b)).toEqual([
      { x: 13 * GRID, y: 18 * GRID },
      { x: 6 * GRID, y: 18 * GRID },
    ]);
  });

  it("carries an attached rail break when the control rail moves and heals when the break is dragged off", () => {
    const c = emptyCircuit();
    addDevice(c, "dc-supply", "PWS1", "body", 0, 0);
    const hot = addDevice(c, "rail-l", "L", "body", 4, 2, { railY0: 2, railY1: 16 });
    const neu = addDevice(c, "rail-n", "N", "body", 20, 2, { railY0: 2, railY1: 16 });
    const gap = addDevice(c, "rail-break", "BK1", "body", 4, 6, { railY0: 6, railY1: 10 });
    const other = addDevice(c, "rail-break", "BK2", "body", 30, 8, { railY0: 8, railY1: 11 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 12);
    addWire(c, lamp.symbol, "1", hot.symbol, "y12");
    addWire(c, lamp.symbol, "2", neu.symbol, "y12");
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().moveRail("rail-l", 7, 5, 19);
    const moved = useLab.getState().circuit;
    const hotSym = moved.symbols.find((s) => s.id === hot.symbol.id);
    const gapSym = moved.symbols.find((s) => s.id === gap.symbol.id);
    const gapDev = moved.devices.find((d) => d.id === gap.device.id);
    const otherSym = moved.symbols.find((s) => s.id === other.symbol.id);
    const otherDev = moved.devices.find((d) => d.id === other.device.id);
    expect(hotSym).toMatchObject({ x: 7 });
    expect(gapSym).toMatchObject({ x: 7, y: 9 });
    expect(gapDev?.params.railY0).toBe(9);
    expect(gapDev?.params.railY1).toBe(13);
    expect(otherSym).toMatchObject({ x: 30, y: 8 });
    expect(otherDev?.params.railY0).toBe(8);
    expect(railBreakCuts(moved).map((cut) => cut.rows)).toEqual([[9, 13]]);
    const process = { temperature: 25, pressure: 1, level: 20, flow: 0, limitHit: false, proxHit: false, photoHit: false };
    expect(tick(moved, createRuntime(moved), { held: new Set(), process }, 50, 0).runtime[lamp.device.id].lit).toBe(false);

    useLab.getState().moveRail("rail-break", 8, 9, 13, true, gap.symbol.id);
    const detached = useLab.getState().circuit;
    expect(detached.symbols.find((s) => s.id === gap.symbol.id)).toMatchObject({ x: 8 });
    expect(railBreakCuts(detached)).toEqual([]);
    expect(tick(detached, createRuntime(detached), { held: new Set(), process }, 50, 0).runtime[lamp.device.id].lit).toBe(true);

    useLab.getState().moveRail("rail-break", 7, 11, 15, true, gap.symbol.id);
    const back = useLab.getState().circuit;
    expect(back.symbols.find((s) => s.id === gap.symbol.id)).toMatchObject({ x: 7 });
    expect(railBreakCuts(back).some((cut) => cut.railSymbolId === hot.symbol.id && cut.rows[0] === 11)).toBe(true);
    expect(tick(back, createRuntime(back), { held: new Set(), process }, 50, 0).runtime[lamp.device.id].lit).toBe(false);
  });

  it("carries an attached rail break when only the control rail is in a group move", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 2, { railY0: 2, railY1: 16 });
    const gap = addDevice(c, "rail-break", "BK1", "body", 4, 6, { railY0: 6, railY1: 10 });
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().moveGroup([{ id: hot.symbol.id, x: 9, y: 5 }]);
    const next = useLab.getState().circuit;
    const gapSym = next.symbols.find((s) => s.id === gap.symbol.id);
    const gapDev = next.devices.find((d) => d.id === gap.device.id);
    expect(gapSym).toMatchObject({ x: 9, y: 9 });
    expect(gapDev?.params).toMatchObject({ railY0: 9, railY1: 13 });
    expect(railBreakCuts(next)).toEqual([{ railSymbolId: hot.symbol.id, rows: [9, 13] }]);
  });

  it("keeps a placed tap, then follows the component into a rail break", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 0, { railY0: 0, railY1: 24 });
    addDevice(c, "rail-break", "BK1", "body", 4, 6, { railY0: 6, railY1: 12 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 12, 7);
    addWire(c, lamp.symbol, "1", hot.symbol, "y6");
    useLab.setState({ circuit: c, mode: "edit" });
    expect(useLab.getState().circuit.wires[0].b.term).toBe("y7");
    useLab.getState().moveSymbol(lamp.symbol.id, 12, 9);
    const wire = useLab.getState().circuit.wires[0];
    expect(wire.b.term).toBe("y9");
    expect(wireRoute(useLab.getState().circuit, wire.a, wire.b)).toEqual([
      { x: 13 * GRID, y: 9 * GRID },
      { x: 4 * GRID, y: 9 * GRID },
    ]);
  });

  it("keeps control-rail wires horizontal when the rail moves", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 0, { railY0: 0, railY1: 24 });
    addDevice(c, "rail-break", "BK1", "body", 4, 6, { railY0: 6, railY1: 12 });
    const pb = addDevice(c, "pb-no", "CR1", "body", 10, 8);
    addWire(c, pb.symbol, "2", hot.symbol, "y16");
    useLab.setState({ circuit: c, mode: "edit" });
    const row = Math.round(terminalWorld(useLab.getState().circuit, { symbolId: pb.symbol.id, term: "2" })!.y / GRID);
    const placed = useLab.getState().circuit.wires[0];
    expect(placed.b.term).toBe(`y${row}`);
    expect(placed.jog).toBeUndefined();
    expect(wireRoute(useLab.getState().circuit, placed.a, placed.b)).toEqual([
      { x: 14 * GRID, y: row * GRID },
      { x: 4 * GRID, y: row * GRID },
    ]);
    useLab.getState().moveRail("rail-l", 6, 3, 27);
    const shifted = useLab.getState().circuit.wires[0];
    expect(shifted.b.term).toBe(`y${row}`);
    expect(wireRoute(useLab.getState().circuit, shifted.a, shifted.b)).toEqual([
      { x: 14 * GRID, y: row * GRID },
      { x: 6 * GRID, y: row * GRID },
    ]);
  });

  it("keeps a wire on the control-rail end square when that end moves", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 4, 2, { railY0: 2, railY1: 16 });
    const pb = addDevice(c, "pb-no", "CR1", "body", 10, 8);
    const w = addWire(c, pb.symbol, "2", hot.symbol, "y2");
    w.b.railPin = "y0";
    useLab.setState({ circuit: c, mode: "edit" });
    const pinned = useLab.getState().circuit.wires[0];
    expect(pinned.b).toMatchObject({ term: "y2", railPin: "y0" });
    const parked = wireRoute(useLab.getState().circuit, pinned.a, pinned.b);
    expect(parked.at(-1)).toEqual({ x: 4 * GRID, y: 2 * GRID });
    expect(parked.at(-2)?.y).toBe(2 * GRID);
    expect(parked.length).toBeGreaterThan(2);
    useLab.getState().moveRail("rail-l", 6, 5, 19);
    const followed = useLab.getState().circuit.wires[0];
    expect(followed.b).toMatchObject({ term: "y5", railPin: "y0" });
    expect(wireRoute(useLab.getState().circuit, followed.a, followed.b).at(-1)).toEqual({
      x: 6 * GRID,
      y: 5 * GRID,
    });
  });

  it("slides a rail tap so the wire stays one straight line", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 2, 2, { railY0: 2, railY1: 20 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 8, 6);
    const w = addWire(c, lamp.symbol, "1", hot.symbol, "y8");
    w.jog = { axis: "y", pos: 40, y: 40 };
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().moveSymbol(lamp.symbol.id, 10, 9);
    useLab.getState().moveRail("rail-l", 4, 2, 20);
    const wire = useLab.getState().circuit.wires[0];
    const route = wireRoute(useLab.getState().circuit, wire.a, wire.b);
    expect(route).toEqual([
      { x: 11 * GRID, y: 9 * GRID },
      { x: 4 * GRID, y: 9 * GRID },
    ]);
  });

  it("does not add a duplicate wire if those ports are already connected", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "pb-no", "PB1", "body", 2, 0);
    const b = addDevice(c, "pb-no", "PB2", "body", 6, 0);
    addWire(c, a.symbol, "2", b.symbol, "1");
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().connectOverlappingTerminals([a.symbol.id]);
    expect(useLab.getState().circuit.wires).toHaveLength(1);
  });

  it("conducts when a lamp is auto-wired onto an isolator numeric/L1 alias", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0);
    const tap = addDevice(c, "net-label", "HOT", "body", 24, 0);
    const hl = addDevice(c, "lamp", "LT1", "body", 30, 0);
    addWire(c, g.symbol, "L1", disc.symbol, "1");
    addWire(c, tap.symbol, "1", hl.symbol, "1");
    addWire(c, hl.symbol, "2", g.symbol, "N");
    const disc1 = terminalWorld(c, { symbolId: disc.symbol.id, term: "1" })!;
    const tap1 = terminalWorld(c, { symbolId: tap.symbol.id, term: "1" })!;
    tap.symbol.x += (disc1.x - tap1.x) / GRID;
    tap.symbol.y += (disc1.y - tap1.y) / GRID;
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().connectOverlappingTerminals([tap.symbol.id]);
    const next = useLab.getState().circuit;
    const overlap = next.wires.find(
      (w) =>
        (w.a.symbolId === tap.symbol.id && w.b.symbolId === disc.symbol.id) ||
        (w.b.symbolId === tap.symbol.id && w.a.symbolId === disc.symbol.id),
    );
    expect(overlap).toBeDefined();
    const discTerm = overlap!.a.symbolId === disc.symbol.id ? overlap!.a.term : overlap!.b.term;
    expect(discTerm).toBe("1");
    const process = { temperature: 25, pressure: 1, level: 20, flow: 0, limitHit: false, proxHit: false, photoHit: false };
    const snap = tick(next, createRuntime(next), { held: new Set(), process }, 50, 50);
    expect(snap.runtime[hl.device.id].lit).toBe(true);
    expect(snap.wires[overlap!.id].live).toBe(true);
  });
});

describe("setSymbolHideTag", () => {
  it("hides only the selected coil tag, not NO/NC of the same relay", () => {
    const c = emptyCircuit();
    const relay = addDevice(c, "relay", "CR1", "coil", 0, 0);
    const noSym = addSymbol(c, relay.device.id, "aux-no", 10, 0);
    const ncSym = addSymbol(c, relay.device.id, "aux-nc", 20, 0);
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().setSymbolHideTag(relay.symbol.id, true);
    const next = useLab.getState().circuit;
    expect(next.symbols.find((s) => s.id === relay.symbol.id)?.hideTag).toBe(true);
    expect(next.symbols.find((s) => s.id === noSym.id)?.hideTag).toBeUndefined();
    expect(next.symbols.find((s) => s.id === ncSym.id)?.hideTag).toBeUndefined();
    expect(next.devices.find((d) => d.id === relay.device.id)?.params.hideTag).toBeUndefined();
  });
});
