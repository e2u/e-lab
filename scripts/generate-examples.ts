import { ALL_20_EXAMPLES } from "../src/examplesBuilder";
import { makeDoc } from "../src/persist";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const outDir = join(__dirname, "../src/examples");
mkdirSync(outDir, { recursive: true });

for (const ex of ALL_20_EXAMPLES) {
  const circuit = ex.build();
  const doc = makeDoc(circuit, ex.id);
  const filePath = join(outDir, `${ex.id}.json`);
  writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n", "utf-8");
  console.log(`Updated ${filePath}`);
}

console.log("All 20 examples generated successfully!");
