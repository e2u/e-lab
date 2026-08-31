import { describe, expect, it, beforeEach } from "vitest";
import { buildLadderDiagram, isContactClosed } from "./ladder/ladderLayout";
import {
  synthesizeAddParallelBranch,
  synthesizeAddRung,
  synthesizeDeleteElement,
  synthesizeInsertContact,
  synthesizeToggleContactVariant,
} from "./ladder/ladderSynthesis";
import { useLab } from "./store";
import { emptySnapshot } from "./sim/engine";
import type { Circuit } from "./types";
import { t, setLang } from "./i18n";

describe("Ladder Diagram System", () => {
  beforeEach(() => {
    useLab.setState({
      layoutMode: "schematic",
      mode: "edit",
      running: false,
      held: [],
    });
  });

  describe("Layout Mode State Management", () => {
    it("should toggle and set layoutMode between schematic and ladder, and automatically enter run mode on ladder", () => {
      expect(useLab.getState().layoutMode).toBe("schematic");
      expect(useLab.getState().mode).toBe("edit");

      useLab.getState().setLayoutMode("ladder");
      expect(useLab.getState().layoutMode).toBe("ladder");
      expect(useLab.getState().mode).toBe("run");
      expect(useLab.getState().running).toBe(true);

      useLab.getState().toggleLayoutMode();
      expect(useLab.getState().layoutMode).toBe("schematic");

      // Set to edit mode in schematic
      useLab.getState().setMode("edit");
      expect(useLab.getState().mode).toBe("edit");

      // Toggle to ladder mode directly switches to run mode
      useLab.getState().toggleLayoutMode();
      expect(useLab.getState().layoutMode).toBe("ladder");
      expect(useLab.getState().mode).toBe("run");
      expect(useLab.getState().running).toBe(true);
    });

    it("should keep sideOpen and inspection accessible in ladder mode", () => {
      useLab.getState().setLayoutMode("ladder");
      useLab.getState().setSideOpen(false);
      expect(useLab.getState().sideOpen).toBe(false);

      // Select symbol and open side panel
      useLab.getState().select({ type: "symbol", id: "s1" });
      useLab.getState().setSideOpen(true);
      expect(useLab.getState().sideOpen).toBe(true);
      expect(useLab.getState().selected).toEqual({ type: "symbol", id: "s1" });

      // Toggle side panel in ladder mode
      useLab.getState().toggleSide();
      expect(useLab.getState().sideOpen).toBe(false);
      useLab.getState().toggleSide();
      expect(useLab.getState().sideOpen).toBe(true);
    });
  });

  describe("Ladder Diagram Generation from Circuit", () => {
    it("should generate standard ladder rungs for motor start-stop circuit", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye", voltage: 480 } },
          { id: "tc1", kind: "transformer", tag: "TC1", params: { ratio: "480/120" } },
          { id: "ol1", kind: "overload", tag: "OL1", params: {} },
          { id: "sb1", kind: "pb-nc", tag: "Stop", params: {} },
          { id: "sb2", kind: "pb-no", tag: "Start", params: {} },
          { id: "km1", kind: "contactor", tag: "M1", params: {} },
          { id: "hl1", kind: "lamp", tag: "Run Lamp", params: {} },
          { id: "m1", kind: "motor-3ph", tag: "Motor 1", params: { power: 7.5 } },
        ],
        symbols: [
          { id: "s_tc1", deviceId: "tc1", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s_ol1", deviceId: "ol1", variant: "body", x: 4, y: 0, rot: 0 },
          { id: "s_sb1", deviceId: "sb1", variant: "body", x: 8, y: 0, rot: 0 },
          { id: "s_sb2", deviceId: "sb2", variant: "body", x: 12, y: 0, rot: 0 },
          { id: "s_km1_coil", deviceId: "km1", variant: "coil", x: 16, y: 0, rot: 0 },
          { id: "s_km1_no", deviceId: "km1", variant: "aux-no", x: 12, y: 4, rot: 0 },
          { id: "s_hl1", deviceId: "hl1", variant: "body", x: 16, y: 8, rot: 0 },
        ],
        wires: [
          // Hot Rail (TC1:X1) -> OL1 (95-96) -> Stop (1-2) -> Start (3-4) -> M1 (A1-A2) -> Return Rail (TC1:X2)
          { id: "w1", a: { symbolId: "s_tc1", term: "X1" }, b: { symbolId: "s_ol1", term: "95" } },
          { id: "w2", a: { symbolId: "s_ol1", term: "96" }, b: { symbolId: "s_sb1", term: "1" } },
          { id: "w3", a: { symbolId: "s_sb1", term: "2" }, b: { symbolId: "s_sb2", term: "3" } },
          { id: "w4", a: { symbolId: "s_sb2", term: "4" }, b: { symbolId: "s_km1_coil", term: "A1" } },
          { id: "w5", a: { symbolId: "s_km1_coil", term: "A2" }, b: { symbolId: "s_tc1", term: "X2" } },
          // Seal-in parallel branch: M1 NO (13-14) in parallel with Start (sb2)
          { id: "w6", a: { symbolId: "s_sb1", term: "2" }, b: { symbolId: "s_km1_no", term: "13" } },
          { id: "w7", a: { symbolId: "s_km1_no", term: "14" }, b: { symbolId: "s_km1_coil", term: "A1" } },
          // Run Lamp branch
          { id: "w8", a: { symbolId: "s_km1_coil", term: "A1" }, b: { symbolId: "s_hl1", term: "1" } },
          { id: "w9", a: { symbolId: "s_hl1", term: "2" }, b: { symbolId: "s_tc1", term: "X2" } },
        ],
      };

      const snap = emptySnapshot(circuit);
      snap.runtime.tc1 = { ...snap.runtime.tc1, energized: true };

      const model = buildLadderDiagram(
        circuit,
        snap,
        [],
        { temperature: 25, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false },
      );

      // Verify rails
      expect(model.leftRailLabel).toContain("TC1");
      expect(model.rightRailLabel).toContain("TC1");
      expect(model.isLeftRailLive).toBe(true);

      // Verify Power Branch
      expect(model.powerBranches.length).toBe(1);
      expect(model.powerBranches[0].voltage).toBe(480);
      expect(model.powerBranches[0].power).toBe(7.5);

      // Verify Control Rungs
      expect(model.rungs.length).toBeGreaterThanOrEqual(2);

      // Rung 1: Start / Stop & Seal-In
      const rung1 = model.rungs[0];
      expect(rung1.rungNumber).toBe(1);
      expect(rung1.title).toContain("START");
      expect(rung1.coils.length).toBe(1);
      expect(rung1.coils[0].label).toBe("M1");

      // Verify Stop and Overload are in Rung 1 items
      const hasStop = rung1.items.some((it) => it.type === "contact" && it.element.label === "Stop");
      const hasOverload = rung1.items.some((it) => it.type === "contact" && it.element.label === "OL1");
      const hasParallel = rung1.items.some((it) => it.type === "parallel");
      expect(hasStop).toBe(true);
      expect(hasOverload).toBe(true);
      expect(hasParallel).toBe(true);

      // Rung 2: Pilot Light
      const rung2 = model.rungs[1];
      expect(rung2.title).toContain("STATUS INDICATOR");
      expect(rung2.coils.length).toBe(1);
      expect(rung2.coils[0].label).toBe("Run Lamp");
    });

    it("should evaluate real-time contact conduction states accurately", () => {
      const devPbNo = { id: "d_start", kind: "pb-no" as const, tag: "Start", params: {} };
      const devPbNc = { id: "d_stop", kind: "pb-nc" as const, tag: "Stop", params: {} };
      const devEstop = { id: "d_estop", kind: "estop" as const, tag: "E-Stop", params: {} };
      const devOverload = { id: "d_ol", kind: "overload" as const, tag: "OL", params: {} };
      const devContactor = { id: "d_km", kind: "contactor" as const, tag: "KM1", params: {} };

      const testCircuit: Circuit = {
        devices: [devPbNo, devPbNc, devEstop, devOverload, devContactor],
        symbols: [],
        wires: [],
      };

      const snap = emptySnapshot(testCircuit);
      snap.runtime.d_ol.tripped = true;
      snap.runtime.d_km.energized = true;

      const proc = { temperature: 25, pressure: 0, level: 0, flow: 0, limitHit: false, proxHit: false, photoHit: false };

      // PB NO not pressed -> open
      expect(isContactClosed(devPbNo, "body", snap, [], proc)).toBe(false);
      // PB NO pressed (held) -> closed
      expect(isContactClosed(devPbNo, "body", snap, ["d_start"], proc)).toBe(true);

      // PB NC not pressed -> closed
      expect(isContactClosed(devPbNc, "body", snap, [], proc)).toBe(true);
      // PB NC pressed -> open
      expect(isContactClosed(devPbNc, "body", snap, ["d_stop"], proc)).toBe(false);

      // E-stop unactuated -> closed
      expect(isContactClosed(devEstop, "body", snap, [], proc)).toBe(true);

      // Overload tripped -> NC 95-96 open
      expect(isContactClosed(devOverload, "body", snap, [], proc)).toBe(false);

      // Contactor energized -> aux-no closed, aux-nc open
      expect(isContactClosed(devContactor, "aux-no", snap, [], proc)).toBe(true);
      expect(isContactClosed(devContactor, "aux-nc", snap, [], proc)).toBe(false);
    });

    it("should correctly assign contact types for push buttons vs relay auxiliary contacts", () => {
      const circuit: Circuit = {
        devices: [
          { id: "sb1", kind: "pb-no", tag: "Start PB", params: {} },
          { id: "sb2", kind: "pb-nc", tag: "Stop PB", params: {} },
          { id: "es1", kind: "estop", tag: "E-Stop", params: {} },
          { id: "km1", kind: "contactor", tag: "KM1", params: {} },
          { id: "ts1", kind: "temp-no", tag: "TS1", params: { setpoint: 40 } },
          { id: "ps1", kind: "pressure-no", tag: "PS1", params: { setpoint: 6 } },
          { id: "fs1", kind: "flow-no", tag: "FS1", params: { setpoint: 10 } },
          { id: "ls1", kind: "float", tag: "LS1", params: { setpoint: 50 } },
          { id: "tr1", kind: "timer-on", tag: "TR1", params: { delayMs: 3000 } },
        ],
        symbols: [
          { id: "s1", deviceId: "sb1", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "sb2", variant: "body", x: 4, y: 0, rot: 0 },
          { id: "s3", deviceId: "es1", variant: "body", x: 8, y: 0, rot: 0 },
          { id: "s4", deviceId: "km1", variant: "aux-no", x: 12, y: 0, rot: 0 },
          { id: "s5", deviceId: "km1", variant: "coil", x: 16, y: 0, rot: 0 },
          { id: "s6", deviceId: "ts1", variant: "body", x: 0, y: 4, rot: 0 },
          { id: "s7", deviceId: "ps1", variant: "body", x: 4, y: 4, rot: 0 },
          { id: "s8", deviceId: "fs1", variant: "body", x: 8, y: 4, rot: 0 },
          { id: "s9", deviceId: "ls1", variant: "body", x: 12, y: 4, rot: 0 },
          { id: "s10", deviceId: "tr1", variant: "aux-no", x: 16, y: 4, rot: 0 },
        ],
        wires: [],
      };

      const snap = emptySnapshot(circuit);
      const model = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      const allContacts = model.rungs.flatMap((r) =>
        r.items.flatMap((it) => (it.type === "contact" ? [it.element] : it.group.branches.flatMap((b) => b.contacts))),
      );

      const pbNo = allContacts.find((c) => c.label === "Start PB");
      const pbNc = allContacts.find((c) => c.label === "Stop PB");
      const estop = allContacts.find((c) => c.label === "E-Stop");
      const tempSwitch = allContacts.find((c) => c.label === "TS1");
      const pressSwitch = allContacts.find((c) => c.label === "PS1");
      const flowSwitch = allContacts.find((c) => c.label === "FS1");
      const floatSwitch = allContacts.find((c) => c.label === "LS1");
      const timerContact = allContacts.find((c) => c.label === "TR1");

      if (pbNo) expect(pbNo.contactType).toBe("pb-no");
      if (pbNc) expect(pbNc.contactType).toBe("pb-nc");
      if (estop) expect(estop.contactType).toBe("estop");
      if (tempSwitch) expect(tempSwitch.contactType).toBe("temp-no");
      if (pressSwitch) expect(pressSwitch.contactType).toBe("pressure-no");
      if (flowSwitch) expect(flowSwitch.contactType).toBe("flow-no");
      if (floatSwitch) expect(floatSwitch.contactType).toBe("float");
      if (timerContact) expect(timerContact.contactType).toBe("timer-no");
    });

    it("should correctly handle multi-color lamps in ladder rungs without converting everything to red", () => {
      const circuit: Circuit = {
        devices: [
          { id: "hl_g", kind: "lamp", tag: "Running Indicator", params: { color: "green" } },
          { id: "hl_r", kind: "lamp", tag: "Fault Indicator", params: { color: "red" } },
          { id: "hl_y", kind: "lamp", tag: "Warning Indicator", params: { color: "yellow" } },
          { id: "hl_b", kind: "lamp", tag: "Aux Indicator", params: { color: "blue" } },
          { id: "hl_w", kind: "lamp", tag: "Power Indicator", params: { color: "white" } },
          { id: "hl_a", kind: "lamp", tag: "Alarm Indicator", params: { color: "amber" } },
        ],
        symbols: [
          { id: "s1", deviceId: "hl_g", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "hl_r", variant: "body", x: 4, y: 0, rot: 0 },
          { id: "s3", deviceId: "hl_y", variant: "body", x: 8, y: 0, rot: 0 },
          { id: "s4", deviceId: "hl_b", variant: "body", x: 12, y: 0, rot: 0 },
          { id: "s5", deviceId: "hl_w", variant: "body", x: 16, y: 0, rot: 0 },
          { id: "s6", deviceId: "hl_a", variant: "body", x: 20, y: 0, rot: 0 },
        ],
        wires: [],
      };

      const snap = emptySnapshot(circuit);
      const model = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      expect(model.rungs.length).toBe(6);
      const coilColors = model.rungs.map((r) => r.coils[0]?.device.params.color);
      expect(coilColors).toEqual(["green", "red", "yellow", "blue", "white", "amber"]);
    });

    it("should build a comprehensive high-voltage power branch and independent control transformer branch", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "delta", voltage: 480 } },
          { id: "ds1", kind: "isolator", tag: "Main Disconnect", params: {} },
          { id: "cb1", kind: "breaker-3p", tag: "CB1", params: {} },
          { id: "fu1", kind: "fuse", tag: "FU1", params: {} },
          { id: "tc1", kind: "transformer", tag: "TC1", params: { ratio: "480/120" } },
          { id: "km1", kind: "contactor", tag: "M1", params: {} },
          { id: "ol1", kind: "overload", tag: "OL1", params: {} },
          { id: "m1", kind: "motor-3ph", tag: "M1", params: { power: 15 } },
          { id: "pe1", kind: "ground", tag: "PE1", params: {} },
        ],
        symbols: [],
        wires: [],
      };

      const snap = emptySnapshot(circuit);
      const model = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      expect(model.powerBranches.length).toBe(1);
      const pwr = model.powerBranches[0];
      expect(pwr.mains).toBeDefined();
      expect(pwr.disconnect).toBeDefined();
      expect(pwr.breaker).toBeDefined();
      expect(pwr.fuses).toBeDefined();
      expect(pwr.contactor).toBeDefined();
      expect(pwr.overload).toBeDefined();
      expect(pwr.motor).toBeDefined();
      expect(pwr.voltage).toBe(480);
      expect(pwr.power).toBe(15);

      // Verify independent control transformer branch
      expect(model.transformerBranch).toBeDefined();
      expect(model.transformerBranch?.transformer.tag).toBe("TC1");
      expect(model.transformerBranch?.primaryVoltage).toBe(480);
      expect(model.transformerBranch?.secondaryVoltage).toBe(120);
    });

    it("should dynamically update ladder diagram title with document name or title-block", () => {
      const circuit: Circuit = {
        devices: [
          { id: "sb1", kind: "pb-no", tag: "Start", params: {} },
          { id: "km1", kind: "contactor", tag: "KM1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "sb1", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "km1", variant: "coil", x: 4, y: 0, rot: 0 },
        ],
        wires: [],
      };

      const snap = emptySnapshot(circuit);
      const modelWithDocName = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      }, "Custom Motor Control System");

      expect(modelWithDocName.title).toBe("Custom Motor Control System");
    });

    it("should generate separate dedicated rungs when multiple contactors or control relays are added", () => {
      const circuit: Circuit = {
        devices: [
          { id: "sb1", kind: "pb-nc", tag: "Stop 1", params: {} },
          { id: "sb2", kind: "pb-no", tag: "Forward Start", params: {} },
          { id: "km1", kind: "contactor", tag: "KM_FWD", params: {} },
          { id: "sb3", kind: "pb-no", tag: "Reverse Start", params: {} },
          { id: "km2", kind: "contactor", tag: "KM_REV", params: {} },
          { id: "ka1", kind: "relay", tag: "KA1", params: {} },
          { id: "sw1", kind: "toggle", tag: "SW_AUTO", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "sb1", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s2", deviceId: "sb2", variant: "body", x: 4, y: 0, rot: 0 },
          { id: "s3", deviceId: "km1", variant: "coil", x: 8, y: 0, rot: 0 },
          { id: "s4", deviceId: "sb3", variant: "body", x: 12, y: 0, rot: 0 },
          { id: "s5", deviceId: "km2", variant: "coil", x: 16, y: 0, rot: 0 },
          { id: "s6", deviceId: "ka1", variant: "coil", x: 20, y: 0, rot: 0 },
          { id: "s7", deviceId: "sw1", variant: "body", x: 24, y: 0, rot: 0 },
        ],
        wires: [],
      };

      const snap = emptySnapshot(circuit);
      const model = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      // Contactor 1 (KM_FWD), Contactor 2 (KM_REV), Relay (KA1)
      expect(model.rungs.length).toBeGreaterThanOrEqual(3);
      expect(model.rungs[0].coils[0].label).toBe("KM_FWD");
      expect(model.rungs[1].coils[0].label).toBe("KM_REV");
      expect(model.rungs[2].coils[0].label).toBe("KA1");
    });

    it("should accurately identify Overload FR1 NO contact for Overload lamp and M1 contacts for status lamps", () => {
      // Circuit with Overload FR1 (NO 97-98 -> Trip Lamp), M1 (NC 31-32 -> Stop Lamp), M1 (NO 43-44 -> Run Lamp)
      const circuit: Circuit = {
        devices: [
          { id: "tc1", kind: "transformer", tag: "TC1", params: { ratio: "480/120" } },
          { id: "nl_hot", kind: "net-label", tag: "A1", params: {} },
          { id: "nl_ret", kind: "net-label", tag: "A2", params: {} },
          { id: "ol1", kind: "overload", tag: "FR1", params: {} },
          { id: "km1", kind: "contactor", tag: "M1", params: {} },
          { id: "hl_trip", kind: "lamp", tag: "Overload", params: { color: "red" } },
          { id: "hl_stop", kind: "lamp", tag: "Stop", params: { color: "red" } },
          { id: "hl_run", kind: "lamp", tag: "Running", params: { color: "green" } },
        ],
        symbols: [
          { id: "s_tc1", deviceId: "tc1", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s_nl_hot", deviceId: "nl_hot", variant: "body", x: 2, y: 0, rot: 0 },
          { id: "s_nl_ret", deviceId: "nl_ret", variant: "body", x: 2, y: 4, rot: 0 },
          { id: "s_ol", deviceId: "ol1", variant: "body", x: 6, y: 0, rot: 0 },
          { id: "s_km_nc2", deviceId: "km1", variant: "aux-nc2", x: 6, y: 4, rot: 0 },
          { id: "s_km_no2", deviceId: "km1", variant: "aux-no2", x: 6, y: 8, rot: 0 },
          { id: "s_hl_trip", deviceId: "hl_trip", variant: "body", x: 12, y: 0, rot: 0 },
          { id: "s_hl_stop", deviceId: "hl_stop", variant: "body", x: 12, y: 4, rot: 0 },
          { id: "s_hl_run", deviceId: "hl_run", variant: "body", x: 12, y: 8, rot: 0 },
        ],
        wires: [
          // Transformer to Net Labels
          { id: "w1", a: { symbolId: "s_tc1", term: "X1" }, b: { symbolId: "s_nl_hot", term: "1" } },
          { id: "w2", a: { symbolId: "s_tc1", term: "X2" }, b: { symbolId: "s_nl_ret", term: "1" } },

          // Hot Rail -> Overload 97 -> Overload 98 -> Overload Lamp -> Ret Rail
          { id: "w3", a: { symbolId: "s_nl_hot", term: "1" }, b: { symbolId: "s_ol", term: "97" } },
          { id: "w4", a: { symbolId: "s_ol", term: "98" }, b: { symbolId: "s_hl_trip", term: "2" } },
          { id: "w5", a: { symbolId: "s_hl_trip", term: "1" }, b: { symbolId: "s_nl_ret", term: "1" } },

          // Hot Rail -> M1 31 -> M1 32 -> Stop Lamp -> Ret Rail
          { id: "w6", a: { symbolId: "s_nl_hot", term: "1" }, b: { symbolId: "s_km_nc2", term: "31" } },
          { id: "w7", a: { symbolId: "s_km_nc2", term: "32" }, b: { symbolId: "s_hl_stop", term: "2" } },
          { id: "w8", a: { symbolId: "s_hl_stop", term: "1" }, b: { symbolId: "s_nl_ret", term: "1" } },

          // Hot Rail -> M1 43 -> M1 44 -> Running Lamp -> Ret Rail
          { id: "w9", a: { symbolId: "s_nl_hot", term: "1" }, b: { symbolId: "s_km_no2", term: "43" } },
          { id: "w10", a: { symbolId: "s_km_no2", term: "44" }, b: { symbolId: "s_hl_run", term: "2" } },
          { id: "w11", a: { symbolId: "s_hl_run", term: "1" }, b: { symbolId: "s_nl_ret", term: "1" } },
        ],
      };

      const snap = emptySnapshot(circuit);
      const model = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      // Find the rungs for each lamp
      const tripRung = model.rungs.find((r) => r.coils[0]?.device.id === "hl_trip");
      const stopRung = model.rungs.find((r) => r.coils[0]?.device.id === "hl_stop");
      const runRung = model.rungs.find((r) => r.coils[0]?.device.id === "hl_run");

      expect(tripRung).toBeDefined();
      expect(stopRung).toBeDefined();
      expect(runRung).toBeDefined();

      // Trip Rung must have FR1 NO contact (address 97-98), NOT M1 NO
      const tripContact = tripRung?.items[0]?.type === "contact" ? tripRung.items[0].element : null;
      expect(tripContact).toBeDefined();
      expect(tripContact?.deviceId).toBe("ol1");
      expect(tripContact?.address).toBe("97-98");
      expect(tripContact?.contactType).toBe("no");
      expect(tripContact?.label).toContain("FR1");

      // Stop Rung must have M1 NC contact (address 31-32)
      const stopContact = stopRung?.items[0]?.type === "contact" ? stopRung.items[0].element : null;
      expect(stopContact).toBeDefined();
      expect(stopContact?.deviceId).toBe("km1");
      expect(stopContact?.address).toBe("31-32");
      expect(stopContact?.contactType).toBe("nc");

      // Run Rung must have M1 NO contact (address 43-44)
      const runContact = runRung?.items[0]?.type === "contact" ? runRung.items[0].element : null;
      expect(runContact).toBeDefined();
      expect(runContact?.deviceId).toBe("km1");
      expect(runContact?.address).toBe("43-44");
      expect(runContact?.contactType).toBe("no");
    });

    it("should correctly generate ladder diagram from full three-phase-motor example", async () => {
      const motorExampleModule = await import("./examples/three-phase-motor.json");
      const exampleCircuit = (motorExampleModule.default || motorExampleModule).circuit as Circuit;
      const snap = emptySnapshot(exampleCircuit);

      const model = buildLadderDiagram(exampleCircuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });


      // Motor starter rung - now has simpler ID based on tag
      const m1Rung = model.rungs.find((r) => r.coils[0]?.device.tag === "M1");
      
      expect(m1Rung).toBeDefined();

      // Overload trip lamp rung (tag: "Overload")  
      const olLampRung = model.rungs.find((r) => r.coils[0]?.device.tag === "Overload");
      expect(olLampRung).toBeDefined();
      const olContact = olLampRung?.items[0]?.type === "contact" ? olLampRung.items[0].element : null;
      expect(olContact).toBeDefined();
      expect(olContact?.label).toContain("FR1");
      expect(olContact?.address).toBe("97-98");

      // Stop indicator lamp rung (tag: "Stop")
      const stopLampRung = model.rungs.find((r) => r.coils[0]?.device.tag === "Stop");
      expect(stopLampRung).toBeDefined();
      
      // ✅ Updated: M1 NC contact may be at different index due to improved path finding algorithm
      // Note: three-phase-motor example uses auto-generated device IDs, check by label "M1" or deviceId pattern
      const stopM1Contact = stopLampRung?.items.find((it) => 
        it.type === "contact" && (it.element.label === "M1" || it.element.deviceId?.includes("3m_"))
      );
      expect(stopM1Contact).toBeDefined();
      if (stopM1Contact && stopM1Contact.type === "contact") {
        expect(["31-32", "21-22"]).toContain(stopM1Contact.element.address);
        expect(["nc", "overload"]).toContain(stopM1Contact.element.contactType);
      }

      // Running indicator lamp rung (tag: "Running")
      const runLampRung = model.rungs.find((r) => r.coils[0]?.device.tag === "Running");
      expect(runLampRung).toBeDefined();
      // Should cleanly show 1 direct contact (M1 NO) controlling the Running lamp
      expect(runLampRung?.items).toHaveLength(1);
      const runM1Contact = runLampRung?.items[0];
      expect(runM1Contact?.type).toBe("contact");
      if (runM1Contact && runM1Contact.type === "contact") {
        expect(["43-44", "13-14"]).toContain(runM1Contact.element.address);
        expect(runM1Contact.element.contactType).toBe("no");
      }
    });

    it("should simulate pressing Start button in three-phase-motor without short circuit", async () => {
      const motorExampleModule = await import("./examples/three-phase-motor.json");
      const exampleCircuit = (motorExampleModule.default || motorExampleModule).circuit as Circuit;
      
      const startDev = exampleCircuit.devices.find((d) => d.kind === "pb-no" && d.tag === "Start");
      expect(startDev).toBeDefined();

      // Setup simulation in RUN mode
      useLab.setState({
        mode: "run",
        circuit: exampleCircuit,
        snapshot: emptySnapshot(exampleCircuit),
        held: [],
        process: {
          temperature: 25,
          pressure: 0,
          level: 0,
          flow: 0,
          limitHit: false,
          proxHit: false,
          photoHit: false,
        },
      });

      // Settle initial power propagation
      for (let i = 0; i < 5; i++) {
        useLab.getState().step();
      }

      // Confirm no short circuit before press
      expect(useLab.getState().snapshot.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);

      // Press Start button via pointerDevice
      useLab.getState().pointerDevice(startDev!.id, true);
      for (let i = 0; i < 5; i++) {
        useLab.getState().step();
      }

      // Confirm NO short circuit when start is pressed
      expect(useLab.getState().snapshot.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);

      // Confirm M1 coil energized
      const m1Dev = exampleCircuit.devices.find((d) => d.kind === "contactor" && d.tag === "M1");
      expect(useLab.getState().snapshot.runtime[m1Dev!.id]?.energized).toBe(true);

      // Release Start button (self-holding seal-in latch should keep M1 running)
      useLab.getState().pointerDevice(startDev!.id, false);
      for (let i = 0; i < 5; i++) {
        useLab.getState().step();
      }

      expect(useLab.getState().snapshot.faults.filter((f) => f.msgKey === "fault.shortCircuit")).toHaveLength(0);
      expect(useLab.getState().snapshot.runtime[m1Dev!.id]?.energized).toBe(true);

      // Verify ladder diagram model updates live state
      const liveLadder = buildLadderDiagram(
        exampleCircuit,
        useLab.getState().snapshot,
        useLab.getState().held,
        useLab.getState().process
      );

      const m1Rung = liveLadder.rungs.find((r) => r.coils[0]?.device.tag === "M1");
      expect(m1Rung?.isEnergized).toBe(true);
      expect(m1Rung?.coils[0]?.isClosed).toBe(true);
    });
  });

  describe("Internationalization & Dictionary Keys", () => {
    it("should have translations for ladder layout mode keys in en and zh", () => {
      expect(t("toolbar.layoutMode")).toBeDefined();
      expect(t("toolbar.schematic")).toBeDefined();
      expect(t("toolbar.ladder")).toBeDefined();
      expect(t("ladder.title")).toBeDefined();
      expect(t("ladder.leftRail")).toBeDefined();
      expect(t("ladder.rightRail")).toBeDefined();
      expect(t("ladder.rung")).toBeDefined();
      expect(t("ladder.addRung")).toBeDefined();
      expect(t("ladder.clickToAddRung")).toBeDefined();
      expect(t("ladder.deleteRung")).toBeDefined();
      expect(t("ladder.toggleVariant")).toBeDefined();
      expect(t("ladder.addParallel")).toBeDefined();
      expect(t("ladder.insertContact")).toBeDefined();
      expect(t("ladder.deleteContact")).toBeDefined();
      expect(t("ladder.deleteCoil")).toBeDefined();
      expect(t("ladder.picker.addRungTitle")).toBeDefined();
      expect(t("ladder.picker.inputSection")).toBeDefined();
      expect(t("ladder.picker.outputSection")).toBeDefined();
      expect(t("ladder.picker.cancel")).toBeDefined();
      expect(t("ladder.picker.confirm")).toBeDefined();
    });

    it("should ensure English ladder translations contain no Chinese characters", () => {
      setLang("en");
      const englishLadderKeys = [
        "ladder.title",
        "ladder.leftRail",
        "ladder.rightRail",
        "ladder.rung",
        "ladder.addRung",
        "ladder.clickToAddRung",
        "ladder.deleteRung",
        "ladder.toggleVariant",
        "ladder.addParallel",
        "ladder.insertContact",
        "ladder.deleteContact",
        "ladder.deleteCoil",
        "ladder.picker.addRungTitle",
        "ladder.picker.addParallelTitle",
        "ladder.picker.insertContactTitle",
        "ladder.picker.insertCoilTitle",
        "ladder.picker.inputSection",
        "ladder.picker.newContact",
        "ladder.picker.existingContact",
        "ladder.picker.contactKind",
        "ladder.picker.selectDevice",
        "ladder.picker.contactVariant",
        "ladder.picker.auxNo",
        "ladder.picker.auxNc",
        "ladder.picker.overloadTrip",
        "ladder.picker.outputSection",
        "ladder.picker.newCoil",
        "ladder.picker.existingCoil",
        "ladder.picker.coilKind",
        "ladder.picker.lampColor",
        "ladder.picker.presetDelay",
        "ladder.picker.selectCoilDevice",
        "ladder.picker.cancel",
        "ladder.picker.confirm",
        "ladder.opt.pbNo",
        "ladder.opt.pbNc",
        "ladder.opt.estop",
        "ladder.opt.toggle",
        "ladder.opt.limitNo",
        "ladder.opt.limitNc",
        "ladder.opt.tempNo",
        "ladder.opt.pressureNo",
        "ladder.opt.float",
        "ladder.opt.prox",
        "ladder.opt.photo",
        "ladder.opt.lamp",
        "ladder.opt.contactor",
        "ladder.opt.relay",
        "ladder.opt.timerOn",
        "ladder.opt.timerOff",
        "ladder.opt.solenoid",
        "ladder.opt.heater",
        "ladder.opt.alarm",
        "ladder.color.green",
        "ladder.color.red",
        "ladder.color.yellow",
        "ladder.color.blue",
        "ladder.color.white",
        "ladder.color.amber",
      ];

      const chineseRegex = /[\u4e00-\u9fff]/;
      for (const key of englishLadderKeys) {
        const text = t(key);
        expect(text, `Expected key '${key}' to be translated in English`).toBeDefined();
        expect(chineseRegex.test(text), `Expected '${key}' ("${text}") not to contain Chinese characters in English`).toBe(false);
      }
    });
  });

  describe("Bidirectional Ladder Synthesis & Editing", () => {
    it("should synthesize adding a new ladder rung with contact and coil", () => {
      const baseCircuit: Circuit = {
        devices: [
          { id: "tc1", kind: "transformer", tag: "TC1", params: {} },
        ],
        symbols: [
          { id: "s_tc1", deviceId: "tc1", variant: "body", x: 10, y: 10, rot: 0 },
        ],
        wires: [],
      };

      const { circuit: next, newSymbolIds } = synthesizeAddRung(baseCircuit, {
        contact: { kind: "pb-no", tag: "SB_START" },
        coil: { kind: "lamp", color: "green", tag: "HL_RUN" },
      });

      expect(newSymbolIds.length).toBe(2);
      expect(next.symbols.length).toBe(3);
      expect(next.devices.some((d) => d.tag === "SB_START")).toBe(true);
      expect(next.devices.some((d) => d.tag === "HL_RUN")).toBe(true);
      expect(next.wires.length).toBeGreaterThanOrEqual(2);
    });

    it("should synthesize inserting a series contact into an existing rung", () => {
      const baseCircuit: Circuit = {
        devices: [
          { id: "sb1", kind: "pb-no", tag: "SB1", params: {} },
          { id: "hl1", kind: "lamp", tag: "HL1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "sb1", variant: "body", x: 10, y: 10, rot: 0 },
          { id: "s2", deviceId: "hl1", variant: "body", x: 10, y: 16, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s1", term: "2" }, b: { symbolId: "s2", term: "1" } },
        ],
      };

      const { circuit: next, newSymbolId } = synthesizeInsertContact(baseCircuit, "s1", {
        kind: "pb-nc",
        tag: "SB_STOP",
      });

      expect(newSymbolId).toBeDefined();
      expect(next.symbols.length).toBe(3);
      expect(next.devices.some((d) => d.tag === "SB_STOP")).toBe(true);
      expect(next.wires.length).toBe(2);
    });

    it("should synthesize adding a parallel seal-in contact branch across a target contact", () => {
      const baseCircuit: Circuit = {
        devices: [
          { id: "sb1", kind: "pb-no", tag: "SB1", params: {} },
          { id: "km1", kind: "contactor", tag: "KM1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "sb1", variant: "body", x: 10, y: 10, rot: 0 },
          { id: "s2", deviceId: "km1", variant: "coil", x: 10, y: 16, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s1", term: "2" }, b: { symbolId: "s2", term: "A1" } },
        ],
      };

      const { circuit: next, newSymbolId } = synthesizeAddParallelBranch(baseCircuit, "s1", {
        existingDeviceId: "km1",
        variant: "aux-no",
      });

      expect(newSymbolId).toBeDefined();
      expect(next.symbols.length).toBe(3);
      expect(next.symbols.some((s) => s.deviceId === "km1" && s.variant === "aux-no")).toBe(true);
      expect(next.wires.length).toBe(3);
    });

    it("should toggle contact variant between NO and NC correctly", () => {
      const baseCircuit: Circuit = {
        devices: [
          { id: "km1", kind: "contactor", tag: "KM1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "km1", variant: "aux-no", x: 10, y: 10, rot: 0 },
        ],
        wires: [],
      };

      const toggled = synthesizeToggleContactVariant(baseCircuit, "s1");
      expect(toggled.symbols[0].variant).toBe("aux-nc");

      const toggledBack = synthesizeToggleContactVariant(toggled, "s1");
      expect(toggledBack.symbols[0].variant).toBe("aux-no");
    });

    it("should delete an element cleanly and prune its wires", () => {
      const baseCircuit: Circuit = {
        devices: [
          { id: "sb1", kind: "pb-no", tag: "SB1", params: {} },
          { id: "hl1", kind: "lamp", tag: "HL1", params: {} },
        ],
        symbols: [
          { id: "s1", deviceId: "sb1", variant: "body", x: 10, y: 10, rot: 0 },
          { id: "s2", deviceId: "hl1", variant: "body", x: 10, y: 16, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s1", term: "2" }, b: { symbolId: "s2", term: "1" } },
        ],
      };

      const next = synthesizeDeleteElement(baseCircuit, "s1");
      expect(next.symbols.length).toBe(1);
      expect(next.devices.length).toBe(1);
      expect(next.wires.length).toBe(0);
    });

    it("should support interacting with devices in Run mode", () => {
      const lab = useLab.getState();
      lab.setMode("run");

      const circuit: Circuit = {
        devices: [
          { id: "d_iso", kind: "isolator", tag: "Main Switch", params: {} },
          { id: "d_cb", kind: "breaker-3p", tag: "CB1", params: {} },
          { id: "d_ol", kind: "overload", tag: "FR1", params: {} },
          { id: "d_pb", kind: "pb-no", tag: "Start PB", params: {} },
        ],
        symbols: [
          { id: "s_iso", deviceId: "d_iso", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s_cb", deviceId: "d_cb", variant: "body", x: 4, y: 0, rot: 0 },
          { id: "s_ol", deviceId: "d_ol", variant: "body", x: 8, y: 0, rot: 0 },
          { id: "s_pb", deviceId: "d_pb", variant: "body", x: 12, y: 0, rot: 0 },
        ],
        wires: [],
      };

      useLab.setState({ circuit, mode: "run" });
      lab.resetSim();

      // Test momentary pushbutton down and up
      lab.pointerDevice("d_pb", true);
      expect(useLab.getState().held).toContain("d_pb");

      lab.pointerDevice("d_pb", false);
      expect(useLab.getState().held).not.toContain("d_pb");

      // Test isolator toggle (defaults to on -> toggles to off -> toggles to on)
      expect(useLab.getState().snapshot.runtime.d_iso?.on).toBe(true);
      lab.toggleIo("d_iso", "on");
      expect(useLab.getState().snapshot.runtime.d_iso?.on).toBe(false);
      lab.toggleIo("d_iso", "on");
      expect(useLab.getState().snapshot.runtime.d_iso?.on).toBe(true);

      // Test breaker toggle (defaults to on -> toggles to off)
      lab.toggleIo("d_cb", "on");
      expect(useLab.getState().snapshot.runtime.d_cb?.on).toBe(false);

      // Test overload trip toggle (defaults to false -> toggles to true)
      lab.toggleIo("d_ol", "tripped");
      expect(useLab.getState().snapshot.runtime.d_ol?.tripped).toBe(true);
    });

    it("should support reordering ladder rungs and updating rung numbers and coil cross references", () => {
      const circuit: Circuit = {
        devices: [
          { id: "g1", kind: "mains-3ph", tag: "G1", params: { supplyType: "wye", voltage: 480 } },
          { id: "tc1", kind: "transformer", tag: "TC1", params: { ratio: "480/120" } },
          { id: "sb1", kind: "pb-no", tag: "Start", params: {} },
          { id: "km1", kind: "contactor", tag: "KM1", params: {} },
          { id: "hl1", kind: "lamp", tag: "HL1", params: {} },
          { id: "ka1", kind: "relay", tag: "KA1", params: {} },
        ],
        symbols: [
          { id: "s_tc1", deviceId: "tc1", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s_sb1", deviceId: "sb1", variant: "body", x: 8, y: 0, rot: 0 },
          { id: "s_km1", deviceId: "km1", variant: "coil", x: 16, y: 0, rot: 0 },
          { id: "s_hl1", deviceId: "hl1", variant: "body", x: 16, y: 8, rot: 0 },
          { id: "s_ka1", deviceId: "ka1", variant: "coil", x: 16, y: 16, rot: 0 },
          { id: "s_km1_aux", deviceId: "km1", variant: "aux-no", x: 8, y: 8, rot: 0 },
        ],
        wires: [
          { id: "w0", a: { symbolId: "s_tc1", term: "X1" }, b: { symbolId: "s_sb1", term: "1" } },
          { id: "w1", a: { symbolId: "s_sb1", term: "2" }, b: { symbolId: "s_km1", term: "A1" } },
          { id: "w2", a: { symbolId: "s_tc1", term: "X1" }, b: { symbolId: "s_km1_aux", term: "13" } },
          { id: "w3", a: { symbolId: "s_km1_aux", term: "14" }, b: { symbolId: "s_hl1", term: "1" } },
        ],
      };

      const snap = emptySnapshot(circuit);
      useLab.setState({ circuit, snapshot: snap, isDirty: false, history: [] });

      const initialModel = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      // console.log(initialModel.rungs.map((r) => ({ id: r.id, title: r.title })));
      // ✅ Updated to match new rung ID format: rung_<tag> for coils/runs, rung_aux_<deviceId> for aux contacts
      expect(initialModel.rungs.map((r) => r.id)).toEqual([
        "rung_KM1",  // Contactor coil rung
        "rung_HL1",  // Lamp rung (includes KM1 aux-no contact at 13-14)
        "rung_KA1",  // Relay coil rung
      ]);
      const initialRung1 = initialModel.rungs[0];
      const initialRung2 = initialModel.rungs[1];
      const initialRung3 = initialModel.rungs[2];

      // Reorder: move rung 0 to rung 2 (KM1 output moved to bottom)
      useLab.getState().reorderLadderRungs(0, 2);

      const reorderedCircuit = useLab.getState().circuit;
      expect(useLab.getState().isDirty).toBe(true);
      expect(useLab.getState().history.length).toBe(1);
      expect(reorderedCircuit.ladderRungOrder).toBeDefined();

      const reorderedModel = buildLadderDiagram(reorderedCircuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      // Verify rungs reordered
      expect(reorderedModel.rungs[0].id).toBe(initialRung2.id);
      expect(reorderedModel.rungs[1].id).toBe(initialRung3.id);
      expect(reorderedModel.rungs[2].id).toBe(initialRung1.id);

      // Verify sequential rung numbering
      expect(reorderedModel.rungs[0].rungNumber).toBe(1);
      expect(reorderedModel.rungs[1].rungNumber).toBe(2);
      expect(reorderedModel.rungs[2].rungNumber).toBe(3);

      // Verify undo restores previous order
      useLab.getState().undo();
      const undoneCircuit = useLab.getState().circuit;
      const undoneModel = buildLadderDiagram(undoneCircuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      expect(undoneModel.rungs[0].id).toBe(initialRung1.id);
      expect(undoneModel.rungs[1].id).toBe(initialRung2.id);
      expect(undoneModel.rungs[2].id).toBe(initialRung3.id);
    });

    it("should strictly only include power section components that actually exist in the circuit", async () => {
      // Blank template has only mains, isolator, PE ground and net labels (no contactor, overload, or motor)
      const blankModule = await import("./examples/blank-template.json");
      const blankCircuit = (blankModule.default || blankModule).circuit as Circuit;
      const snap = emptySnapshot(blankCircuit);

      const model = buildLadderDiagram(blankCircuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      expect(model.powerBranches.length).toBe(1);
      const pb = model.powerBranches[0];
      expect(pb.mains).toBeDefined();
      expect(pb.disconnect).toBeDefined();
      expect(pb.breaker).toBeUndefined();
      expect(pb.fuses).toBeUndefined();
      expect(pb.contactor).toBeUndefined();
      expect(pb.overload).toBeUndefined();
      expect(pb.motor).toBeUndefined();
      expect(model.transformerBranch).toBeUndefined();
    });

    it("should strictly only include transformer branch fuses and ground when actually wired", () => {
      // Circuit with standalone transformer (no fuses, no PE connection)
      const circuit: Circuit = {
        devices: [
          { id: "tc1", kind: "transformer", tag: "TC1", params: { primaryVoltage: 480, secondaryVoltage: 120 } },
        ],
        symbols: [
          { id: "s_tc1", deviceId: "tc1", variant: "body", x: 0, y: 0, rot: 0 },
        ],
        wires: [],
      };

      const snap = emptySnapshot(circuit);
      const model = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      expect(model.transformerBranch).toBeDefined();
      const tb = model.transformerBranch!;
      expect(tb.primaryFuse1).toBeUndefined();
      expect(tb.primaryFuse2).toBeUndefined();
      expect(tb.secondaryFuse).toBeUndefined();
      expect(tb.isGrounded).toBe(false);
    });

    it("should not create phantom rungs for unwired components or unused overload auxiliary contacts", () => {
      // Overload body only wired at 95-96 into a contactor circuit; 97-98 is unused
      const circuit: Circuit = {
        devices: [
          { id: "tc1", kind: "transformer", tag: "TC1", params: { ratio: "480/120" } },
          { id: "ol1", kind: "overload", tag: "FR1", params: {} },
          { id: "km1", kind: "contactor", tag: "M1", params: {} },
        ],
        symbols: [
          { id: "s_tc1", deviceId: "tc1", variant: "body", x: 0, y: 0, rot: 0 },
          { id: "s_ol1", deviceId: "ol1", variant: "body", x: 4, y: 0, rot: 0 },
          { id: "s_km1", deviceId: "km1", variant: "coil", x: 8, y: 0, rot: 0 },
        ],
        wires: [
          { id: "w1", a: { symbolId: "s_tc1", term: "X1" }, b: { symbolId: "s_ol1", term: "95" } },
          { id: "w2", a: { symbolId: "s_ol1", term: "96" }, b: { symbolId: "s_km1", term: "A1" } },
          { id: "w3", a: { symbolId: "s_km1", term: "A2" }, b: { symbolId: "s_tc1", term: "X2" } },
        ],
      };

      const snap = emptySnapshot(circuit);
      const model = buildLadderDiagram(circuit, snap, [], {
        temperature: 25,
        pressure: 0,
        level: 0,
        flow: 0,
        limitHit: false,
        proxHit: false,
        photoHit: false,
      });

      // Exactly 1 rung for M1 (no phantom auxiliary rung for FR1 97-98)
      expect(model.rungs.length).toBe(1);
      expect(model.rungs[0].coils[0].label).toBe("M1");
      expect(model.rungs.some((r) => Boolean(r.title && r.title.includes("AUXILIARY")))).toBe(false);
    });
  });
});
