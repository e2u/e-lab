import { KINDS } from "../catalog";
import { nodeKey, portDevice, findWireAtPoint } from "../geometry";
import {
  GRID,
  type Circuit,
  type Device,
  type DeviceKind,
  type DeviceRuntime,
  type Fault,
  type PortRef,
  type Potential,
  type PotentialKind,
  type ProcessVars,
  type SimSnapshot,
  type Wire,
  type WireLive,
} from "../types";

export const PHASE_COLOR: Record<PotentialKind, string> = {
  L1: "#a65628", // Brown
  L2: "#ff7f00", // Orange
  L3: "#eccd26", // Yellow
  N: "#0284c7", // Blue (Neutral)
  PE: "#2ca02c", // Green (Earth/Ground)
  "DC+": "#dc2626", // Red (DC+)
  "DC-": "#1a5f8a", // Navy Blue (DC-)
};

export function matchNetLabelPhase(tag: string): PotentialKind | null {
  const t = tag.trim().toUpperCase();
  if (!t) return null;
  if (/^(L1|PHASE[ _-]*1|PHASE[ _-]*A|LINE[ _-]*1)\b/i.test(t)) return "L1";
  if (/^(L2|PHASE[ _-]*2|PHASE[ _-]*B|LINE[ _-]*2)\b/i.test(t)) return "L2";
  if (/^(L3|PHASE[ _-]*3|PHASE[ _-]*C|LINE[ _-]*3)\b/i.test(t)) return "L3";
  if (/^(N|NEUTRAL|N[\d_-]*)$/i.test(t)) return "N";
  if (/^(PE|GND|GROUND|EARTH|G|E)$/i.test(t)) return "PE";
  if (/^(DC\+|\+24V|\+12V|\+48V|\+5V|VCC|V\+|\+)$/i.test(t)) return "DC+";
  if (/^(DC-|0V|-24V|-12V|COM|V-|-)$/i.test(t)) return "DC-";
  return null;
}

export function directTerminalPotential(circuit: Circuit, port: PortRef): PotentialKind | null {
  const sym = circuit.symbols.find((s) => s.id === port.symbolId);
  if (!sym) return null;
  const dev = circuit.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return null;
  if (dev.kind === "ground") return "PE";
  if (port.term === "PE" || port.term === "GND" || port.term === "EARTH" || port.term === "G" || port.term === "E") {
    return "PE";
  }
  if (dev.kind === "net-label") return matchNetLabelPhase(dev.tag);
  if (dev.kind === "mains-3ph") {
    if (port.term === "L1") return "L1";
    if (port.term === "L2") return "L2";
    if (port.term === "L3") return "L3";
    if (port.term === "N") return "N";
    if (port.term === "PE") return "PE";
  }
  if (dev.kind === "dc-supply") {
    if (port.term === "+") return "DC+";
    if (port.term === "-") return "DC-";
  }
  if (dev.kind === "gen-ac") {
    if (port.term === "U") return "L1";
    if (port.term === "V") return "L2";
    if (port.term === "W") return "L3";
    if (port.term === "N") return "N";
  }
  if (dev.kind === "gen-dc") {
    if (port.term === "+") return "DC+";
    if (port.term === "-") return "DC-";
  }
  if (dev.kind === "transformer") {
    if (port.term === "X1" || port.term === "S1") return "L1";
    if (port.term === "X2" || port.term === "S2") return "N";
  }
  return null;
}

export function defaultRuntime(kind: DeviceKind): DeviceRuntime {
  const closedHandle =
    kind === "breaker-1p" ||
    kind === "breaker-3p" ||
    kind === "isolator" ||
    kind === "rcd" ||
    kind === "dc-supply" ||
    kind === "fuse";
  return {
    energized: false,
    energizedAlt: false,
    actuated: false,
    on: closedHandle,
    tripped: false,
    position: 0,
    elapsedMs: 0,
    count: 0,
    done: false,
    rpm: 0,
    direction: 0,
    lit: false,
    prevEnergized: false,
    prevPulse: false,
    starDelta: null,
    short: false,
    meterValue: 0,
    meterUnit: kind === "ammeter" ? "A" : "V",
  };
}

export function createRuntime(circuit: Circuit): Record<string, DeviceRuntime> {
  const runtime: Record<string, DeviceRuntime> = {};
  for (const d of circuit.devices) runtime[d.id] = defaultRuntime(d.kind);

  // Synchronize and enforce mutual exclusion for limit switches with the same tag (up to 2)
  const limitByTag = new Map<string, Device[]>();
  for (const d of circuit.devices) {
    if (d.kind === "limit-no" || d.kind === "limit-nc") {
      const tag = d.tag.trim();
      if (tag) {
        const list = limitByTag.get(tag) ?? [];
        list.push(d);
        limitByTag.set(tag, list);
      }
    }
  }
  for (const [, list] of limitByTag) {
    if (list.length === 2) {
      const [d1, d2] = list;
      if (d1.kind === "limit-nc" && d2.kind === "limit-nc") {
        if (runtime[d2.id]) runtime[d2.id].actuated = true;
      }
    }
  }

  return runtime;
}

export function emptySnapshot(circuit: Circuit): SimSnapshot {
  const runtime = createRuntime(circuit);
  const uf = new UnionFind();
  const link = (x: string, y: string) => {
    uf.union(x, y);
  };
  for (const d of circuit.devices) {
    for (const term of allTerminals(d.kind)) uf.add(nk(d.id, term));
  }

  for (const w of circuit.wires) {
    if (w.broken) continue;
    const a = portDevice(circuit, w.a);
    const b = portDevice(circuit, w.b);
    if (a && b) link(nk(a.deviceId, a.term), nk(b.deviceId, b.term));
  }

  linkNetLabels(circuit, link);

  for (const d of circuit.devices) {
    const rt = runtime[d.id];
    for (const [a, b] of bridges(d, rt)) link(nk(d.id, a), nk(d.id, b));
  }

  const stamp = new Map<string, Potential[]>();
  const stampNode = (deviceId: string, term: string, p: Potential) => {
    const root = uf.find(nk(deviceId, term));
    const list = stamp.get(root) ?? [];
    if (!list.some((e) => e.kind === p.kind && e.sourceId === p.sourceId)) {
      list.push(p);
      stamp.set(root, list);
    }
  };

  for (const d of circuit.devices) {
    if (d.kind === "mains-3ph") {
      stampNode(d.id, "L1", { sourceId: d.id, kind: "L1" });
      stampNode(d.id, "L2", { sourceId: d.id, kind: "L2" });
      stampNode(d.id, "L3", { sourceId: d.id, kind: "L3" });
      const sym = circuit.symbols.find((s) => s.deviceId === d.id);
      const isDelta = d.params.supplyType === "delta" || sym?.variant === "delta";
      if (!isDelta) {
        stampNode(d.id, "N", { sourceId: d.id, kind: "N" });
      }
      stampNode(d.id, "PE", { sourceId: d.id, kind: "PE" });
    }
    if (d.kind === "ground") {
      stampNode(d.id, "1", { sourceId: d.id, kind: "PE" });
    }
    if (d.kind === "dc-supply") {
      stampNode(d.id, "+", { sourceId: d.id, kind: "DC+" });
      stampNode(d.id, "-", { sourceId: d.id, kind: "DC-" });
    }
    if (d.kind === "gen-ac") {
      stampNode(d.id, "U", { sourceId: d.id, kind: "L1" });
      stampNode(d.id, "V", { sourceId: d.id, kind: "L2" });
      stampNode(d.id, "W", { sourceId: d.id, kind: "L3" });
      stampNode(d.id, "N", { sourceId: d.id, kind: "N" });
    }
    if (d.kind === "gen-dc") {
      stampNode(d.id, "+", { sourceId: d.id, kind: "DC+" });
      stampNode(d.id, "-", { sourceId: d.id, kind: "DC-" });
    }
    if (d.kind === "transformer") {
      stampNode(d.id, "X1", { sourceId: `xf-${d.id}`, kind: "L1" });
      stampNode(d.id, "X2", { sourceId: `xf-${d.id}`, kind: "N" });
      stampNode(d.id, "S1", { sourceId: `xf-${d.id}`, kind: "L1" });
      stampNode(d.id, "S2", { sourceId: `xf-${d.id}`, kind: "N" });
    }
  }

  const wires: Record<string, WireLive> = {};
  for (const w of circuit.wires) {
    if (w.broken) {
      wires[w.id] = { live: false, kind: null, dir: 0 };
      continue;
    }
    const directA = directTerminalPotential(circuit, w.a);
    const directB = directTerminalPotential(circuit, w.b);
    let kind: PotentialKind | null = null;
    if (directA === "PE" || directB === "PE") {
      kind = "PE";
    } else if (directA) {
      kind = directA;
    } else if (directB) {
      kind = directB;
    } else {
      const a = portDevice(circuit, w.a);
      const b = portDevice(circuit, w.b);
      let p: Potential | null = null;
      if (a) p = potOf(stamp, uf, nk(a.deviceId, a.term));
      if (!p && b) p = potOf(stamp, uf, nk(b.deviceId, b.term));
      kind = p?.kind ?? null;
    }
    wires[w.id] = { live: false, kind, dir: 0 };
  }

  return {
    runtime,
    potentials: {},
    wires,
    faults: [],
    timeMs: 0,
  };
}

function allTerminals(kind: DeviceKind): string[] {
  const names = new Set<string>();
  for (const v of Object.values(KINDS[kind].variants)) {
    for (const t of v.terminals) names.add(t.id);
  }
  return [...names];
}

/** Same-tag net labels are one electrical node. Empty tags stay isolated. */
function linkNetLabels(circuit: Circuit, link: (a: string, b: string) => void): void {
  const groups = new Map<string, string[]>();
  for (const d of circuit.devices) {
    if (d.kind !== "net-label") continue;
    const tag = d.tag.trim();
    if (!tag) continue;
    const list = groups.get(tag) ?? [];
    list.push(nk(d.id, "1"));
    groups.set(tag, list);
  }
  for (const nodes of groups.values()) {
    for (let i = 1; i < nodes.length; i += 1) link(nodes[0], nodes[i]);
  }
}

class UnionFind {
  parent = new Map<string, string>();

  add(n: string): void {
    if (!this.parent.has(n)) this.parent.set(n, n);
  }

  find(n: string): string {
    this.add(n);
    const p = this.parent.get(n)!;
    if (p !== n) {
      const r = this.find(p);
      this.parent.set(n, r);
      return r;
    }
    return n;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function voltageBetween(a: Potential | null, b: Potential | null): boolean {
  if (!a || !b) return false;
  if (a.sourceId !== b.sourceId) return false;
  if (a.kind === b.kind) return false;
  const ac: PotentialKind[] = ["L1", "L2", "L3", "N"];
  if (ac.includes(a.kind) && ac.includes(b.kind)) return true;
  if (
    (a.kind === "DC+" && b.kind === "DC-") ||
    (a.kind === "DC-" && b.kind === "DC+")
  ) {
    return true;
  }
  return false;
}

function hasVoltageBetween(potsA: Potential[], potsB: Potential[]): boolean {
  for (const pa of potsA) {
    for (const pb of potsB) {
      if (voltageBetween(pa, pb)) return true;
    }
  }
  return false;
}

function lineToPhase(v: number): number {
  if (v === 380) return 220;
  if (v === 480) return 277;
  if (v === 208) return 120;
  if (v === 600) return 347;
  return Math.round(v / Math.sqrt(3));
}

function getTransformerSecondaryVoltage(xfDev?: Device): number {
  if (!xfDev) return 120;
  if (xfDev.params.secondaryVoltage !== undefined) return xfDev.params.secondaryVoltage;
  if (xfDev.params.secondaryVolts) {
    const v = Number(xfDev.params.secondaryVolts);
    if (!isNaN(v) && v > 0) return v;
  }
  if (xfDev.params.ratio) {
    const parts = xfDev.params.ratio.split("/");
    if (parts.length >= 2) {
      const v = Number(parts[1]);
      if (!isNaN(v) && v > 0) return v;
    }
  }
  return 120;
}

export function computeVoltage(
  potsA: Potential[],
  potsB: Potential[],
  circuit?: Circuit,
): number {
  for (const pa of potsA) {
    for (const pb of potsB) {
      if (pa.sourceId === pb.sourceId) {
        // Look up source device
        const srcDev = circuit?.devices.find((d) => d.id === pa.sourceId);
        const baseV = srcDev?.params?.voltage ?? 480;

        // Line-to-Line (480V nominal AC or user defined)
        if (
          (pa.kind === "L1" && (pb.kind === "L2" || pb.kind === "L3")) ||
          (pa.kind === "L2" && (pb.kind === "L1" || pb.kind === "L3")) ||
          (pa.kind === "L3" && (pb.kind === "L1" || pb.kind === "L2"))
        ) {
          return baseV;
        }
        // Line-to-Neutral (277V for 480V 3-phase system or transformer secondary)
        if (
          (isHotKind(pa.kind) && pb.kind === "N") ||
          (pa.kind === "N" && isHotKind(pb.kind))
        ) {
          if (pa.sourceId.startsWith("xf-") || pb.sourceId.startsWith("xf-")) {
            const xfId = (pa.sourceId.startsWith("xf-") ? pa.sourceId : pb.sourceId).replace("xf-", "");
            const xfDev = circuit?.devices.find((d) => d.id === xfId);
            return getTransformerSecondaryVoltage(xfDev);
          }
          return lineToPhase(baseV);
        }
        // DC+ to DC- (24V)
        if (
          (pa.kind === "DC+" && pb.kind === "DC-") ||
          (pa.kind === "DC-" && pb.kind === "DC+")
        ) {
          return 24;
        }
      }
      // Line to PE (Ground reference)
      if (
        (isHotKind(pa.kind) && pb.kind === "PE") ||
        (pa.kind === "PE" && isHotKind(pb.kind))
      ) {
        if (pa.sourceId.startsWith("xf-") || pb.sourceId.startsWith("xf-")) {
          const xfId = (pa.sourceId.startsWith("xf-") ? pa.sourceId : pb.sourceId).replace("xf-", "");
          const xfDev = circuit?.devices.find((d) => d.id === xfId);
          return getTransformerSecondaryVoltage(xfDev);
        }
        const srcId = isHotKind(pa.kind) ? pa.sourceId : pb.sourceId;
        const srcDev = circuit?.devices.find((d) => d.id === srcId);
        const baseV = srcDev?.params?.voltage ?? 480;
        return lineToPhase(baseV);
      }
      // Transformer secondary cross-check
      if (
        (pa.sourceId.startsWith("xf-") && isHotKind(pa.kind) && pb.kind === "N") ||
        (pb.sourceId.startsWith("xf-") && isHotKind(pb.kind) && pa.kind === "N")
      ) {
        const xfId = (pa.sourceId.startsWith("xf-") ? pa.sourceId : pb.sourceId).replace("xf-", "");
        const xfDev = circuit?.devices.find((d) => d.id === xfId);
        return getTransformerSecondaryVoltage(xfDev);
      }
    }
  }
  return 0;
}

function phaseIndex(p: Potential | null): number | null {
  if (!p) return null;
  if (p.kind === "L1") return 0;
  if (p.kind === "L2") return 1;
  if (p.kind === "L3") return 2;
  return null;
}

function permutationDir(u: number, v: number, w: number): 1 | -1 | 0 {
  if (new Set([u, v, w]).size !== 3) return 0;
  let inv = 0;
  const arr = [u, v, w];
  for (let i = 0; i < 3; i += 1) {
    for (let j = i + 1; j < 3; j += 1) {
      if (arr[i] > arr[j]) inv += 1;
    }
  }
  return inv % 2 === 0 ? 1 : -1;
}

function nodePots(
  stamp: Map<string, Potential[]>,
  uf: UnionFind,
  node: string,
): Potential[] {
  return stamp.get(uf.find(node)) ?? [];
}

function potOf(
  stamp: Map<string, Potential[]>,
  uf: UnionFind,
  node: string,
  preferredSourceId?: string,
): Potential | null {
  const list = stamp.get(uf.find(node));
  if (!list || list.length === 0) return null;
  if (preferredSourceId) {
    const match = list.find((p) => p.sourceId === preferredSourceId);
    if (match) return match;
  }
  const hot = list.find((p) => isHotKind(p.kind));
  if (hot) return hot;
  const ret = list.find((p) => p.kind === "N" || p.kind === "DC-");
  if (ret) return ret;
  const pe = list.find((p) => p.kind === "PE");
  if (pe) return pe;
  return list[0] ?? null;
}

function nk(id: string, term: string): string {
  return nodeKey(id, term);
}

function bfsDist(adj: Map<string, string[]>, starts: string[]): Map<string, number> {
  const dist = new Map<string, number>();
  const q: string[] = [];
  for (const s of starts) {
    if (dist.has(s)) continue;
    dist.set(s, 0);
    q.push(s);
  }
  let i = 0;
  while (i < q.length) {
    const cur = q[i];
    i += 1;
    const d = dist.get(cur) ?? 0;
    for (const nb of adj.get(cur) ?? []) {
      if (dist.has(nb)) continue;
      dist.set(nb, d + 1);
      q.push(nb);
    }
  }
  return dist;
}

function isHotKind(kind: PotentialKind): boolean {
  return kind === "L1" || kind === "L2" || kind === "L3" || kind === "DC+";
}

function isRetKind(kind: PotentialKind): boolean {
  return kind === "N" || kind === "DC-";
}

function isMomentary(kind: DeviceKind): boolean {
  return (
    kind === "pb-no" ||
    kind === "pb-nc" ||
    kind === "foot" ||
    kind === "foot-no" ||
    kind === "foot-nc"
  );
}

function sensorActuated(device: Device, process: ProcessVars): boolean {
  const set = device.params.setpoint;
  switch (device.kind) {
    case "limit-no":
    case "limit-nc":
      return process.limitHit;
    case "float":
      return process.level >= (set ?? 50);
    case "temp-no":
    case "temp-nc":
      return process.temperature >= (set ?? 140);
    case "pressure-no":
    case "pressure-nc":
      return process.pressure >= (set ?? 4);
    case "flow-no":
    case "flow-nc":
      return process.flow >= (set ?? 40);
    case "prox":
    case "prox-no":
    case "prox-nc":
      return process.proxHit;
    case "photo":
    case "photo-no":
    case "photo-nc":
      return process.photoHit;
    default:
      return false;
  }
}

function isNc(kind: DeviceKind): boolean {
  return (
    kind === "pb-nc" ||
    kind === "estop" ||
    kind === "estop-nc" ||
    kind === "limit-nc" ||
    kind === "temp-nc" ||
    kind === "pressure-nc" ||
    kind === "flow-nc" ||
    kind === "foot-nc" ||
    kind === "prox-nc" ||
    kind === "photo-nc"
  );
}

function closedSwitch(device: Device, rt: DeviceRuntime): boolean {
  if (device.params.welded) return true;
  if (isNc(device.kind)) return !rt.actuated;
  return rt.actuated;
}

function bridges(device: Device, rt: DeviceRuntime): [string, string][] {
  const welded = Boolean(device.params.welded);
  const e = rt.energized || welded;
  const e2 = rt.energizedAlt;
  const trip = rt.tripped;
  const on = rt.on && !trip;
  const kind = device.kind;
  const out: [string, string][] = [];

  const add3 = (a: [string, string][], swap = false) => {
    if (swap) {
      a.push(["L1", "T2"], ["L2", "T1"], ["L3", "T3"]);
    } else {
      a.push(["L1", "T1"], ["L2", "T2"], ["L3", "T3"]);
    }
  };

  switch (kind) {
    case "pb-no":
    case "pb-nc":
    case "foot-no":
    case "foot-nc":
    case "limit-no":
    case "limit-nc":
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
      if (closedSwitch(device, rt)) {
        out.push(["1", "2"], ["3", "4"], ["11", "12"], ["13", "14"]);
      }
      break;
    case "estop":
      if (!rt.actuated) out.push(["1", "2"], ["11", "12"]);
      else out.push(["3", "4"], ["13", "14"]);
      break;
    case "estop-nc":
      if (!rt.actuated) out.push(["1", "2"], ["11", "12"]);
      break;
    case "estop-no":
      if (rt.actuated) out.push(["1", "2"], ["3", "4"], ["13", "14"]);
      break;
    case "toggle":
    case "foot":
      if (rt.actuated) out.push(["1", "2"]);
      else out.push(["3", "4"]);
      break;
    case "float":
      if (rt.actuated) out.push(["1", "2"]);
      break;
    case "toggle-spst":
      if (rt.actuated) out.push(["1", "2"]);
      break;
    case "toggle-spdt":
      out.push(rt.actuated ? ["1", "3"] : ["1", "2"]);
      break;
    case "toggle-dpst":
      if (rt.actuated) out.push(["1", "2"], ["3", "4"]);
      break;
    case "toggle-dpdt":
      if (rt.actuated) out.push(["1", "3"], ["4", "6"]);
      else out.push(["1", "2"], ["4", "5"]);
      break;
    case "toggle-4pdt":
      if (rt.actuated) out.push(["1", "3"], ["4", "6"], ["7", "9"], ["10", "12"]);
      else out.push(["1", "2"], ["4", "5"], ["7", "8"], ["10", "11"]);
      break;
    case "selector-2":
      if (rt.position === 0) out.push(["1", "2"]);
      if (rt.position === 1) out.push(["3", "4"]);
      break;
    case "selector-3":
      if (rt.position === 1) {
        out.push(["COM", "FWD"]);
        out.push(["COM2", "FWD"]);
      }
      if (rt.position === 2) {
        out.push(["COM2", "REV"]);
        out.push(["COM", "REV"]);
      }
      break;
    case "breaker-1p":
    case "fuse":
      if (on) out.push(["1", "2"]);
      break;
    case "breaker-3p":
      if (on) {
        out.push(["L3", "T3"], ["L2", "T2"], ["L1", "T1"]);
        out.push(["5", "6"], ["3", "4"], ["1", "2"]);
      }
      break;
    case "isolator":
      if (on) {
        add3(out);
        out.push(["1", "2"], ["3", "4"], ["5", "6"]);
      }
      break;
    case "rcd":
      if (on) {
        add3(out);
        out.push(["N", "TN"]);
      }
      break;
    case "overload":
      if (!trip) {
        out.push(["L3", "T3"], ["L2", "T2"], ["L1", "T1"]);
        out.push(["5", "6"], ["3", "4"], ["1", "2"]);
        out.push(["95", "96"]);
      } else {
        out.push(["97", "98"]);
      }
      break;
    case "contactor":
      if (e) {
        out.push(["L1", "T1"], ["L2", "T2"], ["L3", "T3"]);
        out.push(["1", "2"], ["3", "4"], ["5", "6"]);
      }
      if (rt.energized) {
        out.push(["13", "14"], ["43", "44"]);
      } else {
        out.push(["21", "22"], ["31", "32"]);
      }
      break;
    case "relay":
      if (e) out.push(["1", "2"], ["5", "6"]);
      else out.push(["3", "4"], ["7", "8"]);
      break;
    case "timer-on":
    case "timer-off":
      if (rt.done) out.push(["15", "18"]);
      else out.push(["15", "16"]);
      if (rt.energized) out.push(["21", "24"]);
      else out.push(["21", "22"]);
      break;
    case "counter":
      if (rt.done) out.push(["1", "2"]);
      break;
    case "starter-dol":
    case "starter-fwd":
      if ((rt.energized || welded) && !trip) add3(out);
      if (!trip) out.push(["95", "96"]);
      else out.push(["97", "98"]);
      if (rt.energized) out.push(["13", "14"]);
      else out.push(["21", "22"]);
      break;
    case "starter-rev":
      if ((rt.energized || welded) && !trip) add3(out, true);
      if (!trip) out.push(["95", "96"]);
      else out.push(["97", "98"]);
      if (rt.energized) out.push(["13", "14"]);
      else out.push(["21", "22"]);
      break;
    case "starter-rev-combo":
      if ((rt.energized || welded) && !e2) add3(out, false);
      if (e2 && !rt.energized) add3(out, true);
      if (rt.energized) out.push(["13", "14"]);
      else out.push(["21", "22"]);
      if (e2) out.push(["13R", "14R"]);
      else out.push(["21R", "22R"]);
      break;
    case "ammeter":
      out.push(["1", "2"]);
      break;
    default:
      break;
  }
  return out;
}

function coilTerms(kind: DeviceKind): [string, string][] {
  switch (kind) {
    case "contactor":
    case "relay":
    case "timer-on":
    case "timer-off":
    case "solenoid":
    case "starter-dol":
    case "starter-fwd":
    case "starter-rev":
      return [["A1", "A2"]];
    case "starter-rev-combo":
      return [
        ["A1F", "A2F"],
        ["A1R", "A2R"],
      ];
    case "lamp":
    case "alarm":
    case "horn":
    case "heater":
      return [["1", "2"]];
    case "counter":
      return [
        ["A1", "A2"],
        ["R1", "R2"],
      ];
    case "transformer":
      return [
        ["H1", "H2"],
        ["H1", "H3"],
        ["H1", "H4"],
        ["H2", "H3"],
        ["H2", "H4"],
        ["H3", "H4"],
        ["P1", "P2"],
      ];
    default:
      return [];
  }
}

export interface TickInput {
  held: Set<string>;
  process: ProcessVars;
}

export function tick(
  circuit: Circuit,
  prevRuntime: Record<string, DeviceRuntime>,
  input: TickInput,
  dtMs: number,
  timeMs: number,
): SimSnapshot {
  const runtime: Record<string, DeviceRuntime> = {};
  for (const d of circuit.devices) {
    const prev = prevRuntime[d.id] ?? defaultRuntime(d.kind);
    const rt: DeviceRuntime = { ...prev };
    if (isMomentary(d.kind)) rt.actuated = input.held.has(d.id);
    const sensed = sensorActuated(d, input.process);
    if (
      d.kind.startsWith("temp") ||
      d.kind.startsWith("pressure") ||
      d.kind.startsWith("flow") ||
      d.kind === "float" ||
      d.kind === "prox" ||
      d.kind === "photo"
    ) {
      rt.actuated = sensed;
    } else if (d.kind === "limit-no" || d.kind === "limit-nc") {
      rt.actuated = input.held.has(d.id) || (input.process.limitHit ? true : prev.actuated);
    }
    runtime[d.id] = rt;
  }

  // Synchronize and enforce mutual exclusion for limit switches with the same tag (up to 2)
  const limitByTag = new Map<string, Device[]>();
  for (const d of circuit.devices) {
    if (d.kind === "limit-no" || d.kind === "limit-nc") {
      const tag = d.tag.trim();
      if (tag) {
        const list = limitByTag.get(tag) ?? [];
        list.push(d);
        limitByTag.set(tag, list);
      }
    }
  }

  for (const [, list] of limitByTag) {
    if (list.length === 2) {
      const [d1, d2] = list;
      const rt1 = runtime[d1.id];
      const rt2 = runtime[d2.id];
      if (!rt1 || !rt2) continue;

      const isOppositeKinds =
        (d1.kind === "limit-no" && d2.kind === "limit-nc") ||
        (d1.kind === "limit-nc" && d2.kind === "limit-no");
      if (isOppositeKinds) {
        // 1 NO + 1 NC of the same physical limit switch SQ:
        // Share physical actuation state. When actuated, NO closes & NC opens.
        const isActuated =
          input.held.has(d1.id) ||
          input.held.has(d2.id) ||
          (input.process.limitHit
            ? true
            : Boolean(prevRuntime[d1.id]?.actuated || prevRuntime[d2.id]?.actuated));
        rt1.actuated = isActuated;
        rt2.actuated = isActuated;
      } else if (d1.kind === "limit-no" && d2.kind === "limit-no") {
        // 2 NO: mutually exclusive (cannot both be actuated/closed)
        if (input.held.has(d1.id)) {
          rt1.actuated = true;
          rt2.actuated = false;
        } else if (input.held.has(d2.id)) {
          rt2.actuated = true;
          rt1.actuated = false;
        } else if (rt1.actuated && rt2.actuated) {
          rt2.actuated = false;
        }
      } else if (d1.kind === "limit-nc" && d2.kind === "limit-nc") {
        // 2 NC: mutually exclusive (cannot both be conducting/unactuated)
        if (input.held.has(d1.id)) {
          rt1.actuated = true;
          rt2.actuated = false;
        } else if (input.held.has(d2.id)) {
          rt2.actuated = true;
          rt1.actuated = false;
        } else if (!rt1.actuated && !rt2.actuated) {
          rt2.actuated = true;
        }
      }
    }
  }

  const uf = new UnionFind();
  const adj = new Map<string, string[]>();
  const link = (x: string, y: string) => {
    uf.union(x, y);
    const ax = adj.get(x) ?? [];
    const ay = adj.get(y) ?? [];
    ax.push(y);
    ay.push(x);
    adj.set(x, ax);
    adj.set(y, ay);
  };
  for (const d of circuit.devices) {
    for (const term of allTerminals(d.kind)) uf.add(nk(d.id, term));
  }

  for (const w of circuit.wires) {
    if (w.broken) continue;
    const a = portDevice(circuit, w.a);
    const b = portDevice(circuit, w.b);
    if (a && b) link(nk(a.deviceId, a.term), nk(b.deviceId, b.term));
  }

  linkNetLabels(circuit, link);

  for (const d of circuit.devices) {
    const rt = runtime[d.id];
    for (const [a, b] of bridges(d, rt)) link(nk(d.id, a), nk(d.id, b));
  }

  const faults: Fault[] = [];
  for (const w of circuit.wires) {
    if (w.broken) {
      faults.push({
        level: "warn",
        message: "斷線故障（選取該導線可復原）",
        msgKey: "fault.brokenWire",
      });
    }
  }
  for (const d of circuit.devices) {
    if (d.params.welded) {
      faults.push({
        level: "warn",
        message: `${d.tag} 觸點熔死`,
        msgKey: "fault.weldedContact",
        msgParams: { tag: d.tag },
        deviceId: d.id,
      });
    }
  }
  const stamp = new Map<string, Potential[]>();
  const shortRoots = new Set<string>();
  const shortDeviceIds = new Set<string>();

  const stampNode = (deviceId: string, term: string, p: Potential) => {
    const root = uf.find(nk(deviceId, term));
    const list = stamp.get(root) ?? [];

    if (p.kind === "PE") {
      if (!list.some((e) => e.kind === "PE" && e.sourceId === p.sourceId)) {
        list.push(p);
        stamp.set(root, list);
      }
      return;
    }

    const existingSameSource = list.find((e) => e.sourceId === p.sourceId);
    if (existingSameSource) {
      if (existingSameSource.kind === p.kind) {
        return;
      }
      shortRoots.add(root);
      shortDeviceIds.add(deviceId);
      if (existingSameSource.sourceId) shortDeviceIds.add(existingSameSource.sourceId);
      faults.push({
        level: "error",
        message: `短路：${existingSameSource.kind} 與 ${p.kind} 接到同一點`,
        msgKey: "fault.shortCircuit",
        msgParams: { a: existingSameSource.kind, b: p.kind },
        deviceId,
      });
      return;
    }

    if (isHotKind(p.kind)) {
      const conflictingHot = list.find((e) => isHotKind(e.kind) && e.sourceId !== p.sourceId);
      if (conflictingHot) {
        shortRoots.add(root);
        shortDeviceIds.add(deviceId);
        if (conflictingHot.sourceId) shortDeviceIds.add(conflictingHot.sourceId);
        faults.push({
          level: "error",
          message: `短路：${conflictingHot.kind} 與 ${p.kind} 接到同一點`,
          msgKey: "fault.shortCircuit",
          msgParams: { a: conflictingHot.kind, b: p.kind },
          deviceId,
        });
        return;
      }
    }

    list.push(p);
    stamp.set(root, list);
  };

  const pot = (deviceId: string, term: string, preferredSourceId?: string) =>
    potOf(stamp, uf, nk(deviceId, term), preferredSourceId);

  for (const d of circuit.devices) {
    const rt = runtime[d.id];
    if (d.kind === "mains-3ph") {
      stampNode(d.id, "L1", { sourceId: d.id, kind: "L1" });
      stampNode(d.id, "L2", { sourceId: d.id, kind: "L2" });
      stampNode(d.id, "L3", { sourceId: d.id, kind: "L3" });
      const sym = circuit.symbols.find((s) => s.deviceId === d.id);
      const isDelta = d.params.supplyType === "delta" || sym?.variant === "delta";
      if (!isDelta) {
        stampNode(d.id, "N", { sourceId: d.id, kind: "N" });
      }
      stampNode(d.id, "PE", { sourceId: d.id, kind: "PE" });
    }
    if (d.kind === "ground") {
      stampNode(d.id, "1", { sourceId: d.id, kind: "PE" });
    }
    if (d.kind === "dc-supply" && rt.on) {
      stampNode(d.id, "+", { sourceId: d.id, kind: "DC+" });
      stampNode(d.id, "-", { sourceId: d.id, kind: "DC-" });
    }
    if (d.kind === "gen-ac" && Math.abs(rt.rpm) > 0.25) {
      stampNode(d.id, "U", { sourceId: d.id, kind: "L1" });
      stampNode(d.id, "V", { sourceId: d.id, kind: "L2" });
      stampNode(d.id, "W", { sourceId: d.id, kind: "L3" });
      stampNode(d.id, "N", { sourceId: d.id, kind: "N" });
    }
    if (d.kind === "gen-dc" && Math.abs(rt.rpm) > 0.25) {
      stampNode(d.id, "+", { sourceId: d.id, kind: "DC+" });
      stampNode(d.id, "-", { sourceId: d.id, kind: "DC-" });
    }
  }

  let grew = true;
  let guard = 0;
  while (grew && guard < 8) {
    grew = false;
    guard += 1;
    for (const d of circuit.devices) {
      if (d.kind === "transformer") {
        // Single-phase transformer: Primary (H1..H4, P1/P2) -> Secondary (X1/X2, S1/S2)
        const in1Pots = nodePots(stamp, uf, nk(d.id, "H1")).length > 0 ? nodePots(stamp, uf, nk(d.id, "H1")) : nodePots(stamp, uf, nk(d.id, "P1"));
        const in2Pots = nodePots(stamp, uf, nk(d.id, "H2")).length > 0 ? nodePots(stamp, uf, nk(d.id, "H2")) : nodePots(stamp, uf, nk(d.id, "P2"));
        const in3Pots = nodePots(stamp, uf, nk(d.id, "H3"));
        const in4Pots = nodePots(stamp, uf, nk(d.id, "H4"));
        const energized =
          hasVoltageBetween(in1Pots, in2Pots) ||
          hasVoltageBetween(in1Pots, in4Pots) ||
          hasVoltageBetween(in1Pots, in3Pots) ||
          hasVoltageBetween(in2Pots, in4Pots) ||
          hasVoltageBetween(in3Pots, in4Pots);
        if (energized) {
          const x1Pots = nodePots(stamp, uf, nk(d.id, "X1"));
          const s1Pots = nodePots(stamp, uf, nk(d.id, "S1"));
          const alreadyStamped = x1Pots.some((p) => p.sourceId === `xf-${d.id}`) || s1Pots.some((p) => p.sourceId === `xf-${d.id}`);
          if (!alreadyStamped) {
            stampNode(d.id, "X1", { sourceId: `xf-${d.id}`, kind: "L1" });
            stampNode(d.id, "X2", { sourceId: `xf-${d.id}`, kind: "N" });
            stampNode(d.id, "S1", { sourceId: `xf-${d.id}`, kind: "L1" });
            stampNode(d.id, "S2", { sourceId: `xf-${d.id}`, kind: "N" });
            grew = true;
          }
        }
      }
    }
  }

  const loadNodes = new Set<string>();

  for (const d of circuit.devices) {
    const rt = runtime[d.id];
    rt.prevEnergized = rt.energized;
    rt.energized = false;
    rt.energizedAlt = false;
    rt.lit = false;

    for (const [a, b] of coilTerms(d.kind)) {
      const potsA = nodePots(stamp, uf, nk(d.id, a));
      const potsB = nodePots(stamp, uf, nk(d.id, b));
      const live = hasVoltageBetween(potsA, potsB);
      if (d.kind === "starter-rev-combo") {
        if (a === "A1F" && live) rt.energized = true;
        if (a === "A1R" && live) rt.energizedAlt = true;
      } else if (d.kind === "counter") {
        if (a === "A1" && live) rt.energized = true;
        if (a === "R1" && live) rt.energizedAlt = true;
      } else if (live) {
        rt.energized = true;
      }
      if (live) {
        loadNodes.add(nk(d.id, a));
        loadNodes.add(nk(d.id, b));
      }
    }

    if (d.kind === "lamp" || d.kind === "alarm" || d.kind === "horn") {
      rt.lit = rt.energized;
    }

    if (d.kind === "net-label" || d.kind === "junction" || d.kind === "ground") {
      rt.energized = Boolean(pot(d.id, "1"));
    }

    if (d.kind === "motor-3ph") {
      const potsU = nodePots(stamp, uf, nk(d.id, "U1")).length > 0 ? nodePots(stamp, uf, nk(d.id, "U1")) : nodePots(stamp, uf, nk(d.id, "U"));
      const potsV = nodePots(stamp, uf, nk(d.id, "V1")).length > 0 ? nodePots(stamp, uf, nk(d.id, "V1")) : nodePots(stamp, uf, nk(d.id, "V"));
      const potsW = nodePots(stamp, uf, nk(d.id, "W1")).length > 0 ? nodePots(stamp, uf, nk(d.id, "W1")) : nodePots(stamp, uf, nk(d.id, "W"));
      let pu: Potential | null = null;
      let pv: Potential | null = null;
      let pw: Potential | null = null;
      for (const u of potsU) {
        const v = potsV.find((p) => p.sourceId === u.sourceId);
        const w = potsW.find((p) => p.sourceId === u.sourceId);
        if (v && w) {
          pu = u;
          pv = v;
          pw = w;
          break;
        }
      }
      const iu = phaseIndex(pu);
      const iv = phaseIndex(pv);
      const iw = phaseIndex(pw);
      const same = Boolean(pu && pv && pw && pu.sourceId === pv.sourceId && pv.sourceId === pw.sourceId);
      const dir = same && iu !== null && iv !== null && iw !== null ? permutationDir(iu, iv, iw) : 0;
      const star =
        uf.find(nk(d.id, "U2")) === uf.find(nk(d.id, "V2")) &&
        uf.find(nk(d.id, "V2")) === uf.find(nk(d.id, "W2")) &&
        uf.find(nk(d.id, "U2")) !== uf.find(nk(d.id, "U"));
      const potsU2 = nodePots(stamp, uf, nk(d.id, "U2"));
      const potsV2 = nodePots(stamp, uf, nk(d.id, "V2"));
      const potsW2 = nodePots(stamp, uf, nk(d.id, "W2"));
      const delta =
        hasVoltageBetween(pu ? [pu] : [], potsU2) &&
        hasVoltageBetween(pv ? [pv] : [], potsV2) &&
        hasVoltageBetween(pw ? [pw] : [], potsW2);
      rt.starDelta = null;
      if (dir !== 0) {
        rt.energized = true;
        rt.direction = dir;
        if (star) rt.starDelta = "star";
        else if (delta) rt.starDelta = "delta";
        loadNodes.add(nk(d.id, "U"));
        loadNodes.add(nk(d.id, "V"));
        loadNodes.add(nk(d.id, "W"));
        if (star || delta) {
          loadNodes.add(nk(d.id, "U2"));
          loadNodes.add(nk(d.id, "V2"));
          loadNodes.add(nk(d.id, "W2"));
        }
      } else {
        rt.direction = 0;
      }
    }

    if (d.kind === "motor-1ph" || d.kind === "fan") {
      const potsU1 = [
        ...nodePots(stamp, uf, nk(d.id, "U1")),
        ...nodePots(stamp, uf, nk(d.id, "1")),
        ...nodePots(stamp, uf, nk(d.id, "L")),
      ];
      const potsU2 = [
        ...nodePots(stamp, uf, nk(d.id, "U2")),
        ...nodePots(stamp, uf, nk(d.id, "2")),
        ...nodePots(stamp, uf, nk(d.id, "N")),
      ];
      const live = hasVoltageBetween(potsU1, potsU2);
      rt.energized = live;
      rt.direction = live ? 1 : 0;
      if (live) {
        loadNodes.add(nk(d.id, "U1"));
        loadNodes.add(nk(d.id, "U2"));
        loadNodes.add(nk(d.id, "1"));
        loadNodes.add(nk(d.id, "2"));
        loadNodes.add(nk(d.id, "L"));
        loadNodes.add(nk(d.id, "N"));
      }
    }

    if (d.kind === "motor-dc") {
      const potsA1 = nodePots(stamp, uf, nk(d.id, "A1"));
      const potsA2 = nodePots(stamp, uf, nk(d.id, "A2"));
      let live = false;
      let dir: 1 | -1 | 0 = 0;
      for (const a1 of potsA1) {
        for (const a2 of potsA2) {
          if (a1.sourceId === a2.sourceId) {
            if (a1.kind === "DC+" && a2.kind === "DC-") {
              live = true;
              dir = 1;
              break;
            } else if (a1.kind === "DC-" && a2.kind === "DC+") {
              live = true;
              dir = -1;
              break;
            }
          }
        }
        if (live) break;
      }
      rt.energized = live;
      rt.direction = dir;
      if (live) {
        loadNodes.add(nk(d.id, "A1"));
        loadNodes.add(nk(d.id, "A2"));
      }
    }

    if (d.kind === "starter-rev-combo" && rt.energized && rt.energizedAlt) {
      faults.push({
        level: "warn",
        message: `${d.tag} 正反轉線圈同時得電，機械互鎖阻止主觸點閉合`,
        msgKey: "fault.fwdRevBothEnergized",
        msgParams: { tag: d.tag },
        deviceId: d.id,
      });
    }
  }

  for (const d of circuit.devices) {
    const rt = runtime[d.id];
    const delay = d.params.delayMs ?? 2000;
    const preset = d.params.preset ?? 5;

    if (d.kind === "timer-on") {
      if (rt.energized) {
        rt.elapsedMs = Math.min(delay, rt.elapsedMs + dtMs);
        rt.done = rt.elapsedMs >= delay;
      } else {
        rt.elapsedMs = 0;
        rt.done = false;
      }
    }

    if (d.kind === "timer-off") {
      if (rt.energized) {
        rt.elapsedMs = delay;
        rt.done = true;
      } else if (rt.done) {
        rt.elapsedMs -= dtMs;
        if (rt.elapsedMs <= 0) {
          rt.elapsedMs = 0;
          rt.done = false;
        }
      }
    }

    if (d.kind === "counter") {
      const reset = rt.energizedAlt;
      if (reset) {
        rt.count = 0;
        rt.done = false;
        rt.prevPulse = false;
      } else {
        const pulse = rt.energized;
        if (pulse && !rt.prevPulse) rt.count += 1;
        rt.prevPulse = pulse;
        rt.done = rt.count >= preset;
      }
    }

    const machine =
      d.kind === "motor-3ph" ||
      d.kind === "motor-1ph" ||
      d.kind === "motor-dc" ||
      d.kind === "fan";
    if (machine) {
      const mag = rt.starDelta === "star" ? 0.58 : 1;
      const target = rt.energized ? (rt.direction || 1) * mag : 0;
      rt.rpm += (target - rt.rpm) * Math.min(1, dtMs / 280);
      if (Math.abs(rt.rpm) < 0.01) rt.rpm = 0;
    }
  }

  for (const d of circuit.devices) {
    if (d.kind !== "gen-ac" && d.kind !== "gen-dc") continue;
    const rt = runtime[d.id];
    let driven = d.params.primeMover === true;
    const shaft = d.params.shaftWith;
    if (shaft && runtime[shaft] && Math.abs(runtime[shaft].rpm) > 0.2) driven = true;
    const target = driven ? 1 : 0;
    rt.rpm += (target - rt.rpm) * Math.min(1, dtMs / 400);
    rt.energized = Math.abs(rt.rpm) > 0.25;
    rt.direction = driven ? 1 : 0;
  }

  const potentials: Record<string, Potential | null> = {};
  for (const [node, root] of uf.parent) {
    potentials[node] = potOf(stamp, uf, root);
  }

  const currentRoots = new Set<string>();
  for (const n of loadNodes) {
    const p = potOf(stamp, uf, n);
    if (p) currentRoots.add(uf.find(n));
  }

  const hotStarts: string[] = [];
  const retStarts: string[] = [];
  for (const d of circuit.devices) {
    const add = (term: string) => {
      const p = pot(d.id, term);
      if (!p) return;
      if (isHotKind(p.kind)) hotStarts.push(nk(d.id, term));
      if (isRetKind(p.kind)) retStarts.push(nk(d.id, term));
    };
    if (d.kind === "mains-3ph") {
      add("L1");
      add("L2");
      add("L3");
      add("N");
    }
    if (d.kind === "dc-supply") {
      add("+");
      add("-");
    }
    if (d.kind === "gen-ac") {
      add("U");
      add("V");
      add("W");
      add("N");
    }
    if (d.kind === "gen-dc") {
      add("+");
      add("-");
    }
    if (d.kind === "transformer") {
      add("X1");
      add("X2");
      add("S1");
      add("S2");
    }
  }
  for (const d of circuit.devices) {
    const rt = runtime[d.id];
    let isShort = shortDeviceIds.has(d.id);
    if (!isShort) {
      for (const term of allTerminals(d.kind)) {
        const root = uf.find(nk(d.id, term));
        if (shortRoots.has(root)) {
          isShort = true;
          break;
        }
      }
    }
    if (isShort) {
      rt.short = true;
    }

    // Evaluate voltmeter
    if (d.kind === "voltmeter") {
      const potsA = nodePots(stamp, uf, nk(d.id, "1"));
      const potsB = nodePots(stamp, uf, nk(d.id, "2"));
      const v = computeVoltage(potsA, potsB, circuit);
      rt.meterValue = v;
      rt.meterUnit = "V";
      rt.energized = v > 0;
    }

    // Evaluate ammeter (Clamp meter or in-line meter)
    if (d.kind === "ammeter") {
      let root1 = uf.find(nk(d.id, "1"));
      let root2 = uf.find(nk(d.id, "2"));

      // Check if clamped to a specific wire or placed over a wire
      let clampedWire: Wire | null = null;
      if (d.params.clampedWireId) {
        clampedWire = circuit.wires.find((w) => w.id === d.params.clampedWireId) ?? null;
      }
      if (!clampedWire) {
        const sym = circuit.symbols.find((s) => s.deviceId === d.id);
        if (sym) {
          const v = KINDS[d.kind]?.variants[sym.variant] ?? { w: 4, h: 4 };
          const cx = (sym.x + v.w / 2) * GRID;
          const cy = (sym.y + v.h / 2) * GRID;
          clampedWire = findWireAtPoint(circuit, cx, cy, Math.max(v.w, v.h) * GRID);
        }
      }

      if (clampedWire && !clampedWire.broken) {
        const a = portDevice(circuit, clampedWire.a);
        const b = portDevice(circuit, clampedWire.b);
        if (a && b) {
          root1 = uf.find(nk(a.deviceId, a.term));
          root2 = uf.find(nk(b.deviceId, b.term));
        }
      }

      const shorted = shortRoots.has(root1) || shortRoots.has(root2) || rt.short;
      if (shorted) {
        rt.meterValue = 999.9;
        rt.meterUnit = "A";
        rt.energized = true;
      } else if (currentRoots.has(root1) || currentRoots.has(root2)) {
        let branchCurrent = 0;
        for (const target of circuit.devices) {
          const trt = runtime[target.id];
          if (!trt.energized && !trt.lit && Math.abs(trt.rpm) <= 0.01) continue;

          let sharesRoot = false;
          for (const term of allTerminals(target.kind)) {
            const tr = uf.find(nk(target.id, term));
            if (tr === root1 || tr === root2) {
              sharesRoot = true;
              break;
            }
          }
          if (sharesRoot) {
            if (
              target.kind === "motor-3ph" ||
              target.kind === "starter-rev-combo" ||
              target.kind.startsWith("starter-")
            ) {
              const kw = target.params.power ?? 5.5;
              const baseI = (kw / 5.5) * 8.5;
              branchCurrent += trt.starDelta === "star" ? baseI * 0.58 : baseI;
            } else if (target.kind === "motor-1ph") {
              const kw = target.params.power ?? 1.5;
              branchCurrent += (kw / 1.5) * 4.2;
            } else if (target.kind === "motor-dc") {
              const kw = target.params.power ?? 0.75;
              branchCurrent += (kw / 0.75) * 3.5;
            } else if (target.kind === "heater") {
              branchCurrent += 5.0;
            } else if (target.kind === "fan") {
              branchCurrent += 1.2;
            } else if (target.kind === "solenoid") {
              branchCurrent += 0.8;
            } else if (target.kind === "lamp") {
              branchCurrent += 0.05;
            } else if (target.kind === "alarm" || target.kind === "horn") {
              branchCurrent += 0.15;
            } else if (
              target.kind === "contactor" ||
              target.kind === "relay" ||
              target.kind.startsWith("timer-")
            ) {
              branchCurrent += 0.08;
            } else if (target.kind === "transformer") {
              branchCurrent += 0.25;
            }
          }
        }
        rt.meterValue = Math.round(branchCurrent * 100) / 100;
        rt.meterUnit = "A";
        rt.energized = branchCurrent > 0;
      } else {
        rt.meterValue = 0;
        rt.meterUnit = "A";
        rt.energized = false;
      }
    }
  }

  const distHot = bfsDist(adj, hotStarts);
  const distRet = bfsDist(adj, retStarts);

  const wires: Record<string, WireLive> = {};
  for (const w of circuit.wires) {
    const a = portDevice(circuit, w.a);
    const b = portDevice(circuit, w.b);
    if (!a || !b) {
      wires[w.id] = { live: false, kind: null, dir: 0, short: false };
      continue;
    }
    if (w.broken) {
      wires[w.id] = { live: false, kind: null, dir: 0, short: false };
      continue;
    }
    const directA = directTerminalPotential(circuit, w.a);
    const directB = directTerminalPotential(circuit, w.b);
    let pKind: PotentialKind | null = null;
    if (directA === "PE" || directB === "PE") {
      pKind = "PE";
    } else if (directA) {
      pKind = directA;
    } else if (directB) {
      pKind = directB;
    } else {
      const p = pot(a.deviceId, a.term) ?? pot(b.deviceId, b.term);
      pKind = p?.kind ?? null;
    }

    const na = nk(a.deviceId, a.term);
    const nb = nk(b.deviceId, b.term);
    const root = uf.find(na);
    const rootB = uf.find(nb);
    const isShort = shortRoots.has(root) || shortRoots.has(rootB);
    const carrying = (Boolean(pKind) && (currentRoots.has(root) || currentRoots.has(rootB))) || isShort;
    let dir: 1 | -1 | 0 = 0;
    if (carrying) {
      const hA = distHot.get(na);
      const hB = distHot.get(nb);
      if (hA !== undefined && hB !== undefined && hA !== hB) {
        dir = hA < hB ? 1 : -1;
      } else {
        const rA = distRet.get(na);
        const rB = distRet.get(nb);
        if (rA !== undefined && rB !== undefined && rA !== rB) {
          dir = rA > rB ? 1 : -1;
        } else {
          dir = 1;
        }
      }
    }
    wires[w.id] = {
      live: carrying,
      kind: isShort ? (pKind ?? "L1") : pKind,
      dir,
      short: isShort,
    };
  }

  return { runtime, potentials, wires, faults, timeMs };
}

export { voltageBetween };
