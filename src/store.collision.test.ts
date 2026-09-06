import { describe, expect, it } from "vitest";
import { useLab } from "./store";
import { emptyCircuit, addDevice, addWire } from "./circuitBuilder";

describe("autoLabelWires - Collision Avoidance", () => {
  it("skips labels that collide with device tags", () => {
    const c = emptyCircuit();
    // Add a device that already uses "1" as its tag
    addDevice(c, "lamp", "1", "body", 0, 0);
    
    // Add some wires that would normally be 1, 2...
    const s1 = addDevice(c, "lamp", "L1", "body", 10, 10).symbol;
    const s2 = addDevice(c, "lamp", "L2", "body", 20, 20).symbol;
    addWire(c, s1, "1", s2, "1");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wLabels = useLab.getState().circuit.wires.map(w => w.label);
    // The first wire should NOT be 1 because "1" is reserved by the device
    expect(wLabels[0]).not.toBe("1");
    expect(wLabels[0]).toBe("2");
  });

  it("skips labels that collide with terminal labels", () => {
    const c = emptyCircuit();
    // Add a net-label device with tag "1" to test collision avoidance
    addDevice(c, "net-label", "1", "body", 5, 5);

    const s1 = addDevice(c, "lamp", "L1", "body", 10, 10).symbol;
    const s2 = addDevice(c, "lamp", "L2", "body", 20, 20).symbol;
    addWire(c, s1, "1", s2, "1");

    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();

    const wLabels = useLab.getState().circuit.wires.map(w => w.label);
    expect(wLabels[0]).toBe("2");
  });
});
