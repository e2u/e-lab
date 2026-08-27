import { describe, expect, it } from "vitest";
import { addDevice, emptyCircuit } from "./circuitBuilder";
import { catalogItem, KINDS } from "./catalog";
import { symbolBounds } from "./geometry";
import { catalogCompKey, setLang, t } from "./i18n";
import { createRuntime, tick } from "./sim/engine";
import { useLab } from "./store";

describe("title-block component", () => {
  it("defines title-block in catalog and KINDS metadata", () => {
    const item = catalogItem("title-block");
    expect(item).toBeDefined();
    expect(item.kind).toBe("title-block");
    expect(item.prefix).toBe("TB");
    expect(item.group).toBe("圖紙標註");

    const kindDef = KINDS["title-block"];
    expect(kindDef).toBeDefined();
    expect(kindDef.variants.body.w).toBe(16);
    expect(kindDef.variants.body.h).toBe(5);
    expect(kindDef.variants.body.terminals).toHaveLength(0);
  });

  it("resolves title-block i18n in en and zh", () => {
    setLang("en");
    expect(catalogCompKey("title-block")).toBe("comp.titleBlock");
    expect(t("comp.titleBlock")).toBe("Title Block");
    expect(t("lib.group.Annotations")).toBe("Annotations");
    expect(t("inspector.projectName")).toBe("PROJECT NAME");
    expect(t("inspector.projectNo")).toBe("PROJECT NO");
    expect(t("inspector.rev")).toBe("REV");
    expect(t("inspector.sheet")).toBe("SHEET");
    expect(t("inspector.description")).toBe("DESCRIPTION");
    expect(t("inspector.designedBy")).toBe("DESIGNED BY");
    expect(t("inspector.date")).toBe("DATE");

    setLang("zh");
    expect(t("comp.titleBlock")).toBe("圖紙標題欄");
    expect(t("lib.group.Annotations")).toBe("圖紙標註");
  });

  it("calculates symbol bounds and scales properly", () => {
    const c = emptyCircuit();
    const { device, symbol } = addDevice(c, "title-block", "TB1", "body", 10, 20, {
      projectName: "AC MOTOR DRIVE",
      projectNo: "PRJ-2026-001",
      rev: "B",
      sheetNum: "1",
      sheetTotal: "3",
      description: "MAIN CONTROL SCHEMATIC",
      designedBy: "ALEX",
      date: "2026-08-26",
      scale: 1,
    });

    const b1 = symbolBounds(c, symbol);
    expect(b1).toEqual({ x: 10, y: 20, w: 16, h: 5 });

    // With 1.5x scale
    device.params.scale = 1.5;
    const b15 = symbolBounds(c, symbol);
    expect(b15).toEqual({ x: 10, y: 20, w: 24, h: 7.5 });

    // With 0.75x scale and 90 deg rotation
    device.params.scale = 0.75;
    symbol.rot = 90;
    const bRot = symbolBounds(c, symbol);
    expect(bRot).toEqual({ x: 10, y: 20, w: 3.75, h: 12 });
  });

  it("does not interfere with electrical simulation", () => {
    const c = emptyCircuit();
    addDevice(c, "title-block", "TB1", "body", 0, 0, {
      projectName: "TEST",
    });
    const snapshot = tick(
      c,
      createRuntime(c),
      {
        held: new Set(),
        process: {
          temperature: 25,
          pressure: 1,
          level: 20,
          flow: 0,
          limitHit: false,
          proxHit: false,
          photoHit: false,
        },
      },
      0,
      16,
    );
    expect(snapshot.faults).toHaveLength(0);
    expect(snapshot.potentials).toEqual({});
  });

  it("updates title block params through store", () => {
    useLab.getState().loadBlankTemplate(true);
    const lab = useLab.getState();
    lab.setPlacing("title-block");
    lab.placeAt(30, 40);

    const updatedState = useLab.getState();
    const tbDev = updatedState.circuit.devices.find((d) => d.kind === "title-block");
    expect(tbDev).toBeDefined();
    expect(tbDev?.params.projectName).toBe("MOTOR CONTROL CIRCUIT");
    expect(tbDev?.params.projectNo).toBe("DWG-001");
    expect(tbDev?.params.rev).toBe("A");
    expect(tbDev?.params.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    // Update params
    if (tbDev) {
      useLab.getState().updateDevice(tbDev.id, {
        params: {
          ...tbDev.params,
          projectName: "CUSTOM AUTOMATION PROJECT",
          projectNo: "AUTO-888",
          rev: "C",
          scale: 1.25,
        },
      });
    }

    const finalDev = useLab.getState().circuit.devices.find((d) => d.kind === "title-block");
    expect(finalDev?.params.projectName).toBe("CUSTOM AUTOMATION PROJECT");
    expect(finalDev?.params.projectNo).toBe("AUTO-888");
    expect(finalDev?.params.rev).toBe("C");
    expect(finalDev?.params.scale).toBe(1.25);
  });
});
