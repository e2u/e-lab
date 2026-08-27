import { memo, type MouseEvent, type PointerEvent } from "react";
import { variantDef } from "../../../catalog";
import { glyphTransform, isJunction, terminalWorld, textUnflipTransform } from "../../../geometry";
import { unionBounds } from "../../../groups";
import { SymbolGlyph } from "../../../Glyphs";
import { getSymbolTagPlacement } from "../../../tagPlacement";
import { t } from "../../../i18n";
import { GRID, type Circuit, type Device, type SimSnapshot, type SymbolInst } from "../../../types";
import { type Selection } from "../../../store";

interface SymbolLayerProps {
  circuit: Circuit;
  snapshot: SimSnapshot;
  selected: Selection | null;
  selectedIds: string[];
  selectedNetTag: string;
  held: string[];
  onSymbolContextMenu: (e: MouseEvent<SVGElement>, symId: string) => void;
  onSymbolPointerDown: (e: PointerEvent<SVGElement>, sym: SymbolInst, dev: Device) => void;
  onSymbolPointerUp: (dev: Device) => void;
  onSymbolPointerLeave: (dev: Device) => void;
  onSymbolDoubleClick?: (e: MouseEvent<SVGElement>, sym: SymbolInst, dev: Device) => void;
}

export const SymbolLayer = memo(function SymbolLayer({
  circuit,
  snapshot,
  selected,
  selectedIds,
  selectedNetTag,
  held,
  onSymbolContextMenu,
  onSymbolPointerDown,
  onSymbolPointerUp,
  onSymbolPointerLeave,
  onSymbolDoubleClick,
}: SymbolLayerProps) {
  const selectedSym = selected?.type === "symbol" ? circuit.symbols.find((s) => s.id === selected.id) : null;
  const selectedDev = selectedSym ? circuit.devices.find((d) => d.id === selectedSym.deviceId) : null;

  return (
    <>
      {circuit.symbols.map((sym) => {
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        if (!dev) return null;
        const v = variantDef(dev.kind, sym.variant);
        const scale = dev.params?.scale ?? 1;
        const boxW = v.w * scale;
        const boxH = v.h * scale;
        const rt = snapshot.runtime[dev.id];
        const sel = selectedIds.includes(sym.id);
        const netMatch =
          !sel &&
          Boolean(selectedNetTag) &&
          dev.kind === "net-label" &&
          dev.tag.trim() === selectedNetTag;
        const isSameDevice = Boolean(
          selectedDev &&
            dev.kind !== "junction" &&
            dev.kind !== "net-label" &&
            dev.kind !== "title-block" &&
            (sym.deviceId === selectedDev.id ||
              (dev.kind === selectedDev.kind && dev.tag.trim() && dev.tag.trim() === selectedDev.tag.trim()))
        );
        const isRelatedSymbol = !sel && isSameDevice;
        return (
          <g key={sym.id}>
            {/* 元件主體 - 保持旋轉 */}
            <g
              className="sym-g"
              transform={glyphTransform(sym, boxW, boxH)}
              onContextMenu={(e) => onSymbolContextMenu(e, sym.id)}
              onPointerDown={(e) => onSymbolPointerDown(e, sym, dev)}
              onPointerUp={() => onSymbolPointerUp(dev)}
              onPointerLeave={() => onSymbolPointerLeave(dev)}
              onDoubleClick={(e) => onSymbolDoubleClick?.(e, sym, dev)}
            >
              {dev.kind === "junction" ? (
                <>
                  <rect className="sym-hit" x={-12} y={-12} width={24} height={24} fill="transparent" />
                  {sel && (
                    <circle cx={0} cy={0} r={10} fill="none" stroke="#2ca02c" strokeDasharray="4 3" pointerEvents="none" />
                  )}
                  {rt?.short && (
                    <circle cx={0} cy={0} r={14} className="sym-short-flash" pointerEvents="none" />
                  )}
                </>
              ) : (
                <>
                  <rect
                    className="sym-hit"
                    x={0}
                    y={0}
                    width={boxW * GRID}
                    height={boxH * GRID}
                    fill="transparent"
                  />
                  {(sel || netMatch || isRelatedSymbol) && (
                    <rect
                      x={-4}
                      y={-4}
                      width={boxW * GRID + 8}
                      height={boxH * GRID + 8}
                      fill="none"
                      stroke={sel ? "#2ca02c" : isRelatedSymbol ? "#d97706" : "#3b7de0"}
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  )}
                  {rt?.short && (
                    <rect
                      x={-6}
                      y={-6}
                      width={boxW * GRID + 12}
                      height={boxH * GRID + 12}
                      className="sym-short-flash"
                      rx="4"
                      pointerEvents="none"
                    />
                  )}
                </>
              )}
              <SymbolGlyph
                device={dev}
                variant={sym.variant}
                w={boxW}
                h={boxH}
                rt={rt}
                pressed={held.includes(dev.id) || Boolean(rt?.actuated)}
                flipX={sym.flipX}
                flipY={sym.flipY}
              />
              {dev.params.welded && (
                <text x={4} y={-6} className="weld-tag" transform={textUnflipTransform(4, -6, sym.flipX, sym.flipY)}>
                  {t("symbol.weldedTag")}
                </text>
              )}
            </g>
            {/* 元件 tag - 單獨渲染，不旋轉 */}
            {dev.kind !== "junction" && dev.kind !== "mains-3ph" && dev.kind !== "net-label" && dev.kind !== "title-block" && (
              <g pointerEvents="none">
                {(() => {
                  const { tagX, tagY, textAnchor } = getSymbolTagPlacement(dev.kind, sym, v);
                  const tagWidth = dev.tag.length * 7;
                  const isTagHighlighted = (selected?.type === "symbol" && selected.id === sym.id) || isSameDevice;
                  return (
                    <>
                      <rect
                        x={tagX - (textAnchor === "start" ? 4 : tagWidth / 2 + 6)}
                        y={tagY - 10}
                        width={textAnchor === "start" ? tagWidth + 8 : tagWidth + 12}
                        height={14}
                        rx="2"
                        className={`sym-tag-bg ${isTagHighlighted ? "selected" : ""}`}
                        fill={isTagHighlighted ? "#ffe066" : "#efe6d0"}
                        stroke={isTagHighlighted ? "#d97706" : "none"}
                        strokeWidth={isTagHighlighted ? 1.2 : 0}
                      />
                      <text
                        x={tagX}
                        y={tagY + 4}
                        textAnchor={textAnchor}
                        className={`sym-tag ${isTagHighlighted ? "selected" : ""}`}
                      >
                        {dev.tag}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
          </g>
        );
      })}

      {circuit.symbols.map((sym) => {
        if (!isJunction(sym.id, circuit)) return null;
        const p = terminalWorld(circuit, { symbolId: sym.id, term: "1" });
        if (!p) return null;
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        const hot = Boolean(dev && snapshot.runtime[dev.id]?.energized);
        const sel = selectedIds.includes(sym.id);
        return (
          <circle
            key={`jdot-${sym.id}`}
            cx={p.x}
            cy={p.y}
            r={hot || sel ? 5.6 : 4.8}
            fill={hot ? "#e6c11e" : "#1b1a16"}
            stroke="#efe6d0"
            strokeWidth="1.2"
            pointerEvents="none"
          />
        );
      })}

      {(circuit.groups ?? []).map((g) => {
        const box = unionBounds(circuit, g.memberIds);
        if (!box) return null;
        const color = g.color || "#3b7de0";
        return (
          <rect
            key={g.id}
            className="group-box"
            x={box.x * GRID - 6}
            y={box.y * GRID - 6}
            width={box.w * GRID + 12}
            height={box.h * GRID + 12}
            rx="4"
            fill="none"
            stroke={color}
            style={{ stroke: color }}
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        );
      })}
    </>
  );
});
