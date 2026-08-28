import React from "react";
import type { LadderCoilElement, LadderContactElement, LadderPowerBranch, LadderTransformerBranch } from "./ladderTypes";
import { interact } from "../ui/schematic/interact";
import { t } from "../i18n";

interface ContactGlyphProps {
  element: LadderContactElement;
  x: number;
  y: number;
  width?: number;
  isRungLive?: boolean;
  mode?: "edit" | "run";
  isSelected?: boolean;
  onInteract?: (deviceKind: string, deviceId: string, down: boolean) => void;
  onSelect?: (symbolId: string, deviceId: string) => void;
  onToggleVariant?: (symbolId: string) => void;
  onInsertContact?: (symbolId: string) => void;
  onAddParallel?: (symbolId: string) => void;
  onDelete?: (symbolId: string) => void;
}

export function LadderContactGlyph({
  element,
  x,
  y,
  width = 90,
  isRungLive = false,
  mode = "edit",
  isSelected = false,
  onInteract,
  onSelect,
  onToggleVariant,
  onInsertContact,
  onAddParallel,
  onDelete,
}: ContactGlyphProps) {
  const { device, contactType, label, address, isClosed } = element;
  const isInteractive =
    mode === "run" &&
    (device.kind === "pb-no" ||
      device.kind === "pb-nc" ||
      device.kind === "estop" ||
      device.kind === "estop-nc" ||
      device.kind === "toggle" ||
      device.kind.startsWith("toggle-") ||
      device.kind === "selector-2" ||
      device.kind === "selector-3" ||
      device.kind === "limit-no" ||
      device.kind === "limit-nc" ||
      device.kind === "temp-no" ||
      device.kind === "temp-nc" ||
      device.kind === "pressure-no" ||
      device.kind === "pressure-nc" ||
      device.kind === "flow-no" ||
      device.kind === "flow-nc" ||
      device.kind === "float" ||
      device.kind === "foot" ||
      device.kind === "foot-no" ||
      device.kind === "foot-nc" ||
      device.kind === "overload");

  const wireColor = isRungLive ? "#f59e0b" : "var(--ladder-wire, #64748b)";
  const conductingColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : "#ef4444";
  const barColor = isClosed ? (isRungLive ? "#10b981" : "var(--ladder-ink, #1e293b)") : "var(--ladder-ink, #475569)";

  const cx = x + width / 2;
  const halfGap = 9;
  const contactR = 3.5;
  const contactXOffset = 10;

  const isPb = contactType === "pb-no" || contactType === "pb-nc";
  const isEstop = contactType === "estop" || contactType === "estop-no";
  const isLimit = contactType === "limit-no" || contactType === "limit-nc";
  const isToggle = contactType === "toggle" || contactType === "selector";
  const isPressure = contactType === "pressure-no" || contactType === "pressure-nc";
  const isLevel = contactType === "float" || contactType === "float-nc";
  const isTemp = contactType === "temp-no" || contactType === "temp-nc";
  const isFlow = contactType === "flow-no" || contactType === "flow-nc";
  const isFoot = contactType === "foot-no" || contactType === "foot-nc";
  const isTimerContact =
    contactType === "timer-no" ||
    contactType === "timer-nc" ||
    contactType === "timer-contact";

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();
    if (onInteract) {
      onInteract(device.kind, device.id, true);
    } else {
      interact(device.kind, device.id, true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();
    if (onInteract) {
      onInteract(device.kind, device.id, false);
    } else {
      interact(device.kind, device.id, false);
    }
  };

  // Common lead lines & terminal circles
  const renderLeadLinesAndCircles = (activeColor: string) => (
    <>
      {/* Left Lead Line */}
      <line
        x1={x}
        y1={y}
        x2={cx - contactXOffset - contactR}
        y2={y}
        stroke={wireColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Right Lead Line */}
      <line
        x1={cx + contactXOffset + contactR}
        y1={y}
        x2={x + width}
        y2={y}
        stroke={isClosed && isRungLive ? wireColor : "var(--ladder-wire, #64748b)"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Left Terminal Circle */}
      <circle
        cx={cx - contactXOffset}
        cy={y}
        r={contactR}
        fill={isClosed && isRungLive ? "#fef08a" : "var(--ladder-paper, #ffffff)"}
        stroke={activeColor}
        strokeWidth="2"
      />
      {/* Right Terminal Circle */}
      <circle
        cx={cx + contactXOffset}
        cy={y}
        r={contactR}
        fill={isClosed && isRungLive ? "#fef08a" : "var(--ladder-paper, #ffffff)"}
        stroke={activeColor}
        strokeWidth="2"
      />
    </>
  );

  // 1. Pushbutton (NO / NC - NEMA Standard)
  const renderPushButton = () => {
    const isNo = contactType === "pb-no";
    const bridgeY = isNo ? (isClosed ? y - 3.5 : y - 8.5) : (isClosed ? y - 3.5 : y + 8.5);
    const stemTop = isNo ? (isClosed ? y - 14.5 : y - 19.5) : (isClosed ? y - 19.5 : y - 7.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;

    return (
      <g className="ladder-pb-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Horizontal Bridge Bar */}
        <line
          x1={cx - 13}
          y1={bridgeY}
          x2={cx + 13}
          y2={bridgeY}
          stroke={activeColor}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Vertical Plunger Stem */}
        <line
          x1={cx}
          y1={bridgeY}
          x2={cx}
          y2={stemTop}
          stroke={activeColor}
          strokeWidth="2"
        />
        {/* Top Plunger T-Cap */}
        <line
          x1={cx - 6}
          y1={stemTop}
          x2={cx + 6}
          y2={stemTop}
          stroke={activeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    );
  };

  // 2. Palm Button / Emergency Stop (NEMA Standard with Mushroom/Crescent Cap)
  const renderEstop = () => {
    const isNo = contactType === "estop-no";
    const bridgeY = isNo ? (isClosed ? y - 3.5 : y - 8.5) : (isClosed ? y - 3.5 : y + 8.5);
    const stemTop = isNo ? (isClosed ? y - 13.5 : y - 18.5) : (isClosed ? y - 18.5 : y - 6.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;

    return (
      <g className="ladder-estop-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Bridge Bar */}
        <line
          x1={cx - 13}
          y1={bridgeY}
          x2={cx + 13}
          y2={bridgeY}
          stroke={activeColor}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Plunger Stem */}
        <line
          x1={cx}
          y1={bridgeY}
          x2={cx}
          y2={stemTop}
          stroke={activeColor}
          strokeWidth="2"
        />
        {/* Red Mushroom / Crescent Cap */}
        <g transform={`translate(${cx}, ${stemTop})`}>
          <path
            d="M -9 0 C -9 -7, 9 -7, 9 0 Z"
            fill="#dc2626"
            stroke="#b91c1c"
            strokeWidth="1.5"
          />
        </g>
      </g>
    );
  };

  // 3. Pressure Switch (NEMA Standard with Diaphragm Dome Cup)
  const renderPressureSwitch = () => {
    const isNo = contactType === "pressure-no";
    const isActuated = isClosed;
    const bridgeY = isClosed ? y - 3.5 : (isNo ? y - 9 : y - 3.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;
    const cupY = y + 8;

    return (
      <g className="ladder-pressure-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade / bridge */}
        {isNo && !isActuated ? (
          <line
            x1={cx - contactXOffset}
            y1={y - 2}
            x2={cx + contactXOffset + 3}
            y2={y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={cx - 13}
            y1={bridgeY}
            x2={cx + 13}
            y2={bridgeY}
            stroke={activeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}
        {/* Stem down to diaphragm */}
        <line
          x1={cx}
          y1={isNo && !isActuated ? y - 5.5 : bridgeY}
          x2={cx}
          y2={cupY}
          stroke={activeColor}
          strokeWidth="1.8"
        />
        {/* Diaphragm Cup / Dome */}
        <path
          d={`M ${cx - 5.5} ${cupY} C ${cx - 5.5} ${cupY + 5.5}, ${cx + 5.5} ${cupY + 5.5}, ${cx + 5.5} ${cupY} Z`}
          fill={isClosed && isRungLive ? "#fef08a" : "var(--ladder-paper, #ffffff)"}
          stroke={activeColor}
          strokeWidth="1.8"
        />
      </g>
    );
  };

  // 4. Level / Liquid Switch (Float Switch with Circular Ball)
  const renderLevelSwitch = () => {
    const isNo = contactType === "float";
    const isActuated = isClosed;
    const bridgeY = isClosed ? y - 3.5 : (isNo ? y - 9 : y - 3.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;
    const ballCenterY = y + 12;

    return (
      <g className="ladder-level-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade / bridge */}
        {isNo && !isActuated ? (
          <line
            x1={cx - contactXOffset}
            y1={y - 2}
            x2={cx + contactXOffset + 3}
            y2={y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={cx - 13}
            y1={bridgeY}
            x2={cx + 13}
            y2={bridgeY}
            stroke={activeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}
        {/* Stem down to float ball */}
        <line
          x1={cx}
          y1={isNo && !isActuated ? y - 5.5 : bridgeY}
          x2={cx}
          y2={ballCenterY - 4.5}
          stroke={activeColor}
          strokeWidth="1.8"
        />
        {/* Float Ball */}
        <circle
          cx={cx}
          cy={ballCenterY}
          r="4.5"
          fill={isClosed && isRungLive ? "#fef08a" : "var(--ladder-paper, #ffffff)"}
          stroke={activeColor}
          strokeWidth="1.8"
        />
      </g>
    );
  };

  // 5. Temperature Switch (NEMA Standard with Square Bimetal Step)
  const renderTemperatureSwitch = () => {
    const isNo = contactType === "temp-no";
    const isActuated = isClosed;
    const bridgeY = isClosed ? y - 3.5 : (isNo ? y - 9 : y - 3.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;
    const startY = isNo && !isActuated ? y - 5.5 : bridgeY;

    return (
      <g className="ladder-temp-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade / bridge */}
        {isNo && !isActuated ? (
          <line
            x1={cx - contactXOffset}
            y1={y - 2}
            x2={cx + contactXOffset + 3}
            y2={y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={cx - 13}
            y1={bridgeY}
            x2={cx + 13}
            y2={bridgeY}
            stroke={activeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}
        {/* Square Bimetal Step / Zigzag */}
        <path
          d={`M ${cx} ${startY} L ${cx} ${startY + 5} L ${cx + 5} ${startY + 5} L ${cx + 5} ${startY + 10} L ${cx} ${startY + 10} L ${cx} ${startY + 15}`}
          fill="none"
          stroke={activeColor}
          strokeWidth="1.8"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </g>
    );
  };

  // 6. Flow Switch (NEMA Standard with Flag/Paddle)
  const renderFlowSwitch = () => {
    const isNo = contactType === "flow-no";
    const isActuated = isClosed;
    const bridgeY = isClosed ? y - 3.5 : (isNo ? y - 9 : y - 3.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;
    const startY = isNo && !isActuated ? y - 5.5 : bridgeY;

    return (
      <g className="ladder-flow-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade / bridge */}
        {isNo && !isActuated ? (
          <line
            x1={cx - contactXOffset}
            y1={y - 2}
            x2={cx + contactXOffset + 3}
            y2={y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={cx - 13}
            y1={bridgeY}
            x2={cx + 13}
            y2={bridgeY}
            stroke={activeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}
        {/* Paddle Stem & Triangle Flag */}
        <line
          x1={cx}
          y1={startY}
          x2={cx}
          y2={startY + 16}
          stroke={activeColor}
          strokeWidth="1.8"
        />
        <polygon
          points={`${cx},${startY + 6} ${cx + 6},${startY + 10} ${cx},${startY + 14}`}
          fill={activeColor}
        />
      </g>
    );
  };

  // 7. Limit Switch (NEMA Standard with Wedge Triangle)
  const renderLimitSwitch = () => {
    const isNo = contactType === "limit-no";
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;

    return (
      <g className="ladder-limit-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade / arm */}
        {isNo && !isClosed ? (
          <line
            x1={cx - contactXOffset}
            y1={y - 2}
            x2={cx + contactXOffset + 3}
            y2={y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={cx - contactXOffset}
            y1={y}
            x2={cx + (isClosed ? contactXOffset : 8)}
            y2={isClosed ? y : y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )}
        {/* Limit Wedge Triangle pointing up to blade */}
        <polygon
          points={`${cx - 3},${isClosed ? y - 4 : y - 9} ${cx + 3},${isClosed ? y - 4 : y - 9} ${cx},${isClosed ? y - 9 : y - 14}`}
          fill="var(--ladder-ink, #334155)"
        />
      </g>
    );
  };

  // 8. Timing Switch (Timer Delay Contacts with Umbrella Arrow)
  const renderTimerContact = () => {
    const isNo = contactType === "timer-no";
    const isTimingClosed = device.kind === "timer-on"; // On-Delay: Timing Closed
    const isActuated = isClosed;
    const bridgeY = isClosed ? y - 3.5 : (isNo ? y - 9 : y - 3.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;

    return (
      <g className="ladder-timing-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade / bridge */}
        {isNo && !isActuated ? (
          <line
            x1={cx - contactXOffset}
            y1={y - 2}
            x2={cx + contactXOffset + 3}
            y2={y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={cx - 13}
            y1={bridgeY}
            x2={cx + 13}
            y2={bridgeY}
            stroke={activeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}
        {/* Umbrella Damper Arrow */}
        {isTimingClosed ? (
          // Timing Closed: Downward arrow / umbrella ↓
          <g transform={`translate(${cx}, ${bridgeY + 4})`}>
            <line x1="0" y1="0" x2="0" y2="10" stroke={activeColor} strokeWidth="1.8" />
            <path d="M -4 6 L 0 10 L 4 6" fill="none" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M -5 2 C -5 0, 5 0, 5 2" fill="none" stroke={activeColor} strokeWidth="1.8" />
          </g>
        ) : (
          // Timing Open: Upward arrow / umbrella ↑
          <g transform={`translate(${cx}, ${bridgeY - 4})`}>
            <line x1="0" y1="0" x2="0" y2="-10" stroke={activeColor} strokeWidth="1.8" />
            <path d="M -4 -6 L 0 -10 L 4 -6" fill="none" stroke={activeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M -5 -2 C -5 0, 5 0, 5 -2" fill="none" stroke={activeColor} strokeWidth="1.8" />
          </g>
        )}
      </g>
    );
  };

  // 9. Foot Switch
  const renderFootSwitch = () => {
    const isNo = contactType === "foot-no";
    const isActuated = isClosed;
    const bridgeY = isClosed ? y - 3.5 : (isNo ? y - 9 : y - 3.5);
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;
    const startY = isNo && !isActuated ? y - 5.5 : bridgeY;

    return (
      <g className="ladder-foot-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade / bridge */}
        {isNo && !isActuated ? (
          <line
            x1={cx - contactXOffset}
            y1={y - 2}
            x2={cx + contactXOffset + 3}
            y2={y - 9}
            stroke={activeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={cx - 13}
            y1={bridgeY}
            x2={cx + 13}
            y2={bridgeY}
            stroke={activeColor}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        )}
        {/* Foot Pedal Bracket ⎵ */}
        <line x1={cx} y1={startY} x2={cx} y2={startY + 9} stroke={activeColor} strokeWidth="1.8" />
        <path
          d={`M ${cx - 6} ${startY + 9} L ${cx - 6} ${startY + 14} L ${cx + 6} ${startY + 14} L ${cx + 6} ${startY + 9}`}
          fill="none"
          stroke={activeColor}
          strokeWidth="1.8"
        />
      </g>
    );
  };

  // 10. Toggle / Selector Switch
  const renderToggleOrSelector = () => {
    const activeColor = isClosed && isRungLive ? "#10b981" : isClosed ? "#3b82f6" : barColor;

    return (
      <g className="ladder-toggle-symbol">
        {renderLeadLinesAndCircles(activeColor)}
        {/* Switch blade */}
        <line
          x1={cx - contactXOffset}
          y1={y}
          x2={cx + (isClosed ? contactXOffset : 8)}
          y2={isClosed ? y : y - 9}
          stroke={activeColor}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Operator Knob / Lever */}
        {contactType === "selector" ? (
          <path
            d={`M ${cx - 4} ${y - 12} L ${cx} ${y - 6} L ${cx + 4} ${y - 12}`}
            fill="none"
            stroke="var(--ladder-ink, #334155)"
            strokeWidth="1.8"
          />
        ) : (
          <line
            x1={cx}
            y1={isClosed ? y : y - 5}
            x2={cx + 6}
            y2={isClosed ? y - 9 : y - 14}
            stroke="var(--ladder-ink, #334155)"
            strokeWidth="2"
          />
        )}
      </g>
    );
  };

  // 11. Standard Relay / Contactor Auxiliary Contact & Thermal Overload Contact
  const renderRelayContact = () => {
    return (
      <g className="ladder-relay-contact">
        {/* Left Lead Line */}
        <line
          x1={x}
          y1={y}
          x2={cx - halfGap}
          y2={y}
          stroke={wireColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Right Lead Line */}
        <line
          x1={cx + halfGap}
          y1={y}
          x2={x + width}
          y2={y}
          stroke={isClosed && isRungLive ? wireColor : "var(--ladder-wire, #64748b)"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Contact Left Bar | */}
        <line
          x1={cx - halfGap}
          y1={y - 14}
          x2={cx - halfGap}
          y2={y + 14}
          stroke={barColor}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Contact Right Bar | */}
        <line
          x1={cx + halfGap}
          y1={y - 14}
          x2={cx + halfGap}
          y2={y + 14}
          stroke={barColor}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Normally Closed Diagonal Slash / */}
        {(contactType === "nc" || contactType === "overload") && (
          <line
            x1={cx - halfGap - 3}
            y1={y + 16}
            x2={cx + halfGap + 3}
            y2={y - 16}
            stroke={barColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Closed State Indicator Connection */}
        {isClosed && (
          <line
            x1={cx - halfGap}
            y1={y}
            x2={cx + halfGap}
            y2={y}
            stroke={conductingColor}
            strokeWidth="2.8"
            strokeDasharray="2 1"
          />
        )}

        {/* Thermal Overload O.L. Text & S-curves */}
        {contactType === "overload" && (
          <g transform={`translate(${cx}, ${y + 20})`}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#dc2626"
            >
              O.L.
            </text>
          </g>
        )}
      </g>
    );
  };

  const tagY = isPb || isEstop ? y - 24 : isPressure || isLevel || isTemp || isFlow ? y - 22 : isLimit || isToggle ? y - 22 : y - 20;

  const handleClick = (e: React.MouseEvent) => {
    if (mode === "edit") {
      e.stopPropagation();
      onSelect?.(element.symbolId || "", element.deviceId);
    }
  };

  return (
    <g
      className={`ladder-contact ${isInteractive ? "interactive" : ""} ${isSelected ? "selected" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      style={{ cursor: mode === "edit" || isInteractive ? "pointer" : "default" }}
    >
      {/* Selection Halo in Edit Mode */}
      {isSelected && mode === "edit" && (
        <rect
          x={cx - 28}
          y={y - 28}
          width={56}
          height={56}
          rx={6}
          fill="rgba(245, 158, 11, 0.12)"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
      )}

      {/* Quick Action Floating Bar above Contact in Edit Mode when selected */}
      {isSelected && mode === "edit" && (
        <g className="ladder-quick-actions" transform={`translate(${cx}, ${y - 48})`}>
          <rect
            x="-56"
            y="-12"
            width="112"
            height="24"
            rx="12"
            fill="#0f172a"
            stroke="#f59e0b"
            strokeWidth="1.5"
            filter="drop-shadow(0 2px 8px rgba(0,0,0,0.4))"
          />
          {/* Toggle NO/NC */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVariant?.(element.symbolId || "");
            }}
          >
            <title>{t("ladder.toggleVariant")}</title>
            <circle cx="-38" cy="0" r="8.5" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
            <text x="-38" y="3.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#f59e0b">
              ⇄
            </text>
          </g>
          {/* Add Parallel Branch */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onAddParallel?.(element.symbolId || "");
            }}
          >
            <title>{t("ladder.addParallel")}</title>
            <circle cx="-13" cy="0" r="8.5" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
            <text x="-13" y="3.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#10b981">
              ⤹
            </text>
          </g>
          {/* Insert Contact */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onInsertContact?.(element.symbolId || "");
            }}
          >
            <title>{t("ladder.insertContact")}</title>
            <circle cx="12" cy="0" r="8.5" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
            <text x="12" y="3.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#3b82f6">
              ➕
            </text>
          </g>
          {/* Delete Element */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(element.symbolId || "");
            }}
          >
            <title>{t("ladder.deleteContact")}</title>
            <circle cx="37" cy="0" r="8.5" fill="#1e293b" stroke="#ef4444" strokeWidth="1" />
            <text x="37" y="3.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#ef4444">
              🗑
            </text>
          </g>
        </g>
      )}

      {/* Invisible hit area for easier clicking on mobile/touch */}
      {(mode === "edit" || isInteractive) && (
        <rect
          x={x}
          y={y - 25}
          width={width}
          height={50}
          fill="transparent"
        />
      )}

      {/* Render Specific Contact Type Symbol */}
      {isPb
        ? renderPushButton()
        : isEstop
        ? renderEstop()
        : isPressure
        ? renderPressureSwitch()
        : isLevel
        ? renderLevelSwitch()
        : isTemp
        ? renderTemperatureSwitch()
        : isFlow
        ? renderFlowSwitch()
        : isLimit
        ? renderLimitSwitch()
        : isTimerContact
        ? renderTimerContact()
        : isFoot
        ? renderFootSwitch()
        : isToggle
        ? renderToggleOrSelector()
        : renderRelayContact()}

      {/* Device Label / Tag */}
      <text
        x={cx}
        y={tagY}
        textAnchor="middle"
        fontSize="11.5"
        fontWeight={isSelected ? "800" : "700"}
        fill={isSelected ? "#b45309" : "var(--ladder-tag, #0f172a)"}
      >
        {label}
      </text>

      {/* Address / Terminal info */}
      {address && (
        <text
          x={cx}
          y={y + 26}
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="500"
          fill="var(--ladder-text-dim, #64748b)"
        >
          {address}
        </text>
      )}
    </g>
  );
}

interface CoilGlyphProps {
  element: LadderCoilElement;
  x: number;
  y: number;
  width?: number;
  isRungLive?: boolean;
  mode?: "edit" | "run";
  isSelected?: boolean;
  onSelect?: (symbolId: string, deviceId: string) => void;
  onDelete?: (symbolId: string) => void;
}

export function LadderCoilGlyph({
  element,
  x,
  y,
  width = 110,
  isRungLive = false,
  mode = "edit",
  isSelected = false,
  onSelect,
  onDelete,
}: CoilGlyphProps) {
  const { label, address, isClosed, coilType, crossRefs, device } = element;
  const isEnergized = isClosed || isRungLive;

  const wireColor = isRungLive ? "#f59e0b" : "var(--ladder-wire, #64748b)";
  const coilColor = isEnergized ? "#10b981" : "var(--ladder-ink, #1e293b)";
  const coilFill = isEnergized ? "rgba(16, 185, 129, 0.15)" : "transparent";
  const glowShadow = isEnergized ? "drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))" : "none";

  const cx = x + width / 2;
  const r = 18;

  // Lamp color letter and hue resolution from device params / tag
  const rawColor = (device?.params?.color || "").toLowerCase().trim();
  const LAMP_MAP: Record<string, { letter: string; color: string; contrastText: string }> = {
    red: { letter: "R", color: "#ef4444", contrastText: "#ffffff" },
    green: { letter: "G", color: "#22c55e", contrastText: "#ffffff" },
    yellow: { letter: "Y", color: "#eab308", contrastText: "#0f172a" },
    amber: { letter: "A", color: "#f59e0b", contrastText: "#0f172a" },
    blue: { letter: "B", color: "#3b82f6", contrastText: "#ffffff" },
    white: { letter: "W", color: "#f8fafc", contrastText: "#0f172a" },
    orange: { letter: "O", color: "#ea580c", contrastText: "#ffffff" },
  };

  let lampLetter = "G";
  let lampColor = "#22c55e";

  if (rawColor && LAMP_MAP[rawColor]) {
    lampLetter = LAMP_MAP[rawColor].letter;
    lampColor = LAMP_MAP[rawColor].color;
  } else if (rawColor.includes("red")) {
    lampLetter = "R";
    lampColor = "#ef4444";
  } else if (rawColor.includes("green")) {
    lampLetter = "G";
    lampColor = "#22c55e";
  } else if (rawColor.includes("yellow")) {
    lampLetter = "Y";
    lampColor = "#eab308";
  } else if (rawColor.includes("amber")) {
    lampLetter = "A";
    lampColor = "#f59e0b";
  } else if (rawColor.includes("blue")) {
    lampLetter = "B";
    lampColor = "#3b82f6";
  } else if (rawColor.includes("white")) {
    lampLetter = "W";
    lampColor = "#f8fafc";
  } else if (rawColor.includes("orange")) {
    lampLetter = "O";
    lampColor = "#ea580c";
  } else {
    // Check if tag contains specific color name (e.g., HL_RED, HR_GREEN)
    const tagLower = (device?.tag || "").toLowerCase();
    if (tagLower.includes("red")) {
      lampLetter = "R";
      lampColor = "#ef4444";
    } else if (tagLower.includes("green")) {
      lampLetter = "G";
      lampColor = "#22c55e";
    } else if (tagLower.includes("yellow") || tagLower.includes("amber")) {
      lampLetter = "Y";
      lampColor = "#eab308";
    } else if (tagLower.includes("blue")) {
      lampLetter = "B";
      lampColor = "#3b82f6";
    } else if (tagLower.includes("white")) {
      lampLetter = "W";
      lampColor = "#f8fafc";
    } else if (tagLower.includes("orange")) {
      lampLetter = "O";
      lampColor = "#ea580c";
    } else {
      // Default to green in e-lab
      lampLetter = "G";
      lampColor = "#22c55e";
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (mode === "edit") {
      e.stopPropagation();
      onSelect?.(element.symbolId || "", element.deviceId);
    }
  };

  return (
    <g
      className={`ladder-coil ${isSelected ? "selected" : ""}`}
      style={{ filter: glowShadow, cursor: mode === "edit" ? "pointer" : "default" }}
      onClick={handleClick}
    >
      {/* Selection Halo in Edit Mode */}
      {isSelected && mode === "edit" && (
        <rect
          x={cx - 26}
          y={y - 26}
          width={52}
          height={52}
          rx={8}
          fill="rgba(245, 158, 11, 0.12)"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
      )}

      {/* Quick Action Floating Bar for Coil */}
      {isSelected && mode === "edit" && (
        <g className="ladder-quick-actions" transform={`translate(${cx}, ${y - 40})`}>
          <rect
            x="-20"
            y="-10"
            width="40"
            height="20"
            rx="10"
            fill="#0f172a"
            stroke="#f59e0b"
            strokeWidth="1.5"
            filter="drop-shadow(0 2px 8px rgba(0,0,0,0.4))"
          />
          {/* Delete Button */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(element.symbolId || "");
            }}
          >
            <title>{t("ladder.deleteCoil")}</title>
            <circle cx="0" cy="0" r="7.5" fill="#1e293b" stroke="#ef4444" strokeWidth="1" />
            <text x="0" y="3.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#ef4444">
              🗑
            </text>
          </g>
        </g>
      )}

      {/* Left Infeed Line */}
      <line
        x1={x}
        y1={y}
        x2={cx - r}
        y2={y}
        stroke={wireColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Right Outfeed Line to Right Rail */}
      <line
        x1={cx + r}
        y1={y}
        x2={x + width}
        y2={y}
        stroke="var(--ladder-wire, #64748b)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Coil Representation based on CoilType */}
      {coilType === "lamp" ? (
        // Indicating Lamp: Circle with 4 diagonal rays pointing outward & color letter
        <g transform={`translate(${cx}, ${y})`}>
          {/* 4 Diagonal rays projecting outward (45°, 135°, 225°, 315°) */}
          <line x1={-r - 5} y1={-r - 5} x2={-r} y2={-r} stroke={isEnergized ? lampColor : coilColor} strokeWidth="2.2" strokeLinecap="round" />
          <line x1={r} y1={-r} x2={r + 5} y2={-r - 5} stroke={isEnergized ? lampColor : coilColor} strokeWidth="2.2" strokeLinecap="round" />
          <line x1={-r - 5} y1={r + 5} x2={-r} y2={r} stroke={isEnergized ? lampColor : coilColor} strokeWidth="2.2" strokeLinecap="round" />
          <line x1={r} y1={r} x2={r + 5} y2={r + 5} stroke={isEnergized ? lampColor : coilColor} strokeWidth="2.2" strokeLinecap="round" />

          <circle
            cx="0"
            cy="0"
            r={r}
            fill={isEnergized ? lampColor : "var(--ladder-paper, #ffffff)"}
            stroke={isEnergized ? lampColor : coilColor}
            strokeWidth="2.4"
          />
          <text
            x="0"
            y="4.5"
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill={isEnergized ? (lampLetter === "W" || lampLetter === "A" ? "#0f172a" : "#ffffff") : "var(--ladder-ink, #1e293b)"}
          >
            {lampLetter}
          </text>
        </g>
      ) : coilType === "solenoid" ? (
        // Solenoid Valve -( ⧓ )-
        <g transform={`translate(${cx}, ${y})`}>
          <circle
            cx="0"
            cy="0"
            r={r}
            fill={coilFill}
            stroke={coilColor}
            strokeWidth="2.4"
          />
          {/* Opposing valve triangles */}
          <polygon
            points={`-8,-6 -8,6 0,0`}
            fill={isEnergized ? "#10b981" : "none"}
            stroke={coilColor}
            strokeWidth="1.8"
          />
          <polygon
            points={`8,-6 8,6 0,0`}
            fill={isEnergized ? "#10b981" : "none"}
            stroke={coilColor}
            strokeWidth="1.8"
          />
        </g>
      ) : coilType === "heater" ? (
        // Electric Heater -( ∿ )-
        <g transform={`translate(${cx}, ${y})`}>
          <circle
            cx="0"
            cy="0"
            r={r}
            fill={isEnergized ? "rgba(239, 68, 68, 0.15)" : "transparent"}
            stroke={isEnergized ? "#ef4444" : coilColor}
            strokeWidth="2.4"
          />
          <path
            d="M -10 0 L -6 -5 L -2 5 L 2 -5 L 6 5 L 10 0"
            fill="none"
            stroke={isEnergized ? "#ef4444" : coilColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ) : coilType === "alarm" || coilType === "horn" ? (
        // Alarm / Horn Loudspeaker
        <g transform={`translate(${cx}, ${y})`}>
          <circle
            cx="0"
            cy="0"
            r={r}
            fill={isEnergized ? "rgba(234, 88, 12, 0.15)" : "transparent"}
            stroke={isEnergized ? "#ea580c" : coilColor}
            strokeWidth="2.4"
          />
          <polygon
            points={`-6,-4 -2,-4 3,-7 3,7 -2,4 -6,4`}
            fill={isEnergized ? "#ea580c" : "none"}
            stroke={isEnergized ? "#ea580c" : coilColor}
            strokeWidth="1.5"
          />
        </g>
      ) : coilType === "timer-on" || coilType === "timer-off" || coilType === "counter" ? (
        // Timer / Counter Block
        <g transform={`translate(${cx - 24}, ${y - 18})`}>
          <rect
            x="0"
            y="0"
            width="48"
            height="36"
            rx="4"
            fill={isEnergized ? "rgba(59, 130, 246, 0.15)" : "var(--ladder-paper, #ffffff)"}
            stroke={isEnergized ? "#3b82f6" : coilColor}
            strokeWidth="2.2"
          />
          <text
            x="24"
            y="15"
            textAnchor="middle"
            fontSize="9"
            fontWeight="800"
            fill={isEnergized ? "#2563eb" : "var(--ladder-ink, #1e293b)"}
          >
            {coilType === "timer-on" ? "TON" : coilType === "timer-off" ? "TOF" : "CTU"}
          </text>
          <text
            x="24"
            y="28"
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="600"
            fill="var(--ladder-text-dim, #64748b)"
          >
            {label}
          </text>
        </g>
      ) : (
        // Standard Industrial Relay / Contactor Coil -( KM1 )-
        <g transform={`translate(${cx}, ${y})`}>
          <circle
            cx="0"
            cy="0"
            r={r}
            fill={coilFill}
            stroke={coilColor}
            strokeWidth="2.4"
          />
          {/* Semicircle bracket cues */}
          <path
            d={`M ${-r + 4} ${-r + 6} A ${r} ${r} 0 0 0 ${-r + 4} ${r - 6}`}
            fill="none"
            stroke={coilColor}
            strokeWidth="2"
          />
          <path
            d={`M ${r - 4} ${-r + 6} A ${r} ${r} 0 0 1 ${r - 4} ${r - 6}`}
            fill="none"
            stroke={coilColor}
            strokeWidth="2"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="800"
            fill={isEnergized ? "#059669" : "var(--ladder-ink, #1e293b)"}
          >
            {label}
          </text>
        </g>
      )}

      {/* Address (A1-A2) */}
      {address && (
        <text
          x={cx}
          y={y + 26}
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="500"
          fill="var(--ladder-text-dim, #64748b)"
        >
          {address}
        </text>
      )}

      {/* Cross-References (e.g. used on Rung 1, Rung 2) */}
      {crossRefs && crossRefs.length > 0 && (
        <text
          x={x + width + 8}
          y={y + 4}
          fontSize="9"
          fontWeight="500"
          fill="var(--ladder-cross-ref, #3b82f6)"
        >
          {crossRefs.join(", ")}
        </text>
      )}
    </g>
  );
}

interface PowerSectionProps {
  branch: LadderPowerBranch;
  x: number;
  y: number;
  width: number;
  mode?: "edit" | "run";
  selectedDeviceId?: string;
  onSelectDevice?: (deviceId: string) => void;
}

export function LadderPowerSection({
  branch,
  x,
  y,
  width,
  mode = "edit",
  selectedDeviceId,
  onSelectDevice,
}: PowerSectionProps) {
  const {
    title,
    disconnect,
    breaker,
    fuses,
    contactor,
    overload,
    motor,
    isRunning,
    isEnergized,
    voltage = 480,
    power = 5.5,
    speedRpm,
  } = branch;

  const handleDisconnectToggle = (e: React.MouseEvent) => {
    if (mode !== "run" || !disconnect) return;
    e.stopPropagation();
    interact(disconnect.kind, disconnect.id, true);
  };

  const handleBreakerToggle = (e: React.MouseEvent) => {
    if (mode !== "run" || !breaker) return;
    e.stopPropagation();
    interact(breaker.kind, breaker.id, true);
  };

  const handleOverloadToggle = (e: React.MouseEvent) => {
    if (mode !== "run" || !overload) return;
    e.stopPropagation();
    interact(overload.kind, overload.id, true);
  };

  const lineSpacing = 28;
  const busY1 = y + 62; // L1 (y + 62 = 117)
  const busY2 = busY1 + lineSpacing; // L2 (y + 90 = 145)
  const busY3 = busY2 + lineSpacing; // L3 (y + 118 = 173)
  const busY4 = busY3 + 26; // PE (y + 144 = 199)

  const motorCx = x + width - 90;
  const motorCy = busY2;

  const isLive = isEnergized || isRunning;
  const busColor1 = isLive ? "#dc2626" : "var(--ladder-wire, #64748b)"; // L1 Red
  const busColor2 = isLive ? "#ca8a04" : "var(--ladder-wire, #64748b)"; // L2 Yellow/Amber
  const busColor3 = isLive ? "#2563eb" : "var(--ladder-wire, #64748b)"; // L3 Blue

  // Determine component positions
  const hasDisconnect = Boolean(disconnect);
  const hasBreaker = Boolean(breaker);
  const hasFuses = Boolean(fuses);

  let disconnectX = x + 95;
  let breakerX = hasDisconnect ? x + 205 : x + 105;
  let fusesX = hasDisconnect && hasBreaker ? x + 315 : hasDisconnect || hasBreaker ? x + 215 : x + 115;
  let contactorX = hasFuses ? fusesX + 115 : hasDisconnect && hasBreaker ? x + 325 : hasDisconnect || hasBreaker ? x + 225 : x + 125;
  let overloadX = contactorX + 115;

  if (overloadX + 70 > motorCx - 40) {
    // Compress spacing if items get close to motor
    const available = (motorCx - 55) - (x + 85);
    const count = (hasDisconnect ? 1 : 0) + (hasBreaker ? 1 : 0) + (hasFuses ? 1 : 0) + 2; // contactor + overload
    const step = available / Math.max(3, count);
    let curX = x + 85;
    if (hasDisconnect) { disconnectX = curX; curX += step; }
    if (hasBreaker) { breakerX = curX; curX += step; }
    if (hasFuses) { fusesX = curX; curX += step; }
    contactorX = curX; curX += step;
    overloadX = curX;
  }

  const isContactorClosed = isRunning || isEnergized;

  return (
    <g className="ladder-power-section">
      {/* Power Section Header Container */}
      <rect
        x={x}
        y={y}
        width={width}
        height={195}
        rx="8"
        fill="var(--ladder-power-bg, rgba(59, 130, 246, 0.03))"
        stroke="var(--ladder-power-border, #cbd5e1)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />

      {/* Section Title */}
      <text
        x={x + 14}
        y={y + 22}
        fontSize="12.5"
        fontWeight="800"
        letterSpacing="0.05em"
        fill="var(--ladder-power-title, #1e40af)"
      >
        ⚡ {title} [{voltage}V 3-PHASE AC / {power}kW ({Math.round(power * 1.341)} HP)]
      </text>

      {/* 3-Phase Main Power Lines (L1, L2, L3) */}
      <g className="ladder-power-bus">
        {/* L1 */}
        <rect x={x + 10} y={busY1 - 10} width="22" height="18" rx="3" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" />
        <text x={x + 21} y={busY1 + 3.5} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#dc2626">L1</text>
        <line x1={x + 35} y1={busY1} x2={motorCx - 32} y2={busY1} stroke={busColor1} strokeWidth="2.8" />

        {/* L2 */}
        <rect x={x + 10} y={busY2 - 10} width="22" height="18" rx="3" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1" />
        <text x={x + 21} y={busY2 + 3.5} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#ca8a04">L2</text>
        <line x1={x + 35} y1={busY2} x2={motorCx - 32} y2={busY2} stroke={busColor2} strokeWidth="2.8" />

        {/* L3 */}
        <rect x={x + 10} y={busY3 - 10} width="22" height="18" rx="3" fill="#dbeafe" stroke="#2563eb" strokeWidth="1" />
        <text x={x + 21} y={busY3 + 3.5} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#2563eb">L3</text>
        <line x1={x + 35} y1={busY3} x2={motorCx - 32} y2={busY3} stroke={busColor3} strokeWidth="2.8" />

        {/* PE / Earth Ground Bus */}
        <rect x={x + 10} y={busY4 - 9} width="22" height="16" rx="3" fill="#f1f5f9" stroke="#64748b" strokeWidth="1" />
        <text x={x + 21} y={busY4 + 3} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#475569">PE</text>
        <line x1={x + 35} y1={busY4} x2={motorCx} y2={busY4} stroke="#10b981" strokeWidth="1.8" strokeDasharray="6 3" />
      </g>

      {/* 1. Main Disconnect / Isolator Switch (if present) */}
      {disconnect && (
        <g
          transform={`translate(${disconnectX}, ${busY1})`}
          onClick={(e) => {
            if (mode === "edit") {
              e.stopPropagation();
              onSelectDevice?.(disconnect.id);
            } else {
              handleDisconnectToggle(e);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {/* Selection Halo in Edit Mode */}
          {mode === "edit" && selectedDeviceId === disconnect.id && (
            <rect
              x="-8"
              y="-28"
              width="40"
              height={lineSpacing * 2 + 40}
              rx="6"
              fill="rgba(245, 158, 11, 0.12)"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* L1 Knife Switch */}
          <circle cx="0" cy="0" r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <line x1="0" y1="0" x2="18" y2="-10" stroke="var(--ladder-ink, #334155)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="24" cy="0" r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />

          {/* L2 Knife Switch */}
          <circle cx="0" cy={lineSpacing} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <line x1="0" y1={lineSpacing} x2="18" y2={lineSpacing - 10} stroke="var(--ladder-ink, #334155)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="24" cy={lineSpacing} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />

          {/* L3 Knife Switch */}
          <circle cx="0" cy={lineSpacing * 2} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <line x1="0" y1={lineSpacing * 2} x2="18" y2={lineSpacing * 2 - 10} stroke="var(--ladder-ink, #334155)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="24" cy={lineSpacing * 2} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />

          {/* Mechanical Tie-Bar with Handle */}
          <line x1="9" y1="-12" x2="9" y2={lineSpacing * 2} stroke="#3b82f6" strokeWidth="1.6" strokeDasharray="3 2" />
          <rect x="5" y="-17" width="8" height="6" rx="1.5" fill="#3b82f6" />

          {/* Tag */}
          <text
            x="12"
            y="-14"
            textAnchor="middle"
            fontSize="10"
            fontWeight={mode === "edit" && selectedDeviceId === disconnect.id ? "800" : "700"}
            fill={mode === "edit" && selectedDeviceId === disconnect.id ? "#b45309" : "var(--ladder-tag, #0f172a)"}
          >
            {disconnect.tag && disconnect.tag.length > 14 ? "Disconnect" : disconnect.tag || "Disconnect"}
          </text>
        </g>
      )}

      {/* 2. Main 3-Pole Thermal-Magnetic Circuit Breaker (if present) */}
      {breaker && (
        <g
          transform={`translate(${breakerX}, ${busY1})`}
          onClick={(e) => {
            if (mode === "edit") {
              e.stopPropagation();
              onSelectDevice?.(breaker.id);
            } else {
              handleBreakerToggle(e);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {/* Selection Halo in Edit Mode */}
          {mode === "edit" && selectedDeviceId === breaker.id && (
            <rect
              x="-8"
              y="-28"
              width="62"
              height={lineSpacing * 2 + 40}
              rx="6"
              fill="rgba(245, 158, 11, 0.12)"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* L1 Breaker Contact + Thermal Curve + Magnetic Notch */}
          <circle cx="0" cy="0" r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <line x1="0" y1="0" x2="16" y2="-9" stroke="var(--ladder-ink, #334155)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="22" cy="0" r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          {/* Thermal S-curve */}
          <path d="M 24 0 C 28 -7, 32 -7, 36 0" fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.2" strokeLinecap="round" />
          {/* Magnetic step */}
          <path d="M 38 0 L 42 -7 L 46 0" fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.2" strokeLinejoin="miter" strokeLinecap="round" />

          {/* L2 Breaker */}
          <circle cx="0" cy={lineSpacing} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <line x1="0" y1={lineSpacing} x2="16" y2={lineSpacing - 9} stroke="var(--ladder-ink, #334155)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="22" cy={lineSpacing} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <path d={`M 24 ${lineSpacing} C 28 ${lineSpacing - 7}, 32 ${lineSpacing - 7}, 36 ${lineSpacing}`} fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.2" strokeLinecap="round" />
          <path d={`M 38 ${lineSpacing} L 42 ${lineSpacing - 7} L 46 ${lineSpacing}`} fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.2" strokeLinejoin="miter" strokeLinecap="round" />

          {/* L3 Breaker */}
          <circle cx="0" cy={lineSpacing * 2} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <line x1="0" y1={lineSpacing * 2} x2="16" y2={lineSpacing * 2 - 9} stroke="var(--ladder-ink, #334155)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="22" cy={lineSpacing * 2} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
          <path d={`M 24 ${lineSpacing * 2} C 28 ${lineSpacing * 2 - 7}, 32 ${lineSpacing * 2 - 7}, 36 ${lineSpacing * 2}`} fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.2" strokeLinecap="round" />
          <path d={`M 38 ${lineSpacing * 2} L 42 ${lineSpacing * 2 - 7} L 46 ${lineSpacing * 2}`} fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.2" strokeLinejoin="miter" strokeLinecap="round" />

          {/* Mechanical Tie-Bar */}
          <line x1="8" y1="-12" x2="8" y2={lineSpacing * 2} stroke="#3b82f6" strokeWidth="1.6" strokeDasharray="3 2" />

          {/* Tag */}
          <text
            x="23"
            y="-14"
            textAnchor="middle"
            fontSize="10"
            fontWeight={mode === "edit" && selectedDeviceId === breaker.id ? "800" : "700"}
            fill={mode === "edit" && selectedDeviceId === breaker.id ? "#b45309" : "var(--ladder-tag, #0f172a)"}
          >
            {breaker.tag && breaker.tag.length > 14 ? "CB1" : breaker.tag || "CB1"}
          </text>
        </g>
      )}

      {/* 3. 3-Phase Fuses (if present) */}
      {fuses && (
        <g
          transform={`translate(${fusesX}, ${busY1})`}
          onClick={(e) => {
            if (mode === "edit") {
              e.stopPropagation();
              onSelectDevice?.(fuses.id);
            }
          }}
          style={{ cursor: mode === "edit" ? "pointer" : "default" }}
        >
          {/* Selection Halo in Edit Mode */}
          {mode === "edit" && selectedDeviceId === fuses.id && (
            <rect
              x="-6"
              y="-26"
              width="34"
              height={lineSpacing * 2 + 38}
              rx="6"
              fill="rgba(245, 158, 11, 0.12)"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          <rect x="0" y="-6" width="22" height="12" rx="2" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="1.8" />
          <line x1="11" y1="-6" x2="11" y2="6" stroke="var(--ladder-ink, #334155)" strokeWidth="1.5" />

          <rect x="0" y={lineSpacing - 6} width="22" height="12" rx="2" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="1.8" />
          <line x1="11" y1={lineSpacing - 6} x2="11" y2={lineSpacing + 6} stroke="var(--ladder-ink, #334155)" strokeWidth="1.5" />

          <rect x="0" y={lineSpacing * 2 - 6} width="22" height="12" rx="2" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="1.8" />
          <line x1="11" y1={lineSpacing * 2 - 6} x2="11" y2={lineSpacing * 2 + 6} stroke="var(--ladder-ink, #334155)" strokeWidth="1.5" />

          <text
            x="11"
            y="-14"
            textAnchor="middle"
            fontSize="10"
            fontWeight={mode === "edit" && selectedDeviceId === fuses.id ? "800" : "700"}
            fill={mode === "edit" && selectedDeviceId === fuses.id ? "#b45309" : "var(--ladder-tag, #0f172a)"}
          >
            {fuses.tag || "FU1"}
          </text>
        </g>
      )}

      {/* 4. Contactor Main Contacts (3-Pole) */}
      <g
        transform={`translate(${contactorX}, ${busY1})`}
        onClick={(e) => {
          if (mode === "edit" && contactor) {
            e.stopPropagation();
            onSelectDevice?.(contactor.id);
          }
        }}
        style={{ cursor: mode === "edit" ? "pointer" : "default" }}
      >
        {/* Selection Halo in Edit Mode */}
        {mode === "edit" && contactor && selectedDeviceId === contactor.id && (
          <rect
            x="-8"
            y="-28"
            width="38"
            height={lineSpacing * 2 + 40}
            rx="6"
            fill="rgba(245, 158, 11, 0.12)"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* L1 Contact */}
        <circle cx="0" cy="0" r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
        <line
          x1="0"
          y1="0"
          x2={isContactorClosed ? "22" : "16"}
          y2={isContactorClosed ? "0" : "-9"}
          stroke={isContactorClosed ? "#10b981" : "var(--ladder-ink, #334155)"}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="22" cy="0" r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />

        {/* L2 Contact */}
        <circle cx="0" cy={lineSpacing} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
        <line
          x1="0"
          y1={lineSpacing}
          x2={isContactorClosed ? "22" : "16"}
          y2={isContactorClosed ? lineSpacing : lineSpacing - 9}
          stroke={isContactorClosed ? "#10b981" : "var(--ladder-ink, #334155)"}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="22" cy={lineSpacing} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />

        {/* L3 Contact */}
        <circle cx="0" cy={lineSpacing * 2} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
        <line
          x1="0"
          y1={lineSpacing * 2}
          x2={isContactorClosed ? "22" : "16"}
          y2={isContactorClosed ? lineSpacing * 2 : lineSpacing * 2 - 9}
          stroke={isContactorClosed ? "#10b981" : "var(--ladder-ink, #334155)"}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="22" cy={lineSpacing * 2} r="3.5" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />

        {/* Mechanical Tie-Bar */}
        <line x1="8" y1="-12" x2="8" y2={lineSpacing * 2} stroke="#3b82f6" strokeWidth="1.6" strokeDasharray="3 2" />

        {/* Tag */}
        <text
          x="11"
          y="-14"
          textAnchor="middle"
          fontSize="10.5"
          fontWeight={mode === "edit" && contactor && selectedDeviceId === contactor.id ? "800" : "700"}
          fill={mode === "edit" && contactor && selectedDeviceId === contactor.id ? "#b45309" : "var(--ladder-tag, #0f172a)"}
        >
          {contactor?.tag || "KM1"} (Main)
        </text>
      </g>

      {/* 6. Thermal Overload Relay Element (NEMA Large Interlocking S-curves) */}
      <g
        transform={`translate(${overloadX}, ${busY1})`}
        onClick={(e) => {
          if (mode === "edit" && overload) {
            e.stopPropagation();
            onSelectDevice?.(overload.id);
          } else {
            handleOverloadToggle(e);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        {/* Selection Halo in Edit Mode */}
        {mode === "edit" && overload && selectedDeviceId === overload.id && (
          <rect
            x="-8"
            y="-28"
            width="52"
            height={lineSpacing * 2 + 58}
            rx="6"
            fill="rgba(245, 158, 11, 0.12)"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* L1 Overload Interlocking S-curves */}
        <path d="M 0 0 C 6 -8, 12 -8, 18 0 C 24 8, 30 8, 36 0" fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 9 0 C 15 8, 21 8, 27 0" fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" />

        {/* L2 Overload Interlocking S-curves */}
        <path d={`M 0 ${lineSpacing} C 6 ${lineSpacing - 8}, 12 ${lineSpacing - 8}, 18 ${lineSpacing} C 24 ${lineSpacing + 8}, 30 ${lineSpacing + 8}, 36 ${lineSpacing}`} fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" />
        <path d={`M 9 ${lineSpacing} C 15 ${lineSpacing + 8}, 21 ${lineSpacing + 8}, 27 ${lineSpacing}`} fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" />

        {/* L3 Overload Interlocking S-curves */}
        <path d={`M 0 ${lineSpacing * 2} C 6 ${lineSpacing * 2 - 8}, 12 ${lineSpacing * 2 - 8}, 18 ${lineSpacing * 2} C 24 ${lineSpacing * 2 + 8}, 30 ${lineSpacing * 2 + 8}, 36 ${lineSpacing * 2}`} fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" />
        <path d={`M 9 ${lineSpacing * 2} C 15 ${lineSpacing * 2 + 8}, 21 ${lineSpacing * 2 + 8}, 27 ${lineSpacing * 2}`} fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" />

        {/* Trip Linkage Dashed Line */}
        <line x1="18" y1="-8" x2="18" y2={lineSpacing * 2 + 14} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />
        <text x="18" y={lineSpacing * 2 + 25} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#dc2626">
          [95-96 TRIP]
        </text>

        {/* Tag */}
        <text
          x="18"
          y="-14"
          textAnchor="middle"
          fontSize="10.5"
          fontWeight={mode === "edit" && overload && selectedDeviceId === overload.id ? "800" : "700"}
          fill={mode === "edit" && overload && selectedDeviceId === overload.id ? "#b45309" : "#dc2626"}
        >
          {overload?.tag || "FR1"} (O.L.)
        </text>
      </g>

      {/* 7. 3-Phase Induction Motor (Large Industrial Standard) */}
      <g
        transform={`translate(${motorCx}, ${motorCy})`}
        onClick={(e) => {
          if (mode === "edit" && motor) {
            e.stopPropagation();
            onSelectDevice?.(motor.id);
          }
        }}
        style={{ cursor: mode === "edit" ? "pointer" : "default" }}
      >
        {/* Selection Halo in Edit Mode */}
        {mode === "edit" && motor && selectedDeviceId === motor.id && (
          <circle
            cx="0"
            cy="0"
            r="38"
            fill="rgba(245, 158, 11, 0.12)"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}
        {/* Terminal Lead Connections */}
        <line x1="-32" y1={-lineSpacing} x2="-22" y2={-lineSpacing + 8} stroke={busColor1} strokeWidth="2.4" />
        <text x="-36" y={-lineSpacing + 4} textAnchor="end" fontSize="8.5" fontWeight="700" fill="#dc2626">T1</text>

        <line x1="-32" y1="0" x2="-26" y2="0" stroke={busColor2} strokeWidth="2.4" />
        <text x="-36" y="3.5" textAnchor="end" fontSize="8.5" fontWeight="700" fill="#ca8a04">T2</text>

        <line x1="-32" y1={lineSpacing} x2="-22" y2={lineSpacing - 8} stroke={busColor3} strokeWidth="2.4" />
        <text x="-36" y={lineSpacing + 3} textAnchor="end" fontSize="8.5" fontWeight="700" fill="#2563eb">T3</text>

        {/* Motor Stator/Rotor Circle */}
        <circle
          cx="0"
          cy="0"
          r="30"
          fill={isRunning ? "rgba(16, 185, 129, 0.16)" : "var(--ladder-motor-bg, #ecfdf5)"}
          stroke={isRunning ? "#10b981" : "var(--ladder-ink, #1e293b)"}
          strokeWidth="2.8"
          style={{
            filter: isRunning ? "drop-shadow(0 0 10px rgba(16, 185, 129, 0.8))" : "none",
          }}
        />

        {/* Center Motor 'M' & Phase Rating */}
        <text x="0" y="-4" textAnchor="middle" fontSize="16" fontWeight="900" fill={isRunning ? "#059669" : "var(--ladder-ink, #1e293b)"}>
          M
        </text>
        <text x="0" y="11" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--ladder-text-dim, #64748b)">
          3~ {power}kW
        </text>

        {/* Motor Tag Above */}
        <text x="0" y="-36" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ladder-tag, #0f172a)">
          {motor?.tag || "M1"}
        </text>

        {/* Operational Status Badge Below */}
        <g transform="translate(0, 42)">
          <rect
            x="-44"
            y="-10"
            width="88"
            height="18"
            rx="4"
            fill={isRunning ? "#d1fae5" : "#f1f5f9"}
            stroke={isRunning ? "#10b981" : "#cbd5e1"}
            strokeWidth="1.2"
          />
          <text
            x="0"
            y="2.5"
            textAnchor="middle"
            fontSize="9"
            fontWeight="800"
            fill={isRunning ? "#047857" : "#64748b"}
          >
            {isRunning ? `⚡ ${Math.round(speedRpm || 1750)} RPM` : "● STOPPED"}
          </text>
        </g>
      </g>
    </g>
  );
}

interface TransformerSectionProps {
  branch: LadderTransformerBranch;
  x: number;
  y: number;
  width: number;
  mode?: "edit" | "run";
  selectedDeviceId?: string;
  onSelectDevice?: (deviceId: string) => void;
}

export function LadderTransformerSection({
  branch,
  x,
  y,
  width,
  mode = "edit",
  selectedDeviceId,
  onSelectDevice,
}: TransformerSectionProps) {
  const {
    title,
    transformer,
    primaryVoltage = 480,
    secondaryVoltage = 120,
    isEnergized,
  } = branch;

  const height = 125;
  const priColor = isEnergized ? "#dc2626" : "var(--ladder-wire, #64748b)";
  const secHotColor = isEnergized ? "#f59e0b" : "var(--ladder-wire, #64748b)";
  const secGndColor = isEnergized ? "#3b82f6" : "var(--ladder-wire, #64748b)";

  const lineY1 = y + 44; // H1 / X1 level
  const lineY2 = y + 84; // H2 / X2 level

  const xformCx = x + width * 0.44;
  const xformCy = (lineY1 + lineY2) / 2;

  return (
    <g className="ladder-transformer-section">
      {/* Container Box */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        fill="var(--ladder-cpt-bg, rgba(245, 158, 11, 0.03))"
        stroke="var(--ladder-cpt-border, #fcd34d)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />

      {/* Section Title */}
      <text
        x={x + 14}
        y={y + 22}
        fontSize="12.5"
        fontWeight="800"
        letterSpacing="0.05em"
        fill="var(--ladder-cpt-title, #b45309)"
      >
        🔌 {title} [{primaryVoltage}V PRIMARY ➔ {secondaryVoltage}V SECONDARY STEP-DOWN]
      </text>

      {/* Primary 480V Incoming Taps (L1 & L2) */}
      <g className="ladder-cpt-primary">
        {/* L1 Tap pill */}
        <rect x={x + 12} y={lineY1 - 10} width="66" height="20" rx="4" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" />
        <text x={x + 45} y={lineY1 + 4} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#dc2626">
          L1 ({primaryVoltage}V)
        </text>
        {/* Line to Primary Fuse FU1 */}
        <line x1={x + 78} y1={lineY1} x2={x + 135} y2={lineY1} stroke={priColor} strokeWidth="2.5" />

        {/* Primary Fuse FU1 */}
        <g transform={`translate(${x + 135}, ${lineY1})`}>
          <rect x="0" y="-6" width="26" height="12" rx="2" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="1.8" />
          <line x1="13" y1="-6" x2="13" y2="6" stroke="var(--ladder-ink, #334155)" strokeWidth="1.5" />
          <text x="13" y="-10" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--ladder-tag, #0f172a)">FU1</text>
        </g>
        <line x1={x + 161} y1={lineY1} x2={xformCx - 26} y2={lineY1} stroke={priColor} strokeWidth="2.5" />

        {/* L2 Tap pill */}
        <rect x={x + 12} y={lineY2 - 10} width="66" height="20" rx="4" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1" />
        <text x={x + 45} y={lineY2 + 4} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#ca8a04">
          L2 ({primaryVoltage}V)
        </text>
        {/* Line to Primary Fuse FU2 */}
        <line x1={x + 78} y1={lineY2} x2={x + 135} y2={lineY2} stroke={priColor} strokeWidth="2.5" />

        {/* Primary Fuse FU2 */}
        <g transform={`translate(${x + 135}, ${lineY2})`}>
          <rect x="0" y="-6" width="26" height="12" rx="2" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="1.8" />
          <line x1="13" y1="-6" x2="13" y2="6" stroke="var(--ladder-ink, #334155)" strokeWidth="1.5" />
          <text x="13" y="-10" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--ladder-tag, #0f172a)">FU2</text>
        </g>
        <line x1={x + 161} y1={lineY2} x2={xformCx - 26} y2={lineY2} stroke={priColor} strokeWidth="2.5" />
      </g>

      {/* Transformer Dual Circles & Core (TC1) */}
      <g
        transform={`translate(${xformCx}, ${xformCy})`}
        onClick={(e) => {
          if (mode === "edit" && transformer) {
            e.stopPropagation();
            onSelectDevice?.(transformer.id);
          }
        }}
        style={{ cursor: mode === "edit" ? "pointer" : "default" }}
      >
        {/* Selection Halo in Edit Mode */}
        {mode === "edit" && transformer && selectedDeviceId === transformer.id && (
          <rect
            x="-52"
            y="-42"
            width="104"
            height="84"
            rx="8"
            fill="rgba(245, 158, 11, 0.12)"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* Primary Coils (Left) */}
        <circle cx="-13" cy="0" r="15" fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.4" />
        {/* Secondary Coils (Right) */}
        <circle cx="13" cy="0" r="15" fill="none" stroke="var(--ladder-ink, #334155)" strokeWidth="2.4" />

        {/* Iron Core Dual Bars */}
        <line x1="-2" y1="-20" x2="-2" y2="20" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />
        <line x1="2" y1="-20" x2="2" y2="20" stroke="var(--ladder-ink, #334155)" strokeWidth="2" />

        {/* Terminal Pins & Labels */}
        {/* H1 */}
        <circle cx="-26" cy={lineY1 - xformCy} r="3.5" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.8" />
        <text x="-26" y={lineY1 - xformCy - 7} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#dc2626">H1</text>

        {/* H2 */}
        <circle cx="-26" cy={lineY2 - xformCy} r="3.5" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1.8" />
        <text x="-26" y={lineY2 - xformCy + 14} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#ca8a04">H2</text>

        {/* X1 */}
        <circle cx="26" cy={lineY1 - xformCy} r="3.5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.8" />
        <text x="26" y={lineY1 - xformCy - 7} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#b45309">X1</text>

        {/* X2 */}
        <circle cx="26" cy={lineY2 - xformCy} r="3.5" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.8" />
        <text x="26" y={lineY2 - xformCy + 14} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#1e40af">X2</text>

        {/* Transformer Tag & Info Badge */}
        <rect
          x="-45"
          y="-35"
          width="90"
          height="17"
          rx="3.5"
          fill="var(--ladder-paper, #ffffff)"
          stroke={mode === "edit" && selectedDeviceId === transformer.id ? "#f59e0b" : "#b45309"}
          strokeWidth={mode === "edit" && selectedDeviceId === transformer.id ? "2" : "1"}
        />
        <text
          x="0"
          y="-23"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="800"
          fill={mode === "edit" && selectedDeviceId === transformer.id ? "#b45309" : "#b45309"}
        >
          {transformer.tag || "TC1"} ({primaryVoltage}/{secondaryVoltage}V)
        </text>
      </g>

      {/* Secondary Output Lines (120V Hot -> Left Rail, 0V/GND -> Right Rail) */}
      <g className="ladder-cpt-secondary">
        {/* Secondary Fuse FU3 on X1 (120V Hot) */}
        <line x1={xformCx + 26} y1={lineY1} x2={xformCx + 75} y2={lineY1} stroke={secHotColor} strokeWidth="2.5" />
        <g transform={`translate(${xformCx + 75}, ${lineY1})`}>
          <rect x="0" y="-6" width="26" height="12" rx="2" fill="var(--ladder-paper, #ffffff)" stroke="var(--ladder-ink, #334155)" strokeWidth="1.8" />
          <line x1="13" y1="-6" x2="13" y2="6" stroke="var(--ladder-ink, #334155)" strokeWidth="1.5" />
          <text x="13" y="-10" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--ladder-tag, #0f172a)">FU3</text>
        </g>
        <line x1={xformCx + 101} y1={lineY1} x2={x + width - 195} y2={lineY1} stroke={secHotColor} strokeWidth="2.5" />

        {/* X1 Output Tag & Lead to Left Rail */}
        <g transform={`translate(${x + width - 195}, ${lineY1})`}>
          <rect x="0" y="-10" width="180" height="20" rx="4" fill={isEnergized ? "#fef3c7" : "var(--ladder-paper, #f1f5f9)"} stroke="#f59e0b" strokeWidth="1.5" />
          <text x="90" y="4" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={isEnergized ? "#b45309" : "var(--ladder-ink, #475569)"}>
            ⚡ {secondaryVoltage}VAC HOT ➔ LEFT RAIL
          </text>
        </g>

        {/* Secondary X2 Line (0V / Common Return) */}
        <line x1={xformCx + 26} y1={lineY2} x2={x + width - 195} y2={lineY2} stroke={secGndColor} strokeWidth="2.5" />

        {/* Ground Connection on X2 (Standard Industrial Neutral Grounding) */}
        <g transform={`translate(${xformCx + 88}, ${lineY2})`}>
          <circle cx="0" cy="0" r="3.5" fill="#10b981" />
          <line x1="0" y1="0" x2="0" y2="18" stroke="#10b981" strokeWidth="2" />
          <line x1="-9" y1="18" x2="9" y2="18" stroke="#10b981" strokeWidth="2.5" />
          <line x1="-6" y1="21" x2="6" y2="21" stroke="#10b981" strokeWidth="2" />
          <line x1="-3" y1="24" x2="3" y2="24" stroke="#10b981" strokeWidth="1.5" />
          <text x="16" y="24" fontSize="8" fontWeight="800" fill="#10b981">⏚ GND</text>
        </g>

        {/* X2 Output Tag & Lead to Right Rail */}
        <g transform={`translate(${x + width - 195}, ${lineY2})`}>
          <rect x="0" y="-10" width="180" height="20" rx="4" fill={isEnergized ? "#dbeafe" : "var(--ladder-paper, #f1f5f9)"} stroke="#3b82f6" strokeWidth="1.5" />
          <text x="90" y="4" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={isEnergized ? "#1e40af" : "var(--ladder-ink, #475569)"}>
            0V / COM (GND) ➔ RIGHT RAIL
          </text>
        </g>
      </g>
    </g>
  );
}
