import { useRef } from "react";
import { t, tOr } from "../i18n";
import { listSaves } from "../persist";
import { useLab } from "../store";

interface ExampleItem {
  id: string;
  title: string;
}

interface MobileMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  examples: ExampleItem[];
  selectedExample: string;
  onSelectExample: (id: string) => void;
  onRequestNewDiagram: () => void;
}

export function MobileMenuModal({
  isOpen,
  onClose,
  examples,
  selectedExample,
  onSelectExample,
  onRequestNewDiagram,
}: MobileMenuModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docName = useLab((s) => s.docName);
  const lang = useLab((s) => s.lang);
  const theme = useLab((s) => s.theme);
  const zoom = useLab((s) => s.zoom);
  const savesTick = useLab((s) => s.savesTick);
  const circuit = useLab((s) => s.circuit);
  void savesTick;

  if (!isOpen) return null;

  const saves = listSaves();

  const handleNew = () => {
    onClose();
    onRequestNewDiagram();
  };

  const handleSelectExample = (exId: string) => {
    onClose();
    onSelectExample(exId);
  };

  const handleSaveToLib = () => {
    useLab.getState().saveToLibrary();
  };

  const handleExportJson = () => {
    useLab.getState().exportFile();
  };

  const handleCopyShare = () => {
    void useLab.getState().copyShareLink();
  };

  const handleLoadSave = (id: string) => {
    useLab.getState().loadSave(id);
    onClose();
  };

  const handleDeleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    useLab.getState().deleteSave(id);
  };

  return (
    <div className="mobile-menu-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div className="mobile-menu-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mobile-menu-header">
          <div className="mobile-menu-title-group">
            <span className="mobile-menu-logo">E-LAB</span>
            <span className="mobile-menu-title">{t("mobileMenu.title") || t("toolbar.menu") || "Menu"}</span>
          </div>
          <button
            type="button"
            className="mobile-menu-close-btn"
            onClick={onClose}
            aria-label={t("mobileMenu.close") || "Close"}
          >
            ✕
          </button>
        </div>

        <div className="mobile-menu-body">
          {/* Tutorial Banner Section */}
          <section className="mobile-menu-section tutorial-section">
            <button
              type="button"
              className="mobile-tutorial-banner-btn"
              onClick={() => {
                onClose();
                useLab.getState().openTutorial("mobile");
              }}
            >
              <div className="mobile-tutorial-banner-content">
                <span className="mobile-tutorial-banner-icon">✨</span>
                <div className="mobile-tutorial-banner-text">
                  <div className="mobile-tutorial-banner-title">{t("tutorial.button") || "新手指引"}</div>
                  <div className="mobile-tutorial-banner-sub">
                    {t("tutorial.buttonTooltip") || "三相馬達自鎖控制快速上手"}
                  </div>
                </div>
              </div>
              <span className="mobile-tutorial-banner-arrow">→</span>
            </button>
          </section>

          {/* Section 1: Diagram Management */}
          <section className="mobile-menu-section">
            <div className="mobile-menu-section-title">{t("mobileMenu.project") || "Diagram Management"}</div>
            <div className="mobile-menu-input-row">
              <label className="mobile-menu-input-label">{t("files.docName") || "Document Name"}</label>
              <input
                type="text"
                className="mobile-menu-text-input"
                value={docName}
                onChange={(e) => useLab.getState().setDocName(e.target.value)}
                placeholder={t("lib.diagramNamePlaceholder") || "Enter diagram name..."}
              />
            </div>

            <div className="mobile-menu-btn-grid">
              <button type="button" className="mobile-action-btn primary" onClick={handleNew}>
                <span className="mobile-action-icon">＋</span>
                <span>{t("lib.newDiagram") || "New Diagram"}</span>
              </button>

              <button type="button" className="mobile-action-btn" onClick={handleCopyShare}>
                <span className="mobile-action-icon">🔗</span>
                <span>{t("files.copyShareLink") || "Share Link"}</span>
              </button>

              <button type="button" className="mobile-action-btn" onClick={handleSaveToLib}>
                <span className="mobile-action-icon">💾</span>
                <span>{t("files.saveToLibrary") || "Save to Library"}</span>
              </button>

              <button type="button" className="mobile-action-btn" onClick={handleExportJson}>
                <span className="mobile-action-icon">⤓</span>
                <span>{t("files.exportJson") || "Export JSON"}</span>
              </button>

              <button type="button" className="mobile-action-btn" onClick={() => fileInputRef.current?.click()}>
                <span className="mobile-action-icon">📂</span>
                <span>{t("files.openFile") || "Open File"}</span>
              </button>

              <button
                type="button"
                className="mobile-action-btn"
                onClick={() => {
                  onClose();
                  useLab.getState().openPrint();
                }}
              >
                <span className="mobile-action-icon">🖨️</span>
                <span>{t("print.execute") || t("files.print") || "Print"}</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void file.text().then((text) => {
                  try {
                    useLab.getState().importDoc(JSON.parse(text));
                    onClose();
                  } catch {
                    useLab.getState().setNotice(t("files.unableToRead"));
                  }
                });
              }}
            />

            {saves.length > 0 && (
              <div className="mobile-saves-box">
                <div className="mobile-saves-header">{t("files.localLibrary") || "Local Library"}</div>
                <div className="mobile-saves-list">
                  {saves.map((s) => (
                    <div className="mobile-save-item" key={s.id} onClick={() => handleLoadSave(s.id)}>
                      <div className="mobile-save-info">
                        <span className="mobile-save-name">{s.name}</span>
                        <span className="mobile-save-date">{new Date(s.savedAt).toLocaleDateString()}</span>
                      </div>
                      <button
                        type="button"
                        className="mobile-save-del-btn"
                        onClick={(e) => handleDeleteSave(s.id, e)}
                        title={t("toolbar.delete")}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Examples */}
          <section className="mobile-menu-section">
            <div className="mobile-menu-section-title">{t("mobileMenu.examples") || t("lib.example") || "Examples"}</div>
            <div className="mobile-examples-list">
              {examples.map((ex) => {
                const isSelected = selectedExample === ex.id;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    className={`mobile-example-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectExample(ex.id)}
                  >
                    <span className="mobile-example-icon">
                      {ex.id === "none" ? "📄" : ex.id === "transformer" ? "⚡" : "⚙️"}
                    </span>
                    <span className="mobile-example-name">{tOr(`example.${ex.id}.title`, ex.title)}</span>
                    {isSelected && <span className="mobile-example-badge">✓</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 3: Preferences & Zoom */}
          <section className="mobile-menu-section">
            <div className="mobile-menu-section-title">{t("mobileMenu.preferences") || "Preferences & View"}</div>

            {/* Language Switch */}
            <div className="mobile-pref-row">
              <span className="mobile-pref-label">{t("lib.language") || "Language"}</span>
              <div className="mobile-segmented-control">
                <button
                  type="button"
                  className={`mobile-segment-btn ${lang === "zh" ? "active" : ""}`}
                  onClick={() => useLab.getState().setLang("zh")}
                >
                  中文
                </button>
                <button
                  type="button"
                  className={`mobile-segment-btn ${lang === "en" ? "active" : ""}`}
                  onClick={() => useLab.getState().setLang("en")}
                >
                  English
                </button>
              </div>
            </div>

            {/* Theme Switch */}
            <div className="mobile-pref-row">
              <span className="mobile-pref-label">{t("theme.theme") || "Theme"}</span>
              <div className="mobile-segmented-control">
                <button
                  type="button"
                  className={`mobile-segment-btn ${theme === "dark" ? "active" : ""}`}
                  onClick={() => useLab.getState().setTheme("dark")}
                >
                  🌙 {t("theme.dark") || "Dark"}
                </button>
                <button
                  type="button"
                  className={`mobile-segment-btn ${theme === "light" ? "active" : ""}`}
                  onClick={() => useLab.getState().setTheme("light")}
                >
                  ☀️ {t("theme.light") || "Light"}
                </button>
              </div>
            </div>

            {/* Canvas Zoom */}
            <div className="mobile-pref-row-column">
              <div className="mobile-pref-row-header">
                <span className="mobile-pref-label">{t("toolbar.zoom") || "Zoom"}</span>
                <span className="mobile-zoom-indicator">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="mobile-zoom-chips">
                <button
                  type="button"
                  className="mobile-zoom-chip highlight"
                  onClick={() => useLab.getState().zoomFit()}
                >
                  ⛶ {t("toolbar.zoomFit") || "Fit"}
                </button>
                {[0.5, 0.75, 1.0, 1.25].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`mobile-zoom-chip ${Math.abs(zoom - lvl) < 0.04 ? "active" : ""}`}
                    onClick={() => useLab.getState().setZoom(lvl)}
                  >
                    {Math.round(lvl * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Circuit stats */}
            <div className="mobile-circuit-stats">
              <span>{circuit.symbols.length} {t("mobileMenu.components") || "symbols"}</span>
              <span>•</span>
              <span>{circuit.wires.length} {t("mobileMenu.wires") || "wires"}</span>
              <span>•</span>
              <span>{circuit.devices.length} {t("inspector.deviceBinding") || "devices"}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
