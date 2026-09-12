import { memo } from "react";
import { associationSpokes } from "../../../relatedSymbols";
import type { Circuit } from "../../../types";

interface RelationLayerProps {
  circuit: Circuit;
  selectedSymbolId: string | null;
}

export const RelationLayer = memo(function RelationLayer({
  circuit,
  selectedSymbolId,
}: RelationLayerProps) {
  if (!selectedSymbolId) return null;
  const spokes = associationSpokes(circuit, selectedSymbolId);
  if (!spokes.length) return null;
  return (
    <g className="device-rel-layer" pointerEvents="none">
      <defs>
        <marker
          id="device-rel-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M1 1 L7 4 L1 7 Z" className="device-rel-arrow" />
        </marker>
      </defs>
      {spokes.map((s) => (
        <line
          key={s.id}
          className="device-rel-line"
          x1={s.from.x}
          y1={s.from.y}
          x2={s.to.x}
          y2={s.to.y}
          markerEnd="url(#device-rel-arrow)"
        />
      ))}
    </g>
  );
});
