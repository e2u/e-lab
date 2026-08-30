import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { findPortAtPoint, findWireAtPoint, hitWireSegment, portsEqual, wireRoute } from "../../geometry";
import { normalizeRect, symbolsInRect } from "../../groups";
import { useLab } from "../../store";
import { GRID, type Circuit, type Device, type Mode, type PortRef, type SymbolInst, type Wire, type WireJog } from "../../types";
import type { MenuPos } from "../ContextMenu";
import { interact, triggerHaptic } from "./interact";

interface UseSchematicEventsParams {
  circuit: Circuit;
  mode: Mode;
  placing: string | null;
  routes: Map<string, { x: number; y: number }[]>;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function useSchematicEvents({
  circuit,
  mode,
  placing,
  routes,
  containerRef,
}: UseSchematicEventsParams) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [rulerPos, setRulerPos] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const drag = useRef<{
    id: string;
    dx: number;
    dy: number;
    origins: Record<string, { x: number; y: number }>;
    wireJogOrigins: Record<string, WireJog>;
    pushedHistory?: boolean;
  } | null>(null);
  const wireDrag = useRef<{
    id: string;
    axis: "x" | "y";
    startX?: number;
    startY?: number;
    pushedHistory?: boolean;
  } | null>(null);
  const junctionClick = useRef<{ id: string; x: number; y: number } | null>(null);
  const lastSymbolTapRef = useRef<{ id: string; time: number; x: number; y: number } | null>(null);
  const lastWireTapRef = useRef<{ id: string; time: number; x: number; y: number } | null>(null);
  const wiringStartedByDragRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; shift: boolean } | null>(null);
  const [marqueeView, setMarqueeView] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [wireCursor, setWireCursor] = useState<"ew-resize" | "ns-resize" | "grab" | null>(null);

  // Multi-touch tracking for pinch-to-zoom and two-finger pan
  const pointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchRef = useRef<{ initialDist: number; initialZoom: number; lastMid: { x: number; y: number } } | null>(null);
  const paperTouchPanRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  // Smooth scroll via requestAnimationFrame
  const rafScrollId = useRef<number | null>(null);
  const pendingScroll = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      cancelLongPress();
      drag.current = null;
      wireDrag.current = null;
      junctionClick.current = null;
      paperTouchPanRef.current = null;
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    window.addEventListener("blur", handleGlobalPointerUp);
    return () => {
      if (rafScrollId.current !== null) {
        cancelAnimationFrame(rafScrollId.current);
      }
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
      window.removeEventListener("blur", handleGlobalPointerUp);
    };
  }, []);

  const scheduleScroll = (dx: number, dy: number) => {
    pendingScroll.current.dx += dx;
    pendingScroll.current.dy += dy;
    if (rafScrollId.current === null && containerRef?.current) {
      rafScrollId.current = requestAnimationFrame(() => {
        rafScrollId.current = null;
        if (containerRef?.current) {
          containerRef.current.scrollLeft -= pendingScroll.current.dx;
          containerRef.current.scrollTop -= pendingScroll.current.dy;
        }
        pendingScroll.current.dx = 0;
        pendingScroll.current.dy = 0;
      });
    }
  };

  const startLongPress = (
    e: PointerEvent,
    callback: (pos: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void }) => void
  ) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    cancelLongPress();
    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      triggerHaptic(25);
      callback({
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
      // Cancel active drag when menu appears
      drag.current = null;
      wireDrag.current = null;
      marqueeRef.current = null;
      setMarqueeView(null);
      paperTouchPanRef.current = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  const checkLongPressMove = (e: PointerEvent) => {
    if (longPressStartRef.current) {
      const dist = Math.hypot(e.clientX - longPressStartRef.current.x, e.clientY - longPressStartRef.current.y);
      if (dist > 8) {
        cancelLongPress();
      }
    }
  };

  const toGrid = (e: { clientX: number; clientY: number }) => {
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

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const g = toGrid(e);
    return { x: g.x * GRID, y: g.y * GRID };
  };

  const placeAtEvent = (e: PointerEvent, wireId?: string) => {
    if (e.button !== 0) return;
    if (!placing) return;
    const p = toGrid(e);
    const extraParams = wireId ? { clampedWireId: wireId } : undefined;
    useLab.getState().placeAt(Math.round(p.x), Math.round(p.y), extraParams);
  };

  const cancelPlace = () => {
    useLab.getState().setPlacing(null);
  };

  const openMenu = (
    e: {
      clientX: number;
      clientY: number;
      preventDefault: () => void;
      stopPropagation: () => void;
    },
    world?: { x: number; y: number },
  ) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = null;
    wireDrag.current = null;
    junctionClick.current = null;
    marqueeRef.current = null;
    setMarqueeView(null);
    paperTouchPanRef.current = null;
    if (placing) {
      cancelPlace();
      return;
    }
    setMenu({ x: e.clientX, y: e.clientY, world: world ?? toWorld(e) });
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
    // Record pointer
    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // If 2 or more touches, initiate pinch-to-zoom
    if (pointersRef.current.size >= 2) {
      cancelLongPress();
      drag.current = null;
      wireDrag.current = null;
      marqueeRef.current = null;
      setMarqueeView(null);
      paperTouchPanRef.current = null;
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      const mid = { x: (pts[0].clientX + pts[1].clientX) / 2, y: (pts[0].clientY + pts[1].clientY) / 2 };
      pinchRef.current = { initialDist: dist, initialZoom: useLab.getState().zoom, lastMid: mid };
      return;
    }

    if (e.button !== 0) return;
    if (placing) {
      e.stopPropagation();
      placeAtEvent(e);
      return;
    }
    setMenu(null);
    const lab = useLab.getState();
    if (lab.wiringFrom) {
      const world = toWorld(e);
      const wire = findWireAtPoint(lab.circuit, world.x, world.y, 18);
      if (wire) {
        lab.connectToWire(wire.id, world);
        return;
      }
      const p = toGrid(e);
      lab.addJunctionAndConnect(p.x, p.y);
      return;
    }
    if (mode !== "edit") {
      lab.select(null);
      if (e.pointerType === "touch") {
        paperTouchPanRef.current = { x: e.clientX, y: e.clientY, moved: false };
        try {
          svgRef.current?.setPointerCapture(e.pointerId);
        } catch {}
      }
      return;
    }

    // Touch device single-finger canvas pan handling on empty paper
    if (e.pointerType === "touch" && !e.shiftKey) {
      paperTouchPanRef.current = { x: e.clientX, y: e.clientY, moved: false };
      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {}
      startLongPress(e, (pos) => {
        lab.select(null);
        openMenu(pos);
      });
      return;
    }

    const p = toGrid(e);
    marqueeRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, shift: e.shiftKey };
    setMarqueeView({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    if (!e.shiftKey) lab.select(null);
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onSvgMove = (e: PointerEvent<SVGSVGElement>) => {
    checkLongPressMove(e);

    // Update active pointer position
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // Handle 2-finger pinch-to-zoom & pan
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      const mid = { x: (pts[0].clientX + pts[1].clientX) / 2, y: (pts[0].clientY + pts[1].clientY) / 2 };

      if (pinchRef.current.initialDist > 10) {
        const scale = dist / pinchRef.current.initialDist;
        const newZoom = Math.max(0.25, Math.min(1.5, Math.round(pinchRef.current.initialZoom * scale * 100) / 100));
        useLab.getState().setZoom(newZoom);
      }

      scheduleScroll(mid.x - pinchRef.current.lastMid.x, mid.y - pinchRef.current.lastMid.y);
      pinchRef.current.lastMid = mid;
      return;
    }

    // Handle touch paper panning
    if (paperTouchPanRef.current && e.pointerType === "touch") {
      const dx = e.clientX - paperTouchPanRef.current.x;
      const dy = e.clientY - paperTouchPanRef.current.y;
      if (Math.hypot(dx, dy) > 3) {
        paperTouchPanRef.current.moved = true;
        cancelLongPress();
      }
      paperTouchPanRef.current.x = e.clientX;
      paperTouchPanRef.current.y = e.clientY;
      paperTouchPanRef.current.moved = true;
      scheduleScroll(dx, dy);
      return;
    }

    const labWiring = useLab.getState().wiringFrom;
    const p = toGrid(e);
    if (e.pointerType !== "touch") {
      setRulerPos(p);
    }
    if (labWiring || placing) {
      setCursor(p);
    } else if (cursor !== null) {
      setCursor(null);
    }

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
      if (
        !wireDrag.current.pushedHistory &&
        (wireDrag.current.startX === undefined ||
          Math.hypot(e.clientX - wireDrag.current.startX, e.clientY - (wireDrag.current.startY ?? 0)) > 2)
      ) {
        useLab.getState().pushHistory();
        wireDrag.current.pushedHistory = true;
      }
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
      if ((Math.abs(ddx) > 1e-4 || Math.abs(ddy) > 1e-4) && !drag.current.pushedHistory) {
        useLab.getState().pushHistory();
        drag.current.pushedHistory = true;
      }
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
    if (e.pointerType !== "touch" && mode === "edit" && !placing) {
      let next: "ew-resize" | "ns-resize" | "grab" | null = null;
      const isNearJunction = circuit.symbols.some((sym) => {
        const dev = circuit.devices.find((d) => d.id === sym.deviceId);
        if (dev?.kind !== "junction") return false;
        return Math.hypot(sym.x * GRID - world.x, sym.y * GRID - world.y) <= 16;
      });

      if (!isNearJunction) {
        for (const w of circuit.wires) {
          const pts = routes.get(w.id) ?? wireRoute(circuit, w.a, w.b, w.jog);
          const hit = hitWireSegment(pts, world);
          if (hit) {
            next = hit.axis === "x" ? "ew-resize" : "ns-resize";
            break;
          }
        }
      }
      setWireCursor(next);
    } else if (wireCursor) {
      setWireCursor(null);
    }
  };

  const onSvgPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    cancelLongPress();
    try {
      if (svgRef.current?.hasPointerCapture(e.pointerId)) {
        svgRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (paperTouchPanRef.current) {
      const moved = paperTouchPanRef.current.moved;
      paperTouchPanRef.current = null;
      if (!moved) {
        useLab.getState().select(null);
      }
      return;
    }

    if (marqueeRef.current) {
      finishMarquee();
      drag.current = null;
      wireDrag.current = null;
      junctionClick.current = null;
      wiringStartedByDragRef.current = null;
      return;
    }
    if (wiringStartedByDragRef.current) {
      const start = wiringStartedByDragRef.current;
      wiringStartedByDragRef.current = null;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      const lab = useLab.getState();
      if (moved > 10 && lab.wiringFrom) {
        const world = toWorld(e);
        const targetPort = findPortAtPoint(lab.circuit, world.x, world.y, 16);
        if (targetPort && !portsEqual(lab.wiringFrom, targetPort)) {
          lab.clickPort(targetPort);
          return;
        }
        const wire = findWireAtPoint(lab.circuit, world.x, world.y, 18);
        if (wire) {
          lab.connectToWire(wire.id, world);
          return;
        }
        const p = toGrid(e);
        lab.addJunctionAndConnect(p.x, p.y);
        return;
      }
    }
    const jc = junctionClick.current;
    junctionClick.current = null;
    drag.current = null;
    wireDrag.current = null;
    if (jc && Math.hypot(e.clientX - jc.x, e.clientY - jc.y) < 6) {
      useLab.getState().clickPort({ symbolId: jc.id, term: "1" });
    }
  };

  const onSvgContextMenu = (e: MouseEvent<SVGSVGElement>) => {
    drag.current = null;
    wireDrag.current = null;
    const lab = useLab.getState();
    if (lab.wiringFrom || lab.placing) {
      e.preventDefault();
      lab.setPlacing(null);
      return;
    }
    lab.select(null);
    openMenu(e, toWorld(e));
  };

  const onWireContextMenu = (e: MouseEvent<SVGElement>, wireId: string) => {
    drag.current = null;
    wireDrag.current = null;
    useLab.getState().select({ type: "wire", id: wireId });
    openMenu(e, toWorld(e));
  };

  const onWirePointerDown = (e: PointerEvent<SVGElement>, wire: Wire, pts: { x: number; y: number }[]) => {
    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    e.stopPropagation();
    if (placing) {
      placeAtEvent(e, placing === "ammeter" ? wire.id : undefined);
      return;
    }
    if (e.button !== 0) return;

    startLongPress(e, (pos) => {
      useLab.getState().select({ type: "wire", id: wire.id });
      openMenu(pos, toWorld(e));
    });

    const lab = useLab.getState();
    if (lab.wiringFrom) {
      lab.connectToWire(wire.id, toWorld(e));
      return;
    }

    if (lab.mode === "edit") {
      const now = Date.now();
      const lastTap = lastWireTapRef.current;
      const isDoubleTap =
        lastTap &&
        lastTap.id === wire.id &&
        now - lastTap.time < 350 &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 20;
      lastWireTapRef.current = { id: wire.id, time: now, x: e.clientX, y: e.clientY };

      if (isDoubleTap && e.button === 0) {
        cancelLongPress();
        wireDrag.current = null;
        drag.current = null;
        lab.select({ type: "wire", id: wire.id });
        lab.straightenWire(wire.id);
        return;
      }
    }

    lab.select({ type: "wire", id: wire.id });
    if (lab.mode !== "edit") return;
    const world = toWorld(e);
    const hit = hitWireSegment(pts, world, 1000);
    if (hit) {
      wireDrag.current = { id: wire.id, axis: hit.axis, startX: e.clientX, startY: e.clientY, pushedHistory: false };
      setWireCursor(hit.axis === "x" ? "ew-resize" : "ns-resize");
      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const onWireDoubleClick = (e: MouseEvent<SVGElement>, wire: Wire) => {
    e.stopPropagation();
    const lab = useLab.getState();
    if (lab.mode !== "edit") return;
    cancelLongPress();
    wireDrag.current = null;
    drag.current = null;
    lab.select({ type: "wire", id: wire.id });
    lab.straightenWire(wire.id);
  };

  const onSymbolContextMenu = (e: MouseEvent<SVGElement>, symId: string) => {
    drag.current = null;
    wireDrag.current = null;
    const lab = useLab.getState();
    if (lab.mode === "edit" && !lab.placing) {
      if (!lab.selectedIds.includes(symId)) {
        lab.select({ type: "symbol", id: symId });
      } else {
        useLab.setState({ selected: { type: "symbol", id: symId } });
      }
    }
    openMenu(e);
  };

  const onSymbolPointerDown = (e: PointerEvent<SVGElement>, sym: SymbolInst, dev: Device) => {
    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    e.stopPropagation();
    const lab = useLab.getState();
    if (lab.placing) {
      placeAtEvent(e);
      return;
    }
    if (lab.mode === "edit") {
      const now = Date.now();
      const lastTap = lastSymbolTapRef.current;
      const isDoubleTap =
        lastTap &&
        lastTap.id === sym.id &&
        now - lastTap.time < 350 &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 20;
      lastSymbolTapRef.current = { id: sym.id, time: now, x: e.clientX, y: e.clientY };

      if (isDoubleTap && e.button === 0) {
        cancelLongPress();
        drag.current = null;
        lab.select({ type: "symbol", id: sym.id }, true);
        lab.setSideOpen(true);
        return;
      }

      startLongPress(e, (pos) => {
        if (!lab.selectedIds.includes(sym.id)) {
          lab.select({ type: "symbol", id: sym.id });
        } else {
          useLab.setState({ selected: { type: "symbol", id: sym.id } });
        }
        openMenu(pos);
      });

      if (dev.kind === "junction" && lab.wiringFrom) {
        lab.clickPort({ symbolId: sym.id, term: "1" });
        return;
      }
      if (e.button !== 0) return;

      if (e.shiftKey) {
        lab.selectToggle(sym.id);
      } else if (!lab.selectedIds.includes(sym.id)) {
        lab.select({ type: "symbol", id: sym.id });
      } else {
        useLab.setState({ selected: { type: "symbol", id: sym.id } });
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
      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {}
      if (dev.kind === "junction") junctionClick.current = { id: sym.id, x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 0) {
      interact(dev.kind, dev.id, true);
    }
  };

  const onSymbolDoubleClick = (e: MouseEvent<SVGElement>, sym: SymbolInst, _dev: Device) => {
    e.stopPropagation();
    const lab = useLab.getState();
    if (lab.mode !== "edit") return;
    cancelLongPress();
    drag.current = null;
    lab.select({ type: "symbol", id: sym.id }, true);
    lab.setSideOpen(true);
  };

  const onSymbolPointerUp = (dev: Device) => {
    cancelLongPress();
    interact(dev.kind, dev.id, false);
  };

  const onSymbolPointerLeave = (dev: Device) => {
    cancelLongPress();
    interact(dev.kind, dev.id, false);
  };

  const onPortPointerDown = (e: PointerEvent<SVGCircleElement>, port: PortRef) => {
    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    e.stopPropagation();
    if (placing) {
      placeAtEvent(e);
      return;
    }
    triggerHaptic(10);
    const lab = useLab.getState();
    if (lab.wiringFrom && !portsEqual(lab.wiringFrom, port)) {
      lab.clickPort(port);
      return;
    }
    wiringStartedByDragRef.current = { x: e.clientX, y: e.clientY };
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

  const onSvgLeave = () => {
    setRulerPos(null);
  };

  return {
    svgRef,
    cursor,
    rulerPos,
    menu,
    setMenu,
    marqueeView,
    wireCursor,
    onPaperDown,
    onSvgMove,
    onSvgLeave,
    onSvgPointerUp,
    onSvgContextMenu,
    onWireContextMenu,
    onWirePointerDown,
    onWireDoubleClick,
    onSymbolContextMenu,
    onSymbolPointerDown,
    onSymbolDoubleClick,
    onSymbolPointerUp,
    onSymbolPointerLeave,
    onPortPointerDown,
    onPortPointerEnter,
    onPortPointerLeave,
    onPlaceOverlayPointerDown,
    onPlaceOverlayContextMenu,
  };
}
