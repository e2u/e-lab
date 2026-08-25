import { useRef, useState, type PointerEvent } from "react";
import { catalogItem, suggestNetLabelTag, variantDef } from "../catalog";
import { allWireRoutes, findWireCrossovers, glyphTransform, hitWireSegment, hopArcD, isJunction, nearestOnPolyline, polylinePathD, snapOnSegment, terminalWorld, textUnflipTransform, wireLabelPos, wireRoute } from "../geometry";
import { normalizeRect, symbolsInRect, unionBounds } from "../groups";
import { SymbolGlyph } from "../Glyphs";
import { PHASE_COLOR } from "../sim/engine";
import { useLab } from "../store";
import { COLS, GRID, ROWS, type Device, type PortRef } from "../types";
import { ContextMenu, type MenuPos } from "./ContextMenu";

export function Schematic() {
  const circuit = useLab((s) => s.circuit);
  const snapshot = useLab((s) => s.snapshot);
  const mode = useLab((s) => s.mode);
  const placing = useLab((s) => s.placing);
  const selected = useLab((s) => s.selected);
  const selectedIds = useLab((s) => s.selectedIds);
  const wiringFrom = useLab((s) => s.wiringFrom);
  const hoverPort = useLab((s) => s.hoverPort);
  const held = useLab((s) => s.held);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const drag = useRef<{
    id: string;
    dx: number;
    dy: number;
    origins: Record<string, { x: number; y: number }>;
  } | null>(null);
  const wireDrag = useRef<{ id: string; axis: "x" | "y" } | null>(null);
  const junctionClick = useRef<{ id: string; x: number; y: number } | null>(null);
  const clickIsolate = useRef<{ id: string; x: number; y: number } | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; shift: boolean } | null>(null);
  const [marqueeView, setMarqueeView] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [wireCursor, setWireCursor] = useState<"ew-resize" | "ns-resize" | "grab" | null>(null);

  const toGrid = (e: PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x / GRID, y: p.y / GRID };
  };

  const placeAtEvent = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (mode !== "edit" || !placing) return;
    const p = toGrid(e);
    useLab.getState().placeAt(Math.round(p.x), Math.round(p.y));
  };

  let selectedNetTag = "";
  if (selected?.type === "symbol") {
    const s = circuit.symbols.find((x) => x.id === selected.id);
    const d = s && circuit.devices.find((x) => x.id === s.deviceId);
    if (d?.kind === "net-label") selectedNetTag = d.tag.trim();
  }
  const routes = allWireRoutes(circuit);
  const crossovers = findWireCrossovers(circuit, routes);

  const cancelPlace = () => {
    useLab.getState().setPlacing(null);
  };

  const onPaperDown = (e: PointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    if (mode === "edit" && placing) {
      e.stopPropagation();
      placeAtEvent(e);
      return;
    }
    setMenu(null);
    const lab = useLab.getState();
    if (lab.wiringFrom) {
      lab.select(null);
      return;
    }
    if (mode !== "edit") {
      lab.select(null);
      return;
    }
    const p = toGrid(e);
    marqueeRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, shift: e.shiftKey };
    setMarqueeView({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    if (!e.shiftKey) lab.select(null);
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const toWorld = (e: PointerEvent) => {
    const g = toGrid(e);
    return { x: g.x * GRID, y: g.y * GRID };
  };

  const finishMarquee = () => {
    const m = marqueeRef.current;
    marqueeRef.current = null;
    setMarqueeView(null);
    if (!m) return;
    const rect = normalizeRect(m.x0, m.y0, m.x1, m.y1);
    if (rect.w < 0.35 && rect.h < 0.35) return;
    const ids = symbolsInRect(useLab.getState().circuit, rect);
    useLab.getState().selectIds(ids, m.shift);
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = toGrid(e);
    setCursor(p);
    const world = { x: p.x * GRID, y: p.y * GRID };
    if (marqueeRef.current) {
      marqueeRef.current = { ...marqueeRef.current, x1: p.x, y1: p.y };
      setMarqueeView({
        x0: marqueeRef.current.x0,
        y0: marqueeRef.current.y0,
        x1: p.x,
        y1: p.y,
      });
      return;
    }
    if (wireDrag.current && mode === "edit") {
      const axis = wireDrag.current.axis;
      // Snap to 1/16 grid for more precise control
      const SNAP_GRID = GRID / 16; // 22 / 16 = 1.375px
      const pos = axis === "x" ? Math.round(world.x / SNAP_GRID) * SNAP_GRID : Math.round(world.y / SNAP_GRID) * SNAP_GRID;
      useLab.getState().setWireJog(wireDrag.current.id, { axis, pos });
      return;
    }
    if (drag.current && mode === "edit") {
      // Snap to 1/16 grid for more precise control (in grid units)
      const SNAP_GRID_UNITS = 1 / 16; // 1/16 of a grid unit
      const nx = Math.round((p.x - drag.current.dx) / SNAP_GRID_UNITS) * SNAP_GRID_UNITS;
      const ny = Math.round((p.y - drag.current.dy) / SNAP_GRID_UNITS) * SNAP_GRID_UNITS;
      const origin = drag.current.origins[drag.current.id];
      if (!origin) return;
      const ddx = nx - origin.x;
      const ddy = ny - origin.y;
      const updates = Object.entries(drag.current.origins).map(([id, o]) => ({
        id,
        x: o.x + ddx,
        y: o.y + ddy,
      }));
      useLab.getState().moveGroup(updates);
      return;
    }
    if (mode === "edit" && !placing) {
      let next: "ew-resize" | "ns-resize" | "grab" | null = null;
      for (const w of circuit.wires) {
        const pts = routes.get(w.id) ?? wireRoute(circuit, w.a, w.b, w.jog);
        const hit = hitWireSegment(pts, world);
        if (hit) {
          next = hit.axis === "x" ? "ew-resize" : "ns-resize";
          break;
        }
      }
      setWireCursor(next);
    } else if (wireCursor) {
      setWireCursor(null);
    }
  };

  const openMenu = (e: {
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "edit") return;
    if (placing) {
      cancelPlace();
      return;
    }
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="paper-wrap">
      <svg
        ref={svgRef}
        className={`paper${placing ? " placing" : ""}${mode === "run" ? " run" : ""}${wiringFrom ? " wiring" : ""}`}
        width={COLS * GRID}
        height={ROWS * GRID}
        onPointerMove={onMove}
        onPointerUp={(e) => {
          if (marqueeRef.current) {
            finishMarquee();
            drag.current = null;
            wireDrag.current = null;
            junctionClick.current = null;
            clickIsolate.current = null;
            return;
          }
          const jc = junctionClick.current;
          junctionClick.current = null;
          const iso = clickIsolate.current;
          clickIsolate.current = null;
          drag.current = null;
          wireDrag.current = null;
          if (jc && Math.hypot(e.clientX - jc.x, e.clientY - jc.y) < 6) {
            useLab.getState().clickPort({ symbolId: jc.id, term: "1" });
          } else if (iso && Math.hypot(e.clientX - iso.x, e.clientY - iso.y) < 6) {
            useLab.getState().select({ type: "symbol", id: iso.id });
          }
        }}
        style={wireCursor ? { cursor: wireCursor } : undefined}
        onContextMenu={(e) => {
          const lab = useLab.getState();
          if (lab.wiringFrom || lab.placing) {
            e.preventDefault();
            lab.setPlacing(null);
            return;
          }
          lab.select(null);
          openMenu(e);
        }}
      >
        <rect
          className="paper-hit"
          x={0}
          y={0}
          width={COLS * GRID}
          height={ROWS * GRID}
          fill="transparent"
          onPointerDown={onPaperDown}
        />

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
          const sel = selected?.type === "wire" && selected.id === w.id;
          const mid = pts[Math.floor(pts.length / 2)] ?? a;
          const tag = (w.label ?? "").trim();
          const tagPos = tag ? wireLabelPos(pts) : null;
          return (
            <g
              key={w.id}
              onContextMenu={(e) => {
                useLab.getState().select({ type: "wire", id: w.id });
                openMenu(e);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (placing) {
                  placeAtEvent(e);
                  return;
                }
                if (e.button !== 0) return;
                const lab = useLab.getState();
                if (lab.wiringFrom) {
                  lab.connectToWire(w.id, toWorld(e));
                  return;
                }
                lab.select({ type: "wire", id: w.id });
                if (lab.mode !== "edit") return;
                const hit = hitWireSegment(pts, toWorld(e));
                if (hit) {
                  lab.pushHistory();
                  wireDrag.current = { id: w.id, axis: hit.axis };
                  setWireCursor(hit.axis === "x" ? "ew-resize" : "ns-resize");
                }
              }}
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
                className={`wire ${live?.live ? "live" : ""} ${w.broken ? "broken" : ""}`}
                stroke={sel ? "#e6c11e" : color}
                strokeDasharray={w.broken ? "6 5" : undefined}
              />
              {sel && (
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
          const sel = selected?.type === "wire" && selected.id === c.hopWireId;
          const color = w?.broken ? "#c4391d" : live?.kind ? PHASE_COLOR[live.kind] : "#2a2924";
          return (
            <path
              key={`hop-${i}`}
              d={hopArcD(c)}
              className={`wire ${live?.live ? "live" : ""}`}
              stroke={sel ? "#e6c11e" : color}
              strokeDasharray={w?.broken ? "6 5" : undefined}
              fill="none"
              pointerEvents="none"
            />
          );
        })}

        {circuit.symbols.map((sym) => {
          const dev = circuit.devices.find((d) => d.id === sym.deviceId);
          if (!dev) return null;
          const v = variantDef(dev.kind, sym.variant);
          const rt = snapshot.runtime[dev.id];
          const sel = selectedIds.includes(sym.id);
          const netMatch =
            !sel &&
            Boolean(selectedNetTag) &&
            dev.kind === "net-label" &&
            dev.tag.trim() === selectedNetTag;
          return (
            <g
              key={sym.id}
              className="sym-g"
              transform={glyphTransform(sym, v.w, v.h)}
              onContextMenu={(e) => {
                const lab = useLab.getState();
                if (lab.mode === "edit" && !lab.placing) {
                  if (!lab.selectedIds.includes(sym.id)) lab.select({ type: "symbol", id: sym.id });
                }
                openMenu(e);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const lab = useLab.getState();
                if (lab.placing) {
                  placeAtEvent(e);
                  return;
                }
                if (lab.mode === "edit") {
                  if (dev.kind === "junction" && lab.wiringFrom) {
                    lab.clickPort({ symbolId: sym.id, term: "1" });
                    return;
                  }
                  if (e.shiftKey) lab.selectToggle(sym.id);
                  else if (!lab.selectedIds.includes(sym.id)) lab.select({ type: "symbol", id: sym.id });
                  else if (lab.selectedIds.length > 1) {
                    clickIsolate.current = { id: sym.id, x: e.clientX, y: e.clientY };
                  }
                  const p = toGrid(e);
                  const ids = useLab.getState().selectedIds;
                  const group = ids.length ? ids : [sym.id];
                  const origins: Record<string, { x: number; y: number }> = {};
                  for (const id of group) {
                    const s = lab.circuit.symbols.find((x) => x.id === id);
                    if (s) origins[id] = { x: s.x, y: s.y };
                  }
                  origins[sym.id] = { x: sym.x, y: sym.y };
                  drag.current = { id: sym.id, dx: p.x - sym.x, dy: p.y - sym.y, origins };
                  if (dev.kind === "junction") junctionClick.current = { id: sym.id, x: e.clientX, y: e.clientY };
                  return;
                }
                interact(dev.kind, dev.id, true);
              }}
              onPointerUp={() => interact(dev.kind, dev.id, false)}
              onPointerLeave={() => interact(dev.kind, dev.id, false)}
            >
              {dev.kind === "junction" ? (
                <>
                  <rect className="sym-hit" x={-12} y={-12} width={24} height={24} fill="transparent" />
                  {sel && (
                    <circle cx={0} cy={0} r={10} fill="none" stroke="#2ca02c" strokeDasharray="4 3" pointerEvents="none" />
                  )}
                </>
              ) : (
                <>
                  <rect
                    className="sym-hit"
                    x={0}
                    y={0}
                    width={v.w * GRID}
                    height={v.h * GRID}
                    fill="transparent"
                  />
                  {(sel || netMatch) && (
                    <rect
                      x={-4}
                      y={-4}
                      width={v.w * GRID + 8}
                      height={v.h * GRID + 8}
                      fill="none"
                      stroke={sel ? "#2ca02c" : "#3b7de0"}
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  )}
                </>
              )}
              <SymbolGlyph
                device={dev}
                variant={sym.variant}
                w={v.w}
                h={v.h}
                rt={rt}
                pressed={held.includes(dev.id) || Boolean(rt?.actuated)}
                flipX={sym.flipX}
                flipY={sym.flipY}
              />
              {dev.params.welded && (
                <text x={4} y={-6} className="weld-tag" transform={textUnflipTransform(4, -6, sym.flipX, sym.flipY)}>
                  熔
                </text>
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
          if (!g.memberIds.some((id) => selectedIds.includes(id))) return null;
          const box = unionBounds(circuit, g.memberIds);
          if (!box) return null;
          return (
            <rect
              key={g.id}
              className="group-box"
              x={box.x * GRID - 6}
              y={box.y * GRID - 6}
              width={box.w * GRID + 12}
              height={box.h * GRID + 12}
              rx="4"
            />
          );
        })}

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
                <circle
                  cx={world.x}
                  cy={world.y}
                  r="6"
                  className={`port ${hot ? "hot" : ""}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (placing) {
                      placeAtEvent(e);
                      return;
                    }
                    useLab.getState().clickPort(port);
                  }}
                  onPointerEnter={() => useLab.getState().setHoverPort(port)}
                  onPointerLeave={() => useLab.getState().setHoverPort(null)}
                />
                <title>{`${dev.tag}:${t.label}`}</title>
              </g>
            );
          });
        })}

        {wiringFrom && cursor && (() => {
          const a = terminalWorld(circuit, wiringFrom);
          if (!a) return null;
          let b = { x: cursor.x * GRID, y: cursor.y * GRID };
          let snapped = false;
          for (const w of circuit.wires) {
            const wpts = routes.get(w.id) ?? wireRoute(circuit, w.a, w.b, w.jog);
            const near = nearestOnPolyline(wpts, b);
            if (near && near.d <= 14) {
              b = snapOnSegment(wpts[near.index], wpts[near.index + 1], { x: near.x, y: near.y });
              snapped = true;
              break;
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
            onPointerDown={(e) => {
              e.stopPropagation();
              placeAtEvent(e);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              cancelPlace();
            }}
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
            params: item.kind === "lamp" ? { color: "green" } : {},
          };
          const gx = Math.round(cursor.x);
          const gy = Math.round(cursor.y);
          return (
            <g
              className="place-ghost"
              transform={`translate(${gx * GRID} ${gy * GRID})`}
              pointerEvents="none"
            >
              <SymbolGlyph device={ghost} variant={item.variant} w={v.w} h={v.h} />
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
      </svg>
      {menu && <ContextMenu pos={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function interact(kind: string, id: string, down: boolean) {
  const lab = useLab.getState();
  if (lab.mode !== "run") return;
  if (kind === "pb-no" || kind === "pb-nc" || kind === "foot" || kind === "foot-no" || kind === "foot-nc") {
    lab.pointerDevice(id, down);
    return;
  }
  if (!down) return;
  if (
    kind === "estop" ||
    kind === "estop-nc" ||
    kind === "estop-no" ||
    kind === "toggle" ||
    kind.startsWith("toggle-")
  ) {
    lab.toggleIo(id, "actuated");
  }
  if (kind === "breaker-1p" || kind === "breaker-3p" || kind === "isolator" || kind === "rcd") {
    lab.toggleIo(id, "on");
  }
  if (kind === "overload" || kind === "fuse") lab.toggleIo(id, "tripped");
  if (kind === "selector-2" || kind === "selector-3") lab.cyclePosition(id);
  if (kind === "limit-no" || kind === "limit-nc") lab.setProcess({ limitHit: !lab.process.limitHit });
  if (kind === "prox") lab.setProcess({ proxHit: !lab.process.proxHit });
  if (kind === "photo") lab.setProcess({ photoHit: !lab.process.photoHit });
  if (kind === "gen-ac" || kind === "gen-dc") lab.toggleIo(id, "prime");
}
