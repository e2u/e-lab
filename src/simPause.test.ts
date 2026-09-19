import { describe, it, expect, beforeEach, vi } from "vitest";
import { useLab } from "./store";
import { emptyCircuit } from "./circuitBuilder";
import { simClockActive } from "./App";
import * as analytics from "./analytics";

describe("Simulation Pause and Resume", () => {
  beforeEach(() => {
    useLab.setState({
      circuit: emptyCircuit(),
      mode: "edit",
      running: false,
      timeMs: 0,
      held: [],
      meterHistory: {},
    });
  });

  it("enters run mode and starts running", () => {
    const store = useLab.getState();
    store.setMode("run");

    expect(useLab.getState().mode).toBe("run");
    expect(useLab.getState().running).toBe(true);
    expect(useLab.getState().timeMs).toBe(0);
  });

  it("pauses simulation and preserves timer and relay states without resetting", () => {
    const s = useLab.getState();
    s.loadCircuit({ devices: [], symbols: [], wires: [], groups: [] });
    useLab.setState({ history: [], future: [], mode: "edit" });

    // Place mains and timer-on
    s.setPlacing("mains-3ph");
    s.placeAt(0, 0);
    s.setPlacing("timer-on");
    s.placeAt(6, 0);

    const [, ktDev] = useLab.getState().circuit.devices;
    s.updateDevice(ktDev.id, { delayMs: 2000 });

    const [gSym, ktSym] = useLab.getState().circuit.symbols;
    s.clickPort({ symbolId: gSym.id, term: "L1" });
    s.clickPort({ symbolId: ktSym.id, term: "A1" });
    s.clickPort({ symbolId: ktSym.id, term: "A2" });
    s.clickPort({ symbolId: gSym.id, term: "N" });

    // Switch to run mode
    s.setMode("run");

    // Step 5 times (250ms)
    for (let i = 0; i < 5; i++) {
      useLab.getState().step();
    }

    expect(useLab.getState().timeMs).toBe(250);
    expect(useLab.getState().snapshot.runtime[ktDev.id]?.elapsedMs).toBe(250);
    expect(useLab.getState().snapshot.runtime[ktDev.id]?.done).toBe(false);

    // Pause simulation
    s.pauseSim();
    expect(useLab.getState().running).toBe(false);
    expect(useLab.getState().mode).toBe("run");
    expect(useLab.getState().timeMs).toBe(250);
    expect(useLab.getState().snapshot.runtime[ktDev.id]?.elapsedMs).toBe(250);

    // Calling setMode("run") while paused resumes running without resetting timeMs or snapshot
    s.setMode("run");
    expect(useLab.getState().running).toBe(true);
    expect(useLab.getState().timeMs).toBe(250);
    expect(useLab.getState().snapshot.runtime[ktDev.id]?.elapsedMs).toBe(250);

    // Step 5 more times (to 500ms)
    for (let i = 0; i < 5; i++) {
      useLab.getState().step();
    }

    expect(useLab.getState().timeMs).toBe(500);
    expect(useLab.getState().snapshot.runtime[ktDev.id]?.elapsedMs).toBe(500);

    // Pause again and resume with resumeSim()
    s.pauseSim();
    expect(useLab.getState().running).toBe(false);
    s.resumeSim();
    expect(useLab.getState().running).toBe(true);
    expect(useLab.getState().timeMs).toBe(500);

    // Calling resetSim resets back to t=0
    s.resetSim();
    expect(useLab.getState().timeMs).toBe(0);
    expect(useLab.getState().snapshot.runtime[ktDev.id]?.elapsedMs).toBe(0);
  });

  it("keeps the sim clock off while the tab is hidden or not in run", () => {
    expect(simClockActive(true, "run", false)).toBe(true);
    expect(simClockActive(true, "run", true)).toBe(false);
    expect(simClockActive(false, "run", false)).toBe(false);
    expect(simClockActive(true, "edit", false)).toBe(false);
  });

  it("does not fire circuit_step analytics on every tick", () => {
    const spy = vi.spyOn(analytics, "trackCircuitStep");
    useLab.getState().setMode("run");
    for (let i = 0; i < 20; i++) useLab.getState().step();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
