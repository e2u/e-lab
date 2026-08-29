// Dynamic imports for all example JSON files (works in both dev and GitHub Pages)
type ExampleImporter = () => Promise<any>;

const exampleImports: Record<string, ExampleImporter> = {
  none: () => Promise.resolve({ circuit: null }),
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
  transformer: () => import("./transformer.json"),
  "three-phase-motor": () => import("./three-phase-motor.json"),
};

export async function loadExampleJson(id: string): Promise<any> {
  // Special case: none means blank template, no JSON needed
  if (id === "none") return { circuit: null };

  try {
    const importer = exampleImports[id];
    if (!importer) return null;

    const module = await importer();
    // Handle ES module export formats
    return module.default || module;
  } catch (e) {
    console.error(`Failed to load example ${id}:`, e);
    return null;
  }
}
