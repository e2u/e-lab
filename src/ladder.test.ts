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
import { t } from "./i18n";

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
    it("should toggle and set layoutMode between schematic and ladder", () => {
      expect(useLab.getState().layoutMode).toBe("schematic");

      useLab.getState().setLayoutMode("ladder");
      expect(useLab.getState().layoutMode).toBe("ladder");

      useLab.getState().toggleLayoutMode();
      expect(useLab.getState().layoutMode).toBe("schematic");

      useLab.getState().toggleLayoutMode();
      expect(useLab.getState().layoutMode).toBe("ladder");
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
        wires: [],
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
      useLab.setState({ lang: "en" });
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
  });
});
