import { beforeEach, describe, expect, it } from "vitest";
import { useLab } from "./store";

describe("Selection & Tag Isolation", () => {
  beforeEach(() => {
    useLab.getState().loadBlankTemplate(true);
  });

  it("updates device tag without mutating wire labels", () => {
    const s = useLab.getState();
    s.setPlacing("ground");
    s.placeAt(5, 5);
    const symA = useLab.getState().circuit.symbols[0];
    const devA = useLab.getState().circuit.devices[0];

    s.setPlacing("fuse");
    s.placeAt(10, 10);
    const symB = useLab.getState().circuit.symbols[1];

    s.clickPort({ symbolId: symA.id, term: "1" });
    s.clickPort({ symbolId: symB.id, term: "1" });
    const wire = useLab.getState().circuit.wires[0];

    // Select symbol A and update tag
    s.select({ type: "symbol", id: symA.id });
    s.updateDevice(devA.id, { tag: "Ground" });
    expect(useLab.getState().circuit.devices.find((d) => d.id === devA.id)?.tag).toBe("Ground");
    expect(useLab.getState().circuit.wires.find((w) => w.id === wire.id)?.label).toBeUndefined();

    // Select wire and update wire label
    s.select({ type: "wire", id: wire.id });
    s.updateWire(wire.id, { label: "W1" });
    expect(useLab.getState().circuit.wires.find((w) => w.id === wire.id)?.label).toBe("W1");
    expect(useLab.getState().circuit.devices.find((d) => d.id === devA.id)?.tag).toBe("Ground");
  });

  it("toggles hideTag on the selected symbol without changing the tag text", () => {
    const s = useLab.getState();
    s.setPlacing("lamp");
    s.placeAt(6, 6);
    const circuit = useLab.getState().circuit;
    const dev = circuit.devices.find((d) => d.kind === "lamp")!;
    const sym = circuit.symbols.find((x) => x.deviceId === dev.id)!;
    const tag = dev.tag;
    s.setSymbolHideTag(sym.id, true);
    const next = useLab.getState().circuit;
    expect(next.symbols.find((x) => x.id === sym.id)?.hideTag).toBe(true);
    expect(next.devices.find((d) => d.id === dev.id)?.tag).toBe(tag);
  });
});
