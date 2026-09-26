import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const EXAMPLES_DIR = path.join(process.cwd(), 'src/examples');
const LIST_JSON_PATH = path.join(EXAMPLES_DIR, 'list.json');
const INDEX_TS_PATH = path.join(EXAMPLES_DIR, 'index.ts');

interface ExampleMetadata {
  id: string;
  title: string;
  blurb: string;
  hash: string;
  filename: string;
}

interface ListJson {
  metadata?: {
    hashes: Record<string, string>;
  };
  examples: Array<{
    id: string;
    title: string;
    blurb: string;
  }>;
}

function getHash(filePath: string): string {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * 解析單個 JSON 文件以獲取元數據
 */
function getExampleData(filePath: string, filename: string): ExampleMetadata | null {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    const title = content.name || filename.replace('.json', '');
    let blurb = '';

    if (content.circuit && content.circuit.devices) {
      const tb = content.circuit.devices.find((d: { kind?: string; params?: { description?: string } }) => d.kind === 'title-block');
      if (tb && tb.params) {
        blurb = tb.params.description || '';
      }
    }

    // Default ID generation logic
    let id = filename.replace('.json', '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Special case overrides for known non-standard mappings
    if (filename === 'BaseTemplate.json') id = 'base-template';
    if (filename === 'blank-template.json') id = 'blank-template';

    return {
      id,
      title,
      blurb,
      hash: getHash(filePath),
      filename
    };
  } catch (e) {
    console.error(`❌ 錯誤解析 ${filename}:`, e);
    return null;
  }
}

async function main() {
  console.log("🔍 開始掃描 examples 目錄...");

  // 定義特殊不需要對應文件的 ID
  const SPECIAL_IDS: Record<string, { id: string, importPath: string }> = {
    'none': { id: 'none', importPath: '() => Promise.resolve({ circuit: null })' },
  };

  const filesOnDisk = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.json') && f !== 'list.json');
  const diskExamplesMap = new Map<string, ExampleMetadata>(); // key is id

  for (const file of filesOnDisk) {
    const data = getExampleData(path.join(EXAMPLES_DIR, file), file);
    if (data) diskExamplesMap.set(data.id, data);
  }

  // Load existing list.json
  let listJson: ListJson = { examples: [] };
  if (fs.existsSync(LIST_JSON_PATH)) {
    try {
        listJson = JSON.parse(fs.readFileSync(LIST_JSON_PATH, 'utf-8'));
    } catch (_e) {
        console.warn("⚠️ 無法讀取舊的 list.json，將建立新的。");
    }
  }

  const oldHashes = listJson.metadata?.hashes || {};
  const newHashes: Record<string, string> = {};
  let updated = false;

  const nextEntries: Array<{ id: string; title: string; blurb: string }> = [];
  const processedIds = new Set<string>();

  // 1. Process existing entries in list.json to see if they changed or are still valid
  for (const existing of listJson.examples) {
    if (SPECIAL_IDS[existing.id]) {
      nextEntries.push(existing);
      processedIds.add(existing.id);
      continue;
    }

    let match: ExampleMetadata | undefined;
    if (diskExamplesMap.has(existing.id)) {
        match = diskExamplesMap.get(existing.id);
    } else {
        for (const ce of diskExamplesMap.values()) {
            if (ce.filename === `${existing.id}.json` || ce.id === existing.id) {
                match = ce;
                break;
            }
        }
    }

    if (match) {
      processedIds.add(match.id);
      newHashes[match.filename] = match.hash;

      if (oldHashes[match.filename] !== match.hash || 
          existing.title !== match.title || 
          existing.blurb !== match.blurb) {
        console.log(`🔄 更新內容: ${match.id}`);
        nextEntries.push({ id: match.id, title: match.title, blurb: match.blurb });
        updated = true;
      } else {
        nextEntries.push(existing);
      }
    } else {
      if (existing.id === 'none') {
        console.log("ℹ️ Preserving special entry: none");
        nextEntries.push(existing);
      } else {
        console.log(`🗑️ Removing deleted example: ${existing.id}`);
        updated = true;
      }
    }
  }

  // 2. Add brand new files found on disk
  for (const [id, ce] of diskExamplesMap.entries()) {
    if (!processedIds.has(id)) {
      console.log(`✨ Found new example: ${ce.title} (${ce.filename})`);
      nextEntries.push({ id: ce.id, title: ce.title, blurb: ce.blurb });
      newHashes[ce.filename] = ce.hash;
      updated = true;
      processedIds.add(id);
    }
  }

  if (!updated && Object.keys(newHashes).length === Object.keys(oldHashes).length) {
     console.log("✅ Everything is up to date.");
     return;
  }

  // Write updated list.json
  const finalListJson: ListJson = {
    metadata: { hashes: newHashes },
    examples: nextEntries
  };
  fs.writeFileSync(LIST_JSON_PATH, JSON.stringify(finalListJson, null, 2) + "\n", 'utf-8');
  console.log(`📝 Updated ${LIST_JSON_PATH}`);

  // 4. 同步 index.ts
  console.log("🔄 同步 src/examples/index.ts...");
  const indexContent = fs.readFileSync(INDEX_TS_PATH, 'utf-8');
  const importPattern = /const exampleImports: Record<string, ExampleImporter> = \{([\s\S]*?)\};/;
  const match = indexContent.match(importPattern);

  if (match) {
    const oldBody = match[1];
    const lines = oldBody.split('\n');
    const manualOverrides: Record<string, string> = {};

    const mappingRegex = /^\s*"?([^"\s]+)"?:\s*(.+),$/;

    for (const line of lines) {
      const m = line.match(mappingRegex);
      if (m) {
        const key = m[1];
        const val = m[2].trim();
        if (!val.includes('import("./') || SPECIAL_IDS[key]) {
          manualOverrides[key] = val;
        }
      }
    }

    const SPECIAL_ALIASES: Record<string, string> = {
      'project-05': '() => import("./Project 05-Off-Delay.json")',
      'Project 05': '() => import("./Project 05-Off-Delay.json")',
      'Project 05-Off-Delay': '() => import("./Project 05-Off-Delay.json")',
      'Project 05-On-Delay': '() => import("./Project 05-On-Delay.json")',
      'Project 06': '() => import("./Project 06.json")',
      'Project 06-Single-Timer': '() => import("./Project 06-Single-Timer.json")',
    };

    const newBodyLines: string[] = [];
    
    // A. Special entries that are NOT on disk but should be in index.ts
    const prioritySpecials = ['none', 'L', 'N'];
    for (const specId of prioritySpecials) {
       if (SPECIAL_IDS[specId]) {
         newBodyLines.push(`  "${specId}": ${SPECIAL_IDS[specId].importPath},`);
       }
    }

    // B. All unique non-special entries from disk
    const sortedDiskExamples = Array.from(diskExamplesMap.values()).sort((a, b) => a.id.localeCompare(b.id));
    for (const ce of sortedDiskExamples) {
      if (manualOverrides[ce.id]) {
         newBodyLines.push(`  "${ce.id}": ${manualOverrides[ce.id]},`);
      } else {
         newBodyLines.push(`  "${ce.id}": () => import("./${ce.filename}"),`);
      }
    }

    // C. Other manual overrides & aliases
    for (const [key, val] of Object.entries({ ...SPECIAL_ALIASES, ...manualOverrides })) {
       if (!newBodyLines.some(line => line.includes(`"${key}":`))) {
          newBodyLines.push(`  "${key}": ${val},`);
       }
    }

    const newBody = newBodyLines.join('\n');
    const updatedIndexContent = indexContent.replace(importPattern, `const exampleImports: Record<string, ExampleImporter> = {\n${newBody}\n};`);
    
    fs.writeFileSync(INDEX_TS_PATH, updatedIndexContent, 'utf-8');
    console.log(`📝 Updated ${INDEX_TS_PATH}`);
  } else {
    console.error("❌ Could not find exampleImports in index.ts");
  }

  console.log("🎉 Done!");
}

main();
