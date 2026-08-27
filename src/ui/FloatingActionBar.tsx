import { rotateSelected, useLab } from "../store";
import { t } from "../i18n";
import { triggerHaptic } from "./schematic/interact";

export function FloatingActionBar() {
  const mode = useLab((s) => s.mode);
  const selected = useLab((s) => s.selected);
  const selectedIds = useLab((s) => s.selectedIds);
  const historyLen = useLab((s) => s.history.length);
  const futureLen = useLab((s) => s.future.length);
  const circuit = useLab((s) => s.circuit);

  const hasSelection = Boolean(selected || selectedIds.length > 0);
  const hasSymbolSelected = Boolean(
    (selected?.type === "symbol" || selectedIds.length > 0) && mode === "edit"
  );
  
  // Check if selected items contain any group (flip is disabled for groups)
  const isGroupSelected = Boolean(
    hasSymbolSelected &&
    circuit.groups?.some((g) => g.memberIds.some((id) => selectedIds.includes(id)))
  );

  const handleAction = (action: () => void) => {
    triggerHaptic(15);
    action();
  };

  return (
    <div className="floating-action-bar" role="toolbar" aria-label={t("toolbar.quickActions")}>
      <button
        type="button"
        className="floating-btn"
        onClick={() => handleAction(() => useLab.getState().undo())}
        disabled={historyLen === 0}
        title={t("toolbar.undo")}
        aria-label={t("toolbar.undo")}
      >
        <span className="floating-btn-icon">↶</span>
      </button>

      <button
        type="button"
        className="floating-btn"
        onClick={() => handleAction(() => useLab.getState().redo())}
        disabled={futureLen === 0}
        title={t("toolbar.redo")}
        aria-label={t("toolbar.redo")}
      >
        <span className="floating-btn-icon">↷</span>
      </button>

      <div className="floating-divider" />

      <button
        type="button"
        className="floating-btn"
        onClick={() => handleAction(() => rotateSelected())}
        disabled={!hasSymbolSelected}
        title={t("toolbar.rotate")}
        aria-label={t("toolbar.rotate")}
      >
        <span className="floating-btn-icon">↻</span>
      </button>

      <button
        type="button"
        className="floating-btn"
        onClick={() => handleAction(() => useLab.getState().flipSelected("h"))}
        disabled={!hasSymbolSelected || isGroupSelected}
        title={t("toolbar.flipH")}
        aria-label={t("toolbar.flipH")}
      >
        <span className="floating-btn-icon">⇄</span>
      </button>

      <div className="floating-divider" />

      <button
        type="button"
        className="floating-btn"
        onClick={() => handleAction(() => useLab.getState().zoomFit())}
        title={t("toolbar.zoomFit")}
        aria-label={t("toolbar.zoomFit")}
      >
        <span className="floating-btn-icon">⛶</span>
      </button>

      <button
        type="button"
        className="floating-btn delete-btn"
        onClick={() => handleAction(() => useLab.getState().deleteSelected())}
        disabled={!hasSelection || mode !== "edit"}
        title={t("toolbar.delete")}
        aria-label={t("toolbar.delete")}
      >
        <span className="floating-btn-icon">🗑</span>
      </button>
    </div>
  );
}
