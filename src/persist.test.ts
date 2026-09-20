import { describe, expect, it } from "vitest";
import { addDevice } from "./circuitBuilder";
import { lampJog } from "./examples";
import {
  decodeShare,
  docFromHash,
  encodeShare,
  fragmentFromLocation,
  makeDoc,
  parseDoc,
} from "./persist";
import { createBlankTemplateCircuit, createBlankTemplateProcess, useLab } from "./store";

// templateData is no longer used after changing blank template to empty circuit

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

  it("round-trips group comment and hideOnPrint", () => {
    const circuit = lampJog();
    circuit.groups = [
      {
        id: "g1",
        memberIds: circuit.symbols.slice(0, 2).map((s) => s.id),
        hideOnPrint: true,
        name: "Station A",
      },
    ];
    const back = decodeShare(encodeShare(makeDoc(circuit, "lab")));
    expect(back?.circuit.groups?.[0]?.hideOnPrint).toBe(true);
    expect(back?.circuit.groups?.[0]?.name).toBe("Station A");
  });

  it("round-trips comment hideOnPrint", () => {
    const circuit = lampJog();
    const rem = addDevice(circuit, "comment", "REM1", "body", 4, 4, { text: "note", hideOnPrint: true });
    const back = decodeShare(encodeShare(makeDoc(circuit, "lab")));
    const saved = back?.circuit.devices.find((d) => d.id === rem.device.id);
    expect(saved?.params.hideOnPrint).toBe(true);
  });

  it("round-trips per-symbol hideTag", () => {
    const circuit = lampJog();
    const lampSym = circuit.symbols.find((s) => circuit.devices.find((d) => d.id === s.deviceId)?.kind === "lamp")!;
    lampSym.hideTag = true;
    const back = decodeShare(encodeShare(makeDoc(circuit, "lab")));
    const saved = back?.circuit.symbols.find((s) => s.id === lampSym.id);
    expect(saved?.hideTag).toBe(true);
  });

  it("migrates legacy device hideTag onto each of that device's symbols", () => {
    const circuit = lampJog();
    const lamp = circuit.devices.find((d) => d.kind === "lamp")!;
    lamp.params.hideTag = true;
    const back = decodeShare(encodeShare(makeDoc(circuit, "lab")));
    const savedDev = back?.circuit.devices.find((d) => d.id === lamp.id);
    expect(savedDev?.params.hideTag).toBeUndefined();
    const savedSyms = back?.circuit.symbols.filter((s) => s.deviceId === lamp.id) ?? [];
    expect(savedSyms.length).toBeGreaterThan(0);
    expect(savedSyms.every((s) => s.hideTag === true)).toBe(true);
  });

  it("round-trips net-terminal pinCount", () => {
    const circuit = createBlankTemplateCircuit();
    const strip = addDevice(circuit, "net-terminal", "L1", "body", 4, 4, { pinCount: 8 });
    const back = decodeShare(encodeShare(makeDoc(circuit, "lab")));
    const saved = back?.circuit.devices.find((d) => d.id === strip.device.id);
    expect(saved?.params.pinCount).toBe(8);
  });

  it("loads out-of-range pinCount without throwing", () => {
    const circuit = createBlankTemplateCircuit();
    addDevice(circuit, "net-terminal", "L1", "body", 4, 4, { pinCount: 0 });
    const back = parseDoc(makeDoc(circuit, "lab"));
    expect(back).not.toBeNull();
    expect(back?.circuit.devices.some((d) => d.kind === "net-terminal")).toBe(true);
  });

  it("rejects junk", () => {
    expect(parseDoc(null)).toBeNull();
    expect(parseDoc({ version: 1 })).toBeNull();
    expect(decodeShare("nope")).toBeNull();
  });

  it("restores share hashes Firefox / Safari may rewrite", () => {
    const circuit = lampJog();
    const doc = makeDoc(circuit, "指示燈點動");
    const payload = encodeShare(doc);

    expect(docFromHash(`#c=${payload}`)?.name).toBe("指示燈點動");
    expect(docFromHash(`#c%3D${payload}`)?.name).toBe("指示燈點動");
    expect(docFromHash(payload)?.name).toBe("指示燈點動");

    const hrefEncoded = `https://elab.example/%23c=${payload}`;
    expect(docFromHash(fragmentFromLocation(hrefEncoded, ""))?.name).toBe("指示燈點動");

    const hrefEq = `https://elab.example/%23c%3D${payload}`;
    expect(docFromHash(fragmentFromLocation(hrefEq, ""))?.name).toBe("指示燈點動");

    const dashed = payload.replace(/-/g, "–");
    expect(decodeShare(dashed)?.name).toBe("指示燈點動");

    const wrapped = `#c=${payload.slice(0, 24)}\n${payload.slice(24)}`;
    expect(docFromHash(wrapped)?.name).toBe("指示燈點動");
  });

  it("loads blank template when creating a new diagram", () => {
    const c = createBlankTemplateCircuit();
    // New blank templates should be empty
    expect(c.symbols.length).toBe(0);
    expect(c.wires.length).toBe(0);
    expect(c.devices.length).toBe(0);

    const proc = createBlankTemplateProcess();
    expect(proc.temperature).toBeDefined();

    // Test store loadBlankTemplate
    useLab.getState().setLayoutMode("ladder");
    useLab.getState().setMode("run");
    useLab.getState().loadBlankTemplate(true);
    const state = useLab.getState();
    // After loading blank template, circuit should also be empty
    expect(state.circuit.devices.length).toBe(0);
    expect(state.circuit.symbols.length).toBe(0);
    expect(state.circuit.wires.length).toBe(0);
    expect(state.layoutMode).toBe("schematic");
    expect(state.mode).toBe("edit");
    expect(state.isDirty).toBe(false);
  });

  it("persists device setpoint and parameters across updates and drafts", () => {
    useLab.getState().newBoard();
    useLab.getState().setPlacing("float-no");
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
