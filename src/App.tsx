import { useEffect, useState } from "react";
import { EXAMPLES, type Example } from "./examples";
import { rotateSelected, useLab } from "./store";
import { formatFaultMessage, t, tOr } from "./i18n";
import { Bench, ProcessRack } from "./ui/Bench";
import { FilesMenu } from "./ui/FilesMenu";
import { Inspector } from "./ui/Inspector";
import { Palette } from "./ui/Palette";
import { Schematic } from "./ui/Schematic";
import { DiscardModal } from "./ui/DiscardModal";
import { TogglePanelButton } from "./ui/TogglePanelButton";
import { FloatingActionBar } from "./ui/FloatingActionBar";
import { MobileMenuModal } from "./ui/MobileMenuModal";


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
  const running = useLab((s) => s.running);
  const snapshot = useLab((s) => s.snapshot);
  const timeMs = useLab((s) => s.timeMs);
  const placing = useLab((s) => s.placing);
  const notice = useLab((s) => s.notice);
  const circuit = useLab((s) => s.circuit);
  const docName = useLab((s) => s.docName);
  const process = useLab((s) => s.process);
  const lang = useLab((s) => s.lang);
  const isDirty = useLab((s) => s.isDirty);
  const paletteOpen = useLab((s) => s.paletteOpen);
  const sideOpen = useLab((s) => s.sideOpen);
  const zoom = useLab((s) => s.zoom);
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
    if (!notice) return;
    const id = window.setTimeout(() => useLab.getState().setNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!running || mode !== "run") return;
    const id = window.setInterval(() => useLab.getState().step(), 50);
    return () => window.clearInterval(id);
  }, [running, mode]);

  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const lab = useLab.getState();
      if (e.key === "[" || ((e.metaKey || e.ctrlKey) && e.key === "[")) {
        e.preventDefault();
        lab.togglePalette();
        return;
      }
      if (e.key === "]" || ((e.metaKey || e.ctrlKey) && e.key === "]")) {
        e.preventDefault();
        lab.toggleSide();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        lab.zoomIn();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        lab.zoomOut();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        lab.resetZoom();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "9") {
        e.preventDefault();
        lab.zoomFit();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        lab.deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        lab.setPlacing(null);
        lab.select(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) lab.redo();
        else lab.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        lab.copySelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        lab.pasteClipboard();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        lab.duplicateSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        lab.selectAll();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (lab.mode !== "edit") return;
        if (e.shiftKey) lab.ungroupSelected();
        else lab.groupSelected();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (lab.mode === "run") lab.setRunning(!lab.running);
        return;
      }
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (lab.mode !== "edit") return;
        rotateSelected(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key.toLowerCase() === "h" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (lab.mode !== "edit") return;
        lab.flipSelected("h");
        return;
      }
      if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (lab.mode !== "edit") return;
        lab.flipSelected("v");
        return;
      }
      if (lab.mode === "edit" && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        if (e.key === "ArrowLeft") lab.nudgeSelected(-step, 0);
        if (e.key === "ArrowRight") lab.nudgeSelected(step, 0);
        if (e.key === "ArrowUp") lab.nudgeSelected(0, -step);
        if (e.key === "ArrowDown") lab.nudgeSelected(0, step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        <div className="brand">
          <h1>E-LAB</h1>
          <small>{t("brand.subtitle")}</small>
        </div>
        <div className="mode-switch">
          <button className={`btn ${mode === "edit" ? "active" : ""}`} onClick={() => useLab.getState().setMode("edit")}>
            {t("toolbar.edit")}
          </button>
          <button className={`btn ${mode === "run" ? "active" : ""}`} onClick={() => useLab.getState().setMode("run")}>
            {t("toolbar.run")}
          </button>
          <button className="btn" onClick={() => useLab.getState().resetSim()}>
            {t("toolbar.reset")}
          </button>
        </div>
        {/* On Mobile: show clean, touch-friendly action buttons (Palette drawer, Side panel drawer, Mobile Menu sheet) */}
        {isMobile ? (
          <div className="mobile-header-actions">
            <button
              type="button"
              className={`btn-icon mobile-header-btn ${mobilePaletteOpen ? "active" : ""}`}
              onClick={() => {
                setMobilePaletteOpen(!mobilePaletteOpen);
                setMobileSideOpen(false);
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
                setMobileSideOpen(!mobileSideOpen);
                setMobilePaletteOpen(false);
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
              title={t("toolbar.menu") || "Menu"}
              aria-label={t("toolbar.menu") || "Menu"}
            >
              ⋯
            </button>
          </div>
        ) : (
          <div className="top-actions">
            <label className="action-label">{t("lib.example")}:</label>
            <select 
              value={selectedExample}
              onChange={(e) => handleRequestSelectExample(e.target.value)}
            >
              {examples.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {tOr(`example.${ex.id}.title`, ex.title)}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="diagram-name"
              value={docName}
              onChange={(e) => useLab.getState().setDocName(e.target.value)}
              placeholder={t("lib.diagramNamePlaceholder") || "Enter diagram name..."}
            />
            <button className="btn" onClick={() => handleRequestNewDiagram()}>
              {t("lib.newDiagram")}
            </button>
            <select
              value={lang}
              title={t("lib.language")}
              onChange={(e) => useLab.getState().setLang(e.target.value as any)}
            >
              <option value="en">{t("lang.en")}</option>
              <option value="zh">{t("lang.zh")}</option>
            </select>
            <FilesMenu />
            <button className="btn" onClick={() => useLab.getState().undo()} title={t("toolbar.undo")}>
              {t("toolbar.undo")}
            </button>
            <button className="btn" onClick={() => useLab.getState().redo()} title={t("toolbar.redo")}>
              {t("toolbar.redo")}
            </button>
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
          </div>
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

      {/* Mobile drawer backdrop */}
      {(isMobile && (mobilePaletteOpen || mobileSideOpen)) && (
        <div
          className="drawer-backdrop visible"
          onClick={() => {
            setMobilePaletteOpen(false);
            setMobileSideOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      <div className={`workspace ${!paletteOpen ? "palette-collapsed" : ""} ${!sideOpen ? "side-collapsed" : ""}`}>
        {/* Palette - desktop: inline, mobile: drawer */}
        {isMobile ? (
          <Palette
            className={mobilePaletteOpen ? "open" : ""}
            onClose={() => setMobilePaletteOpen(false)}
          />
        ) : (
          paletteOpen && <Palette />
        )}

        <Schematic />
        <FloatingActionBar />

        {/* Side panel - desktop: inline, mobile: drawer */}
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
                onClick={() => setMobileSideOpen(false)}
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
          sideOpen && (
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
          )
        )}

        {/* Desktop panel toggles (hidden on mobile via CSS) */}
        <TogglePanelButton
          direction="left"
          isOpen={paletteOpen}
          onClick={() => useLab.getState().togglePalette()}
        />
        <TogglePanelButton
          direction="right"
          isOpen={sideOpen}
          onClick={() => useLab.getState().toggleSide()}
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
      </footer>
    </div>
  );
}
