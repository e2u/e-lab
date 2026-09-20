import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OptionsMenu } from "./OptionsMenu";
import { useLab } from "../store";

describe("OptionsMenu component", () => {
  beforeEach(() => {
    useLab.setState({
      lang: "zh",
      theme: "dark",
      tutorialOpen: false,
    });
  });

  it("renders the 3-dots button and menu structure in Chinese", () => {
    useLab.getState().setLang("zh");
    const htmlZh = renderToStaticMarkup(createElement(OptionsMenu, {}));

    expect(htmlZh).toContain("btn-options-menu");
    expect(htmlZh).toContain("⋮");
    expect(htmlZh).toContain("options-menu-pop");
    expect(htmlZh).toContain("tutorial-btn");
    expect(htmlZh).toContain("✨");
    expect(htmlZh).toContain("繁中");
    expect(htmlZh).toContain("EN");
    expect(htmlZh).toContain("深色");
    expect(htmlZh).toContain("淺色");
  });

  it("renders the 3-dots button and menu structure in English", () => {
    useLab.getState().setLang("en");
    const htmlEn = renderToStaticMarkup(createElement(OptionsMenu, {}));

    expect(htmlEn).toContain("btn-options-menu");
    expect(htmlEn).toContain("⋮");
    expect(htmlEn).toContain("options-menu-pop");
    expect(htmlEn).toContain("tutorial-btn");
    expect(htmlEn).toContain("✨");
    expect(htmlEn).toContain("Dark");
    expect(htmlEn).toContain("Light");
  });
});
