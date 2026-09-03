import { useEffect, useMemo, useRef, useState } from "react";
import { allWireRoutes, findWireCrossovers, getConnectedWireIds } from "../geometry";
import { useLab } from "../store";
import { COLS, GRID, ROWS } from "../types";
import { ContextMenu } from "./ContextMenu";
import { InteractionOverlay } from "./schematic/layers/InteractionOverlay";
import { PaperBackground } from "./schematic/layers/PaperBackground";
import { PortLayer } from "./schematic/layers/PortLayer";
import { SymbolLayer } from "./schematic/layers/SymbolLayer";
import { WireLayer } from "./schematic/layers/WireLayer";
import { emptySnapshot } from "../sim/engine";
import { RulerLeft, RulerTop } from "./schematic/Ruler";
import { useSchematicEvents } from "./schematic/useSchematicEvents";
import { blurActiveInput } from "../keyboard";

export function Schematic() {
  const circuit = useLab((s) => s.circuit);
  const rawSnapshot = useLab((s) => s.snapshot);
  const mode = useLab((s) => s.mode);
  const snapshot = useMemo(() => {
    return mode === "edit" ? emptySnapshot(circuit) : rawSnapshot;
  }, [circuit, mode, rawSnapshot]);
  const editSubMode = useLab((s) => s.editSubMode);
  const placing = useLab((s) => s.placing);
  const placingRot = useLab((s) => s.placingRot);
  const placingFlipX = useLab((s) => s.placingFlipX);
  const placingFlipY = useLab((s) => s.placingFlipY);
  const selected = useLab((s) => s.selected);
  const selectedIds = useLab((s) => s.selectedIds);
  const selectedWireIds = useLab((s) => s.selectedWireIds);
  const wiringFrom = useLab((s) => s.wiringFrom);
  const hoverPort = useLab((s) => s.hoverPort);
  const held = useLab((s) => s.held);
  const zoom = useLab((s) => s.zoom);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth > 768 : true);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showRulers = isDesktop && mode === "edit";

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          useLab.getState().zoomIn();
        } else if (e.deltaY > 0) {
          useLab.getState().zoomOut();
        }
      }
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  let selectedNetTag = "";
  if (selected?.type === "symbol") {
    const s = circuit.symbols.find((x) => x.id === selected.id);
    const d = s && circuit.devices.find((x) => x.id === s.deviceId);
    if (d?.kind === "net-label") selectedNetTag = d.tag.trim();
  }

  const routes = useMemo(() => allWireRoutes(circuit), [circuit]);
  const crossovers = useMemo(() => findWireCrossovers(circuit, routes), [circuit, routes]);

  const highlightedWireIds = useMemo(() => {
    const ids: string[] = [];
    if (selected?.type === "wire") ids.push(selected.id);
    if (selectedWireIds && selectedWireIds.length > 0) {
      for (const id of selectedWireIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    if (ids.length === 0) return new Set<string>();
    return getConnectedWireIds(circuit, ids);
  }, [circuit, selected, selectedWireIds]);

  const {
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
    onTagPointerDown,
    onTagDoubleClick,
    onTagContextMenu,
    onResizeHandlePointerDown,
    onSymbolPointerUp,
    onSymbolPointerLeave,
    onPortPointerDown,
    onPortPointerEnter,
    onPortPointerLeave,
    onPlaceOverlayPointerDown,
    onPlaceOverlayContextMenu,
  } = useSchematicEvents({
    circuit,
    mode,
    placing,
    routes,
    containerRef: wrapRef,
  });

  return (
    <div
      className="paper-wrap"
      ref={wrapRef}
      onPointerDownCapture={blurActiveInput}
    >
      <div className={`schematic-container ${showRulers ? "with-rulers" : ""}`}>
        {showRulers && (
          <>
            <div className="ruler-corner">
              <span>✛</span>
            </div>
            <RulerTop
              cols={COLS}
              zoom={zoom}
              cursorX={rulerPos?.x ?? null}
            />
            <RulerLeft
              rows={ROWS}
              zoom={zoom}
              cursorY={rulerPos?.y ?? null}
            />
          </>
        )}
        <svg
          ref={svgRef}
          className={`paper${placing ? " placing" : ""}${mode === "run" ? " run" : ""}${wiringFrom ? " wiring" : ""} submode-${editSubMode}`}
          width={COLS * GRID * zoom}
          height={ROWS * GRID * zoom}
          viewBox={`0 0 ${COLS * GRID} ${ROWS * GRID}`}
          onPointerMove={onSvgMove}
          onPointerLeave={onSvgLeave}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
          style={{
            backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
            ...(wireCursor ? { cursor: wireCursor } : {}),
          }}
          onContextMenu={onSvgContextMenu}
        >
          <PaperBackground onPaperDown={onPaperDown} />

          <SymbolLayer
            circuit={circuit}
            snapshot={snapshot}
            selected={selected}
            selectedIds={selectedIds}
            selectedNetTag={selectedNetTag}
            highlightedWireIds={highlightedWireIds}
            held={held}
            onSymbolContextMenu={onSymbolContextMenu}
            onSymbolPointerDown={onSymbolPointerDown}
            onSymbolDoubleClick={onSymbolDoubleClick}
            onTagPointerDown={onTagPointerDown}
            onTagDoubleClick={onTagDoubleClick}
            onTagContextMenu={onTagContextMenu}
            onResizeHandlePointerDown={onResizeHandlePointerDown}
            onSymbolPointerUp={onSymbolPointerUp}
            onSymbolPointerLeave={onSymbolPointerLeave}
          />

          <WireLayer
            circuit={circuit}
            snapshot={snapshot}
            selected={selected}
            selectedWireIds={selectedWireIds}
            highlightedWireIds={highlightedWireIds}
            routes={routes}
            crossovers={crossovers}
            onWireContextMenu={onWireContextMenu}
            onWirePointerDown={onWirePointerDown}
            onWireDoubleClick={onWireDoubleClick}
          />

          <PortLayer
            circuit={circuit}
            mode={mode}
            editSubMode={editSubMode}
            wiringFrom={wiringFrom}
            hoverPort={hoverPort}
            onPortPointerDown={onPortPointerDown}
            onPortPointerEnter={onPortPointerEnter}
            onPortPointerLeave={onPortPointerLeave}
          />

          <InteractionOverlay
            circuit={circuit}
            wiringFrom={wiringFrom}
            cursor={cursor}
            placing={placing}
            placingRot={placingRot}
            placingFlipX={placingFlipX}
            placingFlipY={placingFlipY}
            selected={selected}
            routes={routes}
            marqueeView={marqueeView}
            onPlaceOverlayPointerDown={onPlaceOverlayPointerDown}
            onPlaceOverlayContextMenu={onPlaceOverlayContextMenu}
          />
        </svg>
      </div>
      {menu && <ContextMenu pos={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
