import { useEffect, useRef, useState } from "react";
import { EXAMPLES, type Example } from "./examples";
import { useLab } from "./store";
import type { Mode } from "./types";
import { trackCircuitStep } from "./analytics";
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
import { OptionsMenu } from "./ui/OptionsMenu";
import { PrintModal } from "./ui/PrintModal";
import { TutorialOverlay } from "./tutorial/TutorialOverlay";
import { setupKeyboardShortcuts } from "./keyboard";
import { ENABLE_AUTO_LAYOUT } from "./features";


// Import all example JSON data directly for both dev and prod (works in GitHub Pages)
type ExampleOption = Pick<Example, "id" | "title"> & { blurb?: string };

// Internal helper - re-exported for internal use only
function _simClockActive(running: boolean, mode: Mode, hidden: boolean): boolean {
  return running && mode === "run" && !hidden;
}

const SIM_TICK_MS = 50;
/** Fire `circuit_step` once per 5s of wall-clock ticks, not every 50ms. */
const SIM_STEP_ANALYTICS_TICKS = 100;

const loadExamplesFromImports = async (): Promise<ExampleOption[]> => {
  try {
    const listData = (await import("./examples/list.json")) as {
      examples?: ExampleOption[];
      default?: { examples?: ExampleOption[] };
    };
    const examples = listData.examples ?? listData.default?.examples;
    if (Array.isArray(examples)) {
      return examples;
    }
  } catch {
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
  // lang is available for future use but currently unused
  const theme = useLab((s) => s.theme);
  const isDirty = useLab((s) => s.isDirty);
  const paletteOpen = useLab((s) => s.paletteOpen);
  const sideOpen = useLab((s) => s.sideOpen);
  const paletteWidth = useLab((s) => s.paletteWidth);
  const sideWidth = useLab((s) => s.sideWidth);
  const layoutMode = useLab((s) => s.layoutMode);
  const zoom = useLab((s) => s.zoom);
  const printOpen = useLab((s) => s.printOpen);
  const tutorialOpen = useLab((s) => s.tutorialOpen);
  const tutorialVersion = useLab((s) => s.tutorialVersion);
  const [examples, setExamples] = useState<ExampleOption[]>(EXAMPLES);
  const [selectedExample, setSelectedExample] = useState<string>("none");
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'new' | 'example'; exampleId?: string } | null>(null);

  // Mobile drawer and menu state
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [mobileSideOpen, setMobileSideOpen] = useState(false);
  const [pageHidden, setPageHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );

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
    if (typeof document === "undefined") return;
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!_simClockActive(running, mode, pageHidden)) return;
    let ticks = 0;
    const id = window.setInterval(() => {
      useLab.getState().step();
      ticks += 1;
      if (ticks >= SIM_STEP_ANALYTICS_TICKS) {
        ticks = 0;
        trackCircuitStep();
      }
    }, SIM_TICK_MS);
    return () => window.clearInterval(id);
  }, [running, mode, pageHidden]);

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

  const topbarRef = useRef<HTMLElement>(null);
  const statusbarRef = useRef<HTMLElement>(null);
  const isDraggingTopbarRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0, moved: false });

  // Native mouse wheel translation (vertical deltaY to horizontal scroll) for topbar
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleTopbarMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking interactive elements
    if (target.closest("button, input, select, summary, a, .cat-item, .diagram-name, .btn-new-doc, .seg-btn, .options-icon, .example-select")) {
      return;
    }

    const el = topbarRef.current;
    if (!el) return;

    isDraggingTopbarRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingTopbarRef.current) return;
      const el = topbarRef.current;
      if (!el) return;
      const dx = e.clientX - dragStartRef.current.x;
      if (Math.abs(dx) > 3) {
        dragStartRef.current.moved = true;
      }
      el.scrollLeft = dragStartRef.current.scrollLeft - dx;
    };

    const onMouseUp = () => {
      if (isDraggingTopbarRef.current) {
        if (dragStartRef.current.moved) {
          const captureClick = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
          };
          window.addEventListener("click", captureClick, { capture: true, once: true });
        }
        isDraggingTopbarRef.current = false;
        dragStartRef.current.moved = false;
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Support wheel scrolling for statusbar
  useEffect(() => {
    const sb = statusbarRef.current;
    if (!sb) return;
    const onSbWheel = (e: WheelEvent) => {
      if (sb.scrollWidth <= sb.clientWidth) return;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        sb.scrollLeft += e.deltaY;
      }
    };
    sb.addEventListener("wheel", onSbWheel, { passive: false });
    return () => {
      sb.removeEventListener("wheel", onSbWheel);
    };
  }, []);

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
    <>
      <div className="app">
      <header
        ref={topbarRef}
        className="topbar"
        onMouseDown={handleTopbarMouseDown}
      >
        {/* Left Section: Brand, File Menu, New Diagram, Title */}
        <div className="topbar-left">
          <div className="brand">
            <h1>E-LAB</h1>
            <small>{t("brand.subtitle")}</small>
          </div>

          <div className="topbar-divider" />
          <FilesMenu onNewDiagram={handleRequestNewDiagram} />
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

        {/* Center Section: Mode Switch & Edit Sub-Mode */}
        <div className="topbar-center">
          {/* Simulation Mode Segmented Switch */}
          <div className="segmented-group mode-switch">
            {layoutMode !== "ladder" && (
              <button
                type="button"
                className={`seg-btn ${mode === "edit" ? "active" : ""}`}
                onClick={() => useLab.getState().setMode("edit")}
                title={t("toolbar.edit")}
              >
                <span className="seg-icon">✏️</span>
                <span>{t("toolbar.edit")}</span>
              </button>
            )}
            <button
              type="button"
              className={`seg-btn ${mode === "run" && running ? "active" : ""}`}
              onClick={() => {
                if (mode !== "run") {
                  useLab.getState().setMode("run");
                } else {
                  useLab.getState().setRunning(true);
                }
              }}
              title={t("toolbar.run")}
            >
              <span className="seg-icon">▶</span>
              <span>{t("toolbar.run")}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${mode === "run" && !running ? "active" : ""}`}
              onClick={() => {
                if (mode !== "run") {
                  useLab.getState().setMode("run");
                  useLab.getState().setRunning(false);
                } else {
                  useLab.getState().setRunning(false);
                }
              }}
              title={t("toolbar.pause")}
            >
              <span className="seg-icon">⏸</span>
              <span>{t("toolbar.pause")}</span>
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
        </div>

        {/* Right Section: Templates & Options Menu */}
        <div className="topbar-right">
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

          <OptionsMenu />
        </div>
      </header>
      {notice && <div className="toast">{notice}</div>}
      
      {/* Discard Changes Modal */}
      <DiscardModal
        isOpen={discardModalOpen}
        onClose={handleDiscardModalClose}
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
        className={`workspace ${!paletteOpen || layoutMode === "ladder" ? "palette-collapsed" : ""} ${!sideOpen ? "side-collapsed" : ""}`} 
        data-layout-mode={layoutMode}
        style={{
          "--palette-width": `${paletteWidth}px`,
          "--side-width": `${sideWidth}px`,
        } as React.CSSProperties}
      >
        {/* Palette stays on the schematic. Ladder view is read-only for now. */}
        {layoutMode !== "ladder" && (isMobile ? (
          <Palette
            className={mobilePaletteOpen ? "open" : ""}
            onClose={() => {
              setMobilePaletteOpen(false);
              useLab.getState().setPaletteOpen(false);
            }}
          />
        ) : (
          paletteOpen && <Palette />
        ))}

        {/* Desktop left panel resizer */}
        {!isMobile && layoutMode !== "ladder" && paletteOpen && (
          <PanelResizer
            direction="left"
            currentWidth={paletteWidth}
            onResize={(w) => useLab.getState().setPaletteWidth(w)}
            onReset={() => useLab.getState().setPaletteWidth(220)}
          />
        )}

        {layoutMode === "ladder" ? (
          <LadderSchematic />
        ) : (
          <Schematic />
        )}
        <FloatingActionBar />

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
        {layoutMode !== "ladder" && (
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
        )}
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

      <footer ref={statusbarRef} className="statusbar">
        <span>{mode === "edit" ? t("status.edit") : running ? t("status.run") : t("status.pause")}</span>
        <span>{Math.round(timeMs)} ms</span>
        <span>{placing ? `${t("runtime.placing")}: ${placing}` : t("runtime.wiring")}</span>
        <span>{`${t("wireColor.l1Brown")} · ${t("wireColor.l2Orange")} · ${t("wireColor.l3Yellow")} · ${t("wireColor.nWhite")} · ${t("wireColor.peGreen")}`}</span>
        <span>NEMA/JIC</span>
        {faults[0] ? <span className="fault">{formatFaultMessage(faults[0])}</span> : <span>{t("runtime.circuitNormal")}</span>}
        {circuit.wires.some((w) => w.broken) || circuit.devices.some((d) => d.params.welded) ? (
          <span className="fault">{t("runtime.faultInjection")}</span>
        ) : null}

        {/* Run Mode Probe Tools */}
        {mode === "run" && (
          <div className="statusbar-probe-tools">
            <button
              type="button"
              className={`btn-statusbar-probe ${placing === "ammeter" ? "active" : ""}`}
              onClick={() => useLab.getState().setPlacing(placing === "ammeter" ? null : "ammeter")}
              title={t("meters.clampProbe")}
            >
              <span className="probe-icon">🧲</span>
              <span>{t("meters.clampProbe")}</span>
            </button>
            <button
              type="button"
              className={`btn-statusbar-probe ${placing === "voltmeter" ? "active" : ""}`}
              onClick={() => useLab.getState().setPlacing(placing === "voltmeter" ? null : "voltmeter")}
              title={t("meters.voltageProbe")}
            >
              <span className="probe-icon">⚡</span>
              <span>{t("meters.voltageProbe")}</span>
            </button>
          </div>
        )}

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

    {/* Print Modal - rendered outside .app so @media print .app { display: none } does not hide print-mount */}
    <PrintModal
      isOpen={printOpen}
      onClose={() => useLab.getState().closePrint()}
    />
  </>
  );
}
