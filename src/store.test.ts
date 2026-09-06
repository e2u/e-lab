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
});
