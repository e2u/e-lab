import { describe, expect, it } from "vitest";
import { lampJog } from "./examples";
import { decodeShare, encodeShare, makeDoc, parseDoc } from "./persist";

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
});
