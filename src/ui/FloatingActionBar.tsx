import { rotateSelected, useLab } from "../store";
import { t } from "../i18n";
import { triggerHaptic } from "./schematic/interact";
import { ENABLE_AUTO_LAYOUT } from "../features";

export function FloatingActionBar() {
  const mode = useLab((s) => s.mode);
  const editSubMode = useLab((s) => s.editSubMode);
  const placing = useLab((s) => s.placing);
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

      {mode === "run" ? (
        <>
          <button
            type="button"
            className={`floating-btn ${placing === "ammeter" ? "active" : ""}`}
            onClick={() =>
              handleAction(() =>
                useLab.getState().setPlacing(placing === "ammeter" ? null : "ammeter")
              )
            }
            title={t("meters.clampProbe")}
            aria-label={t("meters.clampProbe")}
          >
            <span className="floating-btn-icon">🧲</span>
          </button>

          <button
            type="button"
            className={`floating-btn ${placing === "voltmeter" ? "active" : ""}`}
            onClick={() =>
              handleAction(() =>
                useLab.getState().setPlacing(placing === "voltmeter" ? null : "voltmeter")
              )
            }
            title={t("meters.voltageProbe")}
            aria-label={t("meters.voltageProbe")}
          >
            <span className="floating-btn-icon">⚡</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={`floating-btn ${editSubMode === "wiring" ? "active" : ""}`}
            onClick={() => handleAction(() => useLab.getState().toggleEditSubMode())}
            title={editSubMode === "wiring" ? t("toolbar.wiringTip") : t("toolbar.editingTip")}
            aria-label={editSubMode === "wiring" ? t("toolbar.wiring") : t("toolbar.editing")}
          >
            <span className="floating-btn-icon">{editSubMode === "wiring" ? "🔌" : "✋"}</span>
          </button>

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

          {ENABLE_AUTO_LAYOUT && (
            <button
              type="button"
              className="floating-btn"
              onClick={() => handleAction(() => useLab.getState().autoLayout())}
              title={t("toolbar.autoLayoutTip") || t("toolbar.autoLayout") || "Auto Layout"}
              aria-label={t("toolbar.autoLayout") || "Auto Layout"}
            >
              <span className="floating-btn-icon">🪄</span>
            </button>
          )}
        </>
      )}

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
        disabled={!hasSelection}
        title={t("toolbar.delete")}
        aria-label={t("toolbar.delete")}
      >
        <span className="floating-btn-icon">🗑</span>
      </button>
    </div>
  );
}
