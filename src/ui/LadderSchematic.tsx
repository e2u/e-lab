import { useMemo, useRef } from "react";
import { useLab } from "../store";
import { GRID } from "../types";
import { buildLadderDiagram } from "../ladder/ladderLayout";
import {
  LadderCoilGlyph,
  LadderContactGlyph,
  LadderPowerSection,
  LadderTransformerSection,
} from "../ladder/LadderGlyphs";

export function LadderSchematic() {
  const circuit = useLab((s) => s.circuit);
  const snapshot = useLab((s) => s.snapshot);
  const mode = useLab((s) => s.mode);
  const held = useLab((s) => s.held);
  const process = useLab((s) => s.process);
  const zoom = useLab((s) => s.zoom);
  const docName = useLab((s) => s.docName);
  const selected = useLab((s) => s.selected);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const model = useMemo(() => {
    return buildLadderDiagram(circuit, snapshot, held, process, docName);
  }, [circuit, snapshot, held, process, docName]);

  // Selected device ID lookup
  const selectedDeviceId = useMemo(() => {
    if (!selected) return undefined;
    if (selected.type === "symbol") {
      const sym = circuit.symbols.find((s) => s.id === selected.id);
      return sym?.deviceId;
    }
    return undefined;
  }, [selected, circuit.symbols]);

  // Handlers for Selection
  const handleSelectSymbol = (symbolId: string, deviceId: string) => {
    if (mode !== "edit") return;
    const targetSymId =
      symbolId || circuit.symbols.find((s) => s.deviceId === deviceId)?.id;
    if (targetSymId) {
      useLab.getState().select({ type: "symbol", id: targetSymId });
      useLab.getState().setSideOpen(true);
    }
  };

  const handleSelectDevice = (deviceId: string) => {
    if (mode !== "edit") return;
    const targetSym = circuit.symbols.find((s) => s.deviceId === deviceId);
    if (targetSym) {
      useLab.getState().select({ type: "symbol", id: targetSym.id });
      useLab.getState().setSideOpen(true);
    }
  };

  // Dimensions & Layout constants
  const railLeftX = 90;
  const railRightX = 820;
  const rungWidth = railRightX - railLeftX;

  const hasPower = model.powerBranches.length > 0;
  const hasTransformer = Boolean(model.transformerBranch);

  const powerY = 55;
  const powerHeight = 195;

  const transformerY = hasPower ? powerY + powerHeight + 16 : 55;
  const transformerHeight = 125;

  let startY = 60;
  if (hasPower && hasTransformer) {
    startY = transformerY + transformerHeight + 42;
  } else if (hasPower) {
    startY = powerY + powerHeight + 42;
  } else if (hasTransformer) {
    startY = transformerY + transformerHeight + 42;
  }
  const rungHeight = 110;

  const totalHeight = Math.max(750, startY + (model.rungs.length + (mode === "edit" ? 1 : 0)) * rungHeight + 90);
  const totalWidth = 960;

  const leftRailColor = model.isLeftRailLive ? "#f59e0b" : "var(--ladder-wire, #64748b)";
  const rightRailColor = model.isRightRailLive ? "#3b82f6" : "var(--ladder-wire, #64748b)";

  return (
    <div className="paper-wrap ladder-wrap" ref={wrapRef}>
      <div className="schematic-container ladder-container">
        <svg
          ref={svgRef}
          className={`paper ladder-paper ${mode === "run" ? "run" : ""}`}
          width={totalWidth * zoom}
          height={totalHeight * zoom}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          style={{
            backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
          }}
        >
          {/* Header Title Block */}
          <g transform="translate(40, 25)">
            <text
              x="0"
              y="0"
              fontSize="16"
              fontWeight="800"
              letterSpacing="0.08em"
              fill="var(--ladder-header-title, #1e293b)"
            >
              🪜 {model.title} (INDUSTRIAL LADDER DIAGRAM)
            </text>
            <text
              x="0"
              y="18"
              fontSize="11"
              fontWeight="600"
              fill="var(--ladder-text-dim, #64748b)"
            >
              CONTROL RAILS: {model.leftRailLabel} ─── {model.rightRailLabel} | STANDARD NEMA / IEC LADDER LOGIC
            </text>
          </g>

          {/* Left Vertical Power Rail */}
          {model.powerBranches.map((pb, idx) => (
            <LadderPowerSection
              key={pb.id || idx}
              branch={pb}
              x={railLeftX}
              y={powerY}
              width={rungWidth}
              mode={mode}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={handleSelectDevice}
            />
          ))}

          {/* Control Power Transformer Section (Independent Row, if present) */}
          {model.transformerBranch && (
            <LadderTransformerSection
              branch={model.transformerBranch}
              x={railLeftX}
              y={transformerY}
              width={rungWidth}
              mode={mode}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={handleSelectDevice}
            />
          )}

          {/* Left Vertical Power Rail */}
          <g className="ladder-rail-left">
            <line
              x1={railLeftX}
              y1={startY - 20}
              x2={railLeftX}
              y2={startY + Math.max(1, model.rungs.length) * rungHeight - 20}
              stroke={leftRailColor}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Left Rail Label Tag */}
            <rect
              x={railLeftX - 70}
              y={startY - 42}
              width="65"
              height="22"
              rx="4"
              fill={model.isLeftRailLive ? "#fef3c7" : "var(--ladder-paper, #f1f5f9)"}
              stroke={leftRailColor}
              strokeWidth="1.5"
            />
            <text
              x={railLeftX - 37}
              y={startY - 28}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill={model.isLeftRailLive ? "#b45309" : "var(--ladder-ink, #475569)"}
            >
              {model.leftRailLabel.split(" ")[0]} (HOT)
            </text>
          </g>

          {/* Right Vertical Power Rail */}
          <g className="ladder-rail-right">
            <line
              x1={railRightX}
              y1={startY - 20}
              x2={railRightX}
              y2={startY + Math.max(1, model.rungs.length) * rungHeight - 20}
              stroke={rightRailColor}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Right Rail Label Tag */}
            <rect
              x={railRightX + 5}
              y={startY - 42}
              width="68"
              height="22"
              rx="4"
              fill="var(--ladder-paper, #f1f5f9)"
              stroke={rightRailColor}
              strokeWidth="1.5"
            />
            <text
              x={railRightX + 39}
              y={startY - 28}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill="#2563eb"
            >
              {model.rightRailLabel.split(" ")[0]} (COM)
            </text>
          </g>

          {/* Horizontal Rungs */}
          {model.rungs.map((rung, rIdx) => {
            const rungY = startY + rIdx * rungHeight + 25;
            const isRungLive = rung.isEnergized && model.isLeftRailLive;

            // Collect symbol IDs on this rung for deleting the whole rung
            const rungSymIds: string[] = [];
            for (const it of rung.items) {
              if (it.type === "contact" && it.element.symbolId) {
                rungSymIds.push(it.element.symbolId);
              } else if (it.type === "parallel") {
                for (const b of it.group.branches) {
                  for (const c of b.contacts) {
                    if (c.symbolId) rungSymIds.push(c.symbolId);
                  }
                }
              }
            }
            for (const c of rung.coils) {
              if (c.symbolId) rungSymIds.push(c.symbolId);
            }

            // Compute layout positions for items on this rung
            const inputZoneWidth = rungWidth - 160; // Leave 160px for coil on the right
            const itemCount = rung.items.length;
            const colWidth = itemCount > 0 ? inputZoneWidth / itemCount : inputZoneWidth;

            return (
              <g key={rung.id} className={`ladder-rung ${isRungLive ? "live" : ""}`}>
                {/* Rung Number Badge (Left of Left Rail) */}
                <g
                  className="ladder-rung-badge"
                  transform={`translate(${railLeftX - 44}, ${rungY - 13})`}
                >
                  <rect
                    x="0"
                    y="0"
                    width="36"
                    height="26"
                    rx="6"
                    className="ladder-rung-handle-bg"
                    fill="var(--ladder-paper, #ffffff)"
                    stroke="var(--ladder-wire, #94a3b8)"
                    strokeWidth="1.2"
                  />
                  <text
                    x="18"
                    y="17"
                    textAnchor="middle"
                    fontSize="12.5"
                    fontWeight="800"
                    fill="var(--ladder-rung-num, #0f172a)"
                  >
                    {rung.rungNumber}
                  </text>
                </g>

                {/* Rung Title / Comment Banner */}
                {rung.title && (
                  <text
                    x={railLeftX + 15}
                    y={rungY - 32}
                    fontSize="10.5"
                    fontWeight="800"
                    letterSpacing="0.04em"
                    fill="var(--ladder-rung-title, #334155)"
                  >
                    RUNG {rung.rungNumber}: {rung.title}
                  </text>
                )}

                {/* Left Lead connecting from Left Rail */}
                <line
                  x1={railLeftX}
                  y1={rungY}
                  x2={railLeftX + 25}
                  y2={rungY}
                  stroke={model.isLeftRailLive ? "#f59e0b" : "var(--ladder-wire, #64748b)"}
                  strokeWidth="2.5"
                />

                {/* Render Rung Items (Series Contacts or Parallel Blocks) */}
                {rung.items.map((item, iIdx) => {
                  const itemX = railLeftX + 25 + iIdx * colWidth;

                  if (item.type === "contact") {
                    const isSel = Boolean(
                      selected?.type === "symbol" &&
                      (selected.id === item.element.symbolId ||
                        (selectedDeviceId && selectedDeviceId === item.element.deviceId))
                    );

                    return (
                      <LadderContactGlyph
                        key={item.element.id}
                        element={item.element}
                        x={itemX}
                        y={rungY}
                        width={colWidth}
                        isRungLive={model.isLeftRailLive}
                        mode={mode}
                        isSelected={isSel}
                        onSelect={handleSelectSymbol}
                      />
                    );
                  }

                  if (item.type === "parallel") {
                    // Parallel Branch Box (e.g. Start PB || KM1-NO Seal-In)
                    const { branches, isConducting } = item.group;
                    const bCount = branches.length;
                    const branchSpacing = 42;
                    const topY = rungY - ((bCount - 1) * branchSpacing) / 2;

                    return (
                      <g key={item.group.id} className="ladder-parallel-group">
                        {/* Left Vertical Split Bus */}
                        <line
                          x1={itemX}
                          y1={topY}
                          x2={itemX}
                          y2={topY + (bCount - 1) * branchSpacing}
                          stroke={model.isLeftRailLive ? "#f59e0b" : "var(--ladder-wire, #64748b)"}
                          strokeWidth="2.5"
                        />
                        {/* Right Vertical Join Bus */}
                        <line
                          x1={itemX + colWidth}
                          y1={topY}
                          x2={itemX + colWidth}
                          y2={topY + (bCount - 1) * branchSpacing}
                          stroke={isConducting && model.isLeftRailLive ? "#f59e0b" : "var(--ladder-wire, #64748b)"}
                          strokeWidth="2.5"
                        />

                        {/* Each Parallel Branch */}
                        {branches.map((branch, bIdx) => {
                          const bY = topY + bIdx * branchSpacing;
                          const contact = branch.contacts[0];
                          const isSel = Boolean(
                            selected?.type === "symbol" &&
                            contact &&
                            (selected.id === contact.symbolId ||
                              (selectedDeviceId && selectedDeviceId === contact.deviceId))
                          );

                          return (
                            <g key={branch.id}>
                              {contact && (
                                <LadderContactGlyph
                                  element={contact}
                                  x={itemX}
                                  y={bY}
                                  width={colWidth}
                                  isRungLive={model.isLeftRailLive}
                                  mode={mode}
                                  isSelected={isSel}
                                  onSelect={handleSelectSymbol}
                                />
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  }

                  return null;
                })}

                {/* If no contacts on this rung, straight line to coil */}
                {rung.items.length === 0 && (
                  <line
                    x1={railLeftX}
                    y1={rungY}
                    x2={railRightX - 130}
                    y2={rungY}
                    stroke={model.isLeftRailLive ? "#f59e0b" : "var(--ladder-wire, #64748b)"}
                    strokeWidth="2.5"
                  />
                )}

                {/* Right Output Coils */}
                {rung.coils.map((coil) => {
                  const isSel = Boolean(
                    selected?.type === "symbol" &&
                    (selected.id === coil.symbolId ||
                      (selectedDeviceId && selectedDeviceId === coil.deviceId))
                  );

                  return (
                    <LadderCoilGlyph
                      key={coil.id}
                      element={coil}
                      x={railRightX - 130}
                      y={rungY}
                      width={130}
                      isRungLive={isRungLive}
                      mode={mode}
                      isSelected={isSel}
                      onSelect={handleSelectSymbol}
                    />
                  );
                })}

                {/* If no coils on this rung, show open line stub rather than connecting directly to right rail */}
                {rung.coils.length === 0 && (
                  <line
                    x1={railLeftX + 25 + rung.items.length * colWidth}
                    y1={rungY}
                    x2={Math.min(railLeftX + 25 + rung.items.length * colWidth + 60, railRightX - 20)}
                    y2={rungY}
                    stroke="var(--ladder-wire, #64748b)"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                )}
              </g>
            );
          })}

        </svg>
      </div>
    </div>
  );
}
