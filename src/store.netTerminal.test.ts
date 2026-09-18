import { describe, expect, it } from "vitest";
import { addDevice, addWire, emptyCircuit } from "./circuitBuilder";
import { findPortAtPoint, terminalWorld } from "./geometry";
import { GRID } from "./types";
import { applyNetTerminalPinCount, useLab } from "./store";

describe("net terminal store", () => {
  it("autoLabelWires assigns one number across same-named strips", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "lamp", "LT1", "body", 0, 0);
    const b = addDevice(c, "lamp", "LT2", "body", 20, 0);
    const s1 = addDevice(c, "net-terminal", "BUS", "body", 6, 0, { pinCount: 4 });
    const s2 = addDevice(c, "net-terminal", "BUS", "body", 14, 0, { pinCount: 4 });
    addWire(c, a.symbol, "1", s1.symbol, "2");
    addWire(c, s2.symbol, "3", b.symbol, "1");
    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();
    const wires = useLab.getState().circuit.wires;
    expect(wires[0].label).toBe(wires[1].label);
  });

  it("HV BFS jumps named-net flags past an isolator", () => {
    const c = emptyCircuit();
    const g1 = addDevice(c, "mains-3ph", "PWR1", "delta", 0, 0).symbol;
    const flagA = addDevice(c, "net-label", "L1", "body", 6, 0).symbol;
    const flagB = addDevice(c, "net-label", "L1", "body", 14, 0).symbol;
    const disc = addDevice(c, "isolator", "DISC1", "body", 20, 0).symbol;
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 28, 0).symbol;
    addWire(c, g1, "L1", flagA, "1");
    addWire(c, flagB, "1", disc, "L1");
    addWire(c, disc, "T1", motor, "U");
    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();
    const wires = useLab.getState().circuit.wires;
    expect(wires[0].label).toBe("90");
    expect(wires[1].label).toBe("90");
    expect(wires[2].label).toBe("100");
  });

  it("places consecutive strips on the suggested net, never L11", () => {
    useLab.setState({
      circuit: emptyCircuit(),
      selected: null,
      selectedIds: [],
      placing: "net-terminal",
    });
    useLab.getState().placeAt(8, 8);
    useLab.getState().setPlacing("net-terminal");
    useLab.getState().placeAt(14, 8);
    const strips = useLab.getState().circuit.devices.filter((d) => d.kind === "net-terminal");
    expect(strips.length).toBe(2);
    expect(strips[0].tag).toBe("L1");
    expect(strips[1].tag).toBe("L1");
    expect(strips.some((d) => d.tag === "L11" || d.tag === "L12")).toBe(false);
  });

  it("shrinks pin count and drops wires on vanished pins", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "net-terminal", "L1", "body", 0, 0, { pinCount: 4 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 0);
    addWire(c, strip.symbol, "1", lamp.symbol, "1");
    addWire(c, strip.symbol, "5", lamp.symbol, "2");
    const pin1Before = terminalWorld(c, { symbolId: strip.symbol.id, term: "1" });
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().setNetTerminalPinCount(strip.device.id, 2);
    const next = useLab.getState().circuit;
    expect(next.devices[0].params.pinCount).toBe(2);
    expect(next.wires).toHaveLength(1);
    expect(next.wires[0].a.term === "1" || next.wires[0].b.term === "1").toBe(true);
    const pin1After = terminalWorld(next, { symbolId: strip.symbol.id, term: "1" });
    expect(pin1After).toEqual(pin1Before);
    expect(terminalWorld(next, { symbolId: strip.symbol.id, term: "5" })).toBeNull();
    expect(terminalWorld(next, { symbolId: strip.symbol.id, term: "2" })).not.toBeNull();
  });

  it("grows pin count and keeps existing wires", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "net-terminal", "L1", "body", 0, 0, { pinCount: 4 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 0);
    addWire(c, strip.symbol, "1", lamp.symbol, "1");
    useLab.setState({ circuit: c, mode: "edit" });
    useLab.getState().setNetTerminalPinCount(strip.device.id, 6);
    const next = useLab.getState().circuit;
    expect(next.devices[0].params.pinCount).toBe(6);
    expect(next.wires).toHaveLength(1);
    expect(terminalWorld(next, { symbolId: strip.symbol.id, term: "9" })).not.toBeNull();
    expect(terminalWorld(next, { symbolId: strip.symbol.id, term: "12" })).not.toBeNull();
    const hit = findPortAtPoint(
      next,
      terminalWorld(next, { symbolId: strip.symbol.id, term: "10" })!.x,
      terminalWorld(next, { symbolId: strip.symbol.id, term: "10" })!.y,
      4,
    );
    expect(hit?.term).toBe("10");
  });

  it("updateDevice mixed pinCount+color drops wires and keeps color in one undo", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "net-terminal", "L1", "body", 0, 0, { pinCount: 4 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 0);
    addWire(c, strip.symbol, "8", lamp.symbol, "1");
    useLab.setState({ circuit: c, mode: "edit", history: [], future: [] });
    useLab.getState().updateDevice(strip.device.id, { params: { pinCount: 2, color: "#ffffff" } });
    const next = useLab.getState().circuit.devices.find((d) => d.id === strip.device.id)!;
    expect(next.params.pinCount).toBe(2);
    expect(next.params.color).toBe("#ffffff");
    expect(useLab.getState().circuit.wires).toHaveLength(0);
    useLab.getState().undo();
    expect(useLab.getState().circuit.devices.find((d) => d.id === strip.device.id)?.params.pinCount).toBe(4);
    expect(useLab.getState().circuit.wires).toHaveLength(1);
  });

  it("does not reserve pin labels 1-N as wire numbers", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "net-terminal", "L1", "body", 0, 0, { pinCount: 4 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 0);
    addWire(c, strip.symbol, "1", lamp.symbol, "1");
    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();
    expect(useLab.getState().circuit.wires[0].label).toBe("1");
  });

  it("a strip tagged 1 still reserves wire number 1", () => {
    const c = emptyCircuit();
    addDevice(c, "net-terminal", "1", "body", 0, 0, { pinCount: 4 });
    const a = addDevice(c, "lamp", "LT1", "body", 10, 0);
    const b = addDevice(c, "lamp", "LT2", "body", 16, 0);
    addWire(c, a.symbol, "1", b.symbol, "1");
    useLab.setState({ circuit: c });
    useLab.getState().autoLabelWires();
    expect(useLab.getState().circuit.wires[0].label).not.toBe("1");
  });

  it("ignores params.scale on net-terminal pin grid", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "net-terminal", "L1", "body", 2, 2, { pinCount: 4, scale: 2 });
    const p1 = terminalWorld(c, { symbolId: strip.symbol.id, term: "1" });
    const unscaled = emptyCircuit();
    const plain = addDevice(unscaled, "net-terminal", "L1", "body", 2, 2, { pinCount: 4 });
    const q1 = terminalWorld(unscaled, { symbolId: plain.symbol.id, term: "1" });
    expect(p1).toEqual(q1);
    expect(p1!.x % GRID).toBe(0);
  });

  it("applyNetTerminalPinCount is a pure mutator", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "net-terminal", "L1", "body", 0, 0, { pinCount: 4 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 0);
    addWire(c, strip.symbol, "8", lamp.symbol, "1");
    const { dropped, changed } = applyNetTerminalPinCount(c, strip.device.id, 2);
    expect(dropped).toBe(1);
    expect(changed).toBe(true);
    expect(c.devices[0].params.pinCount).toBe(2);
  });
});
