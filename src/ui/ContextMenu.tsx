import type { CSSProperties } from "react";
import { selectionHasGroup } from "../groups";
import { useLab } from "../store";

export interface MenuPos {
  x: number;
  y: number;
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
  const canUngroup = selectionHasGroup(circuit, selectedIds);

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
              旋轉 90° <kbd>R</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().rotateSelected(-1))}>
              逆時針旋轉 <kbd>⇧R</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().flipSelected("h"))}>
              左右鏡像 <kbd>H</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().flipSelected("v"))}>
              上下鏡像 <kbd>V</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().duplicateSelected())}>
              複製一份 <kbd>⌘D</kbd>
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().copySelected())}>
              複製 <kbd>⌘C</kbd>
            </button>
            <button
              type="button"
              disabled={n < 2}
              onClick={() => run(() => useLab.getState().groupSelected())}
            >
              編成一組 <kbd>⌘G</kbd>
            </button>
            <button
              type="button"
              disabled={!canUngroup}
              onClick={() => run(() => useLab.getState().ungroupSelected())}
            >
              打散 <kbd>⇧⌘G</kbd>
            </button>
            <div className="ctx-sep" />
            <div className="ctx-label">對齊 {n < 2 ? "（先 Shift 多選）" : ""}</div>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("left"))}>
              左對齊
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("right"))}>
              右對齊
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("top"))}>
              上對齊
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("bottom"))}>
              下對齊
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("hcenter"))}>
              水平置中
            </button>
            <button type="button" disabled={n < 2} onClick={() => run(() => useLab.getState().alignSelected("vcenter"))}>
              垂直置中
            </button>
            <button type="button" onClick={() => run(() => useLab.getState().snapSelected())}>
              對齊網格
            </button>
            <div className="ctx-sep" />
            <button type="button" className="danger" onClick={() => run(() => useLab.getState().deleteSelected())}>
              刪除 <kbd>Del</kbd>
            </button>
          </>
        )}
        {hasWire && (
          <>
            <button type="button" onClick={() => run(() => useLab.getState().toggleWireBroken(selected.id))}>
              斷線故障
            </button>
            <button type="button" className="danger" onClick={() => run(() => useLab.getState().deleteSelected())}>
              刪除導線
            </button>
          </>
        )}
        {!hasSymbols && !hasWire && (
          <>
            <button type="button" onClick={() => run(() => useLab.getState().selectAll())}>
              全選 <kbd>⌘A</kbd>
            </button>
            <button
              type="button"
              disabled={!clipboard?.symbols.length}
              onClick={() => run(() => useLab.getState().pasteClipboard())}
            >
              貼上 <kbd>⌘V</kbd>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
