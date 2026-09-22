import { beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App";
import { useLab } from "./store";

describe("App component rendering", () => {
  beforeEach(() => {
    useLab.getState().loadBlankTemplate(true);
  });

  it("renders App without throwing unhandled exceptions", () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain("app");
    expect(html).toContain("topbar");
    expect(html).toContain("E-LAB");
    expect(html).toContain("statusbar");
  });
});
