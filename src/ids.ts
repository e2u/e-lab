let seq = 1;

function rand(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq.toString(36)}_${rand()}`;
}

/** After loading a saved circuit, skip past any numeric ids already in use. */
export function rememberIds(ids: Iterable<string>): void {
  for (const id of ids) {
    const parts = id.split("_");
    if (parts.length < 2) continue;
    const n = parseInt(parts[1], 36);
    if (Number.isFinite(n) && n >= seq) seq = n + 1;
  }
}

export function rememberCircuit(circuit: {
  devices: { id: string }[];
  symbols: { id: string }[];
  wires: { id: string }[];
  groups?: { id: string }[];
}): void {
  rememberIds(circuit.devices.map((d) => d.id));
  rememberIds(circuit.symbols.map((s) => s.id));
  rememberIds(circuit.wires.map((w) => w.id));
  rememberIds((circuit.groups ?? []).map((g) => g.id));
}

export function uniqueId(prefix: string, used: Set<string>): string {
  let id = uid(prefix);
  while (used.has(id)) id = uid(prefix);
  used.add(id);
  return id;
}

export function resetSeqForTests(n = 1): void {
  seq = n;
}

/** Repair duplicate ids from older sessions so React keys and lookups stay unique. */
export function sanitizeCircuitIds(circuit: {
  devices: { id: string }[];
  symbols: { id: string }[];
  wires: { id: string }[];
  groups?: { id: string; memberIds: string[] }[];
}): void {
  rememberCircuit(circuit);
  const used = new Set<string>();
  const take = (id: string, prefix: string) => {
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
    return uniqueId(prefix, used);
  };
  for (const d of circuit.devices) d.id = take(d.id, "d");
  for (const s of circuit.symbols) s.id = take(s.id, "s");
  for (const w of circuit.wires) w.id = take(w.id, "w");
  const live = new Set(circuit.symbols.map((s) => s.id));
  if (circuit.groups) {
    for (const g of circuit.groups) {
      g.id = take(g.id, "g");
      g.memberIds = g.memberIds.filter((id) => live.has(id));
    }
    circuit.groups = circuit.groups.filter((g) => g.memberIds.length >= 2);
  }
}

export function nextTag(
  existing: string[],
  prefix: string,
): string {
  const used = new Set(existing);
  for (let i = 1; i < 1000; i += 1) {
    const tag = `${prefix}${i}`;
    if (!used.has(tag)) return tag;
  }
  return `${prefix}${uid("x")}`;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
