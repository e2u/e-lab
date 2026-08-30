import type { CSSProperties } from "react";
import { t } from "../i18n";
import { selectionHasGroup } from "../groups";
import { useLab } from "../store";
import { GRID } from "../types";

export interface MenuPos {
  x: number;
  y: number;
  world?: { x: number; y: number };
}

export function ContextMenu({
  pos,
  onClose,
}: {
  pos: MenuPos;
  onClose: () => void;
}) {
  const selected = useLab((s) => s.selected);
  const selectedIds = useLab((s) => s.selectedIds);
  const clipboard = useLab((s) => s.clipboard);
  const circuit = useLab((s) => s.circuit);
  const n = selectedIds.length;
  const hasSymbols = n > 0;
  const hasWire = selected?.type === "wire";
  const effectiveIds = selectedIds.length ? selectedIds : selected?.type === "symbol" ? [selected.id] : [];
  const hasGroup = selectionHasGroup(circuit, effectiveIds);
  const canUngroup = hasGroup;
  const hasTagOffset = effectiveIds.some((id) => {
    const s = circuit.symbols.find((x) => x.id === id);
    return Boolean(s?.tagOffset);
  });

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  const style: CSSProperties = {
    left: Math.min(pos.x, window.innerWidth - 220),
    top: Math.min(pos.y, window.innerHeight - 360),
  };

  return (
    <div className="ctx-scrim" onPointerDown={onClose}>
      <div
        className="ctx-menu"
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {hasSymbols && (
          <>
            <button type="button" onClick={() => run(() => useLab.getState().rotateSelected(1))}>
              {t("ctx.rotate")} <kbd>R</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().rotateSelected(-1))}>
              {t("ctx.rotateCCW")} <kbd>⇧R</kbd>
            </button>
            <button type="button" disabled={hasGroup} onClick={() => run(() => useLab.getState().flipSelected("h"))}>
              {t("ctx.flipH")} <kbd>H</kbd>
            </button>
            <button type="button" disabled={hasGroup} onClick={() => run(() => useLab.getState().flipSelected("v"))}>
              {t("ctx.flipV")} <kbd>V</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().duplicateSelected())}>
              {t("ctx.duplicate")} <kbd>⌘D</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().copySelected())}>
              {t("ctx.copy")} <kbd>⌘C</kbd>
            </button>
            <button
              type="button"
              disabled={n < 2}
              onClick={() => run(() => useLab.getState().groupSelected())}
            >
              {t("ctx.group")} <kbd>⌘G</kbd>
            </button>
            <button
              type="button"
              disabled={!canUngroup}
              onClick={() => run(() => useLab.getState().ungroupSelected())}
            >
              {t("ctx.ungroup")} <kbd>⇧⌘G</kbd>
            </button>
            <div className="ctx-sep" />
            <div className="ctx-label">{t("ctx.align")} {n < 2 ? `（${t("ctx.shiftSelect")}）` : ""}</div>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("left"))}>
              {t("ctx.alignLeft")}
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("right"))}>
              {t("ctx.alignRight")}
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("top"))}>
              {t("ctx.alignTop")}
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("bottom"))}>
              {t("ctx.alignBottom")}
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("hcenter"))}>
              {t("ctx.alignCenterH")}
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("vcenter"))}>
              {t("ctx.alignCenterV")}
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("distribute-h"))}>
              {t("ctx.distributeH")}
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("distribute-v"))}>
              {t("ctx.distributeV")}
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().snapSelected())}>
              {t("ctx.snapGrid")}
            </button>
            {hasTagOffset && (
              <button
                type="button"
                onClick={() =>
                  run(() => {
                    for (const id of effectiveIds) {
                      useLab.getState().resetSymbolTagOffset(id);
                    }
                  })
                }
              >
                {t("ctx.resetTagPosition")}
              </button>
            )}
            <div className="ctx-sep" />
            <button type="button" className="danger" onClick={() => run(() => useLab.getState().deleteSelected())}>
              {t("ctx.delete")} <kbd>Del</kbd>
            </button>
          </>
        )}
        {hasWire && (
          <>
            <button type="button" onClick={() => run(() => useLab.getState().quickAttachClampMeter(selected.id))}>
              🧲 {t("meters.probeWire")}
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().addJunctionOnWire(selected.id, pos.world))}>
              {t("ctx.addJunction")}
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().straightenWire(selected.id))}>
              {t("ctx.straightenWire")}
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().toggleWireBroken(selected.id))}>
              {t("ctx.brokenWire")}
            </button>
            <button type="button" className="danger" onClick={() => run(() => useLab.getState().deleteSelected())}>
              {t("ctx.deleteWire")}
            </button>
          </>
        )}
        {!hasSymbols && !hasWire && (
          <>
            {pos.world && (
              <button
                type="button"
                onClick={() => run(() => useLab.getState().addJunctionAt(pos.world!.x / GRID, pos.world!.y / GRID))}
              >
                {t("ctx.addJunctionHere")}
              </button>
            )}
            <button type="button" onClick={() => run(() => useLab.getState().selectAll())}>
              {t("ctx.selectAll")} <kbd>⌘A</kbd>
            </button>
            <button
              type="button"
              disabled={!clipboard?.symbols.length}
              onClick={() => run(() => useLab.getState().pasteClipboard())}
            >
              {t("ctx.paste")} <kbd>⌘V</kbd>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
