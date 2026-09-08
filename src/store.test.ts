import { describe, expect, it } from "vitest";
import { useLab } from "./store";
import { emptyCircuit, addDevice, addWire, addJunction, addSymbol } from "./circuitBuilder";
import { ex07OverloadAlarm } from "./examplesBuilder";

describe("autoLabelWires", () => {
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
    const tSym = addDevice(c, "transformer", "TC1", "body", 5, 5).symbol;

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
    
    const fs = require('fs');
    const filePath = '/Volumes/r1/10-dual-station.json';
    
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
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

    const g1 = addDevice(c, "mains-3ph", "G1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 5, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 10, 0).symbol;
    const km = addDevice(c, "contactor", "KM1", "main", 15, 0).symbol;
    const ol = addDevice(c, "overload", "OL1", "body", 20, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "M1", "body", 25, 0).symbol;

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
    const g1 = addDevice(c, "mains-3ph", "G1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 16, 0).symbol;
    const km = addDevice(c, "contactor", "KM1", "main", 24, 0).symbol;
    const ol = addDevice(c, "overload", "OL1", "body", 32, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "M1", "body", 40, 0).symbol;

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
    const g1 = addDevice(c, "mains-3ph", "G1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 16, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "M1", "body", 24, 0).symbol;
    const tc = addDevice(c, "transformer", "TC1", "body", 8, 12).symbol;

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
    const g1 = addDevice(c, "mains-3ph", "G1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0).symbol;
    const cb = addDevice(c, "breaker-3p", "CB1", "body", 16, 0).symbol;
    const km = addDevice(c, "contactor", "KM1", "main", 24, 0).symbol;
    const ol = addDevice(c, "overload", "OL1", "body", 32, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "M1", "body", 40, 0).symbol;
    const fu1 = addDevice(c, "fuse", "FU1", "body", 12, 10).symbol;
    const fu2 = addDevice(c, "fuse", "FU2", "body", 12, 14).symbol;
    const tc = addDevice(c, "transformer", "TC1", "body", 18, 10).symbol;

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
    const g1 = addDevice(c, "mains-3ph", "G1", "delta", 0, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 5, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "M1", "body", 10, 0).symbol;

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
    const g1 = addDevice(c, "mains-3ph", "G1", "delta", 0, 0).symbol;
    const tc = addDevice(c, "transformer", "TC1", "body", 8, 0).symbol;
    const pb = addDevice(c, "pb-no", "SB1", "body", 14, 8).symbol;
    const lamp = addDevice(c, "lamp", "HL1", "body", 20, 8).symbol;

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
    const g1 = addDevice(c, "mains-3ph", "G1", "delta", 0, 0).symbol;
    const km = addDevice(c, "contactor", "KM1", "main", 10, 0);
    const kmCoil = addSymbol(c, km.device.id, "coil", 10, 10);
    const motor = addDevice(c, "motor-3ph", "M1", "body", 16, 0).symbol;
    const tc = addDevice(c, "transformer", "TC1", "body", 4, 10).symbol;
    const pb = addDevice(c, "pb-no", "SB1", "body", 8, 10).symbol;

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
    const tc = addDevice(c, "transformer", "TC1", "body", 0, 10).symbol;
    const stop = addDevice(c, "pb-nc", "SB1", "body", 8, 10).symbol;
    const start = addDevice(c, "pb-no", "SB2", "body", 16, 10).symbol;
    const km = addDevice(c, "contactor", "KM1", "coil", 24, 10).symbol;
    const frNo = addDevice(c, "overload", "FR1", "aux-no", 8, 20).symbol;
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
});

describe("wire label instances", () => {
  it("hides one copy of a wire number without deleting the wire", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0).symbol;
    const b = addDevice(c, "lamp", "HL2", "body", 10, 0).symbol;
    const w = addWire(c, a, "1", b, "2");
    w.label = "2";
    useLab.setState({ circuit: c, selected: { type: "wire-label", id: `${w.id}@0.500` } });
    useLab.getState().hideWireLabelInstance(w.id, 0.5);
    const marks = useLab.getState().circuit.wires[0].labelMarks;
    expect(marks?.some((m) => m.hidden && Math.abs(m.t - 0.5) < 0.04)).toBe(true);
    expect(useLab.getState().circuit.wires).toHaveLength(1);
  });

  it("pins a dragged copy along the same wire", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "HL1", "body", 0, 0).symbol;
    const b = addDevice(c, "lamp", "HL2", "body", 10, 0).symbol;
    const w = addWire(c, a, "1", b, "2");
    w.label = "2";
    useLab.setState({ circuit: c });
    useLab.getState().pinWireLabel(w.id, 0.5, 0.8);
    const marks = useLab.getState().circuit.wires[0].labelMarks ?? [];
    expect(marks.some((m) => m.hidden && Math.abs(m.t - 0.5) < 0.04)).toBe(true);
    expect(marks.some((m) => !m.hidden && Math.abs(m.t - 0.8) < 0.04)).toBe(true);
  });
});
