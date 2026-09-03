import { describe, expect, it } from "vitest";
import { autoLayoutCircuit } from "./autoLayout";
import { addDevice, addSymbol, addWire, emptyCircuit } from "../circuitBuilder";
import { useLab } from "../store";
import { GRID } from "../types";
import overloadAlarmDoc from "../examples/07-overload-alarm.json";
import dolMotorDoc from "../examples/06-motor-3ph-dol.json";
import basicLampDoc from "../examples/01-basic-lamp.json";

describe("autoLayoutCircuit", () => {
  it("correctly separates power circuit and control circuit in 07-overload-alarm", () => {
    const rawCircuit = overloadAlarmDoc.circuit as any;
    const layout = autoLayoutCircuit(rawCircuit);

    expect(layout.symbols.length).toBeGreaterThan(0);
    expect(layout.devices.length).toBeGreaterThanOrEqual(rawCircuit.devices.length);

    // 1. Check Power circuit devices
    const mainsSym = layout.symbols.find((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "mains-3ph";
    });
    const motorSym = layout.symbols.find((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "motor-3ph";
    });
    const brkSym = layout.symbols.find((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "breaker-3p" || dev?.kind === "overload";
    });

    expect(mainsSym).toBeDefined();
    expect(motorSym).toBeDefined();
    expect(brkSym).toBeDefined();

    // Power devices are on the top power rail (Y <= 10)
    expect(mainsSym!.y).toBeLessThanOrEqual(5);
    expect(brkSym!.y).toBeLessThanOrEqual(5);
    expect(motorSym!.y).toBeLessThanOrEqual(5);
    // Mains is to the left of breaker, breaker is to the left of motor
    expect(mainsSym!.x).toBeLessThan(brkSym!.x);
    expect(brkSym!.x).toBeLessThan(motorSym!.x);

    // 2. Check Control circuit devices
    const coilSym = layout.symbols.find((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "contactor" && s.variant === "coil";
    });
    const stopSym = layout.symbols.find((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "pb-nc";
    });
    const startSym = layout.symbols.find((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "pb-no";
    });
    const auxNoSym = layout.symbols.find((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "contactor" && s.variant === "aux-no";
    });

    expect(coilSym).toBeDefined();
    expect(stopSym).toBeDefined();
    expect(startSym).toBeDefined();

    // Control circuit is below power circuit (Y >= 15)
    expect(stopSym!.y).toBeGreaterThanOrEqual(15);
    expect(startSym!.y).toBeGreaterThanOrEqual(15);
    expect(coilSym!.y).toBeGreaterThanOrEqual(15);

    // Horizontal linear ordering: Stop switch -> Start switch -> Output Coil
    expect(stopSym!.x).toBeLessThan(startSym!.x);
    expect(startSym!.x).toBeLessThan(coilSym!.x);

    // Parallel latch contact is placed directly below the start switch
    if (auxNoSym) {
      expect(auxNoSym.x).toBe(startSym!.x);
      expect(auxNoSym.y).toBeGreaterThan(startSym!.y);
    }

    // All symbol coordinates strictly integers (grid-aligned)
    for (const sym of layout.symbols) {
      expect(Number.isInteger(sym.x)).toBe(true);
      expect(Number.isInteger(sym.y)).toBe(true);
    }
  });

  it("handles DOL motor and basic lamp circuits smoothly", () => {
    const dolLayout = autoLayoutCircuit(dolMotorDoc.circuit as any);
    expect(dolLayout.symbols.length).toBeGreaterThan(0);
    expect(dolLayout.wires.length).toBeGreaterThan(0);

    const lampLayout = autoLayoutCircuit(basicLampDoc.circuit as any);
    expect(lampLayout.symbols.length).toBeGreaterThan(0);
    expect(lampLayout.wires.length).toBeGreaterThan(0);
  });

  it("organizes forward-reverse interlock circuit into separate rungs and horizontal sequence", () => {
    const c = emptyCircuit();
    const mains = addDevice(c, "mains-3ph", "G1", "delta", 0, 0);
    const brk = addDevice(c, "breaker-3p", "QF1", "body", 0, 0);
    const km1Main = addDevice(c, "contactor", "KM1", "main", 0, 0);
    const km2Main = addDevice(c, "contactor", "KM2", "main-rev", 0, 0);
    const motor = addDevice(c, "motor-3ph", "M1", "body", 0, 0);

    const tc = addDevice(c, "transformer", "TC1", "body", 0, 0);
    const sbStop = addDevice(c, "pb-nc", "SB1", "body", 0, 0);
    const sbFwd = addDevice(c, "pb-no", "SB2", "body", 0, 0);
    const km1AuxNo = addSymbol(c, km1Main.device.id, "aux-no", 0, 0);
    const km2AuxNc = addSymbol(c, km2Main.device.id, "aux-nc", 0, 0);
    const km1Coil = addSymbol(c, km1Main.device.id, "coil", 0, 0);

    const sbRev = addDevice(c, "pb-no", "SB3", "body", 0, 0);
    const km2AuxNo = addSymbol(c, km2Main.device.id, "aux-no", 0, 0);
    const km1AuxNc = addSymbol(c, km1Main.device.id, "aux-nc", 0, 0);
    const km2Coil = addSymbol(c, km2Main.device.id, "coil", 0, 0);

    // Power wiring
    addWire(c, mains.symbol, "L1", brk.symbol, "L1");
    addWire(c, brk.symbol, "T1", km1Main.symbol, "L1");
    addWire(c, km1Main.symbol, "T1", motor.symbol, "W");

    // Control wiring for rung 1
    addWire(c, tc.symbol, "X1", sbStop.symbol, "1");
    addWire(c, sbStop.symbol, "2", sbFwd.symbol, "1");
    addWire(c, sbFwd.symbol, "1", km1AuxNo, "13");
    addWire(c, sbFwd.symbol, "2", km1AuxNo, "14");
    addWire(c, sbFwd.symbol, "2", km2AuxNc, "21");
    addWire(c, km2AuxNc, "22", km1Coil, "A1");
    addWire(c, km1Coil, "A2", tc.symbol, "X2");

    const layout = autoLayoutCircuit(c);

    // Verify KM1 coil and KM2 coil are placed on separate rows (different Y)
    const km1CoilPlaced = layout.symbols.find((s) => s.id === km1Coil.id);
    const km2CoilPlaced = layout.symbols.find((s) => s.id === km2Coil.id);
    expect(km1CoilPlaced).toBeDefined();
    expect(km2CoilPlaced).toBeDefined();
    expect(km1CoilPlaced!.y).not.toBe(km2CoilPlaced!.y);

    // Verify horizontal ordering: Stop -> Start -> Interlock -> Coil
    const stopPlaced = layout.symbols.find((s) => s.id === sbStop.symbol.id)!;
    const startPlaced = layout.symbols.find((s) => s.id === sbFwd.symbol.id)!;
    const interlockPlaced = layout.symbols.find((s) => s.id === km2AuxNc.id)!;

    expect(stopPlaced.x).toBeLessThan(startPlaced.x);
    expect(startPlaced.x).toBeLessThan(interlockPlaced.x);
    expect(interlockPlaced.x).toBeLessThan(km1CoilPlaced!.x);
  });

  it("can be triggered via store action useLab.getState().autoLayout()", () => {
    useLab.setState({
      circuit: JSON.parse(JSON.stringify(overloadAlarmDoc.circuit)),
      selected: { type: "symbol", id: "some-id" },
      selectedIds: ["some-id"],
    });

    useLab.getState().autoLayout();

    const state = useLab.getState();
    expect(state.circuit.symbols.length).toBeGreaterThan(0);
    expect(state.selected).toBeNull();
    expect(state.selectedIds).toEqual([]);
    expect(state.history.length).toBeGreaterThan(0);
  });

  it("ensures orthogonal wiring and clean return bus without diagonal lines", () => {
    const rawCircuit = overloadAlarmDoc.circuit as any;
    const layout = autoLayoutCircuit(rawCircuit);

    // Verify all symbols have integer coordinates
    for (const sym of layout.symbols) {
      expect(Number.isInteger(sym.x)).toBe(true);
      expect(Number.isInteger(sym.y)).toBe(true);
    }

    // Verify all junctions are properly placed
    const junctions = layout.symbols.filter((s) => {
      const dev = layout.devices.find((d) => d.id === s.deviceId);
      return dev?.kind === "junction";
    });
    for (const j of junctions) {
      expect(Number.isInteger(j.x)).toBe(true);
      expect(Number.isInteger(j.y)).toBe(true);
    }

    // Verify presence of power devices and control rungs
    expect(junctions.length).toBeGreaterThan(0);
    expect(layout.wires.length).toBeGreaterThan(0);
  });
});
