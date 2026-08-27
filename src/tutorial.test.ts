import { describe, it, expect, beforeEach } from "vitest";
import { PC_TUTORIAL_STEPS, MOBILE_TUTORIAL_STEPS } from "./tutorial/tutorialData";
import { applyTutorialStage } from "./tutorial/stageCircuits";
import { useLab } from "./store";
import { TRANSLATIONS } from "./i18n";

describe("Onboarding Tutorial Tests", () => {
  beforeEach(() => {
    useLab.setState({
      tutorialOpen: false,
      tutorialStepIndex: 0,
      tutorialVersion: "pc",
      mode: "edit",
    });
  });

  it("should define valid PC and Mobile tutorial steps with complete metadata", () => {
    expect(PC_TUTORIAL_STEPS.length).toBe(8);
    expect(MOBILE_TUTORIAL_STEPS.length).toBe(7);

    // Verify PC steps numbering
    PC_TUTORIAL_STEPS.forEach((step, idx) => {
      expect(step.version).toBe("pc");
      expect(step.stepNumber).toBe(idx + 1);
      expect(step.totalSteps).toBe(8);
      expect(step.titleKey).toBeTruthy();
      expect(step.descKey).toBeTruthy();
    });

    // Verify Mobile steps numbering
    MOBILE_TUTORIAL_STEPS.forEach((step, idx) => {
      expect(step.version).toBe("mobile");
      expect(step.stepNumber).toBe(idx + 1);
      expect(step.totalSteps).toBe(7);
      expect(step.titleKey).toBeTruthy();
      expect(step.descKey).toBeTruthy();
    });
  });

  it("should have complete i18n translations for all tutorial keys in English and Chinese", () => {
    const enDict = TRANSLATIONS.en as Record<string, string>;
    const zhDict = TRANSLATIONS.zh as Record<string, string>;

    const allSteps = [...PC_TUTORIAL_STEPS, ...MOBILE_TUTORIAL_STEPS];
    for (const step of allSteps) {
      expect(enDict[step.titleKey]).toBeDefined();
      expect(zhDict[step.titleKey]).toBeDefined();
      expect(enDict[step.descKey]).toBeDefined();
      expect(zhDict[step.descKey]).toBeDefined();

      if (step.tipKey) {
        expect(enDict[step.tipKey]).toBeDefined();
        expect(zhDict[step.tipKey]).toBeDefined();
      }

      if (step.badgeKey) {
        expect(enDict[step.badgeKey]).toBeDefined();
        expect(zhDict[step.badgeKey]).toBeDefined();
      }
    }

    // Check general tutorial buttons and controls
    expect(enDict["tutorial.button"]).toBeDefined();
    expect(zhDict["tutorial.button"]).toBeDefined();
    expect(enDict["tutorial.step"]).toBeDefined();
    expect(zhDict["tutorial.step"]).toBeDefined();
    expect(enDict["tutorial.next"]).toBeDefined();
    expect(zhDict["tutorial.next"]).toBeDefined();
    expect(enDict["tutorial.prev"]).toBeDefined();
    expect(zhDict["tutorial.prev"]).toBeDefined();
    expect(enDict["tutorial.finish"]).toBeDefined();
    expect(zhDict["tutorial.finish"]).toBeDefined();
  });

  it("should manage tutorial open, step navigation and version switching in store", () => {
    const lab = useLab.getState();

    // 1. Open PC tutorial
    lab.openTutorial("pc");
    expect(useLab.getState().tutorialOpen).toBe(true);
    expect(useLab.getState().tutorialStepIndex).toBe(0);
    expect(useLab.getState().tutorialVersion).toBe("pc");

    // 2. Next steps
    lab.nextTutorialStep();
    expect(useLab.getState().tutorialStepIndex).toBe(1);

    lab.nextTutorialStep();
    expect(useLab.getState().tutorialStepIndex).toBe(2);

    // 3. Previous step
    lab.prevTutorialStep();
    expect(useLab.getState().tutorialStepIndex).toBe(1);

    // 4. Set specific step
    lab.setTutorialStep(5);
    expect(useLab.getState().tutorialStepIndex).toBe(5);

    // 5. Restart tutorial
    lab.restartTutorial();
    expect(useLab.getState().tutorialStepIndex).toBe(0);

    // 6. Switch to Mobile version
    lab.setTutorialVersion("mobile");
    expect(useLab.getState().tutorialVersion).toBe("mobile");
    expect(useLab.getState().tutorialStepIndex).toBe(0);

    // 7. Close tutorial
    lab.closeTutorial();
    expect(useLab.getState().tutorialOpen).toBe(false);
  });

  it("should apply tutorial circuit stages without throwing errors", () => {
    // Overview stage
    applyTutorialStage("overview");
    expect(useLab.getState().circuit.devices.length).toBeGreaterThan(0);

    // Transformer & Motor full stage
    applyTutorialStage("motor");
    expect(useLab.getState().circuit.devices.some((d) => d.kind === "motor-3ph" || d.kind === "mains-3ph")).toBe(true);

    // Run stage (switches to run mode and closes isolator)
    applyTutorialStage("run");
    expect(useLab.getState().mode).toBe("run");

    // Latch stage (starts motor in running mode)
    applyTutorialStage("running-latch");
    expect(useLab.getState().mode).toBe("run");
  });
});
