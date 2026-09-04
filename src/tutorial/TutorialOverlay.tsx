import { useEffect, useState, useRef } from "react";
import { t, tOr } from "../i18n";
import { useLab } from "../store";
import { PC_TUTORIAL_STEPS, MOBILE_TUTORIAL_STEPS } from "./tutorialData";
import { applyTutorialStage } from "./stageCircuits";
import type { TutorialStep, TutorialVersion } from "./types";

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVersion?: TutorialVersion;
}

export function TutorialOverlay({ isOpen, onClose, defaultVersion = "pc" }: TutorialOverlayProps) {
  const tutorialStepIndex = useLab((s) => s.tutorialStepIndex);
  const tutorialVersion = useLab((s) => s.tutorialVersion) || defaultVersion;
  const nextTutorialStep = useLab((s) => s.nextTutorialStep);
  const prevTutorialStep = useLab((s) => s.prevTutorialStep);
  const restartTutorial = useLab((s) => s.restartTutorial);
  const setTutorialVersion = useLab((s) => s.setTutorialVersion);

  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const steps: TutorialStep[] = tutorialVersion === "mobile" ? MOBILE_TUTORIAL_STEPS : PC_TUTORIAL_STEPS;
  const currentStep = steps[tutorialStepIndex] || steps[0];

  // Auto-track target element bounding box for spotlight
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const updateRect = () => {
      if (currentStep.targetSelector) {
        const el = document.querySelector(currentStep.targetSelector);
        if (el) {
          const rect = el.getBoundingClientRect();
          setHighlightRect(rect);
          return;
        }
      }
      setHighlightRect(null);
    };

    updateRect();
    const handleResize = () => updateRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    const timer = setTimeout(updateRect, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      clearTimeout(timer);
    };
  }, [isOpen, currentStep]);

  // Adjust drawers / UI context on step changes
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    if (tutorialVersion === "mobile") {
      if (currentStep.id === "mobile-step-drawer") {
        useLab.getState().setPaletteOpen(true);
      } else if (currentStep.id === "mobile-step-run-mode") {
        useLab.getState().setPaletteOpen(false);
      }
    } else {
      if (currentStep.id === "pc-step-palette") {
        useLab.getState().setPaletteOpen(true);
      }
    }
  }, [isOpen, currentStep, tutorialVersion]);

  if (!isOpen || !currentStep) return null;

  const isFirst = tutorialStepIndex === 0;
  const isLast = tutorialStepIndex === steps.length - 1;
  const progressPercent = Math.round(((tutorialStepIndex + 1) / steps.length) * 100);

  const handleApplyStage = () => {
    if (currentStep.stage) {
      applyTutorialStage(currentStep.stage);
    }
  };

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      nextTutorialStep();
    }
  };

  const handlePrev = () => {
    prevTutorialStep();
  };

  const handleSwitchVersion = (ver: TutorialVersion) => {
    setTutorialVersion(ver);
  };

  return (
    <div className="tutorial-overlay" aria-modal="true" role="dialog">
      {/* Background Dim / Spotlight Mask */}
      <div className="tutorial-backdrop" onClick={onClose} />

      {/* Target Spotlight Highlight Border */}
      {highlightRect && (
        <div
          className="tutorial-spotlight"
          style={{
            top: `${Math.max(0, highlightRect.top - 6)}px`,
            left: `${Math.max(0, highlightRect.left - 6)}px`,
            width: `${highlightRect.width + 12}px`,
            height: `${highlightRect.height + 12}px`,
          }}
        />
      )}

      {/* Step Floating / Bottom Card */}
      <div
        className={`tutorial-card ${tutorialVersion === "mobile" ? "mobile" : "desktop"}`}
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar Header */}
        <div className="tutorial-progress-wrap">
          <div className="tutorial-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Card Header */}
        <div className="tutorial-header">
          <div className="tutorial-badge-group">
            <span className="tutorial-step-badge">
              {t("tutorial.step")} {currentStep.stepNumber} / {currentStep.totalSteps}
            </span>
            <span className="tutorial-topic-badge">
              {tOr(currentStep.badgeKey || "", currentStep.badgeFallback || "")}
            </span>
          </div>

          <div className="tutorial-header-actions">
            {/* Version Switch Pill */}
            <div className="tutorial-version-switch">
              <button
                type="button"
                className={`tutorial-ver-btn ${tutorialVersion === "pc" ? "active" : ""}`}
                onClick={() => handleSwitchVersion("pc")}
                title="PC Version"
              >
                💻 PC
              </button>
              <button
                type="button"
                className={`tutorial-ver-btn ${tutorialVersion === "mobile" ? "active" : ""}`}
                onClick={() => handleSwitchVersion("mobile")}
                title="Mobile Version"
              >
                📱 Mobile
              </button>
            </div>

            <button
              type="button"
              className="tutorial-close-btn"
              onClick={onClose}
              title={t("tutorial.skip")}
              aria-label={t("tutorial.skip")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="tutorial-body">
          <h3 className="tutorial-title">
            {tOr(currentStep.titleKey, currentStep.titleFallback)}
          </h3>
          <p className="tutorial-desc">
            {tOr(currentStep.descKey, currentStep.descFallback)}
          </p>

          {currentStep.tipKey && (
            <div className="tutorial-tip">
              <span className="tutorial-tip-icon">💡</span>
              <span className="tutorial-tip-text">
                {tOr(currentStep.tipKey, currentStep.tipFallback || "")}
              </span>
            </div>
          )}
        </div>

        {/* Card Footer / Actions */}
        <div className="tutorial-footer">
          <div className="tutorial-footer-left">
            {currentStep.stage && (
              <button
                type="button"
                className="tutorial-action-btn demo-btn"
                onClick={handleApplyStage}
                title={t("tutorial.applyStage")}
              >
                ⚡ {t("tutorial.applyStage")}
              </button>
            )}
            <button
              type="button"
              className="tutorial-text-btn"
              onClick={restartTutorial}
              title={t("tutorial.restart")}
            >
              ↻ {t("tutorial.restart")}
            </button>
          </div>

          <div className="tutorial-footer-right">
            {!isFirst && (
              <button
                type="button"
                className="tutorial-nav-btn prev"
                onClick={handlePrev}
              >
                {t("tutorial.prev")}
              </button>
            )}

            <button
              type="button"
              className={`tutorial-nav-btn next ${isLast ? "finish" : "primary"}`}
              onClick={handleNext}
            >
              {isLast ? (t("tutorial.finish")) : (t("tutorial.next"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
