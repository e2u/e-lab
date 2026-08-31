import { memo, type MouseEvent, type PointerEvent } from "react";
import { catalogItem, suggestNetLabelTag, variantDef } from "../../../catalog";
import { findPortAtPoint, glyphTransform, nearestOnPolyline, portsEqual, snapOnSegment, terminalWorld, wireRoute } from "../../../geometry";
import { normalizeRect } from "../../../groups";
import { SymbolGlyph } from "../../../Glyphs";
import type { Selection } from "../../../store";
import { COLS, GRID, ROWS, type Circuit, type Device, type PortRef, type Rot, type SymbolInst } from "../../../types";

interface InteractionOverlayProps {
  circuit: Circuit;
  wiringFrom: PortRef | null;
  cursor: { x: number; y: number } | null;
  placing: string | null;
  placingRot?: Rot;
  selected: Selection | null;
  routes: Map<string, { x: number; y: number }[]>;
  marqueeView: { x0: number; y0: number; x1: number; y1: number } | null;
  onPlaceOverlayPointerDown: (e: PointerEvent<SVGRectElement>) => void;
  onPlaceOverlayContextMenu: (e: MouseEvent<SVGRectElement>) => void;
}

function formatMMDDYYYY(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export const InteractionOverlay = memo(function InteractionOverlay({
  circuit,
  wiringFrom,
  cursor,
  placing,
  placingRot = 0,
  selected,
  routes,
  marqueeView,
  onPlaceOverlayPointerDown,
  onPlaceOverlayContextMenu,
}: InteractionOverlayProps) {
  return (
    <>
      {wiringFrom && cursor && (() => {
        const a = terminalWorld(circuit, wiringFrom);
        if (!a) return null;
        let b = { x: cursor.x * GRID, y: cursor.y * GRID };
        let snapped = false;
        const targetPort = findPortAtPoint(circuit, b.x, b.y, 16);
        if (targetPort && !portsEqual(wiringFrom, targetPort)) {
          const p = terminalWorld(circuit, targetPort);
          if (p) {
            b = p;
            snapped = true;
          }
        }
        if (!snapped) {
          for (const w of circuit.wires) {
            const wpts = routes.get(w.id) ?? wireRoute(circuit, w.a, w.b, w.jog);
            const near = nearestOnPolyline(wpts, b);
            if (near && near.d <= 14) {
              b = snapOnSegment(wpts[near.index], wpts[near.index + 1], { x: near.x, y: near.y });
              snapped = true;
              break;
            }
          }
        }
        const pts = wireRoute(circuit, wiringFrom, b);
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        return (
          <g pointerEvents="none">
            <path d={d} fill="none" stroke="#e6c11e" strokeDasharray="5 4" strokeWidth="1.6" />
            {snapped && <circle cx={b.x} cy={b.y} r="5" fill="#e6c11e" />}
          </g>
        );
      })()}

      {placing && (
        <rect
          x={0}
          y={0}
          width={COLS * GRID}
          height={ROWS * GRID}
          fill="transparent"
          className="place-overlay"
          onPointerDown={onPlaceOverlayPointerDown}
          onContextMenu={onPlaceOverlayContextMenu}
        />
      )}

      {placing && cursor && (() => {
        const item = catalogItem(placing);
        const v = variantDef(item.kind, item.variant);
        const ghost: Device = {
          id: "ghost",
          kind: item.kind,
          tag: item.kind === "net-label"
            ? suggestNetLabelTag(circuit, selected?.type === "symbol" ? selected.id : null)
            : item.prefix,
          params:
            item.kind === "lamp"
              ? { color: "green" }
              : item.kind === "title-block"
                ? {
                    projectName: "PROJECT NAME",
                    projectNo: "DWG-001",
                    rev: "A",
                    sheetNum: "1",
                    sheetTotal: "1",
                    description: "SCHEMATIC DIAGRAM",
                    designedBy: "ENGINEER",
                    date: formatMMDDYYYY(),
                    scale: 1,
                  }
                : item.kind === "comment"
                  ? {
                      text: "備註說明 / Note",
                      showLeaderLine: true,
                      bgColor: "#fef9c3",
                      fontSize: 12,
                      width: 6,
                      height: 3,
                    }
                : {},
        };
        const scale = ghost.params?.scale ?? 1;
        const boxW = v.w * scale;
        const boxH = v.h * scale;
        const gx = Math.round(cursor.x);
        const gy = Math.round(cursor.y);
        const ghostSym: SymbolInst = {
          id: "ghost",
          deviceId: "ghost",
          variant: item.variant,
          x: gx,
          y: gy,
          rot: placingRot,
        };
        return (
          <g
            className="place-ghost"
            transform={glyphTransform(ghostSym, boxW, boxH)}
            pointerEvents="none"
          >
            <SymbolGlyph device={ghost} variant={item.variant} w={boxW} h={boxH} />
          </g>
        );
      })()}

      {marqueeView && (() => {
        const r = normalizeRect(marqueeView.x0, marqueeView.y0, marqueeView.x1, marqueeView.y1);
        return (
          <rect
            className="marquee"
            x={r.x * GRID}
            y={r.y * GRID}
            width={Math.max(r.w * GRID, 1)}
            height={Math.max(r.h * GRID, 1)}
          />
        );
      })()}
    </>
  );
});
