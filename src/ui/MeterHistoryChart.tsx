import { useState } from "react";
import type { MeterDataPoint } from "../types";
import { t } from "../i18n";

interface MeterHistoryChartProps {
  deviceId: string;
  tag: string;
  kind: "voltmeter" | "ammeter";
  liveValue: number;
  unit: "V" | "A";
  history: MeterDataPoint[];
  onClear: () => void;
}

export function MeterHistoryChart({
  tag,
  kind,
  liveValue,
  unit,
  history,
  onClear,
}: MeterHistoryChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = history.length > 0 ? history : [{ time: 0, value: liveValue }];
  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values, liveValue);
  const minVal = Math.min(...values, liveValue);
  const avgVal = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : liveValue;

  // Compute nice Y-axis range
  let yMax = kind === "voltmeter" ? 400 : 10;
  if (maxVal > yMax) yMax = Math.ceil(maxVal * 1.15);
  else if (maxVal > 0 && maxVal < 30 && kind === "voltmeter") yMax = 30; // 24V range
  else if (maxVal > 0 && maxVal < 5 && kind === "ammeter") yMax = 5;

  const yMin = 0;
  const yRange = Math.max(1, yMax - yMin);

  // SVG dimensions
  const svgWidth = 360;
  const svgHeight = 150;
  const padLeft = 38;
  const padRight = 14;
  const padTop = 15;
  const padBottom = 24;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  // Map data points to SVG coordinates
  const coords = points.map((p, idx) => {
    const x = points.length === 1 ? padLeft + plotW : padLeft + (idx / (points.length - 1)) * plotW;
    const clampedVal = Math.max(yMin, Math.min(yMax, p.value));
    const y = padTop + plotH - ((clampedVal - yMin) / yRange) * plotH;
    return { x, y, time: p.time, value: p.value };
  });

  // SVG path definitions
  const linePathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, "");
  const firstPt = coords[0] ?? { x: padLeft, y: padTop + plotH };
  const lastPt = coords[coords.length - 1] ?? { x: padLeft + plotW, y: padTop + plotH };
  const areaPathD = `${linePathD} L ${lastPt.x.toFixed(1)} ${padTop + plotH} L ${firstPt.x.toFixed(1)} ${padTop + plotH} Z`;

  // Colors based on meter kind
  const strokeColor = kind === "voltmeter" ? "#3b82f6" : "#f59e0b";
  const gradStart = kind === "voltmeter" ? "rgba(59, 130, 246, 0.4)" : "rgba(245, 158, 11, 0.4)";
  const gradEnd = kind === "voltmeter" ? "rgba(59, 130, 246, 0.0)" : "rgba(245, 158, 11, 0.0)";

  // Y-axis grid steps (3 horizontal lines: 0, 50%, 100%)
  const ySteps = [0, yMax / 2, yMax];

  const hoveredPoint = hoverIndex !== null && coords[hoverIndex] ? coords[hoverIndex] : null;

  return (
    <div className="meter-chart-container">
      {/* Header bar with Live Value and Clear button */}
      <div className="meter-chart-header">
        <div className="meter-header-left">
          <span className="meter-badge" style={{ borderColor: strokeColor, color: strokeColor }}>
            {tag}
          </span>
          <span className="meter-type-title">
            {kind === "voltmeter" ? t("meters.voltmeter") : t("meters.ammeter")}
          </span>
        </div>
        <div className="meter-header-right">
          <div className="meter-live-chip">
            <span className="live-dot" style={{ backgroundColor: strokeColor }} />
            <span className="live-val">
              {kind === "voltmeter" ? `${liveValue.toFixed(1)} V` : `${liveValue.toFixed(2)} A`}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-clear-chart"
            onClick={onClear}
            title={t("meters.clearHistory")}
          >
            {t("meters.clear")}
          </button>
        </div>
      </div>

      {/* Interactive SVG Trend Chart */}
      <div className="meter-svg-wrap">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="meter-trend-svg"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            if (relX < padLeft || relX > padLeft + plotW || coords.length === 0) {
              setHoverIndex(null);
              return;
            }
            // Find closest index
            let bestIdx = 0;
            let bestDist = Infinity;
            coords.forEach((c, idx) => {
              const dist = Math.abs(c.x - relX);
              if (dist < bestDist) {
                bestDist = dist;
                bestIdx = idx;
              }
            });
            setHoverIndex(bestIdx);
          }}
        >
          <defs>
            <linearGradient id={`grad-${kind}-${tag}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradStart} />
              <stop offset="100%" stopColor={gradEnd} />
            </linearGradient>
          </defs>

          {/* Background */}
          <rect
            x={padLeft}
            y={padTop}
            width={plotW}
            height={plotH}
            fill="var(--chart-bg, rgba(0,0,0,0.25))"
            rx="3"
          />

          {/* Horizontal grid lines & labels */}
          {ySteps.map((v, i) => {
            const y = padTop + plotH - (v / yRange) * plotH;
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke="var(--chart-grid, rgba(255,255,255,0.12))"
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? undefined : "3 3"}
                />
                <text
                  x={padLeft - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--chart-text, #94a3b8)"
                  fontFamily="monospace"
                >
                  {Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* Time axis ticks */}
          <text
            x={padLeft}
            y={svgHeight - 6}
            fontSize="9"
            fill="var(--chart-text, #94a3b8)"
            fontFamily="monospace"
          >
            {points.length > 1 ? `-${(points[points.length - 1].time - points[0].time).toFixed(0)}s` : "0s"}
          </text>
          <text
            x={padLeft + plotW}
            y={svgHeight - 6}
            textAnchor="end"
            fontSize="9"
            fill="var(--chart-text, #94a3b8)"
            fontFamily="monospace"
          >
            0s (now)
          </text>

          {/* Gradient Filled Area under Curve */}
          {coords.length > 1 && (
            <path d={areaPathD} fill={`url(#grad-${kind}-${tag})`} />
          )}

          {/* Main Curve Line */}
          <path
            d={linePathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Latest data point pulse */}
          {lastPt && (
            <g>
              <circle cx={lastPt.x} cy={lastPt.y} r="6" fill={strokeColor} opacity="0.3" className="chart-pulse" />
              <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
            </g>
          )}

          {/* Interactive Hover Crosshair & Data Indicator */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={padTop + plotH}
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#ffffff"
                stroke={strokeColor}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.y / svgHeight) * 100}%`,
            }}
          >
            <div className="tooltip-val">
              {kind === "voltmeter" ? `${hoveredPoint.value.toFixed(1)} V` : `${hoveredPoint.value.toFixed(2)} A`}
            </div>
            <div className="tooltip-time">t = {hoveredPoint.time.toFixed(1)}s</div>
          </div>
        )}
      </div>

      {/* Summary Statistics Cards */}
      <div className="meter-stats-grid">
        <div className="meter-stat-card">
          <span className="stat-label">{t("meters.max")}</span>
          <span className="stat-value">
            {kind === "voltmeter" ? `${maxVal.toFixed(1)} ${unit}` : `${maxVal.toFixed(2)} ${unit}`}
          </span>
        </div>
        <div className="meter-stat-card">
          <span className="stat-label">{t("meters.avg")}</span>
          <span className="stat-value">
            {kind === "voltmeter" ? `${avgVal.toFixed(1)} ${unit}` : `${avgVal.toFixed(2)} ${unit}`}
          </span>
        </div>
        <div className="meter-stat-card">
          <span className="stat-label">{t("meters.min")}</span>
          <span className="stat-value">
            {kind === "voltmeter" ? `${minVal.toFixed(1)} ${unit}` : `${minVal.toFixed(2)} ${unit}`}
          </span>
        </div>
        <div className="meter-stat-card">
          <span className="stat-label">{t("meters.samples")}</span>
          <span className="stat-value">{points.length}</span>
        </div>
      </div>
    </div>
  );
}
