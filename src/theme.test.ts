import { describe, it, expect, beforeEach } from "vitest";
import { useLab } from "./store";
import { t, setLang } from "./i18n";

describe("Theme Switcher (Dark / Light Theme)", () => {
  beforeEach(() => {
    try {
      if (typeof localStorage !== "undefined" && typeof localStorage.clear === "function") {
        localStorage.clear();
      }
    } catch {}
    useLab.setState({ theme: "light" });
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  });

  it("should have light theme as default", () => {
    const theme = useLab.getState().theme;
    expect(theme).toBe("light");
  });

  it("should switch to dark theme and persist to localStorage", () => {
    const lab = useLab.getState();
    lab.setTheme("dark");

    expect(useLab.getState().theme).toBe("dark");
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      expect(localStorage.getItem("elab.theme")).toBe("dark");
    }
    if (typeof document !== "undefined") {
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    }
  });

  it("should toggle between light and dark theme", () => {
    const lab = useLab.getState();
    expect(lab.theme).toBe("light");

    lab.toggleTheme();
    expect(useLab.getState().theme).toBe("dark");

    lab.toggleTheme();
    expect(useLab.getState().theme).toBe("light");
  });

  it("should provide i18n translation keys in both English and Chinese", () => {
    setLang("en");
    expect(t("theme.theme")).toBe("Theme");
    expect(t("theme.dark")).toBe("Dark");
    expect(t("theme.light")).toBe("Light");
    expect(t("theme.switchToLight")).toBe("Switch to Light Theme");
    expect(t("theme.switchToDark")).toBe("Switch to Dark Theme");

    setLang("zh");
    expect(t("theme.theme")).toBe("介面外觀");
    expect(t("theme.dark")).toBe("深色");
    expect(t("theme.light")).toBe("淺色");
    expect(t("theme.switchToLight")).toBe("切換為淺色外觀");
    expect(t("theme.switchToDark")).toBe("切換為深色外觀");
  });

  it("should keep light theme active when print modal is opened and closed", () => {
    const lab = useLab.getState();
    expect(lab.theme).toBe("light");

    lab.openPrint();
    expect(useLab.getState().printOpen).toBe(true);
    expect(useLab.getState().theme).toBe("light");

    lab.closePrint();
    expect(useLab.getState().printOpen).toBe(false);
    expect(useLab.getState().theme).toBe("light");
  });
});
