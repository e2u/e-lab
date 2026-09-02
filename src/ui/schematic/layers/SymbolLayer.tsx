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
  highlightedWireIds?: Set<string>;
  held: string[];
  onSymbolContextMenu: (e: MouseEvent<SVGElement>, symId: string) => void;
  onSymbolPointerDown: (e: PointerEvent<SVGElement>, sym: SymbolInst, dev: Device) => void;
  onSymbolPointerUp: (dev: Device) => void;
  onSymbolPointerLeave: (dev: Device) => void;
  onSymbolDoubleClick?: (e: MouseEvent<SVGElement>, sym: SymbolInst, dev: Device) => void;
  onTagPointerDown?: (e: PointerEvent<SVGElement>, sym: SymbolInst, dev: Device) => void;
  onTagDoubleClick?: (e: MouseEvent<SVGElement>, sym: SymbolInst, dev: Device) => void;
  onTagContextMenu?: (e: MouseEvent<SVGElement>, sym: SymbolInst, dev: Device) => void;
}

export const SymbolLayer = memo(function SymbolLayer({
  circuit,
  snapshot,
  selected,
  selectedIds,
  selectedNetTag,
  highlightedWireIds,
  held,
  onSymbolContextMenu,
  onSymbolPointerDown,
  onSymbolPointerUp,
  onSymbolPointerLeave,
  onSymbolDoubleClick,
  onTagPointerDown,
  onTagDoubleClick,
  onTagContextMenu,
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
            ((dev.kind !== "comment" && sym.deviceId === selectedDev.id) ||
              (selectedDev.kind === "comment" && dev.id === selectedDev.params?.targetDeviceId) ||
              (dev.kind === "comment" && dev.params?.targetDeviceId === selectedDev.id) ||
              (dev.kind !== "comment" && dev.kind === selectedDev.kind && dev.tag.trim() && dev.tag.trim() === selectedDev.tag.trim()))
        );
        const isRelatedSymbol = !sel && isSameDevice;
        return (
          <g key={sym.id}>
            {/* Symbol body - preserve rotation */}
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
                  <rect
                    className="sym-hit"
                    x={-14}
                    y={-14}
                    width={28}
                    height={28}
                    fill="transparent"
                    style={{ cursor: "move" }}
                  />
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
            {/* Symbol tag - rendered separately, unrotated */}
            {dev.kind !== "junction" && dev.kind !== "mains-3ph" && dev.kind !== "net-label" && dev.kind !== "title-block" && dev.kind !== "comment" && (
              <g pointerEvents="all">
                {(() => {
                  const basePlacement = getSymbolTagPlacement(dev.kind, sym, v);
                  const tagOffsetX = (sym.tagOffset?.dx ?? 0) * GRID;
                  const tagOffsetY = (sym.tagOffset?.dy ?? 0) * GRID;
                  const tagX = basePlacement.tagX + tagOffsetX;
                  const tagY = basePlacement.tagY + tagOffsetY;
                  const textAnchor = basePlacement.textAnchor;
                  const tagWidth = Math.max(16, dev.tag.length * 7);
                  const isTagHighlighted = (selected?.type === "symbol" && selected.id === sym.id) || isSameDevice;

                  // Timer active delay display below tag
                  const isTimerKind = dev.kind === "timer-on" || dev.kind === "timer-off";
                  const isTimerActive = isTimerKind && Boolean(rt && (rt.energized || (dev.kind === "timer-off" && rt.elapsedMs > 0)));

                  let delayText = "";
                  let isDone = false;
                  if (isTimerActive && rt) {
                    const delayMs = dev.params.delayMs ?? 2000;
                    const elapsedMs = rt.elapsedMs ?? 0;
                    isDone = Boolean(rt.done);

                    if (dev.kind === "timer-on") {
                      if (!isDone) {
                        const remMs = Math.max(0, delayMs - elapsedMs);
                        const remStr = (remMs / 1000).toFixed(1) + "s";
                        const totalStr = (delayMs / 1000).toFixed(1) + "s";
                        delayText = `${remStr} / ${totalStr}`;
                      } else {
                        delayText = `${(delayMs / 1000).toFixed(1)}s`;
                      }
                    } else {
                      // timer-off
                      if (rt.energized) {
                        delayText = `${(delayMs / 1000).toFixed(1)}s`;
                      } else {
                        const remMs = Math.max(0, elapsedMs);
                        const remStr = (remMs / 1000).toFixed(1) + "s";
                        const totalStr = (delayMs / 1000).toFixed(1) + "s";
                        delayText = `${remStr} / ${totalStr}`;
                      }
                    }
                  }

                  const delayBadgeW = Math.max(26, delayText.length * 6.2 + 8);
                  const delayBadgeH = 14;
                  const delayBadgeY = tagY + 8;
                  const delayBadgeX = textAnchor === "start" ? tagX : tagX - delayBadgeW / 2;
                  const delayTextX = textAnchor === "start" ? tagX + 4 : tagX;
                  const delayTextAnchor = textAnchor === "start" ? "start" : "middle";

                  return (
                    <g
                      className="sym-tag-group"
                      style={{ cursor: "move" }}
                      onPointerDown={(e) => onTagPointerDown?.(e, sym, dev)}
                      onDoubleClick={(e) => onTagDoubleClick?.(e, sym, dev)}
                      onContextMenu={(e) => (onTagContextMenu ? onTagContextMenu(e, sym, dev) : onSymbolContextMenu(e, sym.id))}
                    >
                      <rect
                        x={tagX - (textAnchor === "start" ? 4 : tagWidth / 2 + 6)}
                        y={tagY - 10}
                        width={textAnchor === "start" ? tagWidth + 8 : tagWidth + 12}
                        height={16}
                        rx="3"
                        className={`sym-tag-bg ${isTagHighlighted ? "selected" : ""}`}
                        fill={isTagHighlighted ? "#ffe066" : "#efe6d0"}
                        stroke={isTagHighlighted ? "#d97706" : "#b0a588"}
                        strokeWidth={isTagHighlighted ? 1.2 : 0.8}
                      />
                      <text
                        x={tagX}
                        y={tagY + 4}
                        textAnchor={textAnchor}
                        className={`sym-tag ${isTagHighlighted ? "selected" : ""}`}
                        style={{ userSelect: "none" }}
                      >
                        {dev.tag}
                      </text>

                      {isTimerActive && delayText && (
                        <g className="sym-tag-delay-group">
                          <rect
                            x={delayBadgeX}
                            y={delayBadgeY}
                            width={delayBadgeW}
                            height={delayBadgeH}
                            rx="3"
                            className={`sym-tag-delay-bg ${isDone ? "done" : "timing"}`}
                            fill={isDone ? "#dcfce7" : "#fef3c7"}
                            stroke={isDone ? "#16a34a" : "#f59e0b"}
                            strokeWidth={0.8}
                          />
                          <text
                            x={delayTextX}
                            y={delayBadgeY + 10.5}
                            textAnchor={delayTextAnchor}
                            className={`sym-tag-delay-text ${isDone ? "done" : "timing"}`}
                            style={{
                              userSelect: "none",
                              fontSize: "9px",
                              fontWeight: 600,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                              fill: isDone ? "#15803d" : "#b45309",
                            }}
                          >
                            {delayText}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}
              </g>
            )}
          </g>
        );
      })}

      {circuit.symbols.map((sym) => {
        if (!isJunction(sym.id, circuit)) return null;
        const connectedWires = circuit.wires.filter((w) => w.a.symbolId === sym.id || w.b.symbolId === sym.id);
        const sel = selectedIds.includes(sym.id);
        if (connectedWires.length < 2 && !sel) return null;
        const p = terminalWorld(circuit, { symbolId: sym.id, term: "1" });
        if (!p) return null;
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        const hot = Boolean(dev && snapshot.runtime[dev.id]?.energized);
        const isConnectedJunction = highlightedWireIds ? connectedWires.some((w) => highlightedWireIds.has(w.id)) : false;
        const rOuter = hot || sel || isConnectedJunction ? 6 : 5;
        const rInner = hot || sel || isConnectedJunction ? 2.5 : 2;
        const greenColor = "#16a34a";
        const strokeColor = hot || isConnectedJunction ? "#e6c11e" : sel ? "#3b82f6" : greenColor;
        const fillColor = hot || isConnectedJunction ? "rgba(230, 193, 30, 0.25)" : sel ? "rgba(59, 130, 246, 0.2)" : "rgba(22, 163, 74, 0.2)";
        const dotColor = hot || isConnectedJunction ? "#e6c11e" : sel ? "#3b82f6" : greenColor;
        return (
          <g key={`jdot-${sym.id}`} pointerEvents="none">
            <circle
              cx={p.x}
              cy={p.y}
              r={rOuter}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray="2.5 2"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={rInner}
              fill={dotColor}
            />
          </g>
        );
      })}

      {/* Comment leader lines */}
      {circuit.symbols.map((sym) => {
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        if (!dev || dev.kind !== "comment" || !dev.params?.targetDeviceId || dev.params?.showLeaderLine === false) return null;
        const targetDev = circuit.devices.find((d) => d.id === dev.params?.targetDeviceId);
        if (!targetDev) return null;
        const targetSym = circuit.symbols.find((s) => s.deviceId === targetDev.id);
        if (!targetSym) return null;

        const v = variantDef(dev.kind, sym.variant);
        const tv = variantDef(targetDev.kind, targetSym.variant);
        const cw = ((dev.params?.width ?? v.w) * GRID);
        const ch = ((dev.params?.height ?? v.h) * GRID);
        const tw = (tv.w * GRID);
        const th = (tv.h * GRID);

        // Comment center / anchor
        const cx = sym.x * GRID + cw / 2;
        const cy = sym.y * GRID + ch / 2;

        // Target center
        const tx = targetSym.x * GRID + tw / 2;
        const ty = targetSym.y * GRID + th / 2;

        const isHighlighted = selectedIds.includes(sym.id) || selectedIds.includes(targetSym.id);

        return (
          <g key={`leader-${sym.id}`} pointerEvents="none">
            <line
              x1={cx}
              y1={cy}
              x2={tx}
              y2={ty}
              stroke={isHighlighted ? "#ca8a04" : "#94a3b8"}
              strokeWidth={isHighlighted ? 2 : 1.4}
              strokeDasharray="4 3"
              opacity={isHighlighted ? 1 : 0.75}
            />
            {/* Anchor circle at target component */}
            <circle
              cx={tx}
              cy={ty}
              r={3.5}
              fill={isHighlighted ? "#ca8a04" : "#94a3b8"}
              stroke="#ffffff"
              strokeWidth={1}
            />
            {/* Anchor dot at comment box */}
            <circle
              cx={cx}
              cy={cy}
              r={2.5}
              fill={isHighlighted ? "#ca8a04" : "#94a3b8"}
            />
          </g>
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
