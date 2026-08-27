import threePhaseMotorDoc from "../examples/three-phase-motor.json";
import blankTemplateDoc from "../examples/blank-template.json";
import type { Circuit, ProcessVars } from "../types";
import type { TutorialCircuitStage } from "./types";
import { useLab } from "../store";

export function applyTutorialStage(stage: TutorialCircuitStage) {
  const lab = useLab.getState();

  switch (stage) {
    case "overview": {
      lab.setMode("edit");
      lab.loadCircuit(
        JSON.parse(JSON.stringify(blankTemplateDoc.circuit)) as Circuit,
        "three-phase-motor",
        blankTemplateDoc.process as ProcessVars
      );
      break;
    }

    case "power": {
      lab.setMode("edit");
      lab.loadCircuit(
        JSON.parse(JSON.stringify(blankTemplateDoc.circuit)) as Circuit,
        "three-phase-motor",
        blankTemplateDoc.process as ProcessVars
      );
      break;
    }

    case "transformer":
    case "control":
    case "motor":
    case "complete": {
      lab.setMode("edit");
      lab.loadCircuit(
        JSON.parse(JSON.stringify(threePhaseMotorDoc.circuit)) as Circuit,
        "three-phase-motor",
        threePhaseMotorDoc.process as ProcessVars
      );
      break;
    }

    case "run": {
      // Ensure circuit is loaded then switch to RUN mode
      lab.loadCircuit(
        JSON.parse(JSON.stringify(threePhaseMotorDoc.circuit)) as Circuit,
        "three-phase-motor",
        threePhaseMotorDoc.process as ProcessVars
      );
      lab.setMode("run");
      // Close disconnect breaker
      const isolatorDev = lab.circuit.devices.find((d) => d.kind === "isolator" || d.tag.includes("Disconnect"));
      if (isolatorDev) {
        lab.toggleIo(isolatorDev.id, "on");
      }
      break;
    }

    case "running-latch": {
      lab.loadCircuit(
        JSON.parse(JSON.stringify(threePhaseMotorDoc.circuit)) as Circuit,
        "three-phase-motor",
        threePhaseMotorDoc.process as ProcessVars
      );
      lab.setMode("run");
      // Close disconnect breaker
      const isolator = lab.circuit.devices.find((d) => d.kind === "isolator" || d.tag.includes("Disconnect"));
      if (isolator) {
        lab.toggleIo(isolator.id, "on");
      }
      // Momentarily press start button to trigger latch
      const startBtn = lab.circuit.devices.find((d) => d.kind === "pb-no" || d.tag.toLowerCase().includes("start"));
      if (startBtn) {
        lab.pointerDevice(startBtn.id, true);
        setTimeout(() => {
          useLab.getState().pointerDevice(startBtn.id, false);
        }, 120);
      }
      break;
    }
  }
}
