import { memo, useMemo } from "react";
import { GRID } from "../../types";

interface RulerTopProps {
  cols: number;
  zoom: number;
  cursorX: number | null;
}

export interface RulerTicksData {
  lines: { px: number; y1: number; y2: number; color: string; width: number }[];
  labels: { px: number; text: string }[];
}

export function computeRulerTopTicks(cols: number, zoom: number): RulerTicksData {
  const lines: RulerTicksData["lines"] = [];
  const labels: RulerTicksData["labels"] = [];

  for (let i = 0; i <= cols; i++) {
    const px = i * GRID * zoom;
    const isTen = i % 10 === 0;
    const isFive = i % 5 === 0;

    if (isTen) {
      lines.push({ px, y1: 7, y2: 20, color: "#9e9175", width: 1.2 });
      if (i > 0 && i < cols) {
        labels.push({ px, text: String(i) });
      }
    } else if (isFive) {
      lines.push({ px, y1: 12, y2: 20, color: "#736852", width: 1 });
    } else {
      lines.push({ px, y1: 16, y2: 20, color: "#4d4434", width: 1 });
    }
  }
  return { lines, labels };
}

export function computeRulerLeftTicks(rows: number, zoom: number): {
  lines: { py: number; x1: number; x2: number; color: string; width: number }[];
  labels: { py: number; text: string }[];
} {
  const lines: { py: number; x1: number; x2: number; color: string; width: number }[] = [];
  const labels: { py: number; text: string }[] = [];

  for (let i = 0; i <= rows; i++) {
    const py = i * GRID * zoom;
    const isTen = i % 10 === 0;
    const isFive = i % 5 === 0;

    if (isTen) {
      lines.push({ py, x1: 7, x2: 20, color: "#9e9175", width: 1.2 });
      if (i > 0 && i < rows) {
        labels.push({ py, text: String(i) });
      }
    } else if (isFive) {
      lines.push({ py, x1: 12, x2: 20, color: "#736852", width: 1 });
    } else {
      lines.push({ py, x1: 16, x2: 20, color: "#4d4434", width: 1 });
    }
  }
  return { lines, labels };
}

export function RulerTopComponent({ cols, zoom, cursorX }: RulerTopProps) {
  const totalW = cols * GRID * zoom;
  const cx = cursorX !== null ? cursorX * GRID * zoom : null;

  const ticks = useMemo(() => computeRulerTopTicks(cols, zoom), [cols, zoom]);

  return (
    <div className="ruler-top-wrap" style={{ width: totalW }}>
      <svg
        width={totalW}
        height={20}
        style={{ display: "block" }}
        className="ruler-svg"
      >
        {ticks.lines.map((l, i) => (
          <line
            key={`t-line-${i}`}
            x1={l.px}
            y1={l.y1}
            x2={l.px}
            y2={l.y2}
            stroke={l.color}
            strokeWidth={l.width}
          />
        ))}
        {ticks.labels.map((lbl, i) => (
          <text
            key={`t-txt-${i}`}
            x={lbl.px}
            y={6}
            fill="#9e9175"
            fontSize="8"
            fontFamily="'Red Hat Mono', monospace, sans-serif"
            fontWeight="600"
            textAnchor="middle"
          >
            {lbl.text}
          </text>
        ))}
        {cx !== null && (
          <g className="ruler-indicator">
            <line
              x1={cx}
              y1={0}
              x2={cx}
              y2={20}
              stroke="#e6c11e"
              strokeWidth="1.5"
            />
            <polygon
              points={`${cx - 3},0 ${cx + 3},0 ${cx},4`}
              fill="#e6c11e"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

export const RulerTop = memo(RulerTopComponent);

interface RulerLeftProps {
  rows: number;
  zoom: number;
  cursorY: number | null;
}

export function RulerLeftComponent({ rows, zoom, cursorY }: RulerLeftProps) {
  const totalH = rows * GRID * zoom;
  const cy = cursorY !== null ? cursorY * GRID * zoom : null;

  const ticks = useMemo(() => computeRulerLeftTicks(rows, zoom), [rows, zoom]);

  return (
    <div className="ruler-left-wrap" style={{ height: totalH }}>
      <svg
        width={20}
        height={totalH}
        style={{ display: "block" }}
        className="ruler-svg"
      >
        {ticks.lines.map((l, i) => (
          <line
            key={`l-line-${i}`}
            x1={l.x1}
            y1={l.py}
            x2={l.x2}
            y2={l.py}
            stroke={l.color}
            strokeWidth={l.width}
          />
        ))}
        {ticks.labels.map((lbl, i) => (
          <text
            key={`l-txt-${i}`}
            x={6}
            y={lbl.py + 3}
            fill="#9e9175"
            fontSize="7.5"
            fontFamily="'Red Hat Mono', monospace, sans-serif"
            fontWeight="600"
            textAnchor="end"
          >
            {lbl.text}
          </text>
        ))}
        {cy !== null && (
          <g className="ruler-indicator">
            <line
              x1={0}
              y1={cy}
              x2={20}
              y2={cy}
              stroke="#e6c11e"
              strokeWidth="1.5"
            />
            <polygon
              points={`0,${cy - 3} 0,${cy + 3} 4,${cy}`}
              fill="#e6c11e"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

export const RulerLeft = memo(RulerLeftComponent);
