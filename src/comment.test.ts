import { describe, expect, it } from "vitest";
import { CATALOG, KINDS, variantDef } from "./catalog";
import { catalogCompKey, t } from "./i18n";
import { useLab } from "./store";
import { emptySnapshot } from "./sim/engine";
import { addDevice } from "./circuitBuilder";
import type { Circuit } from "./types";

function createEmptyCircuit(): Circuit {
  return { devices: [], symbols: [], wires: [], groups: [] };
}

describe("Comment Component & Binding", () => {
  it("defines comment in catalog and KINDS properly", () => {
    const item = CATALOG.find((c) => c.id === "comment");
    expect(item).toBeDefined();
    expect(item?.kind).toBe("comment");
    expect(item?.group).toBe("圖紙標註");
    expect(item?.prefix).toBe("REM");

    const kindDef = KINDS.comment;
    expect(kindDef).toBeDefined();
    expect(kindDef.variants.body).toBeDefined();
    expect(kindDef.variants.body.terminals.length).toBe(0);

    const v = variantDef("comment", "body");
    expect(v.w).toBe(6);
    expect(v.h).toBe(3);
    expect(v.terminals.length).toBe(0);
  });

  it("provides i18n translations in English and Chinese", () => {
    expect(catalogCompKey("comment")).toBe("comp.comment");
    expect(t("comp.comment")).toBeDefined();
    expect(t("inspector.commentText")).toBeDefined();
    expect(t("inspector.bindTarget")).toBeDefined();
    expect(t("inspector.showLeaderLine")).toBeDefined();
    expect(t("inspector.addComment")).toBeDefined();
  });

  it("places a comment box on canvas with default parameters", () => {
    useLab.getState().newBoard();
    useLab.getState().setPlacing("comment");
    useLab.getState().placeAt(15, 12);

    const circuit = useLab.getState().circuit;
    const commentDev = circuit.devices.find((d) => d.kind === "comment");
    expect(commentDev).toBeDefined();
    expect(commentDev?.tag).toMatch(/^REM/);
    expect(commentDev?.params.text).toBe("備註說明 / Note");
    expect(commentDev?.params.showLeaderLine).toBe(true);
    expect(commentDev?.params.bgColor).toBe("#fef9c3");
    expect(commentDev?.params.fontSize).toBe(12);

    const commentSym = circuit.symbols.find((s) => s.deviceId === commentDev?.id);
    expect(commentSym).toBeDefined();
    expect(commentSym?.x).toBe(15);
    expect(commentSym?.y).toBe(12);
  });

  it("updates comment text, styling, and dimensions", () => {
    useLab.getState().newBoard();
    useLab.getState().setPlacing("comment");
    useLab.getState().placeAt(20, 20);

    const circuit = useLab.getState().circuit;
    const commentDev = circuit.devices.find((d) => d.kind === "comment")!;

    useLab.getState().updateDevice(commentDev.id, {
      text: "主電機過載保護注意設定為 12A",
      bgColor: "#e0f2fe",
      fontSize: 14,
      width: 8,
      height: 4,
      showLeaderLine: false,
    });

    const updated = useLab.getState().circuit.devices.find((d) => d.id === commentDev.id)!;
    expect(updated.params.text).toBe("主電機過載保護注意設定為 12A");
    expect(updated.params.bgColor).toBe("#e0f2fe");
    expect(updated.params.fontSize).toBe(14);
    expect(updated.params.width).toBe(8);
    expect(updated.params.height).toBe(4);
    expect(updated.params.showLeaderLine).toBe(false);
  });

  it("attaches and binds a comment to a specific component", () => {
    useLab.getState().newBoard();
    const c = createEmptyCircuit();
    const motor = addDevice(c, "motor-3ph", "M1", "body", 10, 10);
    useLab.getState().loadCircuit(c);

    // Call addCommentForSymbol for the motor symbol
    useLab.getState().addCommentForSymbol(motor.symbol.id);

    const circuit = useLab.getState().circuit;
    const commentDev = circuit.devices.find((d) => d.kind === "comment");
    expect(commentDev).toBeDefined();
    expect(commentDev?.params.targetDeviceId).toBe(motor.device.id);
    expect(commentDev?.params.text).toContain("M1");
    expect(commentDev?.params.showLeaderLine).toBe(true);

    const commentSym = circuit.symbols.find((s) => s.deviceId === commentDev?.id);
    expect(commentSym).toBeDefined();
    // Placed to the right of the motor
    expect(commentSym!.x).toBeGreaterThan(motor.symbol.x);

    // Test unbinding
    useLab.getState().updateDevice(commentDev!.id, { targetDeviceId: "" });
    const unboundDev = useLab.getState().circuit.devices.find((d) => d.id === commentDev!.id)!;
    expect(unboundDev.params.targetDeviceId).toBeUndefined();

    // Test re-binding
    useLab.getState().updateDevice(commentDev!.id, { targetDeviceId: motor.device.id });
    const reboundDev = useLab.getState().circuit.devices.find((d) => d.id === commentDev!.id)!;
    expect(reboundDev.params.targetDeviceId).toBe(motor.device.id);
  });

  it("does not interfere with electrical simulation", () => {
    const c = createEmptyCircuit();
    addDevice(c, "comment", "REM1", "body", 5, 5, { text: "Documentation note" });
    const snap = emptySnapshot(c);
    expect(snap).toBeDefined();
    expect(snap.runtime).toBeDefined();
    // comment has no terminals and doesn't affect energized status
    expect(c.wires.length).toBe(0);
  });

  it("supports undo and redo when editing comments", () => {
    useLab.getState().newBoard();
    useLab.getState().setPlacing("comment");
    useLab.getState().placeAt(10, 10);

    const commentDev = useLab.getState().circuit.devices.find((d) => d.kind === "comment")!;
    useLab.getState().updateDevice(commentDev.id, { text: "Initial Text" });

    useLab.getState().updateDevice(commentDev.id, { text: "Modified Text" });
    expect(useLab.getState().circuit.devices.find((d) => d.id === commentDev.id)?.params.text).toBe("Modified Text");

    useLab.getState().undo();
    expect(useLab.getState().circuit.devices.find((d) => d.id === commentDev.id)?.params.text).toBe("Initial Text");

    useLab.getState().redo();
    expect(useLab.getState().circuit.devices.find((d) => d.id === commentDev.id)?.params.text).toBe("Modified Text");
  });
});
