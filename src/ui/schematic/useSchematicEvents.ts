import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { hitWireSegment, wireRoute } from "../../geometry";
import { normalizeRect, symbolsInRect } from "../../groups";
import { useLab } from "../../store";
import { GRID, type Circuit, type Device, type Mode, type PortRef, type SymbolInst, type Wire, type WireJog } from "../../types";
import type { MenuPos } from "../ContextMenu";
import { interact } from "./interact";

interface UseSchematicEventsParams {
  circuit: Circuit;
  mode: Mode;
  placing: string | null;
  routes: Map<string, { x: number; y: number }[]>;
}

export function useSchematicEvents({
  circuit,
  mode,
  placing,
  routes,
}: UseSchematicEventsParams) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const drag = useRef<{
    id: string;
    dx: number;
    dy: number;
    origins: Record<string, { x: number; y: number }>;
    wireJogOrigins: Record<string, WireJog>;
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

  const toWorld = (e: PointerEvent) => {
    const g = toGrid(e);
    return { x: g.x * GRID, y: g.y * GRID };
  };

  const placeAtEvent = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (mode !== "edit" || !placing) return;
    const p = toGrid(e);
    useLab.getState().placeAt(Math.round(p.x), Math.round(p.y));
  };

  const cancelPlace = () => {
    useLab.getState().setPlacing(null);
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

  const onSvgMove = (e: PointerEvent<SVGSVGElement>) => {
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
      const wireUpdates = Object.entries(drag.current.wireJogOrigins).map(([id, jog]) => ({
        id,
        jog: {
          axis: jog.axis,
          pos: jog.axis === "x" ? jog.pos + ddx * GRID : jog.pos + ddy * GRID,
        },
      }));
      useLab.getState().moveGroup(updates, wireUpdates);
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

  const onSvgPointerUp = (e: PointerEvent<SVGSVGElement>) => {
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
  };

  const onSvgContextMenu = (e: MouseEvent<SVGSVGElement>) => {
    const lab = useLab.getState();
    if (lab.wiringFrom || lab.placing) {
      e.preventDefault();
      lab.setPlacing(null);
      return;
    }
    lab.select(null);
    openMenu(e);
  };

  const onWireContextMenu = (e: MouseEvent<SVGElement>, wireId: string) => {
    useLab.getState().select({ type: "wire", id: wireId });
    openMenu(e);
  };

  const onWirePointerDown = (e: PointerEvent<SVGElement>, wire: Wire, pts: { x: number; y: number }[]) => {
    e.stopPropagation();
    if (placing) {
      placeAtEvent(e);
      return;
    }
    if (e.button !== 0) return;
    const lab = useLab.getState();
    if (lab.wiringFrom) {
      lab.connectToWire(wire.id, toWorld(e));
      return;
    }
    lab.select({ type: "wire", id: wire.id });
    if (lab.mode !== "edit") return;
    const hit = hitWireSegment(pts, toWorld(e));
    if (hit) {
      lab.pushHistory();
      wireDrag.current = { id: wire.id, axis: hit.axis };
      setWireCursor(hit.axis === "x" ? "ew-resize" : "ns-resize");
    }
  };

  const onSymbolContextMenu = (e: MouseEvent<SVGElement>, symId: string) => {
    const lab = useLab.getState();
    if (lab.mode === "edit" && !lab.placing) {
      if (!lab.selectedIds.includes(symId)) lab.select({ type: "symbol", id: symId });
    }
    openMenu(e);
  };

  const onSymbolPointerDown = (e: PointerEvent<SVGElement>, sym: SymbolInst, dev: Device) => {
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
      const groupSet = new Set(Object.keys(origins));
      const wireJogOrigins: Record<string, WireJog> = {};
      for (const w of lab.circuit.wires) {
        if (w.jog && groupSet.has(w.a.symbolId) && groupSet.has(w.b.symbolId)) {
          wireJogOrigins[w.id] = { ...w.jog };
        }
      }
      drag.current = { id: sym.id, dx: p.x - sym.x, dy: p.y - sym.y, origins, wireJogOrigins };
      if (dev.kind === "junction") junctionClick.current = { id: sym.id, x: e.clientX, y: e.clientY };
      return;
    }
    interact(dev.kind, dev.id, true);
  };

  const onSymbolPointerUp = (dev: Device) => {
    interact(dev.kind, dev.id, false);
  };

  const onSymbolPointerLeave = (dev: Device) => {
    interact(dev.kind, dev.id, false);
  };

  const onPortPointerDown = (e: PointerEvent<SVGCircleElement>, port: PortRef) => {
    e.stopPropagation();
    if (placing) {
      placeAtEvent(e);
      return;
    }
    useLab.getState().clickPort(port);
  };

  const onPortPointerEnter = (port: PortRef) => {
    useLab.getState().setHoverPort(port);
  };

  const onPortPointerLeave = () => {
    useLab.getState().setHoverPort(null);
  };

  const onPlaceOverlayPointerDown = (e: PointerEvent<SVGRectElement>) => {
    e.stopPropagation();
    placeAtEvent(e);
  };

  const onPlaceOverlayContextMenu = (e: MouseEvent<SVGRectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    cancelPlace();
  };

  return {
    svgRef,
    cursor,
    menu,
    setMenu,
    marqueeView,
    wireCursor,
    onPaperDown,
    onSvgMove,
    onSvgPointerUp,
    onSvgContextMenu,
    onWireContextMenu,
    onWirePointerDown,
    onSymbolContextMenu,
    onSymbolPointerDown,
    onSymbolPointerUp,
    onSymbolPointerLeave,
    onPortPointerDown,
    onPortPointerEnter,
    onPortPointerLeave,
    onPlaceOverlayPointerDown,
    onPlaceOverlayContextMenu,
  };
}
