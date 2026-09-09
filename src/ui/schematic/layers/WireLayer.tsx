import { memo, useMemo, type MouseEvent, type PointerEvent } from "react";
import { alignStackedWireLabels, dedupeWireLabels, getConnectedWireIds, hopArcD, labelMarkMatches, makeWireLabelKey, pickVisibleWireLabels, polylinePathD, terminalWorld, WIRE_LABEL_SEPARATION, wireLabelAnchorAtT, wireLabelAnchors, wireLabelOffset, wireLabelRadius, type WireCrossover } from "../../../geometry";
import { printHiddenSymbolIds, wireIsPrintHidden } from "../../../groups";
import { PHASE_COLOR } from "../../../sim/engine";
import type { Selection } from "../../../store";
import type { Circuit, SimSnapshot, Wire } from "../../../types";

interface WireLayerProps {
  circuit: Circuit;
  snapshot: SimSnapshot;
  selected: Selection | null;
  selectedWireIds?: string[];
  highlightedWireIds?: Set<string>;
  routes: Map<string, { x: number; y: number }[]>;
  crossovers: WireCrossover[];
  /** Sheet option: render wire number labels (defaults to visible when omitted). */
  showWireLabels?: boolean;
  hiddenWireLabels?: Set<string>;
  onWireContextMenu: (e: MouseEvent<SVGElement>, wireId: string) => void;
  onWirePointerDown: (e: PointerEvent<SVGElement>, wire: Wire, pts: { x: number; y: number }[]) => void;
  onWireDoubleClick?: (e: MouseEvent<SVGElement>, wire: Wire) => void;
  onWireLabelPointerDown?: (e: PointerEvent<SVGElement>, wireId: string, t: number) => void;
  onWireLabelDoubleClick?: (e: MouseEvent<SVGElement>, wireId: string, t: number) => void;
  onWireLabelContextMenu?: (e: MouseEvent<SVGElement>, wireId: string, t: number) => void;
  labelDragPreview?: { wireId: string; fromT: number; toT: number } | null;
  /** When true, skip internal wiring of groups marked hide-on-print. */
  omitPrintHidden?: boolean;
}

export const WireLayer = memo(function WireLayer({
  circuit,
  snapshot,
  selected,
  selectedWireIds,
  highlightedWireIds,
  routes,
  crossovers,
  showWireLabels,
  hiddenWireLabels = new Set(),
  onWireContextMenu,
  onWirePointerDown,
  onWireDoubleClick,
  onWireLabelPointerDown,
  onWireLabelDoubleClick,
  onWireLabelContextMenu,
  labelDragPreview = null,
  omitPrintHidden = false,
}: WireLayerProps) {
  const printHiddenIds = useMemo(() => printHiddenSymbolIds(circuit), [circuit]);
  const activeHighlightedWireIds = useMemo(() => {
    if (highlightedWireIds) return highlightedWireIds;
    const ids: string[] = [];
    if (selected?.type === "wire") ids.push(selected.id);
    if (selectedWireIds && selectedWireIds.length > 0) {
      for (const id of selectedWireIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    if (ids.length === 0) return new Set<string>();
    return getConnectedWireIds(circuit, ids);
  }, [circuit, selected, selectedWireIds, highlightedWireIds]);

  const hopsByWire = useMemo(() => {
    const map = new Map<string, typeof crossovers>();
    for (const c of crossovers) {
      const list = map.get(c.hopWireId);
      if (list) list.push(c);
      else map.set(c.hopWireId, [c]);
    }
    return map;
  }, [crossovers]);

  const labelsByWire = useMemo(() => {
    if (showWireLabels === false) return new Map();
    const deviceById = new Map(circuit.devices.map((d) => [d.id, d]));
    const avoid: { x: number; y: number }[] = [];
    for (const sym of circuit.symbols) {
      if (omitPrintHidden && printHiddenIds.has(sym.id)) continue;
      if (deviceById.get(sym.deviceId)?.kind !== "junction") continue;
      const p = terminalWorld(circuit, { symbolId: sym.id, term: "1" });
      if (p) avoid.push(p);
    }
    const candidates = circuit.wires.flatMap((w) => {
      const tag = (w.label ?? "").trim();
      if (!tag || hiddenWireLabels.has(w.id)) return [];
      if (omitPrintHidden && wireIsPrintHidden(w, printHiddenIds)) return [];
      const pts = routes.get(w.id);
      if (!pts || pts.length < 2) return [];
      const anchors = wireLabelAnchors(pts, wireLabelOffset(tag));
      if (!anchors.length) return [];
      return [{ wireId: w.id, tag, anchors }];
    });
    let placed = pickVisibleWireLabels(candidates, undefined, avoid);
    const wireInfo = new Map<string, { pts: { x: number; y: number }[]; tag: string; offset: number }>();
    for (const w of circuit.wires) {
      if (omitPrintHidden && wireIsPrintHidden(w, printHiddenIds)) continue;
      const tag = (w.label ?? "").trim();
      const pts = routes.get(w.id);
      if (!tag || !pts) continue;
      wireInfo.set(w.id, { pts, tag, offset: wireLabelOffset(tag) });
    }
    placed = alignStackedWireLabels(placed, wireInfo);
    for (const w of circuit.wires) {
      if (omitPrintHidden && wireIsPrintHidden(w, printHiddenIds)) continue;
      const marks = w.labelMarks;
      if (!marks?.length) continue;
      const pts = routes.get(w.id);
      if (!pts) continue;
      const tag = (w.label ?? "").trim() || "0";
      const offset = wireLabelOffset(tag);
      let list = placed.get(w.id) ?? [];
      const hidden = marks.filter((m) => m.hidden);
      const visible = marks.filter((m) => !m.hidden);
      list = list.filter((a) => {
        if (hidden.some((m) => labelMarkMatches(a.t, m.t))) return false;
        for (const m of hidden) {
          const p = wireLabelAnchorAtT(pts, m.t, offset);
          if (p && Math.hypot(a.x - p.x, a.y - p.y) < WIRE_LABEL_SEPARATION) return false;
        }
        return true;
      });
      for (const m of visible) {
        if (list.some((a) => labelMarkMatches(a.t, m.t))) continue;
        const a = wireLabelAnchorAtT(pts, m.t, offset);
        if (a) list.push({ ...a, segLen: a.segLen + 1e6 });
      }
      placed.set(w.id, list);
    }
    return dedupeWireLabels(placed, wireInfo);
  }, [circuit, routes, hiddenWireLabels, showWireLabels, omitPrintHidden, printHiddenIds]);

  return (
    <>
      {circuit.wires.map((w) => {
        const pts = routes.get(w.id);
        if (!pts || pts.length < 2) return null;
        const hideOnPrint = wireIsPrintHidden(w, printHiddenIds);
        if (omitPrintHidden && hideOnPrint) return null;
        const a = pts[0];
        const hops = hopsByWire.get(w.id) ?? [];
        const live = snapshot.wires[w.id];
        const d = polylinePathD(pts, hops);
        const flowPts = live?.dir === -1 ? [...pts].reverse() : pts;
        const flowD = polylinePathD(flowPts, hops);
        const color = w.broken ? "#c4391d" : live?.kind ? PHASE_COLOR[live.kind] : "#2a2924";
        const isDirectlySelected =
          (selected?.type === "wire" && selected.id === w.id) ||
          Boolean(selectedWireIds?.includes(w.id));
        const isConnected = activeHighlightedWireIds.has(w.id);
        const isHighlighted = isDirectlySelected || isConnected;
        const stroke = isHighlighted ? "#e6c11e" : color;
        const mid = pts[Math.floor(pts.length / 2)] ?? a;

        return (
          <g
            key={w.id}
            className={hideOnPrint ? "group-print-hidden" : undefined}
            onContextMenu={(e) => onWireContextMenu(e, w.id)}
            onPointerDown={(e) => onWirePointerDown(e, w, pts)}
            onDoubleClick={(e) => onWireDoubleClick?.(e, w)}
          >
            <path
              d={d}
              className="wire-hit"
              fill="none"
              stroke="transparent"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={d}
              className={`wire ${live?.live ? "live" : ""} ${w.broken ? "broken" : ""} ${live?.short ? "short-circuit" : ""}`}
              stroke={stroke}
              style={{ stroke, color }}
              strokeDasharray={w.broken ? "6 5" : undefined}
            />
            {isHighlighted && (
              <path
                d={d}
                className="wire-glow"
                fill="none"
                stroke="#e6c11e"
                strokeWidth={isDirectlySelected ? "6" : "5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDirectlySelected ? "0.4" : "0.25"}
                pointerEvents="none"
              />
            )}
            {isDirectlySelected && (
              <>
                <path
                  d={d}
                  className="wire-selection"
                  fill="none"
                  stroke="#0066cc"
                  strokeWidth="4"
                  strokeDasharray="8 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
                {(() => {
                  let minX = a.x, minY = a.y, maxX = a.x, maxY = a.y;
                  for (const p of pts) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                  }
                  const w = Math.abs(maxX - minX);
                  const h = Math.abs(maxY - minY);
                  return (
                    <rect
                      x={minX - 6}
                      y={minY - 6}
                      width={w + 12}
                      height={h + 12}
                      rx="4"
                      fill="none"
                      stroke="#0066cc"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                      pointerEvents="none"
                    />
                  );
                })()}
              </>
            )}
            {w.broken && (
              <g transform={`translate(${mid.x} ${mid.y})`} className="break-x">
                <line x1="-6" y1="-6" x2="6" y2="6" stroke="#c4391d" strokeWidth="2.4" />
                <line x1="6" y1="-6" x2="-6" y2="6" stroke="#c4391d" strokeWidth="2.4" />
              </g>
            )}
            {live?.live &&
              !w.broken &&
              live.dir !== 0 &&
              [0, 0.33, 0.66].map((off) => (
                <circle key={off} r="3.2" className="electron">
                  <animateMotion dur="1.5s" begin={`${-off * 1.5}s`} repeatCount="indefinite" path={flowD} />
                </circle>
              ))}
          </g>
        );
      })}

      {crossovers.map((c, i) => {
        const w = circuit.wires.find((item) => item.id === c.hopWireId);
        if (w && omitPrintHidden && wireIsPrintHidden(w, printHiddenIds)) return null;
        const live = snapshot.wires[c.hopWireId];
        const hideOnPrint = Boolean(w && wireIsPrintHidden(w, printHiddenIds));
        const isDirectlySelected =
          (selected?.type === "wire" && selected.id === c.hopWireId) ||
          Boolean(selectedWireIds?.includes(c.hopWireId));
        const isConnected = activeHighlightedWireIds.has(c.hopWireId);
        const isHighlighted = isDirectlySelected || isConnected;
        const color = w?.broken ? "#c4391d" : live?.kind ? PHASE_COLOR[live.kind] : "#2a2924";
        const stroke = isHighlighted ? "#e6c11e" : color;
        return (
          <path
            key={`hop-${i}`}
            d={hopArcD(c)}
            className={`wire ${live?.live ? "live" : ""} ${live?.short ? "short-circuit" : ""}${hideOnPrint ? " group-print-hidden" : ""}`}
            stroke={stroke}
            style={{ stroke, color }}
            strokeDasharray={w?.broken ? "6 5" : undefined}
            fill="none"
            pointerEvents="none"
          />
        );
      })}

      {showWireLabels !== false &&
        circuit.wires.flatMap((w) => {
          const tag = (w.label ?? "").trim();
          if (!tag) return [];
          const hideOnPrint = wireIsPrintHidden(w, printHiddenIds);
          if (omitPrintHidden && hideOnPrint) return [];
          let anchors = labelsByWire.get(w.id) ?? [];
          if (labelDragPreview && labelDragPreview.wireId === w.id) {
            const pts = routes.get(w.id);
            if (pts) {
              anchors = anchors.filter((a) => Math.abs(a.t - labelDragPreview.fromT) >= 0.04);
              const dragged = wireLabelAnchorAtT(pts, labelDragPreview.toT, wireLabelOffset(tag));
              if (dragged) anchors = [...anchors, dragged];
            }
          }
          return anchors.map((anchor, li) => {
            const radius = wireLabelRadius(tag);
            const labelKey = makeWireLabelKey(w.id, anchor.t);
            const isSelected =
              (selected?.type === "wire-label" && selected.id === labelKey) ||
              (selected?.type === "wire" && selected.id === w.id);
            return (
              <g
                key={`${w.id}-label-${li}-${anchor.t.toFixed(3)}`}
                className={`wire-label-group${hideOnPrint ? " group-print-hidden" : ""}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onWireLabelPointerDown?.(e as any, w.id, anchor.t);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onWireLabelDoubleClick?.(e as any, w.id, anchor.t);
                }}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  onWireLabelContextMenu?.(e as any, w.id, anchor.t);
                }}
              >
                <circle
                  className="wire-label-hit"
                  cx={anchor.x}
                  cy={anchor.y}
                  r={radius}
                  fill="transparent"
                  stroke={isSelected ? "#0066cc" : "currentColor"}
                  strokeWidth={isSelected ? 1.5 : 1.2}
                />
                <text
                  className="wire-label"
                  x={anchor.x}
                  y={anchor.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {tag}
                </text>
              </g>
            );
          });
        })}
    </>
  );
});
