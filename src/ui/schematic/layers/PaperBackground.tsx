import { memo, type PointerEvent } from "react";
import { COLS, GRID, ROWS } from "../../../types";

interface PaperBackgroundProps {
  onPaperDown: (e: PointerEvent<SVGRectElement>) => void;
}

export const PaperBackground = memo(function PaperBackground({ onPaperDown }: PaperBackgroundProps) {
  return (
    <rect
      className="paper-hit"
      x={0}
      y={0}
      width={COLS * GRID}
      height={ROWS * GRID}
      fill="transparent"
      onPointerDown={onPaperDown}
    />
  );
});
