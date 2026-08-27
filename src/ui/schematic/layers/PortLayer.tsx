import { memo, type PointerEvent } from "react";
import { variantDef } from "../../../catalog";
import { terminalWorld } from "../../../geometry";
import type { Circuit, Mode, PortRef } from "../../../types";

interface PortLayerProps {
  circuit: Circuit;
  mode: Mode;
  wiringFrom: PortRef | null;
  hoverPort: PortRef | null;
  onPortPointerDown: (e: PointerEvent<SVGCircleElement>, port: PortRef) => void;
  onPortPointerEnter: (port: PortRef) => void;
  onPortPointerLeave: () => void;
}

export const PortLayer = memo(function PortLayer({
  circuit,
  mode,
  wiringFrom,
  hoverPort,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
}: PortLayerProps) {
  return (
    <>
      {circuit.symbols.map((sym) => {
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        if (!dev || mode !== "edit" || dev.kind === "junction") return null;
        const v = variantDef(dev.kind, sym.variant);
        return v.terminals.map((t) => {
          const world = terminalWorld(circuit, { symbolId: sym.id, term: t.id });
          if (!world) return null;
          const port: PortRef = { symbolId: sym.id, term: t.id };
          const hot =
            (wiringFrom && wiringFrom.symbolId === port.symbolId && wiringFrom.term === port.term) ||
            (hoverPort && hoverPort.symbolId === port.symbolId && hoverPort.term === port.term);
          return (
            <g key={`${sym.id}:${t.id}`}>
              {/* Invisible larger hit target for touch & mouse ease */}
              <circle
                cx={world.x}
                cy={world.y}
                r="16"
                fill="transparent"
                stroke="transparent"
                style={{ cursor: "crosshair", pointerEvents: "all" }}
                onPointerDown={(e) => onPortPointerDown(e, port)}
                onPointerEnter={() => onPortPointerEnter(port)}
                onPointerLeave={onPortPointerLeave}
              />
              <circle
                cx={world.x}
                cy={world.y}
                r="6"
                className={`port ${hot ? "hot" : ""}`}
                style={{ pointerEvents: "none" }}
              />
              <title>{`${dev.tag}:${t.label}`}</title>
            </g>
          );
        });
      })}
    </>
  );
});
