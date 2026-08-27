import { useEffect, useMemo, useState } from "react";
import { allWireRoutes, findWireCrossovers } from "../geometry";
import { t } from "../i18n";
import { DEFAULT_PRINT_OPTIONS, getPrintContentBounds, type PrintOptions } from "../print";
import { useLab } from "../store";
import { COLS, GRID, ROWS } from "../types";
import { emptySnapshot } from "../sim/engine";
import { SymbolLayer } from "./schematic/layers/SymbolLayer";
import { WireLayer } from "./schematic/layers/WireLayer";

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrintModal({ isOpen, onClose }: PrintModalProps) {
  const circuit = useLab((s) => s.circuit);
  const docName = useLab((s) => s.docName);
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const routes = useMemo(() => allWireRoutes(circuit), [circuit]);
  const crossovers = useMemo(() => findWireCrossovers(circuit, routes), [circuit, routes]);
  const bounds = useMemo(() => getPrintContentBounds(circuit, options.padding), [circuit, options.padding]);
  const snapshot = useMemo(() => emptySnapshot(circuit), [circuit]);

  if (!isOpen) return null;

  const isContentScope = options.scope === "content";
  const viewBox = isContentScope ? bounds.viewBox : `0 0 ${COLS * GRID} ${ROWS * GRID}`;
  const viewBoxParts = viewBox.split(" ").map(Number);
  const [vbX, vbY, vbW, vbH] = viewBoxParts;

  const handlePrint = () => {
    window.print();
  };

  const currentDateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const renderSvgContent = (forPrint = false) => {
    const bgFill =
      options.background === "white"
        ? "#ffffff"
        : options.background === "paper"
          ? "#efe6d0"
          : "none";

    const gridColor = options.background === "paper" ? "rgba(42, 72, 110, 0.14)" : "rgba(0, 0, 0, 0.08)";
    const gridDotColor = options.background === "paper" ? "rgba(42, 72, 110, 0.22)" : "rgba(0, 0, 0, 0.16)";
    const patternId = forPrint ? "print-canvas-grid" : "preview-canvas-grid";

    return (
      <svg
        className={`print-svg ${options.colorMode === "monochrome" ? "print-monochrome" : ""}`}
        viewBox={viewBox}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{
          backgroundColor: bgFill,
          ...(options.colorMode === "monochrome"
            ? { filter: "grayscale(100%) contrast(140%)" }
            : {}),
        }}
      >
        <defs>
          {options.printGrid && (
            <pattern
              id={patternId}
              width={GRID}
              height={GRID}
              patternUnits="userSpaceOnUse"
              x={vbX % GRID}
              y={vbY % GRID}
            >
              <line x1={0} y1={0} x2={GRID} y2={0} stroke={gridColor} strokeWidth={0.6} />
              <line x1={0} y1={0} x2={0} y2={GRID} stroke={gridColor} strokeWidth={0.6} />
              <circle cx={0} cy={0} r={0.9} fill={gridDotColor} />
            </pattern>
          )}
        </defs>

        {/* Background Fill */}
        {options.background !== "transparent" && (
          <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={bgFill} />
        )}

        {/* Grid Overlay */}
        {options.printGrid && (
          <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={`url(#${patternId})`} />
        )}

        {/* Wires & Crossovers */}
        <WireLayer
          circuit={circuit}
          snapshot={snapshot}
          selected={null}
          routes={routes}
          crossovers={crossovers}
          onWireContextMenu={() => {}}
          onWirePointerDown={() => {}}
        />

        {/* Components & Symbols */}
        <SymbolLayer
          circuit={circuit}
          snapshot={snapshot}
          selected={null}
          selectedIds={[]}
          selectedNetTag=""
          held={[]}
          onSymbolContextMenu={() => {}}
          onSymbolPointerDown={() => {}}
          onSymbolPointerUp={() => {}}
          onSymbolPointerLeave={() => {}}
        />
      </svg>
    );
  };

  return (
    <>
      {/* Screen Modal Dialog */}
      <div className="modal-overlay print-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div className="print-modal-container" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="print-modal-header">
            <div className="print-modal-title">
              <span className="print-icon">🖨️</span>
              <h3>{t("print.title") || "Print Diagram"}</h3>
              <span className="print-doc-badge">{docName || "Untitled"}</span>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label={t("print.cancel") || "Close"}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="print-modal-body">
            {/* Left: Interactive Preview */}
            <div className="print-preview-pane">
              <div className="print-preview-header">
                <span>{t("print.preview") || "Print Preview"}</span>
                <span className="print-preview-meta">
                  {isContentScope
                    ? `${Math.round(bounds.width)} × ${Math.round(bounds.height)} px (${bounds.suggestedOrientation})`
                    : `${COLS * GRID} × ${ROWS * GRID} px (Full)`}
                </span>
              </div>

              <div className={`print-preview-canvas-wrap ${options.background}`}>
                {options.includeHeader && (
                  <div className="print-preview-doc-header">
                    <span className="doc-title">{docName || "Untitled Diagram"}</span>
                    <span className="doc-date">{currentDateStr}</span>
                  </div>
                )}
                <div className="print-preview-svg-container">
                  {renderSvgContent(false)}
                </div>
              </div>

              {!bounds.hasElements && isContentScope && (
                <div className="print-empty-hint">
                  {t("print.noElements") || "Diagram is empty."}
                </div>
              )}
            </div>

            {/* Right: Settings & Options */}
            <div className="print-controls-pane">
              {/* Option 1: Print Scope */}
              <div className="print-option-group">
                <label className="print-option-label">{t("print.scope") || "Print Area"}</label>
                <div className="print-toggle-buttons">
                  <button
                    type="button"
                    className={`print-toggle-btn ${options.scope === "content" ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, scope: "content" })}
                  >
                    <span className="toggle-icon">✂️</span>
                    <span>{t("print.scopeContent") || "Auto-crop Content"}</span>
                  </button>
                  <button
                    type="button"
                    className={`print-toggle-btn ${options.scope === "full" ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, scope: "full" })}
                  >
                    <span className="toggle-icon">📐</span>
                    <span>{t("print.scopeFull") || "Full Canvas"}</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Background Style */}
              <div className="print-option-group">
                <label className="print-option-label">{t("print.background") || "Background Style"}</label>
                <div className="print-bg-options">
                  <button
                    type="button"
                    className={`print-bg-btn bg-white ${options.background === "white" ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, background: "white" })}
                  >
                    <span className="bg-swatch white" />
                    <span>{t("print.bgWhite") || "White Paper"}</span>
                  </button>
                  <button
                    type="button"
                    className={`print-bg-btn bg-paper ${options.background === "paper" ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, background: "paper" })}
                  >
                    <span className="bg-swatch paper" />
                    <span>{t("print.bgPaper") || "Warm Paper"}</span>
                  </button>
                  <button
                    type="button"
                    className={`print-bg-btn bg-trans ${options.background === "transparent" ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, background: "transparent" })}
                  >
                    <span className="bg-swatch transparent" />
                    <span>{t("print.bgTransparent") || "Transparent"}</span>
                  </button>
                </div>
              </div>

              {/* Option 3: Print Grid */}
              <div className="print-option-group">
                <label className="print-checkbox-row">
                  <input
                    type="checkbox"
                    checked={options.printGrid}
                    onChange={(e) => setOptions({ ...options, printGrid: e.target.checked })}
                  />
                  <span>{t("print.printGrid") || "Print Engineering Grid"}</span>
                </label>
              </div>

              {/* Option 4: Color Mode */}
              <div className="print-option-group">
                <label className="print-option-label">{t("print.colorMode") || "Color Mode"}</label>
                <div className="print-toggle-buttons">
                  <button
                    type="button"
                    className={`print-toggle-btn ${options.colorMode === "color" ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, colorMode: "color" })}
                  >
                    <span className="toggle-icon">🎨</span>
                    <span>{t("print.colorFull") || "Full Color"}</span>
                  </button>
                  <button
                    type="button"
                    className={`print-toggle-btn ${options.colorMode === "monochrome" ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, colorMode: "monochrome" })}
                  >
                    <span className="toggle-icon">🔲</span>
                    <span>{t("print.colorMono") || "Monochrome (B&W)"}</span>
                  </button>
                </div>
              </div>

              {/* Option 5: Header Info */}
              <div className="print-option-group">
                <label className="print-checkbox-row">
                  <input
                    type="checkbox"
                    checked={options.includeHeader}
                    onChange={(e) => setOptions({ ...options, includeHeader: e.target.checked })}
                  />
                  <span>{t("print.includeHeader") || "Include Title & Date Header"}</span>
                </label>
              </div>

              {/* Orientation Recommendation */}
              <div className="print-orientation-tip">
                <span className="tip-icon">💡</span>
                <span>
                  {t("print.orientation") || "Orientation"}:{" "}
                  <strong>
                    {bounds.suggestedOrientation === "landscape"
                      ? t("print.orientationLandscape") || "Landscape"
                      : t("print.orientationPortrait") || "Portrait"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="print-modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              {t("print.cancel") || "Cancel"}
            </button>
            <button type="button" className="btn ok print-submit-btn" onClick={handlePrint}>
              <span>🖨️</span>
              <span>{t("print.execute") || "Print"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Media Print Mount: Only rendered when browser prints */}
      <div className="print-mount" aria-hidden="true">
        {options.includeHeader && (
          <div className="print-page-header">
            <span className="print-header-title">{docName || "Untitled Diagram"}</span>
            <span className="print-header-meta">E-LAB • {currentDateStr}</span>
          </div>
        )}
        <div className="print-page-body">
          {renderSvgContent(true)}
        </div>
      </div>
    </>
  );
}
