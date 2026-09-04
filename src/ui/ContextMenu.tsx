import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { t } from "../i18n";
import { selectionHasGroup } from "../groups";
import { areWiresConnected } from "../geometry";
import { useLab } from "../store";
import { GRID } from "../types";
import { ENABLE_AUTO_LAYOUT } from "../features";

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
  const selectedWireIds = useLab((s) => s.selectedWireIds);
  const clipboard = useLab((s) => s.clipboard);
  const circuit = useLab((s) => s.circuit);
  const n = selectedIds.length;
  const hasSymbols = n > 0;
  const nWires = selectedWireIds?.length ?? (selected?.type === "wire" ? 1 : 0);
  const hasWire = selected?.type === "wire" || nWires > 0;
  const canMergeWires =
    selectedWireIds &&
    selectedWireIds.length === 2 &&
    areWiresConnected(circuit, selectedWireIds[0], selectedWireIds[1]);
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

  // Clamp against the *measured* menu size after mount. Render off-screen
  // until adjusted so no flash at the wrong spot.
  const menuRef = useRef<HTMLDivElement>(null);
  const [adj, setAdj] = useState<{ left: number; top: number; maxHeight?: number } | null>(null);
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const pad = 8;
    const w = el.offsetWidth;
    const maxH = window.innerHeight - pad * 2;
    const h = Math.min(el.offsetHeight, maxH);
    setAdj({
      left: Math.min(Math.max(pos.x + 4, pad), Math.max(pad, window.innerWidth - w - pad)),
      top: Math.min(Math.max(pos.y + 4, pad), Math.max(pad, window.innerHeight - h - pad)),
      ...(h >= maxH ? { maxHeight: maxH } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style: CSSProperties = adj
    ? { left: adj.left, top: adj.top, ...(adj.maxHeight ? { maxHeight: adj.maxHeight, overflowY: "auto" as const } : {}) }
    : { left: -9999, top: -9999 };

  // Portal to document.body: ancestors like .paper-wrap use contain/overflow
  // which would otherwise re-anchor position:fixed and clip the menu.
  return createPortal(
    <div className="ctx-scrim" onPointerDown={onClose}>
      <div
        ref={menuRef}
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
            {effectiveIds.length === 1 && (() => {
              const sym = circuit.symbols.find((s) => s.id === effectiveIds[0]);
              const dev = sym ? circuit.devices.find((d) => d.id === sym.deviceId) : null;
              if (!dev || !sym) return null;
              const getToggleVariant = (k: string, v: string): string | null => {
                if (k === "timer-on" || k === "timer-off") {
                  if (v === "delayed-no") return "delayed-nc";
                  if (v === "delayed-nc") return "delayed-no";
                  if (v === "inst-no") return "inst-nc";
                  if (v === "inst-nc") return "inst-no";
                } else if (k === "contactor") {
                  if (v === "aux-no") return "aux-nc";
                  if (v === "aux-nc") return "aux-no";
                  if (v === "aux-no2") return "aux-nc2";
                  if (v === "aux-nc2") return "aux-no2";
                } else if (k === "relay") {
                  if (v === "aux-no") return "aux-nc";
                  if (v === "aux-nc") return "aux-no";
                  if (v === "aux-no2") return "aux-nc2";
                  if (v === "aux-nc2") return "aux-no2";
                } else if (k === "overload") {
                  if (v === "aux-no") return "aux-nc";
                  if (v === "aux-nc") return "aux-no";
                }
                return null;
              };
              const toggleTarget = getToggleVariant(dev.kind, sym.variant);
              if (dev.kind === "comment") {
                return (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        run(() => {
                          useLab.getState().updateDevice(dev.id, {
                            showLeaderLine: dev.params.showLeaderLine === false ? true : false,
                          });
                        })
                      }
                    >
                      {dev.params.showLeaderLine === false ? t("ctx.showLeaderLine") : t("ctx.hideLeaderLine")}
                    </button>
                    {dev.params.targetDeviceId && (
                      <button
                        type="button"
                        onClick={() =>
                          run(() => {
                            useLab.getState().updateDevice(dev.id, { targetDeviceId: "" });
                          })
                        }
                      >
                        {t("ctx.unbindComponent")}
                      </button>
                    )}
                  </>
                );
              }
              return (
                <>
                  {toggleTarget && (
                    <button
                      type="button"
                      onClick={() => run(() => useLab.getState().setSymbolVariant(sym.id, toggleTarget))}
                    >
                      🔀 {t("ctx.switchContactVariant")}
                    </button>
                  )}
                  {dev.kind !== "junction" && dev.kind !== "title-block" && (
                    <button type="button" onClick={() => run(() => useLab.getState().addCommentForSymbol(sym.id))}>
                      💬 {t("inspector.addComment")}
                    </button>
                  )}
                </>
              );
            })()}
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
            {nWires === 2 && (
              <button
                type="button"
                disabled={!canMergeWires}
                onClick={() => run(() => useLab.getState().mergeSelectedWires())}
              >
                🔗 {t("ctx.mergeWires")}
              </button>
            )}
            {nWires <= 1 && selected?.type === "wire" && (
              <button type="button" onClick={() => run(() => useLab.getState().quickAttachClampMeter(selected.id))}>
                🧲 {t("meters.probeWire")}
              </button>
            )}
            {nWires <= 1 && selected?.type === "wire" && (
              <button type="button" onClick={() => run(() => useLab.getState().addJunctionOnWire(selected.id, pos.world))}>
                {t("ctx.addJunction")}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                run(() => {
                  const targetIds = nWires > 1 && selectedWireIds ? selectedWireIds : selected?.type === "wire" ? [selected.id] : [];
                  for (const id of targetIds) {
                    useLab.getState().straightenWire(id);
                  }
                })
              }
            >
              {t("ctx.straightenWire")}
            </button>
            {nWires <= 1 && selected?.type === "wire" && (
              <button type="button" onClick={() => run(() => useLab.getState().toggleWireBroken(selected.id))}>
                {t("ctx.brokenWire")}
              </button>
            )}
            <button type="button" className="danger" onClick={() => run(() => useLab.getState().deleteSelected())}>
              {t("ctx.deleteWire")}
            </button>
          </>
        )}
        {!hasSymbols && !hasWire && (
          <>
            {pos.world && (
              <>
                <button
                  type="button"
                  onClick={() => run(() => useLab.getState().addJunctionAt(pos.world!.x / GRID, pos.world!.y / GRID))}
                >
                  {t("ctx.addJunctionHere")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => {
                      const gx = Math.round(pos.world!.x / GRID);
                      const gy = Math.round(pos.world!.y / GRID);
                      useLab.getState().placeAt(gx, gy, {
                        text: t("comment.defaultText"),
                        showLeaderLine: true,
                        bgColor: "#fef9c3",
                        fontSize: 12,
                        width: 6,
                        height: 3,
                      });
                    })
                  }
                >
                  💬 {t("ctx.addCommentHere")}
                </button>
              </>
            )}
            <button type="button" onClick={() => run(() => useLab.getState().selectAll())}>
              {t("ctx.selectAll")} <kbd>⌘A</kbd>
            </button>
            {ENABLE_AUTO_LAYOUT && (
              <button type="button" onClick={() => run(() => useLab.getState().autoLayout())}>
                🪄 {t("toolbar.autoLayout") || "自動排版"} <kbd>⇧L</kbd>
              </button>
            )}
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
    </div>,
    document.body
  );
}
