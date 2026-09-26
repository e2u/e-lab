import type { Circuit } from "../types";

// Dynamic imports for all example JSON files (works in both dev and GitHub Pages)
export interface ExampleDoc {
  circuit?: Circuit | null;
  title?: string;
  name?: string;
  version?: number;
  [key: string]: unknown;
}

type ExampleImporter = () => Promise<unknown>;

const exampleImports: Record<string, ExampleImporter> = {
  "none": () => Promise.resolve({ circuit: null }),
  "01-basic-lamp": () => import("./01-basic-lamp.json"),
  "02-start-stop-lamp": () => import("./02-start-stop-lamp.json"),
  "03-transformer-fuse": () => import("./03-transformer-fuse.json"),
  "04-relay-self-holding": () => import("./04-relay-self-holding.json"),
  "05-motor-1ph-manual": () => import("./05-motor-1ph-manual.json"),
  "06-motor-3ph-dol": () => import("./06-motor-3ph-dol.json"),
  "07-overload-alarm": () => import("./07-overload-alarm.json"),
  "08-estop-safety": () => import("./08-estop-safety.json"),
  "09-hoa-selector": () => import("./09-hoa-selector.json"),
  "10-dual-station": () => import("./10-dual-station.json"),
  "11-fwd-rev-interlock": () => import("./11-fwd-rev-interlock.json"),
  "12-limit-reciprocating": () => import("./12-limit-reciprocating.json"),
  "13-timer-on-sequence": () => import("./13-timer-on-sequence.json"),
  "14-timer-off-cooling": () => import("./14-timer-off-cooling.json"),
  "15-star-delta-starter": () => import("./15-star-delta-starter.json"),
  "16-tank-level-pump": () => import("./16-tank-level-pump.json"),
  "17-temp-pressure-heater": () => import("./17-temp-pressure-heater.json"),
  "18-conveyor-counter-sorter": () => import("./18-conveyor-counter-sorter.json"),
  "19-ats-dual-power": () => import("./19-ats-dual-power.json"),
  "20-automated-cell": () => import("./20-automated-cell.json"),
  "21-timer-ss-off-dual-motor": () => import("./21-timer-ss-off-dual-motor.json"),
  "22-timer-ss-off-three-motor": () => import("./22-timer-ss-off-three-motor.json"),
  "23-timer-ss-on-dual-motor": () => import("./23-timer-ss-on-dual-motor.json"),
  "24-timer-ss-on-three-motor": () => import("./24-timer-ss-on-three-motor.json"),
  "base-template": () => import("./BaseTemplate.json"),
  "blank-template": () => import("./blank-template.json"),
  "project-01": () => import("./Project 01.json"),
  "project-02": () => import("./Project 02.json"),
  "project-03": () => import("./Project 03.json"),
  "project-04": () => import("./Project 04.json"),
  "project-05-off-delay": () => import("./Project 05-Off-Delay.json"),
  "project-05-on-delay": () => import("./Project 05-On-Delay.json"),
  "project-06": () => import("./Project 06.json"),
  "project-06-single-timer": () => import("./Project 06-Single-Timer.json"),
  "project-07": () => import("./Project 07.json"),
  "project-08": () => import("./Project 08.json"),
  "project-09": () => import("./Project 09.json"),
  "project-10": () => import("./Project 10.json"),
  "project-11": () => import("./Project 11.json"),
  "project-11-single-relay": () => import("./Project 11-Single-Relay.json"),
  "project-12": () => import("./Project 12.json"),
  "project-13": () => import("./Project 13.json"),
  "project-14-third-motor-start-after-first-motor": () => import("./Project 14 Third-motor-start-after-first-motor.json"),
  "project-14-third-motor-start-after-first-motor-reset-by-motor1": () => import("./Project 14 Third-motor-start-after-first-motor Reset-by-motor1.json"),
  "project-14-third-motor-start-after-second-motor": () => import("./Project 14 Third-motor-start-after-second-motor.json"),
  "project-14-third-motor-start-after-second-motor-reset-by-motor2": () => import("./Project 14 Third-motor-start-after-second-motor Reset-by-motor2.json"),
  "three-phase-motor": () => import("./three-phase-motor.json"),
  "transformer": () => import("./transformer.json"),
  "project-05": () => import("./Project 05-Off-Delay.json"),
  "Project 05": () => import("./Project 05-Off-Delay.json"),
  "Project 05-Off-Delay": () => import("./Project 05-Off-Delay.json"),
  "Project 05-On-Delay": () => import("./Project 05-On-Delay.json"),
  "Project 06": () => import("./Project 06.json"),
  "Project 06-Single-Timer": () => import("./Project 06-Single-Timer.json"),
};

export async function loadExampleJson(id: string): Promise<ExampleDoc | null> {
  // Special case: none means blank template, no JSON needed
  if (id === "none") return { circuit: null };

  try {
    const normalizedKey = id.trim();
    const importer =
      exampleImports[normalizedKey] ||
      exampleImports[normalizedKey.toLowerCase()] ||
      exampleImports[normalizedKey.replace(/\s+/g, "-").toLowerCase()] ||
      exampleImports[normalizedKey.replace(/-/g, " ")];
    if (!importer) return null;

    const module = (await importer()) as { default?: ExampleDoc } & ExampleDoc;
    // Handle ES module export formats
    return (module.default || module) as ExampleDoc;
  } catch (e) {
    console.error(`Failed to load example ${id}:`, e);
    return null;
  }
}
