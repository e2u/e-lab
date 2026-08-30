import { memo, type PointerEvent } from "react";
import { variantDef } from "../../../catalog";
import { terminalWorld } from "../../../geometry";
import type { Circuit, EditSubMode, Mode, PortRef } from "../../../types";

interface PortLayerProps {
  circuit: Circuit;
  mode: Mode;
  editSubMode?: EditSubMode;
  wiringFrom: PortRef | null;
  hoverPort: PortRef | null;
  onPortPointerDown: (e: PointerEvent<SVGCircleElement>, port: PortRef) => void;
  onPortPointerEnter: (port: PortRef) => void;
  onPortPointerLeave: () => void;
}

export const PortLayer = memo(function PortLayer({
  circuit,
  mode,
  editSubMode = "editing",
  wiringFrom,
  hoverPort,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
}: PortLayerProps) {
  if (mode !== "edit") return null;

  const isWiring = editSubMode === "wiring";

  return (
    <>
      {circuit.symbols.map((sym) => {
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        if (!dev || dev.kind === "junction") return null;
        const v = variantDef(dev.kind, sym.variant);
        return v.terminals.map((t) => {
          const world = terminalWorld(circuit, { symbolId: sym.id, term: t.id });
          if (!world) return null;
          const port: PortRef = { symbolId: sym.id, term: t.id };
          const hot =
            isWiring &&
            ((wiringFrom && wiringFrom.symbolId === port.symbolId && wiringFrom.term === port.term) ||
              (hoverPort && hoverPort.symbolId === port.symbolId && hoverPort.term === port.term));
          return (
            <g key={`${sym.id}:${t.id}`}>
              {/* Invisible larger hit target for touch & mouse ease only in wiring mode */}
              {isWiring && (
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
              )}
              <circle
                cx={world.x}
                cy={world.y}
                r={isWiring ? 6 : 4}
                className={`port ${hot ? "hot" : ""} ${!isWiring ? "port-subtle" : ""}`}
                style={{ pointerEvents: "none", opacity: isWiring ? 1 : 0.4 }}
              />
              <title>{`${dev.tag}:${t.label}`}</title>
            </g>
          );
        });
      })}
    </>
  );
});
