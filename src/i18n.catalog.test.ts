import { describe, expect, it } from "vitest";
import { CATALOG, GROUPS } from "./catalog";
import { TRANSLATIONS, catalogCompKey, setLang, tOr } from "./i18n";

describe("catalog labels", () => {
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
      "transformer3ph",
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
});
