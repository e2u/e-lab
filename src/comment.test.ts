import { describe, expect, it } from "vitest";
import { CATALOG, KINDS, variantDef } from "./catalog";
import { catalogCompKey, setLang, t } from "./i18n";
import { printHiddenSymbolIds } from "./groups";
import { getPrintContentBounds } from "./print";
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
    expect(t("inspector.groupComment")).toBeDefined();
    expect(t("comment.groupDefaultText", { name: "G" })).toContain("G");
    expect(t("comment.taggedDefaultText", { tag: "M1" })).toContain("M1");
    expect(t("inspector.hideCommentOnPrintHint")).toBeDefined();
    expect(t("ctx.hideCommentOnPrint")).toBeDefined();
  });

  it("places a comment box on canvas with default parameters", () => {
    useLab.getState().newBoard();
    useLab.getState().setPlacing("comment");
    useLab.getState().placeAt(15, 12);

    const circuit = useLab.getState().circuit;
    const commentDev = circuit.devices.find((d) => d.kind === "comment");
    expect(commentDev).toBeDefined();
    expect(commentDev?.tag).toMatch(/^REM/);
    expect(commentDev?.params.text).toBe(t("comment.defaultText"));
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
    setLang("en");
    useLab.getState().newBoard();
    const c = createEmptyCircuit();
    const motor = addDevice(c, "motor-3ph", "MTR1", "body", 10, 10);
    useLab.getState().loadCircuit(c);

    // Call addCommentForSymbol for the motor symbol
    useLab.getState().addCommentForSymbol(motor.symbol.id);

    const circuit = useLab.getState().circuit;
    const commentDev = circuit.devices.find((d) => d.kind === "comment");
    expect(commentDev).toBeDefined();
    expect(commentDev?.params.targetDeviceId).toBe(motor.device.id);
    expect(commentDev?.params.text).toBe("MTR1 Note");
    expect(commentDev?.params.text).not.toMatch(/[\u4e00-\u9fff]/);
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

  it("can hide a comment from print while keeping it on the canvas", () => {
    const c = createEmptyCircuit();
    const rem = addDevice(c, "comment", "REM1", "body", 2, 2, { text: "note" });
    const lamp = addDevice(c, "lamp", "LT1", "body", 30, 20);
    useLab.getState().loadCircuit(c);
    useLab.getState().updateDevice(rem.device.id, { hideOnPrint: true });

    const circuit = useLab.getState().circuit;
    expect(circuit.devices.find((d) => d.id === rem.device.id)?.params.hideOnPrint).toBe(true);
    expect(printHiddenSymbolIds(circuit).has(rem.symbol.id)).toBe(true);

    const bounds = getPrintContentBounds(circuit, 2);
    expect(bounds.hasElements).toBe(true);
    expect(bounds.minX).toBeGreaterThanOrEqual(lamp.symbol.x - 3);
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
