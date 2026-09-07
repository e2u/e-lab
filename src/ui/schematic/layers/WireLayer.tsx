import { memo, useMemo, type MouseEvent, type PointerEvent } from "react";
import { getConnectedWireIds, getCumulativeDistances, hopArcD, polylinePathD, terminalWorld, wireLabelPos, wireRoute, type WireCrossover } from "../../../geometry";
import { variantDef } from "../../../catalog";
import { PHASE_COLOR } from "../../../sim/engine";
import type { Selection } from "../../../store";
import { GRID } from "../../../types";
import type { Circuit, SimSnapshot, Wire } from "../../../types";

interface WireLayerProps {
  circuit: Circuit;
  snapshot: SimSnapshot;
  selected: Selection | null;
  selectedWireIds?: string[];
  highlightedWireIds?: Set<string>;
  routes: Map<string, { x: number; y: number }[]>;
  crossovers: WireCrossover[];
  /** Sheet option: render wire number labels (defaults to visible when omitted). */
  showWireLabels?: boolean;
  hiddenWireLabels?: Set<string>;
  onWireContextMenu: (e: MouseEvent<SVGElement>, wireId: string) => void;
  onWirePointerDown: (e: PointerEvent<SVGElement>, wire: Wire, pts: { x: number; y: number }[]) => void;
  onWireDoubleClick?: (e: MouseEvent<SVGElement>, wire: Wire) => void;
  onWireLabelPointerDown?: (e: PointerEvent<SVGElement>, wireId: string) => void;
  onWireLabelDoubleClick?: (e: MouseEvent<SVGElement>, wireId: string) => void;
  onWireLabelContextMenu?: (e: MouseEvent<SVGElement>, wireId: string) => void;
}

export const WireLayer = memo(function WireLayer({
  circuit,
  snapshot,
  selected,
  selectedWireIds,
  highlightedWireIds,
  routes,
  crossovers,
  showWireLabels,
  hiddenWireLabels = new Set(),
  onWireContextMenu,
  onWirePointerDown,
  onWireDoubleClick,
  onWireLabelPointerDown,
  onWireLabelDoubleClick,
  onWireLabelContextMenu,
}: WireLayerProps) {
  const activeHighlightedWireIds = useMemo(() => {
    if (highlightedWireIds) return highlightedWireIds;
    const ids: string[] = [];
    if (selected?.type === "wire") ids.push(selected.id);
    if (selectedWireIds && selectedWireIds.length > 0) {
      for (const id of selectedWireIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    if (ids.length === 0) return new Set<string>();
    return getConnectedWireIds(circuit, ids);
  }, [circuit, selected, selectedWireIds, highlightedWireIds]);

  // Build connectivity graph for collision detection
  // Two wires are electrically connected if they share the same node (terminal or junction)
  const wireConnectivity = useMemo(() => {
    // Map each node to list of wire IDs that connect to it
    const nodeToWires = new Map<string, string[]>();
    
    for (const w of circuit.wires) {
      // Node key format: "port:symbolId:term" for device terminals, 
      // "junction:symbolId" for junction symbols
      const getNodeKey = (ref: { symbolId: string; term: string }) => {
        // Check if this is a junction terminal (all have term="1")
        const sym = circuit.symbols.find(s => s.id === ref.symbolId);
        if (sym && circuit.devices.some(d => d.id === sym.deviceId && d.kind === "junction")) {
          return `junction:${ref.symbolId}`;
        }
        return `port:${ref.symbolId}:${ref.term}`;
      };
      
      const na = getNodeKey(w.a);
      const nb = getNodeKey(w.b);
      
      if (!nodeToWires.has(na)) nodeToWires.set(na, []);
      nodeToWires.get(na)!.push(w.id);
      
      if (!nodeToWires.has(nb)) nodeToWires.set(nb, []);
      nodeToWires.get(nb)!.push(w.id);
    }
    
    return nodeToWires;
  }, [circuit]);

  return (
    <>
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
        const isDirectlySelected =
          (selected?.type === "wire" && selected.id === w.id) ||
          Boolean(selectedWireIds?.includes(w.id));
        const isConnected = activeHighlightedWireIds.has(w.id);
        const isHighlighted = isDirectlySelected || isConnected;
        const stroke = isHighlighted ? "#e6c11e" : color;
        const mid = pts[Math.floor(pts.length / 2)] ?? a;
        const tag = (w.label ?? "").trim();
        const tagPos = tag ? wireLabelPos(pts, 6, circuit) : null;
        return (
          <g
            key={w.id}
            onContextMenu={(e) => onWireContextMenu(e, w.id)}
            onPointerDown={(e) => onWirePointerDown(e, w, pts)}
            onDoubleClick={(e) => onWireDoubleClick?.(e, w)}
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
              className={`wire ${live?.live ? "live" : ""} ${w.broken ? "broken" : ""} ${live?.short ? "short-circuit" : ""}`}
              stroke={stroke}
              style={{ stroke, color }}
              strokeDasharray={w.broken ? "6 5" : undefined}
            />
            {isHighlighted && (
              <path
                d={d}
                className="wire-glow"
                fill="none"
                stroke="#e6c11e"
                strokeWidth={isDirectlySelected ? "6" : "5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isDirectlySelected ? "0.4" : "0.25"}
                pointerEvents="none"
              />
            )}
            {isDirectlySelected && (
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
                  pointerEvents="none"
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
                      pointerEvents="none"
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
            {showWireLabels !== false && tag && tagPos && !hiddenWireLabels.has(w.id) && (() => {
              // Check if wire goes straight through a junction - skip label in that case
              const pts = routes.get(w.id);
              if (!pts) return null;
              
              // Look for junction points on this wire (excluding endpoints)
              let hasStraightThroughJunction = false;
              for (let i = 1; i < pts.length - 1; i++) {
                const p = pts[i];
                for (const sym of circuit.symbols) {
                  const dev = circuit.devices.find(d => d.id === sym.deviceId);
                  if (dev?.kind === "junction") {
                    const juncX = sym.x * GRID;
                    const juncY = sym.y * GRID;
                    // Check if wire passes through this junction
                    if (Math.abs(p.x - juncX) < 0.5 && Math.abs(p.y - juncY) < 0.5) {
                      hasStraightThroughJunction = true;
                      break;
                    }
                  }
                }
                if (hasStraightThroughJunction) break;
              }
              
              // If wire goes straight through a junction, don't show label
              if (hasStraightThroughJunction) return null;
              
              // Optimize: in the 4-grid radius along wire path from a junction, only show one wire number
              
              // Simple approach: check if this wire and another wire share a connection point (junction)
              // and compare their label positions. Only show the nearest one to each junction.
              
              const tagX = tagPos.x;
              const tagY = tagPos.y;
              let showLabel = true;
              
              if (!showLabel) return null;
              
              // Calculate circle radius based on text size
              const textWidth = tag.length * 6.8;
              const padding = 4;
              const radius = Math.max(10, textWidth / 2 + padding);
              
              // Use tagPos as the base position (from wireLabelPos which finds longest segment midpoint)
              // For horizontal wires: y is already offset up by 12 from the wire center
              // For vertical wires: x is already offset right by 12 from the wire center
              let wirePointX = tagPos.x, wirePointY = tagPos.y;
              
              // Check for collisions and determine best offset direction
              let bestOffsetX = 0;
              let bestOffsetY = 0;
                
              // Allow circle to touch the wire (no clearance needed)
              // For horizontal wires: try up then down
              if (tagPos.horizontal) {
                // Try offset above first
                let offsetUpGood = true;
                for (const sym of circuit.symbols) {
                  if (sym.id === w.a.symbolId || sym.id === w.b.symbolId) continue; // Skip connected symbols
                  const dev = circuit.devices.find(d => d.id === sym.deviceId);
                  if (!dev) continue;
                  const v = variantDef(dev.kind, sym.variant);
                  const boxW = v.w * (dev.params?.scale ?? 1);
                  const boxH = v.h * (dev.params?.scale ?? 1);
                  
                  // Check collision with symbol bounds
                  const symX = sym.x * GRID;
                  const symY = sym.y * GRID;
                  const tagYUp = wirePointY - radius;
                  
                  if (wirePointX >= symX - 2 && wirePointX <= symX + boxW * GRID + 2 &&
                      tagYUp >= symY - 2 && tagYUp <= symY + boxH * GRID + 2) {
                    offsetUpGood = false;
                    break;
                  }
                }
                
                if (offsetUpGood) {
                  bestOffsetY = -radius; // Above wire
                } else {
                  bestOffsetY = -radius; // Below wire
                }
              } 
              // For vertical wires: try right then left
              else {
                // Try offset to the right first
                let offsetRightGood = true;
                for (const sym of circuit.symbols) {
                  if (sym.id === w.a.symbolId || sym.id === w.b.symbolId) continue; // Skip connected symbols
                  const dev = circuit.devices.find(d => d.id === sym.deviceId);
                  if (!dev) continue;
                  const v = variantDef(dev.kind, sym.variant);
                  const boxW = v.w * (dev.params?.scale ?? 1);
                  const boxH = v.h * (dev.params?.scale ?? 1);
                  
                  // Check collision with symbol bounds
                  const symX = sym.x * GRID;
                  const symY = sym.y * GRID;
                  const tagXRight = wirePointX + -radius;
                  
                  if (tagXRight >= symX - 2 && tagXRight <= symX + boxW * GRID + 2 &&
                      wirePointY >= symY - 2 && wirePointY <= symY + boxH * GRID + 2) {
                    offsetRightGood = false;
                    break;
                  }
                }
                
                if (offsetRightGood) {
                  bestOffsetX = radius; // Right of wire, touching
                } else {
                  bestOffsetX = -radius; // Left of wire, touching
                }
              }
              
              let finalTagX = wirePointX + bestOffsetX;
              let finalTagY = wirePointY + bestOffsetY;

              // Check for collisions with other wire labels and handle same-number wires
              const labelRadius = radius;
              
              // First, check if there are other wires with the same number that belong to our electrical net
              // Use wireConnectivity graph to find all wires connected to us (including transitive connections)
              const sameNumberConnectedWires = [w];
              
              // Build set of nodes that wire w connects to
              const getNodeKey = (ref: { symbolId: string; term: string }) => {
                const sym = circuit.symbols.find(s => s.id === ref.symbolId);
                if (sym && circuit.devices.some(d => d.id === sym.deviceId && d.kind === "junction")) {
                  return `junction:${ref.symbolId}`;
                }
                return `port:${ref.symbolId}:${ref.term}`;
              };
              const myNodes = new Set([getNodeKey(w.a), getNodeKey(w.b)]);
              
              // Collect all wires electrically connected to any of our nodes (direct + transitive via BFS)
              let visitedWireIds = new Set<string>([w.id]);
              let frontier = [...myNodes];
              
              while (frontier.length > 0) {
                const currentNode = frontier.shift()!;
                const wiresAtNode = wireConnectivity.get(currentNode) || [];
                
                for (const wireId of wiresAtNode) {
                  if (visitedWireIds.has(wireId)) continue;
                  visitedWireIds.add(wireId);
                  
                  const otherWire = circuit.wires.find(ww => ww.id === wireId);
                  if (!otherWire) continue;
                  
                  // Only add wires with the same label
                  const otherLabel = otherWire.label?.trim();
                  if (otherLabel && otherLabel === tag) {
                    sameNumberConnectedWires.push(otherWire);
                    
                    // Add this wire's nodes to frontier for further exploration
                    frontier.push(getNodeKey(otherWire.a));
                    frontier.push(getNodeKey(otherWire.b));
                  }
                }
              }
              
              // If multiple wires share a connection and have the same number,
              // only show the label on the longest one
              if (sameNumberConnectedWires.length > 1) {
                // Calculate max segment length for each wire
                const wireLengths = sameNumberConnectedWires.map(wire => {
                  const pts = routes.get(wire.id);
                  if (!pts || pts.length < 2) return { id: wire.id, maxLength: -Infinity };
                  
                  let maxLength = 0;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
                    if (len > maxLength) maxLength = len;
                  }
                  return { id: wire.id, maxLength };
                });
                
                // Find the maximum length
                const maxLen = Math.max(...wireLengths.map(wl => wl.maxLength));
                
                // Only show label for wires with max length
                const myMaxLength = wireLengths.find(wl => wl.id === w.id)?.maxLength ?? -Infinity;
                if (myMaxLength < maxLen) {
                  return null;
                }
                
                // If multiple wires have the same max length, prefer smaller ID
                const maxLenWires = wireLengths.filter(wl => wl.maxLength === maxLen).map(wl => wl.id);
                if (maxLenWires.length > 1 && !maxLenWires.includes(w.id)) {
                  // This wire has max length but not the smallest ID among them
                  return null;
                }
              }
              
              for (const otherWire of circuit.wires) {
                if (otherWire.id === w.id) continue; // Skip self
                
                const otherLabel = otherWire.label?.trim();
                if (!otherLabel) continue; // No label on this wire
                
                // Get the position of the other label
                const otherPts = routes.get(otherWire.id);
                if (!otherPts) continue;
                
                const otherTagPos = wireLabelPos(otherPts, 6, circuit);
                if (!otherTagPos) continue;
                
                // Calculate the other label's final position (simplified: assume same offset direction)
                const otherTextWidth = otherLabel.length * 6.8;
                const otherPadding = 4;
                const otherRadius = Math.max(10, otherTextWidth / 2 + otherPadding);
                let otherFinalX = otherTagPos.x;
                let otherFinalY = otherTagPos.y;
                
                if (otherTagPos.horizontal) {
                  otherFinalY += (bestOffsetY < 0 ? -labelRadius : labelRadius);
                } else {
                  otherFinalX += (bestOffsetX < 0 ? -labelRadius : labelRadius);
                }
                
                // Check for overlap
                const dx = finalTagX - otherFinalX;
                const dy = finalTagY - otherFinalY;
                const distance = Math.hypot(dx, dy);
                const minDistance = labelRadius + otherRadius + 4; // 4 units clearance
                
                if (distance < minDistance) {
                  // Collision detected - move this label to opposite side
                  if (tagPos.horizontal) {
                    finalTagY = wirePointY - labelRadius; // Flip vertical offset
                  } else {
                    finalTagX = wirePointX - labelRadius; // Flip horizontal offset
                  }
                }
              }

              // Check if this wire label is selected
              const isSelected = (selected?.type === "wire-label" && selected.id === w.id) || 
                                (selected?.type === "wire" && selected.id === w.id);
              
              return (
                <g
                  className="wire-label-group"
                  pointerEvents="all"
                  onPointerDown={(e) => onWireLabelPointerDown?.(e as any, w.id)}
                  onDoubleClick={(e) => onWireLabelDoubleClick?.(e as any, w.id)}
                  onContextMenu={(e) => onWireLabelContextMenu?.(e as any, w.id)}
                >
                  <g className="wire-label" pointerEvents="none">
                    {/* Empty circle outline only - no fill */}
                    <circle
                      cx={finalTagX}
                      cy={finalTagY}
                      r={radius}
                      fill="none"
                      stroke={isSelected ? "#0066cc" : "currentColor"}
                      strokeWidth={isSelected ? 1.5 : 1.2}
                    />
                    <text
                      x={finalTagX}
                      y={finalTagY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {tag}
                    </text>
                  </g>
                </g>
              );
            })()}
          </g>
        );
      })}

      {crossovers.map((c, i) => {
        const w = circuit.wires.find((item) => item.id === c.hopWireId);
        const live = snapshot.wires[c.hopWireId];
        const isDirectlySelected =
          (selected?.type === "wire" && selected.id === c.hopWireId) ||
          Boolean(selectedWireIds?.includes(c.hopWireId));
        const isConnected = activeHighlightedWireIds.has(c.hopWireId);
        const isHighlighted = isDirectlySelected || isConnected;
        const color = w?.broken ? "#c4391d" : live?.kind ? PHASE_COLOR[live.kind] : "#2a2924";
        const stroke = isHighlighted ? "#e6c11e" : color;
        return (
          <path
            key={`hop-${i}`}
            d={hopArcD(c)}
            className={`wire ${live?.live ? "live" : ""} ${live?.short ? "short-circuit" : ""}`}
            stroke={stroke}
            style={{ stroke, color }}
            strokeDasharray={w?.broken ? "6 5" : undefined}
            fill="none"
            pointerEvents="none"
          />
        );
      })}
    </>
  );
});
