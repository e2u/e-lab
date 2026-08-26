import { sanitizeCircuitIds } from "./ids";
import type { Circuit, ProcessVars } from "./types";
import { tOr } from "./i18n";

export const DOC_VERSION = 1 as const;

export interface LabDoc {
  version: typeof DOC_VERSION;
  name?: string;
  circuit: Circuit;
  process?: ProcessVars;
}

export interface SavedLab {
  id: string;
  name: string;
  savedAt: number;
  doc: LabDoc;
}

const SAVES_KEY = "elab.saves";
const DRAFT_KEY = "elab.draft";

export function isCircuit(value: unknown): value is Circuit {
  if (!value || typeof value !== "object") return false;
  const c = value as Circuit;
  if (!Array.isArray(c.devices) || !Array.isArray(c.symbols) || !Array.isArray(c.wires)) {
    return false;
  }
  const validDevices = c.devices.every(
    (d) => d && typeof d.id === "string" && typeof d.kind === "string" && typeof d.tag === "string",
  );
  if (!validDevices) return false;

  const validSymbols = c.symbols.every(
    (s) =>
      s &&
      typeof s.id === "string" &&
      typeof s.deviceId === "string" &&
      typeof s.variant === "string" &&
      typeof s.x === "number" &&
      typeof s.y === "number",
  );
  if (!validSymbols) return false;

  const validWires = c.wires.every(
    (w) =>
      w &&
      typeof w.id === "string" &&
      w.a &&
      typeof w.a.symbolId === "string" &&
      typeof w.a.term === "string" &&
      w.b &&
      typeof w.b.symbolId === "string" &&
      typeof w.b.term === "string",
  );
  if (!validWires) return false;

  return true;
}

export function parseDoc(raw: unknown): LabDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as LabDoc;
  if (d.version !== DOC_VERSION || !isCircuit(d.circuit)) return null;
  if (!Array.isArray(d.circuit.groups)) d.circuit.groups = [];
  sanitizeCircuitIds(d.circuit);
  return {
    version: DOC_VERSION,
    name: typeof d.name === "string" ? d.name : undefined,
    circuit: d.circuit,
    process: d.process,
  };
}

export function makeDoc(circuit: Circuit, name?: string, process?: ProcessVars): LabDoc {
  return { version: DOC_VERSION, name, circuit, process };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeShare(doc: LabDoc): string {
  const bytes = new TextEncoder().encode(JSON.stringify(doc));
  return `j1.${toBase64Url(bytes)}`;
}

export function decodeShare(payload: string): LabDoc | null {
  const text = payload.trim();
  if (!text.startsWith("j1.")) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(text.slice(3)));
    return parseDoc(JSON.parse(json));
  } catch {
    return null;
  }
}

export function hashFromDoc(doc: LabDoc): string {
  return `#c=${encodeShare(doc)}`;
}

export function docFromHash(hash: string): LabDoc | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const c = params.get("c");
  if (!c) {
    if (raw.startsWith("c=")) return decodeShare(decodeURIComponent(raw.slice(2)));
    return null;
  }
  return decodeShare(c);
}

export function listSaves(): SavedLab[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLab[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && s.doc && isCircuit(s.doc.circuit));
  } catch {
    return [];
  }
}

export function putSave(save: SavedLab): SavedLab[] {
  const all = listSaves().filter((s) => s.id !== save.id);
  all.unshift(save);
  const trimmed = all.slice(0, 40);
  localStorage.setItem(SAVES_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function removeSave(id: string): SavedLab[] {
  const all = listSaves().filter((s) => s.id !== id);
  localStorage.setItem(SAVES_KEY, JSON.stringify(all));
  return all;
}

export function writeDraft(doc: LabDoc): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
}

export function readDraft(): LabDoc | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return parseDoc(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function downloadJson(doc: LabDoc, filename: string): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function startupDoc(
  fallback: () => Circuit,
  fallbackName: string,
): { circuit: Circuit; name: string; process?: ProcessVars } {
  if (typeof window !== "undefined") {
    const shared = docFromHash(window.location.hash);
    if (shared) {
      return {
        circuit: shared.circuit,
        name: shared.name ?? tOr("msg.unnamedDiagram", "Untitled Diagram"),
        process: shared.process,
      };
    }
    const draft = readDraft();
    if (draft) {
      return {
        circuit: draft.circuit,
        name: draft.name ?? tOr("msg.unnamedDiagram", "Untitled Diagram"),
        process: draft.process,
      };
    }
  }
  return { circuit: fallback(), name: fallbackName };
}
