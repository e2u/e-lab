import { resolvedVariant, variantDef } from "./catalog";
import { buildNetGraph, nodeKeysForPort, terminalWorld, wireRoute } from "./geometry";
import type { Circuit, DeviceKind, PortRef, Wire } from "./types";

/** Line-side AC/DC power sources whose connected nets use 10x wire numbers. */
const HV_SOURCE_KINDS = new Set<string>(["mains-3ph", "gen-ac", "gen-dc"]);

function isHvSourceTerminal(kind: string, term: string): boolean {
  if (kind === "mains-3ph") return term === "L1" || term === "L2" || term === "L3" || term === "N";
  if (kind === "gen-ac") return term === "U" || term === "V" || term === "W" || term === "N";
  if (kind === "gen-dc") return term === "+" || term === "-";
  return false;
}

function isControlOnlyVariant(variant: string): boolean {
  return variant === "coil" || variant.startsWith("aux") || variant.startsWith("delayed") || variant.startsWith("inst");
}

/**
 * Terminals on a symbol that belong to the power path.
 * HV numbering may cross these terminals of the *same symbol*, but must not
 * jump to a coil/aux symbol of the same device or to a transformer secondary.
 */
function hvBridgeTerminals(kind: string, variant: string, termIds: string[]): string[] {
  if (isControlOnlyVariant(variant)) return [];
  switch (kind) {
    case "transformer":
      return termIds.filter((id) => id === "H1" || id === "H2" || id === "H3" || id === "H4");
    case "isolator":
    case "breaker-1p":
    case "breaker-3p":
    case "rcd":
    case "fuse":
    case "motor-3ph":
    case "motor-1ph":
    case "motor-dc":
    case "heater":
    case "fan":
      return termIds;
    case "overload":
      return variant === "body" || variant === "main" ? termIds : [];
    case "contactor":
      return variant === "main" ? termIds : [];
    case "starter-dol":
    case "starter-fwd":
    case "starter-rev":
    case "starter-rev-combo":
      return termIds.filter((id) =>
        id === "L1" || id === "L2" || id === "L3" || id === "N" ||
        id === "T1" || id === "T2" || id === "T3" || id === "TN"
      );
    default:
      return [];
  }
}

function portKey(p: PortRef): string {
  return `${p.symbolId}:${p.term}`;
}

/**
 * Wires on the high-voltage power path: start at mains/generator terminals,
 * follow nets, and cross series power devices (isolator, breaker, contactor
 * main, overload, …). Stops at transformer X1/X2 and control-only symbols.
 */
function collectHvWireIds(circuit: Circuit, wires: Wire[]): Set<string> {
  const symbolById = new Map(circuit.symbols.map((s) => [s.id, s]));
  const deviceById = new Map(circuit.devices.map((d) => [d.id, d]));

  const wiresByPort = new Map<string, Wire[]>();
  const addPortWire = (p: PortRef, w: Wire) => {
    const key = portKey(p);
    const list = wiresByPort.get(key);
    if (list) list.push(w);
    else wiresByPort.set(key, [w]);
  };
  for (const w of wires) {
    addPortWire(w.a, w);
    addPortWire(w.b, w);
  }

  const hvWireIds = new Set<string>();
  const visitedPorts = new Set<string>();
  const queue: PortRef[] = [];

  const enqueue = (p: PortRef) => {
    const key = portKey(p);
    if (visitedPorts.has(key)) return;
    visitedPorts.add(key);
    queue.push(p);
  };

  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      if (HV_SOURCE_KINDS.has(dev.kind) && isHvSourceTerminal(dev.kind, p.term)) {
        enqueue(p);
      }
    }
  }

  const graph = buildNetGraph(circuit);
  const wireById = new Map(wires.map((w) => [w.id, w]));

  while (queue.length) {
    const port = queue.shift()!;
    for (const w of wiresByPort.get(portKey(port)) ?? []) {
      hvWireIds.add(w.id);
      enqueue(w.a);
      enqueue(w.b);
    }

    for (const key of nodeKeysForPort(circuit, port)) {
      for (const wireId of graph.nodeToWires.get(key) ?? []) {
        const w = wireById.get(wireId);
        if (!w) continue;
        hvWireIds.add(w.id);
        enqueue(w.a);
        enqueue(w.b);
      }
    }

    const sym = symbolById.get(port.symbolId);
    if (!sym) continue;
    const dev = deviceById.get(sym.deviceId);
    if (!dev) continue;
    const v = resolvedVariant(dev.kind, sym.variant, dev.params);
    for (const term of hvBridgeTerminals(dev.kind, sym.variant, v.terminals.map((t) => t.id))) {
      enqueue({ symbolId: sym.id, term });
    }
  }

  return hvWireIds;
}

const HV_PHASE_RANK: Record<string, number> = {
  L1: 0, U: 0,
  L2: 1, V: 1,
  L3: 2, W: 2,
  N: 3,
};

const POLE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["L1", "T1"],
  ["L2", "T2"],
  ["L3", "T3"],
  ["N", "TN"],
  ["1", "2"],
  ["3", "4"],
  ["5", "6"],
  ["11", "12"],
  ["13", "14"],
  ["21", "22"],
  ["31", "32"],
  ["43", "44"],
  ["95", "96"],
  ["97", "98"],
  ["15", "16"],
  ["15", "18"],
  ["COM", "FWD"],
  ["COM2", "REV"],
];

function isSeriesPowerDevice(kind: string, variant: string): boolean {
  if (isControlOnlyVariant(variant)) return false;
  switch (kind) {
    case "isolator":
    case "breaker-1p":
    case "breaker-3p":
    case "rcd":
    case "fuse":
      return true;
    case "overload":
      return variant === "body" || variant === "main";
    case "contactor":
      return variant === "main";
    case "starter-dol":
    case "starter-fwd":
    case "starter-rev":
    case "starter-rev-combo":
      return true;
    default:
      return false;
  }
}

/** Other-end terminals of the same contact pole (not aliases of `term`). */
function poleMates(kind: DeviceKind, variant: string, term: string, allowed: Set<string>): string[] {
  const v = variantDef(kind, variant);
  if (!allowed.has(term)) return [];
  const terms = v.terminals.filter((t) => allowed.has(t.id));
  const me = terms.find((t) => t.id === term);
  if (!me) return [];

  const parent = new Map<string, string>();
  for (const t of terms) parent.set(t.id, t.id);
  const findT = (id: string): string => {
    let cur = parent.get(id) ?? id;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, parent.get(next) ?? next);
      cur = parent.get(cur)!;
    }
    return cur;
  };
  const unionT = (a: string, b: string) => {
    const ra = findT(a);
    const rb = findT(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (terms[i].x === terms[j].x && terms[i].y === terms[j].y) unionT(terms[i].id, terms[j].id);
    }
  }
  for (const [a, b] of POLE_PAIRS) {
    if (parent.has(a) && parent.has(b)) unionT(a, b);
  }

  const pinKey = (t: { x: number; y: number }) => `${t.x},${t.y}`;
  const pinRep = new Map<string, string>();
  for (const t of terms) {
    if (!pinRep.has(pinKey(t))) pinRep.set(pinKey(t), t.id);
  }
  const mates = terms.filter((t) => findT(t.id) === findT(term) && (t.x !== me.x || t.y !== me.y));
  if (mates.length === 0 && pinRep.size === 2) {
    const other = [...pinRep.values()].find((id) => {
      const ot = terms.find((t) => t.id === id)!;
      return ot.x !== me.x || ot.y !== me.y;
    });
    if (other) {
      const pin = terms.find((t) => t.id === other)!;
      return terms.filter((t) => t.x === pin.x && t.y === pin.y).map((t) => t.id);
    }
  }
  return mates.map((t) => t.id);
}

function otherPoleTerms(kind: DeviceKind, variant: string, term: string): string[] {
  if (!isSeriesPowerDevice(kind, variant)) return [];
  const v = variantDef(kind, variant);
  return poleMates(kind, variant, term, new Set(hvBridgeTerminals(kind, variant, v.terminals.map((t) => t.id))));
}

function isControlSeriesDevice(kind: string, variant: string): boolean {
  if (
    kind === "contactor" ||
    kind === "relay" ||
    kind === "timer-on" ||
    kind === "timer-off" ||
    kind === "timer-ss-on" ||
    kind === "timer-ss-off"
  ) {
    return variant.startsWith("aux") || variant.startsWith("delayed") || variant.startsWith("inst");
  }
  if (kind === "overload") return variant.startsWith("aux");
  if (kind === "fuse" || kind === "breaker-1p") return true;
  switch (kind) {
    case "pb-no":
    case "pb-nc":
    case "estop":
    case "estop-nc":
    case "estop-no":
    case "selector-2":
    case "selector-3":
    case "toggle":
    case "toggle-spst":
    case "toggle-spdt":
    case "toggle-dpst":
    case "toggle-dpdt":
    case "toggle-4pdt":
    case "limit-no":
    case "limit-nc":
    case "foot":
    case "foot-no":
    case "foot-nc":
    case "float":
    case "temp-no":
    case "temp-nc":
    case "pressure-no":
    case "pressure-nc":
    case "flow-no":
    case "flow-nc":
    case "prox":
    case "prox-no":
    case "prox-nc":
    case "photo":
    case "photo-no":
    case "photo-nc":
      return true;
    default:
      return false;
  }
}

function controlPoleTerms(kind: DeviceKind, variant: string, term: string): string[] {
  if (!isControlSeriesDevice(kind, variant)) return [];
  const v = variantDef(kind, variant);
  return poleMates(kind, variant, term, new Set(v.terminals.map((t) => t.id)));
}

function isControlSourceTerminal(kind: string, term: string): boolean {
  if (kind === "transformer") return term === "X1";
  if (kind === "dc-supply") return term === "+" || term === "POS" || term === "1";
  return false;
}

function isCoilA1(kind: string, _variant: string, term: string): boolean {
  if (term === "A1") {
    return (
      kind === "contactor" ||
      kind === "relay" ||
      kind === "timer-on" ||
      kind === "timer-off" ||
      kind === "counter" ||
      kind.startsWith("starter")
    );
  }
  if (term === "2") {
    return kind === "timer-ss-on" || kind === "timer-ss-off";
  }
  return false;
}

/**
 * Control nets in schematic order: finish each X1→coil path (top to bottom)
 * before numbering leftover branches (lamps, alarms).
 */
function collectControlNetOrder(
  circuit: Circuit,
  wires: Wire[],
  find: (i: number) => number,
  isHvRoot: (root: number) => boolean,
): number[] {
  const symbolById = new Map(circuit.symbols.map((s) => [s.id, s]));
  const deviceById = new Map(circuit.devices.map((d) => [d.id, d]));
  const wireIndex = new Map(wires.map((w, i) => [w.id, i]));

  const wiresByPort = new Map<string, Wire[]>();
  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const key = portKey(p);
      const list = wiresByPort.get(key);
      if (list) list.push(w);
      else wiresByPort.set(key, [w]);
    }
  }

  const rootAt = (p: PortRef): number | null => {
    const w = wiresByPort.get(portKey(p))?.[0];
    if (!w) return null;
    const idx = wireIndex.get(w.id);
    return idx === undefined ? null : find(idx);
  };

  const portsByRoot = new Map<number, PortRef[]>();
  for (const w of wires) {
    const idx = wireIndex.get(w.id);
    if (idx === undefined) continue;
    const root = find(idx);
    const list = portsByRoot.get(root) ?? [];
    list.push(w.a, w.b);
    portsByRoot.set(root, list);
  }

  type Edge = { otherRoot: number; y: number; x: number };

  const seriesEdgesFrom = (root: number): Edge[] => {
    const seen = new Set<number>();
    const edges: Edge[] = [];
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      for (const term of controlPoleTerms(dev.kind, sym.variant, p.term)) {
        const other = rootAt({ symbolId: sym.id, term });
        if (other === null || other === root || seen.has(other) || isHvRoot(other)) continue;
        seen.add(other);
        edges.push({ otherRoot: other, y: sym.y, x: sym.x });
      }
    }
    return edges;
  };

  const netHasCoilA1 = (root: number): boolean => {
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (dev && isCoilA1(dev.kind, sym.variant, p.term)) return true;
    }
    return false;
  };

  const coilReach = new Map<number, boolean>();
  const reachesCoil = (root: number, visiting = new Set<number>()): boolean => {
    if (visiting.size === 0 && coilReach.has(root)) return coilReach.get(root)!;
    if (visiting.has(root)) return false;
    visiting.add(root);
    let found = netHasCoilA1(root);
    if (!found) {
      for (const e of seriesEdgesFrom(root)) {
        if (reachesCoil(e.otherRoot, visiting)) {
          found = true;
          break;
        }
      }
    }
    visiting.delete(root);
    if (visiting.size === 0) coilReach.set(root, found);
    return found;
  };

  const sources: { root: number; y: number; x: number }[] = [];
  const sourceSeen = new Set<number>();
  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev || !isControlSourceTerminal(dev.kind, p.term)) continue;
      const root = rootAt(p);
      if (root === null || isHvRoot(root) || sourceSeen.has(root)) continue;
      sourceSeen.add(root);
      sources.push({ root, y: sym.y, x: sym.x });
    }
  }
  sources.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

  const order: number[] = [];
  const seen = new Set<number>();

  const walk = (root: number, preferCoil: boolean) => {
    if (isHvRoot(root)) return;
    if (!seen.has(root)) {
      seen.add(root);
      order.push(root);
    }
    let next = seriesEdgesFrom(root).filter((e) => !seen.has(e.otherRoot) && !isHvRoot(e.otherRoot));
    if (preferCoil) next = next.filter((e) => reachesCoil(e.otherRoot));
    next.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
    for (const e of next) walk(e.otherRoot, preferCoil);
  };

  for (const s of sources) walk(s.root, true);
  for (const s of sources) walk(s.root, false);
  return order;
}

type HvNetMeta = { phase: number; stage: number; onMotorPath: boolean };

/**
 * Rank each HV net for numbering: stage = devices crossed from the source
 * (DISC column, then CB, then KM…), phase = L1/L2/L3/N.
 */
function collectHvNetMeta(
  circuit: Circuit,
  wires: Wire[],
  find: (i: number) => number,
): Map<number, HvNetMeta> {
  const symbolById = new Map(circuit.symbols.map((s) => [s.id, s]));
  const deviceById = new Map(circuit.devices.map((d) => [d.id, d]));
  const wireIndex = new Map(wires.map((w, i) => [w.id, i]));

  const wiresByPort = new Map<string, Wire[]>();
  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const key = portKey(p);
      const list = wiresByPort.get(key);
      if (list) list.push(w);
      else wiresByPort.set(key, [w]);
    }
  }

  type Q = { port: PortRef; phase: number; stage: number };
  const queue: Q[] = [];
  const best = new Map<string, HvNetMeta>();
  const netMeta = new Map<number, HvNetMeta>();

  const enqueue = (port: PortRef, phase: number, stage: number) => {
    const key = portKey(port);
    const prev = best.get(key);
    if (prev && prev.stage <= stage) return;
    best.set(key, { phase, stage, onMotorPath: false });
    queue.push({ port, phase, stage });
  };

  for (const w of wires) {
    for (const p of [w.a, w.b]) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      if (!HV_SOURCE_KINDS.has(dev.kind) || !isHvSourceTerminal(dev.kind, p.term)) continue;
      enqueue(p, HV_PHASE_RANK[p.term] ?? 0, 0);
    }
  }

  while (queue.length) {
    const { port, phase, stage } = queue.shift()!;
    const cur = best.get(portKey(port));
    if (!cur || cur.stage < stage) continue;

    for (const w of wiresByPort.get(portKey(port)) ?? []) {
      const idx = wireIndex.get(w.id);
      if (idx !== undefined) {
        const root = find(idx);
        const prev = netMeta.get(root);
        if (!prev || stage < prev.stage || (stage === prev.stage && phase < prev.phase)) {
          netMeta.set(root, { phase, stage, onMotorPath: false });
        }
      }
      const other = portKey(w.a) === portKey(port) ? w.b : w.a;
      enqueue(other, phase, stage);
    }

    const sym = symbolById.get(port.symbolId);
    if (!sym) continue;
    const dev = deviceById.get(sym.deviceId);
    if (!dev) continue;
    for (const term of otherPoleTerms(dev.kind, sym.variant, port.term)) {
      enqueue({ symbolId: sym.id, term }, phase, stage + 1);
    }
  }

  const rootAt = (p: PortRef): number | null => {
    const w = wiresByPort.get(portKey(p))?.[0];
    if (!w) return null;
    const idx = wireIndex.get(w.id);
    return idx === undefined ? null : find(idx);
  };

  const portsByRoot = new Map<number, PortRef[]>();
  for (const w of wires) {
    const idx = wireIndex.get(w.id);
    if (idx === undefined) continue;
    const root = find(idx);
    const list = portsByRoot.get(root) ?? [];
    list.push(w.a, w.b);
    portsByRoot.set(root, list);
  }

  const netHasMotor = (root: number): boolean => {
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (dev && (dev.kind === "motor-3ph" || dev.kind === "motor-1ph" || dev.kind === "motor-dc")) return true;
    }
    return false;
  };

  const seriesPowerNeighbors = (root: number): number[] => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const p of portsByRoot.get(root) ?? []) {
      const sym = symbolById.get(p.symbolId);
      if (!sym) continue;
      const dev = deviceById.get(sym.deviceId);
      if (!dev) continue;
      for (const term of otherPoleTerms(dev.kind, sym.variant, p.term)) {
        const other = rootAt({ symbolId: sym.id, term });
        if (other === null || other === root || seen.has(other)) continue;
        seen.add(other);
        out.push(other);
      }
    }
    return out;
  };

  const motorMemo = new Map<number, boolean>();
  const reachesMotor = (root: number, visiting = new Set<number>()): boolean => {
    if (visiting.size === 0 && motorMemo.has(root)) return motorMemo.get(root)!;
    if (visiting.has(root)) return false;
    visiting.add(root);
    let found = netHasMotor(root);
    if (!found) {
      const stage = netMeta.get(root)?.stage ?? 99;
      for (const other of seriesPowerNeighbors(root)) {
        const os = netMeta.get(other)?.stage ?? 99;
        if (os > stage && reachesMotor(other, visiting)) {
          found = true;
          break;
        }
      }
    }
    visiting.delete(root);
    if (visiting.size === 0) motorMemo.set(root, found);
    return found;
  };

  for (const [root, meta] of netMeta) {
    netMeta.set(root, { ...meta, onMotorPath: reachesMotor(root) });
  }

  return netMeta;
}

export function applyWireLabels(circuit: Circuit): Circuit {
  const next = circuit;
    const wires = next.wires;
    
    const n = wires.length;
    if (n === 0) return next;

    // First pass: identify special nets and reserve their labels
    const reservedLabels = new Map<string, string>(); // wireId -> reserved label
    
    for (const dev of next.devices) {
      if (dev.kind === "mains-3ph") {
        // Find L1, L2, L3, N connections - these are reserved
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            for (const term of ["L1", "L2", "L3", "N"]) {
              const t = v.terminals.find(t => t.id === term);
              if (t) {
                for (const w of wires) {
                  if ((w.a.symbolId === sym.id && w.a.term === term) ||
                      (w.b.symbolId === sym.id && w.b.term === term)) {
                    switch(term) {
                      case "L1": reservedLabels.set(w.id, "90"); break;
                      case "L2": reservedLabels.set(w.id, "91"); break;
                      case "L3": reservedLabels.set(w.id, "92"); break;
                      case "N": reservedLabels.set(w.id, "93"); break;
                    }
                  }
                }
              }
            }
          }
        }
      } else if (dev.kind === "ground") {
        // PE/Ground is reserved as 0
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            // Find ground terminal (usually "1" or "PE")
            const gndTerm = v.terminals.find(t => t.id === "1" || t.id === "PE");
            if (gndTerm) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === gndTerm.id) ||
                    (w.b.symbolId === sym.id && w.b.term === gndTerm.id)) {
                  reservedLabels.set(w.id, "0");
                }
              }
            }
          }
        }
      } else if (dev.kind === "transformer") {
        // Transformer output: X1 is control circuit hot (reserved 1), X2 is return/ground (reserved 2)
        // Note: H1/H2/H3/H4 are high-voltage input and should NOT be reserved
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            // Check for X1 terminal (control circuit input) - reserved as 1
            const x1Term = v.terminals.find(t => t.id === "X1");
            if (x1Term) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === x1Term.id) ||
                    (w.b.symbolId === sym.id && w.b.term === x1Term.id)) {
                  reservedLabels.set(w.id, "1");
                }
              }
            }
            // Check for X2 terminal (return/ground line) - reserved as 2
            const x2Term = v.terminals.find(t => t.id === "X2");
            if (x2Term) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === x2Term.id) ||
                    (w.b.symbolId === sym.id && w.b.term === x2Term.id)) {
                  reservedLabels.set(w.id, "2");
                }
              }
            }
          }
        }
      } else if (dev.kind === "dc-supply") {
        // Find wires connected to + and -
        for (const sym of next.symbols) {
          if (sym.deviceId === dev.id) {
            const v = variantDef(dev.kind, sym.variant);
            const posTerm = v.terminals.find(t => t.id === "+" || t.id === "POS" || t.id === "1");
            const negTerm = v.terminals.find(t => t.id === "-" || t.id === "NEG" || t.id === "0V" || t.id === "2");
            
            if (posTerm) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === posTerm.id) ||
                    (w.b.symbolId === sym.id && w.b.term === posTerm.id)) {
                  reservedLabels.set(w.id, "1");
                }
              }
            }
            if (negTerm) {
              for (const w of wires) {
                if ((w.a.symbolId === sym.id && w.a.term === negTerm.id) ||
                    (w.b.symbolId === sym.id && w.b.term === negTerm.id)) {
                  reservedLabels.set(w.id, "2");
                }
              }
            }
          }
        }
      }
    }

    // Only reserve specific terminal labels that should NOT be used as wire numbers:
    // - Power phase labels: L1, L2, L3
    // - Neutral: N
    // - Ground/Protective Earth: G, PE
    // - Transformer secondary: X1, X2
    // These are fixed standards that must not conflict with wire numbering
    const reservedTerminalLabels = new Set(["L1", "L2", "L3", "N", "G", "PE", "X1", "X2"]);
    
    const reservedTags = new Set<string>();
    next.devices.forEach(d => {
      if (d.tag.trim()) reservedTags.add(d.tag.trim());
    });
    next.symbols.forEach(s => {
      const dev = next.devices.find(d => d.id === s.deviceId);
      if (dev) {
        const v = resolvedVariant(dev.kind, s.variant, dev.params);
        v.terminals.forEach(t => {
          if (t.label.trim() && reservedTerminalLabels.has(t.label)) {
            reservedTags.add(t.label.trim());
          }
        });
      }
    });

    // Union-Find for grouping connected wires
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i: number): number {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    }
    function union(i: number, j: number) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootI] = rootJ;
      }
    }

    const graph = buildNetGraph(next);
    const wireIndex = new Map(wires.map((w, i) => [w.id, i]));
    for (const ids of graph.nodeToWires.values()) {
      let first: number | undefined;
      for (const id of ids) {
        const idx = wireIndex.get(id);
        if (idx === undefined) continue;
        if (first === undefined) first = idx;
        else union(first, idx);
      }
    }

    const components = new Map<number, string>();
    
    // First pass: assign reserved labels to their connected components
    const rootLabels = new Map<number, string>();
    
    for (const [wireId, label] of reservedLabels) {
      const wireIdx = wires.findIndex(w => w.id === wireId);
      if (wireIdx >= 0) {
        const root = find(wireIdx);
        if (!rootLabels.has(root)) {
          rootLabels.set(root, label);
        }
      }
    }

    // Calculate bounds for sorting by position
    // Use wire route start point (from terminalWorld) to determine reading order
    const componentBounds = new Map<number, { leftX: number; topY: number }>();
    
    wires.forEach((w, i) => {
      const root = find(i);
      if (!componentBounds.has(root)) {
        // Get wire endpoints using terminalWorld
        const a = terminalWorld(next, w.a);
        const b = terminalWorld(next, w.b);
        
        if (a && b) {
          // Use the topmost-leftmost point as the sorting anchor
          // Sort by y (top to bottom), then by x (left to right)
          const top = b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a;
          componentBounds.set(root, { leftX: top.x, topY: top.y });
        } else {
          // Fallback: use min x and y of wire route
          const pts = wireRoute(next, w.a, w.b, w.jog);
          let minX = Infinity, minY = Infinity;
          for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
          }
          componentBounds.set(root, { leftX: minX, topY: minY });
        }
      }
    });

    // Circuit type (HV vs control) is *not* the same as Union-Find nets.
    // Union-Find groups wires that share a port (same wire number). HV status
    // must also cross series power devices (DISC → CB → KM main → OL → motor)
    // without leaking through transformer secondaries or contactor coils.
    const hvWireIds = collectHvWireIds(next, wires);
    const hvNetMeta = collectHvNetMeta(next, wires, find);
    const isHVCircuitMap = new Map<number, boolean>();

    function determineCircuitType(root: number): boolean {
      if (isHVCircuitMap.has(root)) return isHVCircuitMap.get(root)!;
      let isHV = false;
      for (let i = 0; i < wires.length; i++) {
        if (find(i) === root && hvWireIds.has(wires[i].id)) {
          isHV = true;
          break;
        }
      }
      isHVCircuitMap.set(root, isHV);
      return isHV;
    }

    // Control nets: top to bottom, then left to right.
    // HV nets: by hop from the source (DISC column, then CB, then KM…),
    // then L1 / L2 / L3 — not "finish L1 all the way, then L2".
    const controlSortedRoots = Array.from(componentBounds.entries())
      .sort((a, b) => {
        if (a[1].topY !== b[1].topY) return a[1].topY - b[1].topY;
        return a[1].leftX - b[1].leftX;
      });
    const hvFallback: HvNetMeta = { phase: 99, stage: 99, onMotorPath: false };
    const hvSortedRoots = Array.from(componentBounds.keys())
      .sort((a, b) => {
        const ma = hvNetMeta.get(a) ?? hvFallback;
        const mb = hvNetMeta.get(b) ?? hvFallback;
        // Motor starter path first; transformer primary spurs after, so they
        // don't steal 10x numbers from the L1/L2/L3 columns.
        const aMain = ma.onMotorPath ? 0 : 1;
        const bMain = mb.onMotorPath ? 0 : 1;
        if (aMain !== bMain) return aMain - bMain;
        if (ma.stage !== mb.stage) return ma.stage - mb.stage;
        if (ma.phase !== mb.phase) return ma.phase - mb.phase;
        const ba = componentBounds.get(a)!;
        const bb = componentBounds.get(b)!;
        if (ba.leftX !== bb.leftX) return ba.leftX - bb.leftX;
        return ba.topY - bb.topY;
      });
    
    // Mark transformer internal jumper wires (single-phase transformers)
    // H1 and H4 are primary input terminals, H2 and H3 are tap terminals
    // Two common jumper configurations:
    //   Mode 1: H1->H3 (input to tap), H2->H4 (tap to input)
    //   Mode 2: H3->H2 (tap to tap - shorting taps together)
    // These should not get wire numbers as they are internal connections
    
    // Mark transformer jumper wires - only H1 and H4 are primary input terminals
    // For single-phase transformers:
    //   - H1 and H4 connect to mains (L1/L2/L3) - these should be numbered (HV)
    //   - H2 and H3 are tap terminals - connections to them don't need labels
    // A wire is a "transformer internal jumper" if it connects H1-H2, H1-H3, H2-H4, or H3-H4
    
    const transformerInternalJumperWireIds = new Set<string>();
    
    for (const dev of next.devices) {
      if (dev.kind === "transformer") {
        // Find all transformer symbols
        const transformerSyms = next.symbols.filter(s => s.deviceId === dev.id);
        
        for (const sym of transformerSyms) {
          const v = variantDef(dev.kind, sym.variant);
          const hasH1 = v.terminals.some(t => t.id === "H1");
          const hasH2 = v.terminals.some(t => t.id === "H2");
          const hasH3 = v.terminals.some(t => t.id === "H3");
          const hasH4 = v.terminals.some(t => t.id === "H4");
          
          // Check H1->H2 connection (input to first tap)
          if (hasH1 && hasH2) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H1" && w.b.term === "H2") ||
                  (w.a.symbolId === sym.id && w.a.term === "H2" && w.b.term === "H1") ||
                  (w.b.symbolId === sym.id && w.b.term === "H1" && w.a.term === "H2") ||
                  (w.b.symbolId === sym.id && w.b.term === "H2" && w.a.term === "H1")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
          
          // Check H1->H3 connection (input to second tap)
          if (hasH1 && hasH3) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H1" && w.b.term === "H3") ||
                  (w.a.symbolId === sym.id && w.a.term === "H3" && w.b.term === "H1") ||
                  (w.b.symbolId === sym.id && w.b.term === "H1" && w.a.term === "H3") ||
                  (w.b.symbolId === sym.id && w.b.term === "H3" && w.a.term === "H1")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
          
          // Check H2->H4 connection (first tap to input)
          if (hasH2 && hasH4) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H2" && w.b.term === "H4") ||
                  (w.a.symbolId === sym.id && w.a.term === "H4" && w.b.term === "H2") ||
                  (w.b.symbolId === sym.id && w.b.term === "H2" && w.a.term === "H4") ||
                  (w.b.symbolId === sym.id && w.b.term === "H4" && w.a.term === "H2")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
          
          // Check H3->H4 connection (second tap to input)
          if (hasH3 && hasH4) {
            for (const w of wires) {
              if ((w.a.symbolId === sym.id && w.a.term === "H3" && w.b.term === "H4") ||
                  (w.a.symbolId === sym.id && w.a.term === "H4" && w.b.term === "H3") ||
                  (w.b.symbolId === sym.id && w.b.term === "H3" && w.a.term === "H4") ||
                  (w.b.symbolId === sym.id && w.b.term === "H4" && w.a.term === "H3")) {
                transformerInternalJumperWireIds.add(w.id);
              }
            }
          }
        }
      }
    }
    
    // Assign sequential labels. Reserved nets (90/91/92, X1=1, X2=2) first;
    // remaining HV nets by stage then phase; control nets along X1→coil
    // paths first, then leftover branches (lamps / alarms).
    const controlOrder = collectControlNetOrder(next, wires, find, determineCircuitType);
    let hvCounter = 100;
    let controlCounter = 1;
    const usedLabels = new Set<string>([...reservedTags, ...rootLabels.values()]);

    const assignIfNeeded = (root: number, asHv: boolean) => {
      if (components.has(root)) return;
      const reserved = rootLabels.get(root);
      if (reserved) {
        components.set(root, reserved);
        return;
      }
      if (asHv !== determineCircuitType(root)) return;
      let label = asHv ? `${hvCounter++}` : `${controlCounter++}`;
      while (usedLabels.has(label)) {
        label = asHv ? `${hvCounter++}` : `${controlCounter++}`;
      }
      usedLabels.add(label);
      components.set(root, label);
    };

    for (const root of hvSortedRoots) assignIfNeeded(root, true);
    for (const root of controlOrder) assignIfNeeded(root, false);
    for (const [root] of controlSortedRoots) assignIfNeeded(root, false);

    // Set labels for all wires
    wires.forEach((w, i) => {
      const root = find(i);
      
      // Check if this specific wire is a transformer internal jumper
      // If so, don't assign a label even if the component has one
      const isTransformerJumper = transformerInternalJumperWireIds.has(w.id);
      
      if (isTransformerJumper) {
        w.label = "";
      } else {
        w.label = components.get(root)!;
      }
    });

    return next;

}
