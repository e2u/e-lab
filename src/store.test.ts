import { describe, expect, it } from "vitest";
import { useLab } from "./store";
import { emptyCircuit, addDevice, addWire, addJunction } from "./circuitBuilder";

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
});
