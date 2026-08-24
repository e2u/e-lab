import { useEffect, useState } from "react";
import { EXAMPLES, type Example } from "./examples";
import { rotateSelected, useLab } from "./store";
import { t } from "./i18n";
import { Bench, ProcessRack } from "./ui/Bench";
import { FilesMenu } from "./ui/FilesMenu";
import { Inspector } from "./ui/Inspector";
import { Palette } from "./ui/Palette";
import { Schematic } from "./ui/Schematic";
import { DiscardModal } from "./ui/DiscardModal";


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
  // Panel visibility states with localStorage persistence
  const [showPalette, setShowPalette] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("elab.showPalette");
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  
  const [showSide, setShowSide] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("elab.showSide");
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Persist panel state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("elab.showPalette", String(showPalette));
    } catch {}
  }, [showPalette]);
  
  useEffect(() => {
    try {
      localStorage.setItem("elab.showSide", String(showSide));
    } catch {}
  }, [showSide]);

  const [examples, setExamples] = useState<Example[]>(EXAMPLES);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'new' | 'example'; exampleId?: string } | null>(null);

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
  }, []);

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

  // Handle new diagram - show modal for unsaved changes
  const handleRequestNewDiagram = () => {
    setPendingAction({ type: 'new' });
    setDiscardModalOpen(true);
  };

  // Handle example selection - show modal for unsaved changes
  const handleRequestSelectExample = (exampleId: string) => {
    setPendingAction({ type: 'example', exampleId });
    setDiscardModalOpen(true);
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
        useLab.getState().loadBlankTemplate(true);
      } else if (pendingAction.type === 'example' && pendingAction.exampleId) {
        useLab.getState().loadExample(pendingAction.exampleId);
      }
    } else if (action === 'discard') {
      // Discard changes and continue with the action
      if (pendingAction.type === 'new') {
        useLab.getState().loadBlankTemplate(true);
      } else if (pendingAction.type === 'example' && pendingAction.exampleId) {
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
        <div className="top-actions">
          <label className="action-label">{t("lib.example")}:</label>
          <select 
            defaultValue="none"  // Changed from "dol" to "none"
            onChange={(e) => handleRequestSelectExample(e.target.value)}
          >
            {examples.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
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
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
          <FilesMenu />
          <button className="btn" onClick={() => useLab.getState().undo()}>
            {t("toolbar.undo")}
          </button>
        </div>
      </header>
      {notice && <div className="toast">{notice}</div>}
      
      {/* Discard Changes Modal */}
      <DiscardModal 
        isOpen={discardModalOpen} 
        onClose={handleDiscardModalClose} 
      />

      <div className="workspace">
        <aside className={`palette ${showPalette ? '' : 'collapsed'}`}>
          {showPalette && <Palette />}
          {!showPalette && (
            <button 
              className="expand-btn"
              onClick={() => setShowPalette(true)}
              title={t("toolbar.expand")}
            >
              «
            </button>
          )}
        </aside>
        <Schematic />
        <aside className={`side ${showSide ? '' : 'collapsed'}`}>
          {showSide && <>
            <Bench />
            <ProcessRack />
            <Inspector />
          </>}
          {!showSide && (
            <button 
              className="expand-btn"
              onClick={() => setShowSide(true)}
              title={t("toolbar.expand")}
            >
              »
            </button>
          )}
        </aside>
      </div>

      <footer className="statusbar">
        <span>{mode === "edit" ? "EDIT" : running ? "RUN" : "PAUSE"}</span>
        <span>{Math.round(timeMs)} ms</span>
        <span>{placing ? `${t("runtime.placing")}: ${ placing}` : t("runtime.wiring")}</span>
        <span>{`${t("wireColor.l1Brown")} · ${t("wireColor.l2Orange")} · ${t("wireColor.l3Yellow")} · ${t("wireColor.nWhite")} · ${t("wireColor.peGreen")}`}</span>
        <span>NEMA/JIC</span>
        {faults[0] ? <span className="fault">{faults[0].message}</span> : <span>{t("runtime.circuitNormal")}</span>}
        {circuit.wires.some((w) => w.broken) || circuit.devices.some((d) => d.params.welded) ? (
          <span className="fault">{t("runtime.faultInjection")}</span>
        ) : null}
      </footer>
    </div>
  );
}
