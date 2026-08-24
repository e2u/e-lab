// Dynamic imports for all example JSON files (works in both dev and GitHub Pages)
type ExampleImporter = () => Promise<any>;

const exampleImports: Record<string, ExampleImporter> = {
  dol: () => import("./dol.json"),
  lamp: () => import("./lamp.json"),
  list: () => import("./list.json"),
  rev: () => import("./rev.json"),
  selrev: () => import("./selrev.json"),
  "three-phase-motor": () => import("./three-phase-motor.json"),
  transformer: () => import("./transformer.json"),
  yd: () => import("./yd.json"),
};

export async function loadExampleJson(id: string): Promise<any> {
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
