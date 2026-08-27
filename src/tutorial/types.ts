export type TutorialVersion = "pc" | "mobile";

export type TutorialCircuitStage = "overview" | "power" | "transformer" | "control" | "motor" | "run" | "running-latch" | "complete";

export interface TutorialStep {
  id: string;
  version: TutorialVersion;
  stepNumber: number;
  totalSteps: number;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  tipKey?: string;
  tipFallback?: string;
  targetSelector?: string;
  badgeKey?: string;
  badgeFallback?: string;
  stage?: TutorialCircuitStage;
  actionType?: "none" | "apply-circuit" | "switch-run" | "interact-start" | "interact-breaker";
}
