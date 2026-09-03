import { beforeEach, describe, expect, it } from "vitest";
import { useLab } from "../../store";
import { interact } from "./interact";

describe("schematic interact dispatcher", () => {
  beforeEach(() => {
    useLab.setState({
      mode: "run",
      circuit: {
        devices: [
          { id: "pb1", kind: "pb-no", tag: "SB1", params: {} },
          { id: "es1", kind: "estop", tag: "SB0", params: {} },
          { id: "qf1", kind: "breaker-1p", tag: "QF1", params: {} },
          { id: "fu1", kind: "fuse", tag: "FU1", params: {} },
          { id: "sa1", kind: "selector-2", tag: "SA1", params: {} },
        ],
        symbols: [],
        wires: [],
      },
      held: [],
      process: {
        temperature: 20,
        pressure: 1,
        level: 50,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      },
    });
  });

  it("ignores interactions when not in run mode", () => {
    useLab.setState({ mode: "edit" });
    interact("pb-no", "pb1", true);
    expect(useLab.getState().held).toEqual([]);
  });

  it("handles momentary push buttons (down and up)", () => {
    interact("pb-no", "pb1", true);
    expect(useLab.getState().held).toContain("pb1");

    interact("pb-no", "pb1", false);
    expect(useLab.getState().held).not.toContain("pb1");
  });

  it("handles toggles and estops on pointer down only", () => {
    interact("estop", "es1", true);
    expect(useLab.getState().snapshot.runtime["es1"]?.actuated).toBe(true);

    interact("estop", "es1", false);
    // Should still be true on pointer up
    expect(useLab.getState().snapshot.runtime["es1"]?.actuated).toBe(true);
  });

  it("handles breakers and fuses", () => {
    // Breakers default to on: true, so toggling turns them off
    interact("breaker-1p", "qf1", true);
    expect(useLab.getState().snapshot.runtime["qf1"]?.on).toBe(false);

    // Fuses default to tripped: false, so toggling trips them
    interact("fuse", "fu1", true);
    expect(useLab.getState().snapshot.runtime["fu1"]?.tripped).toBe(true);
  });

  it("handles process variables (limit, prox, photo)", () => {
    expect(useLab.getState().process.limitHit).toBe(false);
    interact("limit-no", "any", true);
    expect(useLab.getState().process.limitHit).toBe(true);

    expect(useLab.getState().process.proxHit).toBe(false);
    interact("prox", "any", true);
    expect(useLab.getState().process.proxHit).toBe(true);

    expect(useLab.getState().process.photoHit).toBe(false);
    interact("photo", "any", true);
    expect(useLab.getState().process.photoHit).toBe(true);
  });

  it("handles multiple float switches with independent setpoints and level adjustment", () => {
    useLab.setState({
      circuit: {
        devices: [
          { id: "fl1", kind: "float", tag: "SL1", params: { setpoint: 30 } },
          { id: "fl2", kind: "float", tag: "SL2", params: { setpoint: 80 } },
        ],
        symbols: [
          { id: "sfl1", deviceId: "fl1", variant: "contact-no", x: 10, y: 10, rot: 0 },
          { id: "sfl2", deviceId: "fl2", variant: "contact-no", x: 20, y: 10, rot: 0 },
        ],
        wires: [],
      },
      process: {
        temperature: 20,
        pressure: 1,
        level: 10,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      },
    });

    // Initial state: level=10, both SL1 (sp=30) and SL2 (sp=80) are below threshold
    expect(useLab.getState().process.level).toBe(10);

    // Clicking SL1 sets level to 30 (triggering SL1)
    interact("float", "fl1", true);
    expect(useLab.getState().process.level).toBe(30);

    // Clicking SL2 sets level to 80 (triggering both SL1 and SL2)
    interact("float", "fl2", true);
    expect(useLab.getState().process.level).toBe(80);

    // Clicking SL2 again resets level below 80 (to 70)
    interact("float", "fl2", true);
    expect(useLab.getState().process.level).toBe(70);
  });

  it("handles temperature, pressure and flow switch setpoints and process variables", () => {
    useLab.setState({
      circuit: {
        devices: [
          { id: "ts1", kind: "temp-no", tag: "ST1", params: { setpoint: 150 } },
          { id: "ps1", kind: "pressure-no", tag: "SP1", params: { setpoint: 6 } },
          { id: "fs1", kind: "flow-no", tag: "SF1", params: { setpoint: 45 } },
        ],
        symbols: [],
        wires: [],
      },
      process: {
        temperature: 75,
        pressure: 1,
        level: 0,
        flow: 10,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      },
    });

    // Temperature switch interaction
    interact("temp-no", "ts1", true);
    expect(useLab.getState().process.temperature).toBe(150);
    interact("temp-no", "ts1", true);
    expect(useLab.getState().process.temperature).toBe(140);

    // Pressure switch interaction
    interact("pressure-no", "ps1", true);
    expect(useLab.getState().process.pressure).toBe(6);
    interact("pressure-no", "ps1", true);
    expect(useLab.getState().process.pressure).toBe(5);

    // Flow switch interaction
    interact("flow-no", "fs1", true);
    expect(useLab.getState().process.flow).toBe(45);
    interact("flow-no", "fs1", true);
    expect(useLab.getState().process.flow).toBe(35);
  });

  it("aligns selected symbols in store without side effects", () => {
    useLab.setState({
      mode: "edit",
      circuit: {
        devices: [
          { id: "d1", kind: "lamp", tag: "HL1", params: {} },
          { id: "d2", kind: "lamp", tag: "HL2", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "d1", variant: "body", x: 2, y: 10, rot: 0 },
          { id: "s2", deviceId: "d2", variant: "body", x: 8, y: 20, rot: 0 },
        ],
        wires: [],
      },
      selectedIds: ["s1", "s2"],
    });

    useLab.getState().alignSelected("top");
    const symbols = useLab.getState().circuit.symbols;
    const s1 = symbols.find((s) => s.id === "s1");
    const s2 = symbols.find((s) => s.id === "s2");
    expect(s1?.y).toBe(10);
    expect(s2?.y).toBe(10);
  });

  it("places breaker-1p and breaker-3p with default vertical orientation and right-facing arc", () => {
    useLab.setState({
      mode: "edit",
      circuit: {
        devices: [],
        symbols: [],
        wires: [],
      },
    });

    useLab.getState().setPlacing("breaker-1p");
    expect(useLab.getState().placingFlipX).toBe(false);
    expect(useLab.getState().placingFlipY).toBe(false);
    expect(useLab.getState().placingRot).toBe(0);

    useLab.getState().placeAt(5, 5);
    const sym1 = useLab.getState().circuit.symbols[0];
    expect(sym1.flipX).toBe(false);
    expect(sym1.rot).toBe(0);

    useLab.getState().setPlacing("breaker-3p");
    expect(useLab.getState().placingRot).toBe(0);

    useLab.getState().placeAt(15, 15);
    const sym2 = useLab.getState().circuit.symbols[1];
    expect(sym2.rot).toBe(0);
  });
});
