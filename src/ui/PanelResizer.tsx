import React, { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";

export interface PanelResizerProps {
  direction: "left" | "right";
  currentWidth: number;
  minWidth?: number;
  maxWidth?: number;
  onResize: (width: number) => void;
  onReset?: () => void;
  className?: string;
}

export function PanelResizer({
  direction,
  currentWidth,
  minWidth = direction === "left" ? 160 : 200,
  maxWidth = direction === "left" ? 500 : 600,
  onResize,
  onReset,
  className = "",
}: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only main button (left mouse button or touch)
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      dragRef.current = {
        startX: e.clientX,
        startWidth: currentWidth,
      };
      setIsDragging(true);
      document.body.classList.add("panel-resizing");
    },
    [currentWidth]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const { startX, startWidth } = dragRef.current;
      const deltaX = e.clientX - startX;
      // For left panel: dragging right increases width. For right panel: dragging left increases width.
      const rawWidth = direction === "left" ? startWidth + deltaX : startWidth - deltaX;

      // Limit max width dynamically to prevent taking up whole screen
      const dynamicMax = typeof window !== "undefined" ? Math.min(maxWidth, Math.round(window.innerWidth * 0.45)) : maxWidth;
      const clampedWidth = Math.max(minWidth, Math.min(dynamicMax, Math.round(rawWidth)));

      onResize(clampedWidth);
    },
    [direction, minWidth, maxWidth, onResize]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
        dragRef.current = null;
        setIsDragging(false);
        document.body.classList.remove("panel-resizing");
      }
    },
    []
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onReset?.();
    },
    [onReset]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 30 : 10;
      const dynamicMax = typeof window !== "undefined" ? Math.min(maxWidth, Math.round(window.innerWidth * 0.45)) : maxWidth;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = direction === "left" ? currentWidth - step : currentWidth + step;
        onResize(Math.max(minWidth, Math.min(dynamicMax, next)));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = direction === "left" ? currentWidth + step : currentWidth - step;
        onResize(Math.max(minWidth, Math.min(dynamicMax, next)));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onReset?.();
      }
    },
    [currentWidth, direction, minWidth, maxWidth, onResize, onReset]
  );

  useEffect(() => {
    return () => {
      document.body.classList.remove("panel-resizing");
    };
  }, []);

  const titleText =
    direction === "left"
      ? t("toolbar.resizeLeft") || "Drag to resize palette (Double-click to reset)"
      : t("toolbar.resizeRight") || "Drag to resize side panel (Double-click to reset)";

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-valuenow={currentWidth}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-label={titleText}
      title={titleText}
      className={`panel-resizer ${direction} ${isDragging ? "dragging" : ""} ${className}`.trim()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    />
  );
}
