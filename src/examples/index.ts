// Dynamic imports for all example JSON files (works in both dev and GitHub Pages)
type ExampleImporter = () => Promise<any>;

const exampleImports: Record<string, ExampleImporter> = {
  none: () => Promise.resolve({ circuit: null }),
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
