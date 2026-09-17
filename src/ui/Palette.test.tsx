import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Palette } from "./Palette";
import { GROUPS } from "../catalog";
import { setLang } from "../i18n";
import { useLab } from "../store";

describe("Palette Component Hierarchy & Rendering", () => {
  it("renders all major categories and subcategories in SSR", () => {
    setLang("zh");
    useLab.getState().setLang("zh");
    const htmlZh = renderToStaticMarkup(createElement(Palette, {}));
    expect(htmlZh).toContain("palette-header");
    expect(htmlZh).toContain("palette-search-box");
    expect(htmlZh).toContain("palette-category-pills");
    expect(htmlZh).toContain("電源與保護");
    expect(htmlZh).toContain("電源與變壓器");
    expect(htmlZh).toContain("斷路器與熔斷器");
    expect(htmlZh).toContain("熱過載保護");
    expect(htmlZh).toContain("按鈕與急停");
    expect(htmlZh).toContain("通電延時 (TON)");
    expect(htmlZh).toContain("固態通電延時 (8-Pin)");
    expect(htmlZh).toContain("固態斷電延時 (11-Pin)");
    expect(htmlZh).toContain("全部折疊");
    expect(htmlZh).toContain("全部分類");
    expect(htmlZh).not.toContain("lib.collapseAll");
    expect(htmlZh).not.toContain("lib.expandAll");
    expect(htmlZh).not.toContain("lib.allCategories");

    setLang("en");
    useLab.getState().setLang("en");
    const htmlEn = renderToStaticMarkup(createElement(Palette, {}));
    expect(htmlEn).toContain("Power &amp; Protection");
    expect(htmlEn).toContain("Power &amp; Transformer");
    expect(htmlEn).toContain("Breakers &amp; Fuses");
    expect(htmlEn).toContain("Thermal Overload");
    expect(htmlEn).toContain("Solid-State ON-Delay (8-Pin)");
    expect(htmlEn).toContain("Solid-State OFF-Delay (11-Pin)");
    expect(htmlEn).toContain("Collapse All");
    expect(htmlEn).toContain("All Categories");
    expect(htmlEn).not.toContain("lib.collapseAll");
    expect(htmlEn).not.toContain("lib.expandAll");
    expect(htmlEn).not.toContain("lib.allCategories");
  });

  it("has proper category structure for every group", () => {
    for (const g of GROUPS) {
      expect(g.id).toBeDefined();
      expect(g.label).toBeDefined();
      expect(g.labelEn).toBeDefined();
      expect(g.subgroups).toBeDefined();
      expect(g.subgroups!.length).toBeGreaterThan(0);
    }
  });
});
