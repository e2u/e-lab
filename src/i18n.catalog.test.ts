import { describe, expect, it } from "vitest";
import { CATALOG, GROUPS, KINDS } from "./catalog";
import { TRANSLATIONS, catalogCompKey, formatFaultMessage, setLang, tOr } from "./i18n";

describe("catalog labels", () => {
  it("ensures all component variants and terminals are aligned to whole integer grid dimensions", () => {
    for (const [kind, meta] of Object.entries(KINDS)) {
      for (const [variantName, variant] of Object.entries(meta.variants)) {
        expect(
          Number.isInteger(variant.w),
          `${kind}:${variantName} width (${variant.w}) should be an integer`,
        ).toBe(true);
        expect(
          Number.isInteger(variant.h),
          `${kind}:${variantName} height (${variant.h}) should be an integer`,
        ).toBe(true);

        for (const term of variant.terminals) {
          expect(
            Number.isInteger(term.x),
            `${kind}:${variantName} terminal ${term.id} x (${term.x}) should be an integer`,
          ).toBe(true);
          expect(
            Number.isInteger(term.y),
            `${kind}:${variantName} terminal ${term.id} y (${term.y}) should be an integer`,
          ).toBe(true);
        }
      }
    }
  });

  it("ensures all component terminals have clear, non-empty terminal identifiers and labels", () => {
    for (const [kind, meta] of Object.entries(KINDS)) {
      for (const [variantName, variant] of Object.entries(meta.variants)) {
        for (const term of variant.terminals) {
          expect(term.id.trim().length, `${kind}:${variantName} terminal ID should not be empty`).toBeGreaterThan(0);
          expect(term.label.trim().length, `${kind}:${variantName} terminal label should not be empty`).toBeGreaterThan(0);
        }
      }
    }

    // Verify key terminal labels
    const s3 = KINDS["selector-3"].variants.body.terminals;
    expect(s3.map((t) => t.label)).toEqual(["COM", "FWD", "COM2", "REV"]);

    const s2 = KINDS["selector-2"].variants.body.terminals;
    expect(s2.map((t) => t.label)).toEqual(["1", "2", "3", "4"]);

    const spdt = KINDS["toggle-spdt"].variants.body.terminals;
    expect(spdt.map((t) => t.label)).toEqual(["COM", "NC", "NO"]);

    const dpdt = KINDS["toggle-dpdt"].variants.body.terminals;
    expect(dpdt.map((t) => t.label)).toEqual(["COM1", "NC1", "NO1", "COM2", "NC2", "NO2"]);

    const kmCoil = KINDS["contactor"].variants.coil.terminals;
    expect(kmCoil.map((t) => t.label)).toEqual(["A1", "A2"]);

    const m3 = KINDS["motor-3ph"].variants.body.terminals;
    expect(m3.map((t) => t.label)).toEqual(["U", "V", "W"]);

    const m1 = KINDS["motor-1ph"].variants.body.terminals;
    expect(m1.map((t) => t.label)).toEqual(["U1", "U2"]);
  });
  it("maps selector and net-label ids to real translation keys", () => {
    expect(catalogCompKey("selector-2")).toBe("comp.selector2");
    expect(catalogCompKey("selector-3")).toBe("comp.selector3");
    expect(catalogCompKey("net-label")).toBe("comp.netLabel");
    expect(catalogCompKey("km-coil")).toBe("comp.contactorCoil");
  });

  it("resolves every catalog item to a human name in en and zh", () => {
    for (const lang of ["en", "zh"] as const) {
      setLang(lang);
      for (const item of CATALOG) {
        const key = catalogCompKey(item.id);
        const name = tOr(key, lang === "en" ? item.labelEn : item.label);
        expect(name, `${lang} ${item.id} (${key})`).not.toMatch(/^(comp\.|lib\.)/);
        expect(name.trim().length).toBeGreaterThan(0);
        expect(TRANSLATIONS[lang][key], `${lang} missing ${key}`).toBeDefined();
      }
    }
  });

  it("omits devices outside relay-contactor control", () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    for (const extra of [
      "dc-supply",
      "rcd",
      "prox",
      "photo",
      "horn",
      "fan",
      "heater",
      "motor-dc",
      "gen-ac",
      "gen-dc",
      "counter",
      "starter-dol",
      "starter-fwd",
      "starter-rev",
    ]) {
      expect(ids.has(extra), extra).toBe(false);
    }
    expect(ids.has("km-coil")).toBe(true);
    expect(ids.has("motor-3ph")).toBe(true);
    expect(ids.has("timer-on")).toBe(true);
    expect(ids.has("flow-no")).toBe(true);
    expect(ids.has("pressure-nc")).toBe(true);
    expect(ids.has("temp-no")).toBe(true);
    expect(ids.has("temp-nc")).toBe(true);
  });

  it("resolves every palette group heading", () => {
    for (const lang of ["en", "zh"] as const) {
      setLang(lang);
      for (const g of GROUPS) {
        const key = `lib.group.${g.id}`;
        const name = tOr(key, lang === "en" ? g.labelEn : g.label);
        expect(name, `${lang} ${g.id}`).not.toMatch(/^lib\./);
        expect(TRANSLATIONS[lang][key], `${lang} missing ${key}`).toBeDefined();
      }
    }
  });

  it("formats fault messages using i18n", () => {
    setLang("en");
    expect(formatFaultMessage({ level: "warn", message: "fallback", msgKey: "fault.brokenWire" })).toBe(
      "Broken wire fault (select wire to restore)",
    );
    expect(
      formatFaultMessage({
        level: "warn",
        message: "fallback",
        msgKey: "fault.weldedContact",
        msgParams: { tag: "KM1" },
      }),
    ).toBe("KM1 welded contact");
    expect(
      formatFaultMessage({
        level: "error",
        message: "fallback",
        msgKey: "fault.shortCircuit",
        msgParams: { a: "L1", b: "L2" },
      }),
    ).toBe("Short circuit: L1 and L2 connected to the same point");

    setLang("zh");
    expect(formatFaultMessage({ level: "warn", message: "fallback", msgKey: "fault.brokenWire" })).toBe(
      "斷線故障（選取該導線可復原）",
    );
    expect(
      formatFaultMessage({
        level: "warn",
        message: "fallback",
        msgKey: "fault.weldedContact",
        msgParams: { tag: "KM1" },
      }),
    ).toBe("KM1 觸點熔死");
    expect(
      formatFaultMessage({
        level: "error",
        message: "fallback",
        msgKey: "fault.shortCircuit",
        msgParams: { a: "L1", b: "L2" },
      }),
    ).toBe("短路：L1 與 L2 接到同一點");
  });
});
