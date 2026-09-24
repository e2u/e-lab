import { memo, type PointerEvent, type MouseEvent } from "react";
import { hotRailSplices, railBreakCuts } from "../../../geometry";
import { layoutLogicRails, type RailCellBox, type RailSelection, type RailSpine } from "../../../rails/logicRails";
import { GRID, type Circuit, type RailCellContent } from "../../../types";

interface RailLayerProps {
  circuit: Circuit;
  lineNumbers: Record<number, string>;
  crossReferences: Record<number, RailCellContent[]>;
  railSelection: RailSelection | null;
  editingRail: RailSelection | null;
  editable: boolean;
  /** Print omits the layout-only break mark. The control rail gap stays. */
  hideBreaks?: boolean;
  selectedSymbolId?: string | null;
  onRailCellPointerDown: (e: PointerEvent<SVGRectElement>, cell: RailCellBox) => void;
  onRailCellDoubleClick: (e: MouseEvent<SVGRectElement>, cell: RailCellBox) => void;
  onCommitRailText: (cell: RailCellBox, text: string) => void;
  onCancelRailEdit: () => void;
  onRailEndPointerDown: (e: PointerEvent<SVGRectElement>, spine: RailSpine, which: "y0" | "y1") => void;
  onRailSpinePointerDown: (e: PointerEvent<SVGLineElement>, spine: RailSpine) => void;
}

function RailEndHandle({
  spine,
  which,
  y,
  onPointerDown,
}: {
  spine: RailSpine;
  which: "y0" | "y1";
  y: number;
  onPointerDown: (e: PointerEvent<SVGRectElement>, spine: RailSpine, which: "y0" | "y1") => void;
}) {
  const size = 12;
  const py = y * GRID;
  return (
    <rect
      className="rail-end-handle"
      x={spine.x - size / 2}
      y={py - size / 2}
      width={size}
      height={size}
      rx={2}
      data-rail-end={which}
      data-rail={spine.rail}
      onPointerDown={(e) => onPointerDown(e, spine, which)}
    />
  );
}

function railSegments(
  y1: number,
  y2: number,
  gaps: { y1: number; y2: number }[],
): { y1: number; y2: number }[] {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  const cuts = gaps
    .map((g) => ({ y1: Math.max(top, Math.min(g.y1, g.y2)), y2: Math.min(bot, Math.max(g.y1, g.y2)) }))
    .filter((g) => g.y2 - g.y1 > 0.5)
    .sort((a, b) => a.y1 - b.y1);
  const segments: { y1: number; y2: number }[] = [];
  let cursor = top;
  for (const cut of cuts) {
    if (cut.y1 - cursor > 0.5) segments.push({ y1: cursor, y2: cut.y1 });
    cursor = Math.max(cursor, cut.y2);
  }
  if (bot - cursor > 0.5) segments.push({ y1: cursor, y2: bot });
  return segments.length > 0 ? segments : [{ y1: top, y2: bot }];
}

function selectedCell(sel: RailSelection | null, cell: RailCellBox): boolean {
  return Boolean(sel && sel.rail === cell.rail && sel.y === cell.y && sel.index === cell.index);
}

export const RailLayer = memo(function RailLayer({
  circuit,
  lineNumbers,
  crossReferences,
  railSelection,
  editingRail,
  editable,
  hideBreaks = false,
  selectedSymbolId,
  onRailCellPointerDown,
  onRailCellDoubleClick,
  onCommitRailText,
  onCancelRailEdit,
  onRailEndPointerDown,
  onRailSpinePointerDown,
}: RailLayerProps) {
  const layout = layoutLogicRails(circuit, lineNumbers, crossReferences);
  if (layout.spines.length === 0 && layout.cells.length === 0) return null;
  const splices = hotRailSplices(circuit);
  const breakCuts = railBreakCuts(circuit);
  const breaks = circuit.symbols.flatMap((sym) => {
    const dev = circuit.devices.find((d) => d.id === sym.deviceId);
    if (!dev || dev.kind !== "rail-break") return [];
    const y0 = dev.params.railY0;
    const y1 = dev.params.railY1;
    if (typeof y0 !== "number" || typeof y1 !== "number") return [];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    return [{ symbolId: sym.id, x: sym.x * GRID, y0: lo, y1: hi }];
  });

  return (
    <g className="logic-rails">
      {layout.spines.map((spine) => {
        const gaps = [...splices, ...breakCuts]
          .filter((s) => s.railSymbolId === spine.symbolId)
          .map((s) => ({ y1: s.rows[0] * GRID, y2: s.rows[1] * GRID }));
        const segments = railSegments(spine.y1, spine.y2, gaps);
        const selected = selectedSymbolId === spine.symbolId;
        return (
        <g key={`${spine.rail}-spine`}>
          {segments.map((seg, i) => (
            <g key={i}>
              <line
                className="wire-hit"
                x1={spine.x}
                y1={seg.y1}
                x2={spine.x}
                y2={seg.y2}
                stroke="transparent"
                strokeWidth={22}
                strokeLinecap="round"
                style={{ pointerEvents: "stroke", cursor: "move" }}
                onPointerDown={(e) => onRailSpinePointerDown(e, spine)}
              />
              <line
                className={selected ? "wire rail-spine selected" : "wire rail-spine"}
                x1={spine.x}
                y1={seg.y1}
                x2={spine.x}
                y2={seg.y2}
              />
            </g>
          ))}
          {editable && (
            <>
              <RailEndHandle spine={spine} which="y0" y={spine.y0Grid} onPointerDown={onRailEndPointerDown} />
              <RailEndHandle spine={spine} which="y1" y={spine.y1Grid} onPointerDown={onRailEndPointerDown} />
            </>
          )}
        </g>
        );
      })}
      {!hideBreaks && breaks.map((brk) => {
        const inset = 6;
        const y1 = brk.y0 * GRID + inset;
        const y2 = brk.y1 * GRID - inset;
        const selected = selectedSymbolId === brk.symbolId;
        const spine = {
          rail: "l" as const,
          symbolId: brk.symbolId,
          x: brk.x,
          y1,
          y2,
          y0Grid: brk.y0,
          y1Grid: brk.y1,
        };
        return (
          <g key={brk.symbolId}>
            <line
              className="wire-hit"
              x1={brk.x}
              y1={y1}
              x2={brk.x}
              y2={y2}
              stroke="transparent"
              strokeWidth={22}
              style={{ pointerEvents: "stroke", cursor: "move" }}
              onPointerDown={(e) => onRailSpinePointerDown(e, spine)}
            />
            <line
              className={selected ? "rail-break selected" : "rail-break"}
              x1={brk.x}
              y1={y1}
              x2={brk.x}
              y2={y2}
            />
            {editable && (
              <g className="rail-break-handles">
                <RailEndHandle spine={spine} which="y0" y={brk.y0} onPointerDown={onRailEndPointerDown} />
                <RailEndHandle spine={spine} which="y1" y={brk.y1} onPointerDown={onRailEndPointerDown} />
              </g>
            )}
          </g>
        );
      })}
      {layout.cells.map((cell) => {
        const editing = selectedCell(editingRail, cell);
        const selected = selectedCell(railSelection, cell);
        const weight = cell.style === "bold" ? 700 : 400;
        const fontStyle = cell.style === "italic" ? "italic" : "normal";
        return (
          <g key={`${cell.rail}:${cell.y}:${cell.index}`} className="rail-cell">
            <rect
              className={selected ? "rail-cell-bg selected" : "rail-cell-bg"}
              x={cell.x}
              y={cell.yPx}
              width={cell.w}
              height={cell.h}
              rx={2}
              data-rail={cell.rail}
              data-row={cell.y}
              data-index={cell.index}
              onPointerDown={(e) => onRailCellPointerDown(e, cell)}
              onDoubleClick={(e) => onRailCellDoubleClick(e, cell)}
            />
            {editing ? (
              <foreignObject className="rail-inline-wrap" x={cell.x} y={cell.yPx} width={cell.w} height={cell.h}>
                <input
                  className="rail-inline"
                  autoFocus
                  defaultValue={cell.text}
                  aria-label={cell.rail === "l" ? "Line number" : "Cross-reference"}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.dataset.committed = "1";
                      onCommitRailText(cell, e.currentTarget.value);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.currentTarget.dataset.committed = "1";
                      onCancelRailEdit();
                    }
                  }}
                  onBlur={(e) => {
                    if (e.currentTarget.dataset.committed === "1") return;
                    e.currentTarget.dataset.committed = "1";
                    onCommitRailText(cell, e.currentTarget.value);
                  }}
                />
              </foreignObject>
            ) : (
              <text
                className={cell.isNC && !cell.segments?.length ? "rail-cell-text nc" : "rail-cell-text"}
                x={cell.x + cell.w / 2}
                y={cell.yPx + cell.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontWeight={weight}
                fontStyle={fontStyle}
              >
                {cell.segments?.length
                  ? cell.segments.map((seg, i) => (
                      <tspan key={i} className={seg.isNC ? "nc" : undefined}>
                        {seg.text}
                      </tspan>
                    ))
                  : cell.text}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});
