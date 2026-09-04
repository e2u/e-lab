import { useEffect, useState } from "react";
import { EXAMPLES, type Example } from "./examples";
import { useLab } from "./store";
import { formatFaultMessage, t, tOr } from "./i18n";
import { Bench, ProcessRack } from "./ui/Bench";
import { FilesMenu } from "./ui/FilesMenu";
import { Inspector } from "./ui/Inspector";
import { Palette } from "./ui/Palette";
import { Schematic } from "./ui/Schematic";
import { LadderSchematic } from "./ui/LadderSchematic"; // Ladder diagram schematic component
import { DiscardModal } from "./ui/DiscardModal";
import { TogglePanelButton } from "./ui/TogglePanelButton";
import { PanelResizer } from "./ui/PanelResizer";
import { FloatingActionBar } from "./ui/FloatingActionBar";
import { MobileMenuModal } from "./ui/MobileMenuModal";
import { PrintModal } from "./ui/PrintModal";
import { TutorialOverlay } from "./tutorial/TutorialOverlay";
import { setupKeyboardShortcuts } from "./keyboard";
import { ENABLE_AUTO_LAYOUT, ENABLE_LADDER } from "./features";


// Import all example JSON data directly for both dev and prod (works in GitHub Pages)
const loadExamplesFromImports = async (): Promise<Example[]> => {
  try {
    const listData: any = await import("./examples/list.json");
    if (listData && listData.examples && Array.isArray(listData.examples)) {
      return listData.examples;
    }
  } catch (e) {
    console.log("Failed to load examples from imports, using default examples");
  }
  // Fallback to default examples
  return EXAMPLES;
};

export function App() {
  const mode = useLab((s) => s.mode);
  const editSubMode = useLab((s) => s.editSubMode);
  const running = useLab((s) => s.running);
  const snapshot = useLab((s) => s.snapshot);
  const timeMs = useLab((s) => s.timeMs);
  const placing = useLab((s) => s.placing);
  const notice = useLab((s) => s.notice);
  const circuit = useLab((s) => s.circuit);
  const docName = useLab((s) => s.docName);
  const process = useLab((s) => s.process);
  const lang = useLab((s) => s.lang);
  const theme = useLab((s) => s.theme);
  const isDirty = useLab((s) => s.isDirty);
  const paletteOpen = useLab((s) => s.paletteOpen);
  const sideOpen = useLab((s) => s.sideOpen);
  const paletteWidth = useLab((s) => s.paletteWidth);
  const sideWidth = useLab((s) => s.sideWidth);
  const layoutMode = useLab((s) => s.layoutMode);
  const showLadderMenu = useLab((s) => s.showLadderMenu);
  const zoom = useLab((s) => s.zoom);
  const printOpen = useLab((s) => s.printOpen);
  const tutorialOpen = useLab((s) => s.tutorialOpen);
  const tutorialVersion = useLab((s) => s.tutorialVersion);
  const [examples, setExamples] = useState<Example[]>(EXAMPLES);
  const [selectedExample, setSelectedExample] = useState<string>("none");
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'new' | 'example'; exampleId?: string } | null>(null);

  // Mobile drawer and menu state
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [mobileSideOpen, setMobileSideOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => useLab.getState().persistDraft(), 700);
    return () => window.clearTimeout(id);
  }, [circuit, docName, process]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      useLab.getState().persistDraft();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => useLab.getState().setNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Sync theme attribute to <html> element
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!running || mode !== "run") return;
    const id = window.setInterval(() => useLab.getState().step(), 50);
    return () => window.clearInterval(id);
  }, [running, mode]);

  // Global keyboard shortcuts and focus management
  useEffect(() => {
    return setupKeyboardShortcuts();
  }, []);

  // Load examples on mount - works in both dev and GitHub Pages
  useEffect(() => {
    loadExamplesFromImports().then(setExamples);

    // Load three-phase-motor example on first visit (when circuit is empty)
    const lab = useLab.getState();
    if (lab.circuit.devices.length === 0 && lab.circuit.symbols.length === 0) {
      setSelectedExample("three-phase-motor");
      lab.loadExample("three-phase-motor");
    }

    // Check if user is visiting for the first time, auto-launch tutorial
    try {
      if (typeof localStorage !== "undefined") {
        const hasCompleted = localStorage.getItem("elab.tutorial_completed");
        if (!hasCompleted) {
          const isMobileDevice =
            window.innerWidth <= 768 || (window.innerHeight <= 550 && window.innerWidth <= 1024);
          const timer = setTimeout(() => {
            useLab.getState().openTutorial(isMobileDevice ? "mobile" : "pc");
          }, 450);
          return () => clearTimeout(timer);
        }
      }
    } catch {}
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      // A device should be in mobile / drawer mode if:
      // 1. Width <= 768px (portrait phones, small tablets)
      // 2. OR Height <= 550px with Width <= 1024px (phones in landscape orientation)
      // 3. OR Touch device ((hover: none) and (pointer: coarse)) with Width <= 1024px
      const isTouch = typeof window !== "undefined" && (
        window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ||
        (navigator?.maxTouchPoints ?? 0) > 0
      );
      const isLandscapeMobile = window.innerHeight <= 550 && window.innerWidth <= 1024;
      const isSmallWidth = window.innerWidth <= 768;
      const isTouchTabletOrPhone = Boolean(isTouch && window.innerWidth <= 1024);

      const mobile = isSmallWidth || isLandscapeMobile || isTouchTabletOrPhone;
      setIsMobile(mobile);
      // Sync mobile drawer state with store state on desktop
      if (!mobile) {
        setMobilePaletteOpen(false);
        setMobileSideOpen(false);
        setMobileMenuOpen(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, []);

  // Adaptive initial zoom for small screens
  // Only apply if zoom is still at default (1.0) meaning user hasn't customized it
  useEffect(() => {
    const isSmall = window.innerWidth <= 768 || window.innerHeight <= 550;
    if (isSmall && zoom === 1) {
      useLab.getState().setZoom(0.5);
    }
  }, [zoom]);

  useEffect(() => {
    const devices = useLab.getState().circuit.devices;
    const noisy = devices.some(
      (d) => (d.kind === "alarm" || d.kind === "horn") && snapshot.runtime[d.id]?.lit,
    );
    if (!noisy || mode !== "run") return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    return () => {
      osc.stop();
      void ctx.close();
    };
  }, [snapshot, mode]);

  const faults = snapshot.faults;

  // Handle new diagram - show modal for unsaved changes only if dirty
  const handleRequestNewDiagram = () => {
    if (isDirty) {
      setPendingAction({ type: 'new' });
      setDiscardModalOpen(true);
    } else {
      setSelectedExample("none");
      useLab.getState().loadBlankTemplate(true);
    }
  };

  // Handle example selection - show modal for unsaved changes only if dirty
  const handleRequestSelectExample = (exampleId: string) => {
    if (isDirty) {
      setPendingAction({ type: 'example', exampleId });
      setDiscardModalOpen(true);
    } else {
      setSelectedExample(exampleId);
      useLab.getState().loadExample(exampleId);
    }
  };

  // Handle discard modal action
  const handleDiscardModalClose = (action?: string) => {
    setDiscardModalOpen(false);
    
    if (!pendingAction) {
      setPendingAction(null);
      return;
    }
    
    if (action === 'save') {
      // Export current circuit first
      useLab.getState().exportFile();
      
      if (pendingAction.type === 'new') {
        setSelectedExample("none");
        useLab.getState().loadBlankTemplate(true);
      } else if (pendingAction.type === 'example' && pendingAction.exampleId) {
        setSelectedExample(pendingAction.exampleId);
        useLab.getState().loadExample(pendingAction.exampleId);
      }
    } else if (action === 'discard') {
      // Discard changes and continue with the action
      if (pendingAction.type === 'new') {
        setSelectedExample("none");
        useLab.getState().loadBlankTemplate(true);
      } else if (pendingAction.type === 'example' && pendingAction.exampleId) {
        setSelectedExample(pendingAction.exampleId);
        useLab.getState().loadExample(pendingAction.exampleId);
      }
    }
    
    setPendingAction(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        {isMobile ? (
          <>
            <div className="brand">
              <h1>E-LAB</h1>
              <small>{t("brand.subtitle")}</small>
            </div>
            <div className="mode-switch">
              {layoutMode !== "ladder" && (
                <button className={`btn ${mode === "edit" ? "active" : ""}`} onClick={() => useLab.getState().setMode("edit")}>
                  {t("toolbar.edit")}
                </button>
              )}
              {mode === "edit" && layoutMode !== "ladder" && (
                <>
                  <button
                    type="button"
                    className={`btn submode-mobile-btn ${editSubMode === "wiring" ? "active" : ""}`}
                    onClick={() => useLab.getState().toggleEditSubMode()}
                    title={editSubMode === "wiring" ? t("toolbar.wiringTip") : t("toolbar.editingTip")}
                  >
                    {editSubMode === "wiring" ? `🔌 ${t("toolbar.wiring")}` : `✋ ${t("toolbar.editing")}`}
                  </button>
                  {ENABLE_AUTO_LAYOUT && (
                    <button
                      type="button"
                      className="btn submode-mobile-btn"
                      onClick={() => useLab.getState().autoLayout()}
                      title={t("toolbar.autoLayoutTip")}
                    >
                      🪄 {t("toolbar.autoLayout")}
                    </button>
                  )}
                </>
              )}
              <button className={`btn ${mode === "run" ? "active" : ""}`} onClick={() => useLab.getState().setMode("run")}>
                {t("toolbar.run")}
              </button>
              <button className="btn" onClick={() => useLab.getState().resetSim()}>
                {t("toolbar.reset")}
              </button>
            </div>
            <div className="mobile-header-actions">
              <button
                type="button"
                className="btn-tutorial-mobile-highlight"
                onClick={() => useLab.getState().openTutorial("mobile")}
                title={t("tutorial.buttonTooltip")}
                aria-label={t("tutorial.button")}
              >
                ✨ {t("tutorial.button")}
              </button>
              <button
                type="button"
                className={`btn-icon mobile-header-btn ${mobilePaletteOpen ? "active" : ""}`}
                onClick={() => {
                  const next = !mobilePaletteOpen;
                  setMobilePaletteOpen(next);
                  setMobileSideOpen(false);
                  useLab.getState().setPaletteOpen(next);
                }}
                title={t("toolbar.palette")}
                aria-label={t("toolbar.palette")}
              >
                ☰
              </button>
              <button
                type="button"
                className={`btn-icon mobile-header-btn ${mobileSideOpen ? "active" : ""}`}
                onClick={() => {
                  const next = !mobileSideOpen;
                  setMobileSideOpen(next);
                  setMobilePaletteOpen(false);
                  useLab.getState().setSideOpen(next);
                }}
                title={t("toolbar.sidePanel")}
                aria-label={t("toolbar.sidePanel")}
              >
                ⚙
              </button>
              <button
                type="button"
                className={`btn-icon mobile-header-btn ${mobileMenuOpen ? "active" : ""}`}
                onClick={() => setMobileMenuOpen(true)}
                title={t("toolbar.menu")}
                aria-label={t("toolbar.menu")}
              >
                ⋯
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Left Section: Brand, File Menu, New Diagram, Title */}
            <div className="topbar-left">
              <div className="brand">
                <h1>E-LAB</h1>
                <small>{t("brand.subtitle")}</small>
              </div>
              <div className="topbar-divider" />
              <FilesMenu />
              <button
                type="button"
                className="btn btn-new-doc"
                onClick={() => handleRequestNewDiagram()}
                title={t("lib.newDiagram")}
              >
                <span className="btn-plus-icon">+</span>
                <span>{t("lib.newDiagram")}</span>
              </button>
              <div className="doc-title-wrapper" title={t("files.docName")}>
                <input
                  type="text"
                  className="diagram-name"
                  value={docName}
                  onChange={(e) => useLab.getState().setDocName(e.target.value)}
                  placeholder={t("lib.diagramNamePlaceholder")}
                />
              </div>
            </div>

            {/* Center Section: Mode, Layout View, Probes, Guide, Examples */}
            <div className="topbar-center">
              {/* Simulation Mode Segmented Switch */}
              <div className="segmented-group mode-switch">
                {layoutMode !== "ladder" && (
                  <button
                    type="button"
                    className={`seg-btn ${mode === "edit" ? "active" : ""}`}
                    onClick={() => useLab.getState().setMode("edit")}
                  >
                    <span className="seg-icon">✏️</span>
                    <span>{t("toolbar.edit")}</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`seg-btn ${mode === "run" ? "active" : ""}`}
                  onClick={() => useLab.getState().setMode("run")}
                >
                  <span className="seg-icon">▶</span>
                  <span>{t("toolbar.run")}</span>
                </button>
                <button
                  type="button"
                  className="seg-btn btn-reset"
                  onClick={() => useLab.getState().resetSim()}
                  title={t("toolbar.reset")}
                >
                  <span className="seg-icon">↺</span>
                  <span>{t("toolbar.reset")}</span>
                </button>
              </div>

              {/* Edit Sub-Mode Segmented Switch (Editing / Wiring) & Auto Layout */}
              {mode === "edit" && layoutMode !== "ladder" && (
                <>
                  <div className="segmented-group submode-switch">
                    <button
                      type="button"
                      className={`seg-btn ${editSubMode === "editing" ? "active" : ""}`}
                      onClick={() => useLab.getState().setEditSubMode("editing")}
                      title={t("toolbar.editingTip")}
                    >
                      <span className="seg-icon">✋</span>
                      <span>{t("toolbar.editing")}</span>
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${editSubMode === "wiring" ? "active" : ""}`}
                      onClick={() => useLab.getState().setEditSubMode("wiring")}
                      title={t("toolbar.wiringTip")}
                    >
                      <span className="seg-icon">🔌</span>
                      <span>{t("toolbar.wiring")}</span>
                    </button>
                  </div>
                  {ENABLE_AUTO_LAYOUT && (
                    <button
                      type="button"
                      className="btn btn-auto-layout"
                      onClick={() => useLab.getState().autoLayout()}
                      title={t("toolbar.autoLayoutTip")}
                    >
                      <span>🪄</span>
                      <span>{t("toolbar.autoLayout")}</span>
                    </button>
                  )}
                </>
              )}

              {/* Run Mode Probe Tools */}
              {mode === "run" && (
                <div className="probe-tools-group">
                  <button
                    type="button"
                    className={`btn btn-probe ${placing === "ammeter" ? "active" : ""}`}
                    onClick={() => useLab.getState().setPlacing(placing === "ammeter" ? null : "ammeter")}
                    title={t("meters.clampProbe")}
                  >
                    🧲 {t("meters.clampProbe")}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-probe ${placing === "voltmeter" ? "active" : ""}`}
                    onClick={() => useLab.getState().setPlacing(placing === "voltmeter" ? null : "voltmeter")}
                    title={t("meters.voltageProbe")}
                  >
                    ⚡ {t("meters.voltageProbe")}
                  </button>
                </div>
              )}

              <div className="topbar-divider" />

              {/* Only show Layout Mode switch button when ENABLE_LADDER and showLadderMenu are true */}
              {ENABLE_LADDER && showLadderMenu && (
                <>
                  {/* Layout Mode Toggle - Schematic / Ladder */}
                  <div className="segmented-group layout-mode-switch">
                    <button
                      type="button"
                      className={`seg-btn ${layoutMode === "schematic" ? "active" : ""}`}
                      onClick={() => useLab.getState().setLayoutMode("schematic")}
                      title={t("toolbar.schematic")}
                    >
                      <span className="seg-icon">📐</span>
                      <span>{t("toolbar.schematic")}</span>
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${layoutMode === "ladder" ? "active" : ""}`}
                      onClick={() => useLab.getState().setLayoutMode("ladder")}
                      title={t("toolbar.ladder")}
                    >
                      <span className="seg-icon">🪜</span>
                      <span>{t("toolbar.ladder")}</span>
                    </button>
                  </div>

                  <div className="topbar-divider" />
                </>
              )}

              {/* Interactive Tutorial Button */}
              <button
                type="button"
                className="btn-tutorial-highlight"
                onClick={() => useLab.getState().openTutorial("pc")}
                title={t("tutorial.buttonTooltip")}
              >
                <span className="btn-tutorial-icon">✨</span>
                <span>{t("tutorial.button")}</span>
              </button>

              {/* Example Selector */}
              <div className="example-selector-wrapper">
                <span className="example-icon">📚</span>
                <select 
                  value={selectedExample}
                  onChange={(e) => {
                    handleRequestSelectExample(e.target.value);
                    e.target.blur();
                  }}
                  className="example-select"
                  title={t("lib.example")}
                >
                  {examples.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {tOr(`example.${ex.id}.title`, ex.title)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Section: Theme & Language */}
            <div className="topbar-right">
              {/* Theme Switcher */}
              <button
                type="button"
                className="btn-icon btn-theme-toggle"
                onClick={() => useLab.getState().toggleTheme()}
                title={theme === "dark" ? (t("theme.switchToLight")) : (t("theme.switchToDark"))}
                aria-label={t("theme.theme")}
              >
                {theme === "dark" ? "🌙" : "☀️"}
              </button>

              {/* Language Switcher */}
              <div className="lang-select-wrapper">
                <span className="lang-icon">🌐</span>
                <select
                  value={lang}
                  title={t("lib.language")}
                  className="lang-select"
                  onChange={(e) => {
                    useLab.getState().setLang(e.target.value as any);
                    e.target.blur();
                  }}
                >
                  <option value="zh">繁中</option>
                  <option value="en">EN</option>
                </select>
              </div>

              {/* Ladder menu toggle */}
              {ENABLE_LADDER && (
                <button
                  type="button"
                  className={`btn-icon ${showLadderMenu ? "active" : ""}`}
                  onClick={() => useLab.getState().toggleShowLadderMenu()}
                  title={showLadderMenu ? t("toolbar.hideLadder") : t("toolbar.showLadder")}
                  aria-label={t("toolbar.ladderToggle")}
                >
                  🪜
                </button>
              )}
            </div>
          </>
        )}
      </header>
      {notice && <div className="toast">{notice}</div>}
      
      {/* Discard Changes Modal */}
      <DiscardModal
        isOpen={discardModalOpen}
        onClose={handleDiscardModalClose}
      />

      {/* Mobile Menu Modal / Bottom Sheet */}
      <MobileMenuModal
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        examples={examples}
        selectedExample={selectedExample}
        onSelectExample={handleRequestSelectExample}
        onRequestNewDiagram={handleRequestNewDiagram}
      />

      {/* Print Modal */}
      <PrintModal
        isOpen={printOpen}
        onClose={() => useLab.getState().closePrint()}
      />

      {/* Tutorial Overlay */}
      <TutorialOverlay
        isOpen={tutorialOpen}
        onClose={() => useLab.getState().closeTutorial()}
        defaultVersion={tutorialVersion}
      />

      {/* Mobile drawer backdrop */}
      {(isMobile && (mobilePaletteOpen || mobileSideOpen)) && (
        <div
          className="drawer-backdrop visible"
          onClick={() => {
            setMobilePaletteOpen(false);
            setMobileSideOpen(false);
            useLab.getState().setPaletteOpen(false);
            useLab.getState().setSideOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* Add data-layout-mode attribute to workspace div to support ladder mode CSS layout */}
      <div 
        className={`workspace ${!paletteOpen ? "palette-collapsed" : ""} ${!sideOpen ? "side-collapsed" : ""}`} 
        data-layout-mode={layoutMode}
        style={{
          "--palette-width": `${paletteWidth}px`,
          "--side-width": `${sideWidth}px`,
        } as React.CSSProperties}
      >
        {/* Palette - desktop: inline, mobile: drawer */}
        {isMobile ? (
          <Palette
            className={mobilePaletteOpen ? "open" : ""}
            onClose={() => {
              setMobilePaletteOpen(false);
              useLab.getState().setPaletteOpen(false);
            }}
          />
        ) : (
          paletteOpen && <Palette />
        )}

        {/* Desktop left panel resizer */}
        {!isMobile && paletteOpen && (
          <PanelResizer
            direction="left"
            currentWidth={paletteWidth}
            onResize={(w) => useLab.getState().setPaletteWidth(w)}
            onReset={() => useLab.getState().setPaletteWidth(220)}
          />
        )}

        {/* Ladder diagram conditional rendering: switch canvas based on layoutMode */}
        {ENABLE_LADDER && layoutMode === "ladder" ? (
          <LadderSchematic />
        ) : (
          <>
            <Schematic />
            <FloatingActionBar />
          </>
        )}

        {/* Desktop right panel resizer */}
        {!isMobile && sideOpen && (
          <PanelResizer
            direction="right"
            currentWidth={sideWidth}
            onResize={(w) => useLab.getState().setSideWidth(w)}
            onReset={() => useLab.getState().setSideWidth(260)}
          />
        )}

        {/* Side panel - desktop: inline, mobile: drawer */}
        {sideOpen && (
          <>
            {isMobile ? (
              <aside
                className={`side ${mobileSideOpen ? "open" : ""}`}
                style={{ zIndex: mobileSideOpen ? 30 : 20 }}
              >
                <div className="side-header">
                  <span className="side-title">{t("toolbar.sidePanel")}</span>
                  <button
                    type="button"
                    className="panel-close-btn"
                    onClick={() => {
                      setMobileSideOpen(false);
                      useLab.getState().setSideOpen(false);
                    }}
                    title={t("toolbar.collapseRight")}
                    aria-label={t("toolbar.collapseRight")}
                  >
                    ✕
                  </button>
                </div>
                <Bench />
                <ProcessRack />
                <Inspector />
              </aside>
            ) : (
              <aside className="side">
                <div className="side-header">
                  <span className="side-title">{t("toolbar.sidePanel")}</span>
                  <button
                    type="button"
                    className="panel-close-btn"
                    onClick={() => useLab.getState().setSideOpen(false)}
                    title={t("toolbar.collapseRight")}
                    aria-label={t("toolbar.collapseRight")}
                  >
                    ✕
                  </button>
                </div>
                <Bench />
                <ProcessRack />
                <Inspector />
              </aside>
            )}
          </>
        )}

        {/* Panel toggles for both desktop and small screens */}
        <TogglePanelButton
          direction="left"
          isOpen={isMobile ? mobilePaletteOpen : paletteOpen}
          onClick={() => {
            if (isMobile) {
              const next = !mobilePaletteOpen;
              setMobilePaletteOpen(next);
              if (next) setMobileSideOpen(false);
              useLab.getState().setPaletteOpen(next);
            } else {
              useLab.getState().togglePalette();
            }
          }}
        />
        <TogglePanelButton
          direction="right"
          isOpen={isMobile ? mobileSideOpen : sideOpen}
          onClick={() => {
            if (isMobile) {
              const next = !mobileSideOpen;
              setMobileSideOpen(next);
              if (next) setMobilePaletteOpen(false);
              useLab.getState().setSideOpen(next);
            } else {
              useLab.getState().toggleSide();
            }
          }}
        />
      </div>

      <footer className="statusbar">
        <span>{mode === "edit" ? t("status.edit") : running ? t("status.run") : t("status.pause")}</span>
        <span>{Math.round(timeMs)} ms</span>
        <span>{placing ? `${t("runtime.placing")}: ${placing}` : t("runtime.wiring")}</span>
        <span>{`${t("wireColor.l1Brown")} · ${t("wireColor.l2Orange")} · ${t("wireColor.l3Yellow")} · ${t("wireColor.nWhite")} · ${t("wireColor.peGreen")}`}</span>
        <span>NEMA/JIC</span>
        {faults[0] ? <span className="fault">{formatFaultMessage(faults[0])}</span> : <span>{t("runtime.circuitNormal")}</span>}
        {circuit.wires.some((w) => w.broken) || circuit.devices.some((d) => d.params.welded) ? (
          <span className="fault">{t("runtime.faultInjection")}</span>
        ) : null}

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button
            type="button"
            className="btn-icon"
            onClick={() => useLab.getState().zoomOut()}
            title={t("toolbar.zoomOut")}
            disabled={zoom <= 0.25}
            aria-label={t("toolbar.zoomOut")}
          >
            −
          </button>
          <input
            type="range"
            className="zoom-slider"
            min="0.25"
            max="1.5"
            step="0.01"
            value={zoom}
            onChange={(e) => useLab.getState().setZoom(parseFloat(e.target.value))}
            title={`${t("toolbar.zoom")}: ${Math.round(zoom * 100)}%`}
            aria-label={t("toolbar.zoom")}
          />
          <span
            className="zoom-val"
            onClick={() => useLab.getState().resetZoom()}
            title={t("toolbar.zoomReset")}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => useLab.getState().zoomIn()}
            title={t("toolbar.zoomIn")}
            disabled={zoom >= 1.5}
            aria-label={t("toolbar.zoomIn")}
          >
            +
          </button>
          <button
            type="button"
            className="btn-icon zoom-fit-btn"
            onClick={() => useLab.getState().zoomFit()}
            title={t("toolbar.zoomFit")}
            aria-label={t("toolbar.zoomFit")}
          >
            ⛶
          </button>
        </div>

        <span className="statusbar-copyright">@2026 DW. All rights reserved.</span>
      </footer>
    </div>
  );
}
