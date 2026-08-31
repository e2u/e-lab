import { memo, useMemo, type MouseEvent, type PointerEvent } from "react";
import { getConnectedWireIds, hopArcD, polylinePathD, terminalWorld, wireLabelPos, wireRoute, type WireCrossover } from "../../../geometry";
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
  onWireContextMenu: (e: MouseEvent<SVGElement>, wireId: string) => void;
  onWirePointerDown: (e: PointerEvent<SVGElement>, wire: Wire, pts: { x: number; y: number }[]) => void;
  onWireDoubleClick?: (e: MouseEvent<SVGElement>, wire: Wire) => void;
}

export const WireLayer = memo(function WireLayer({
  circuit,
  snapshot,
  selected,
  selectedWireIds,
  highlightedWireIds,
  routes,
  crossovers,
  onWireContextMenu,
  onWirePointerDown,
  onWireDoubleClick,
}: WireLayerProps) {
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

  return (
    <>
      {circuit.wires.map((w) => {
        const a = terminalWorld(circuit, w.a);
        const b = terminalWorld(circuit, w.b);
        if (!a || !b) return null;
        const pts = routes.get(w.id) ?? wireRoute(circuit, w.a, w.b, w.jog);
        const hops = crossovers.filter((c) => c.hopWireId === w.id);
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
        const tag = (w.label ?? "").trim();
        const tagPos = tag ? wireLabelPos(pts) : null;
        return (
          <g
            key={w.id}
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
            {tag && tagPos && (
              <g className="wire-label" pointerEvents="none">
                <rect
                  x={tagPos.horizontal ? tagPos.x - tag.length * 3.4 - 3 : tagPos.x - 2}
                  y={tagPos.y - 11}
                  width={tag.length * 6.8 + 6}
                  height={14}
                  rx="2"
                  className="wire-label-bg"
                />
                <text
                  x={tagPos.x}
                  y={tagPos.y}
                  textAnchor={tagPos.horizontal ? "middle" : "start"}
                >
                  {tag}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {crossovers.map((c, i) => {
        const w = circuit.wires.find((item) => item.id === c.hopWireId);
        const live = snapshot.wires[c.hopWireId];
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
            className={`wire ${live?.live ? "live" : ""} ${live?.short ? "short-circuit" : ""}`}
            stroke={stroke}
            style={{ stroke, color }}
            strokeDasharray={w?.broken ? "6 5" : undefined}
            fill="none"
            pointerEvents="none"
          />
        );
      })}
    </>
  );
});
