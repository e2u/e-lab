import { memo } from "react";
import { associationSpokes, nameAssociationSpokes, type AssociationSpoke } from "../../../relatedSymbols";
import type { Circuit } from "../../../types";

interface RelationLayerProps {
  circuit: Circuit;
  selectedSymbolId: string | null;
  /** Keeps marker ids unique when the editor and the print svg are both mounted. */
  markerSuffix?: string;
}

function ArrowMarker({ id, className, bidirectional }: { id: string; className: string; bidirectional?: boolean }) {
  return (
    <marker
      id={id}
      markerWidth="8"
      markerHeight="8"
      refX="7"
      refY="4"
      orient={bidirectional ? "auto-start-reverse" : "auto"}
      markerUnits="userSpaceOnUse"
    >
      <path d="M1 1 L7 4 L1 7 Z" className={className} />
    </marker>
  );
}

function Spokes({
  spokes,
  className,
  markerId,
  lineClass,
  bidirectional = false,
}: {
  spokes: AssociationSpoke[];
  className: string;
  markerId: string;
  lineClass: string;
  bidirectional?: boolean;
}) {
  if (!spokes.length) return null;
  const marker = `url(#${markerId})`;
  return (
    <g className={className} pointerEvents="none">
      <defs>
        <ArrowMarker
          id={markerId}
          className={lineClass === "device-rel-line name" ? "device-rel-arrow name" : "device-rel-arrow"}
          bidirectional={bidirectional}
        />
      </defs>
      {spokes.map((s) => (
        <line
          key={s.id}
          className={lineClass}
          x1={s.from.x}
          y1={s.from.y}
          x2={s.to.x}
          y2={s.to.y}
          markerStart={bidirectional ? marker : undefined}
          markerEnd={marker}
        />
      ))}
    </g>
  );
}

export const RelationLayer = memo(function RelationLayer({
  circuit,
  selectedSymbolId,
  markerSuffix = "",
}: RelationLayerProps) {
  const deviceSpokes = selectedSymbolId
    ? associationSpokes(circuit, selectedSymbolId).filter((s) => s.kind === "device")
    : [];
  const nameSpokes = nameAssociationSpokes(circuit);
  if (!deviceSpokes.length && !nameSpokes.length) return null;
  return (
    <>
      <Spokes
        spokes={deviceSpokes}
        className="device-rel-layer"
        markerId={`device-rel-arrow${markerSuffix}`}
        lineClass="device-rel-line"
      />
      <Spokes
        spokes={nameSpokes}
        className="device-rel-name-layer"
        markerId={`device-rel-arrow-name${markerSuffix}`}
        lineClass="device-rel-line name"
        bidirectional
      />
    </>
  );
});
