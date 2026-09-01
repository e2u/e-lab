import { describe, expect, it } from "vitest";
import { lampJog } from "./examples";
import { decodeShare, encodeShare, makeDoc, parseDoc } from "./persist";
import { createBlankTemplateCircuit, createBlankTemplateProcess, useLab } from "./store";
import templateData from "./examples/blank-template.json";

describe("persist", () => {
  it("round-trips a circuit through a share payload", () => {
    const circuit = lampJog();
    const doc = makeDoc(circuit, "指示燈點動");
    const payload = encodeShare(doc);
    const back = decodeShare(payload);
    expect(back?.name).toBe("指示燈點動");
    expect(back?.circuit.devices.map((d) => d.tag)).toEqual(circuit.devices.map((d) => d.tag));
    expect(back?.circuit.wires.length).toBe(circuit.wires.length);
  });

  it("round-trips a wire label", () => {
    const circuit = lampJog();
    circuit.wires[0].label = "L1";
    const back = decodeShare(encodeShare(makeDoc(circuit, "lab")));
    expect(back?.circuit.wires[0].label).toBe("L1");
  });

  it("rejects junk", () => {
    expect(parseDoc(null)).toBeNull();
    expect(parseDoc({ version: 1 })).toBeNull();
    expect(decodeShare("nope")).toBeNull();
  });

  it("loads blank template when creating a new diagram", () => {
    const c = createBlankTemplateCircuit();
    expect(c.devices.length).toBe(templateData.circuit.devices.length);
    expect(c.symbols.length).toBe(templateData.circuit.symbols.length);
    expect(c.wires.length).toBe(templateData.circuit.wires.length);

    const proc = createBlankTemplateProcess();
    expect(proc.temperature).toBe(templateData.process.temperature);

    // Test store loadBlankTemplate
    useLab.getState().loadBlankTemplate(true);
    const state = useLab.getState();
    expect(state.circuit.devices.length).toBe(templateData.circuit.devices.length);
    expect(state.circuit.symbols.length).toBe(templateData.circuit.symbols.length);
    expect(state.circuit.wires.length).toBe(templateData.circuit.wires.length);
    expect(state.isDirty).toBe(false);
  });

  it("persists device setpoint and parameters across updates and drafts", () => {
    useLab.getState().newBoard();
    useLab.getState().setPlacing("float");
    useLab.getState().placeAt(5, 5);
    const state = useLab.getState();
    const floatSym = state.circuit.symbols[state.circuit.symbols.length - 1];
    const floatDev = state.circuit.devices.find((d) => d.id === floatSym.deviceId)!;
    expect(floatDev.params.setpoint).toBe(50);

    // Update setpoint to 90%
    useLab.getState().updateDevice(floatDev.id, { setpoint: 90 });
    const updatedDev = useLab.getState().circuit.devices.find((d) => d.id === floatDev.id)!;
    expect(updatedDev.params.setpoint).toBe(90);

    // Verify roundtrip encoding
    const doc = makeDoc(useLab.getState().circuit, "Float Test", useLab.getState().process);
    const roundtripped = decodeShare(encodeShare(doc));
    const roundtrippedDev = roundtripped?.circuit.devices.find((d) => d.id === floatDev.id);
    expect(roundtrippedDev?.params.setpoint).toBe(90);
  });
});
