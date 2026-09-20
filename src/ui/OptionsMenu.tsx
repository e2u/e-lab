import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { useLab } from "../store";
import type { Lang } from "../types";

export function OptionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const lang = useLab((s) => s.lang);
  const theme = useLab((s) => s.theme);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <details ref={menuRef} className="menu options-menu" open={isOpen}>
      <summary
        className="btn-icon btn-options-menu"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }}
        title={t("toolbar.moreOptions") || "More options"}
        aria-label={t("toolbar.moreOptions") || "More options"}
      >
        <span className="options-icon">⋮</span>
      </summary>

      <div className="menu-pop options-menu-pop">
        {/* Quick Guide */}
        <button
          type="button"
          className="btn options-item-btn tutorial-btn"
          onClick={() => handleAction(() => useLab.getState().openTutorial("pc"))}
          title={t("tutorial.buttonTooltip")}
        >
          <span className="options-item-icon">✨</span>
          <span className="options-item-label">{t("tutorial.button")}</span>
        </button>

        <div className="menu-divider" />

        {/* Theme Switcher */}
        <div className="options-row">
          <div className="options-row-header">
            <span className="options-item-icon">{theme === "dark" ? "🌙" : "☀️"}</span>
            <span className="options-item-label">{t("theme.theme")}</span>
          </div>
          <div className="options-segmented-group">
            <button
              type="button"
              className={`options-seg-btn ${theme === "dark" ? "active" : ""}`}
              onClick={() => useLab.getState().setTheme("dark")}
            >
              🌙 {t("theme.dark")}
            </button>
            <button
              type="button"
              className={`options-seg-btn ${theme === "light" ? "active" : ""}`}
              onClick={() => useLab.getState().setTheme("light")}
            >
              ☀️ {t("theme.light")}
            </button>
          </div>
        </div>

        <div className="menu-divider" />

        {/* Language Switcher */}
        <div className="options-row">
          <div className="options-row-header">
            <span className="options-item-icon">🌐</span>
            <span className="options-item-label">{t("lib.language")}</span>
          </div>
          <div className="options-segmented-group">
            <button
              type="button"
              className={`options-seg-btn ${lang === "zh" ? "active" : ""}`}
              onClick={() => useLab.getState().setLang("zh" as Lang)}
            >
              繁中
            </button>
            <button
              type="button"
              className={`options-seg-btn ${lang === "en" ? "active" : ""}`}
              onClick={() => useLab.getState().setLang("en" as Lang)}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
