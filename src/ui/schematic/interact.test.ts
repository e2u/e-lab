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
});
