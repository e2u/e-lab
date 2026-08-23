import { KINDS } from "../catalog";
import { nodeKey, portDevice } from "../geometry";
import type {
  Circuit,
  Device,
  DeviceKind,
  DeviceRuntime,
  Fault,
  Potential,
  PotentialKind,
  ProcessVars,
  SimSnapshot,
  WireLive,
} from "../types";

export const PHASE_COLOR: Record<PotentialKind, string> = {
  L1: "#a65628", // Brown
  L2: "#ff7f00", // Orange
  L3: "#eccd26", // Yellow
  N: "#ffffff", // White
  PE: "#2ca02c", // Green
  "DC+": "#e07020",
  "DC-": "#1a5f8a",
};

export function defaultRuntime(kind: DeviceKind): DeviceRuntime {
  const closedHandle =
    kind === "breaker-1p" ||
    kind === "breaker-3p" ||
    kind === "rcd" ||
    kind === "isolator" ||
    kind === "dc-supply";
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
  };
}

export function createRuntime(circuit: Circuit): Record<string, DeviceRuntime> {
  const runtime: Record<string, DeviceRuntime> = {};
  for (const d of circuit.devices) runtime[d.id] = defaultRuntime(d.kind);
  return runtime;
}

export function emptySnapshot(circuit: Circuit): SimSnapshot {
  return {
    runtime: createRuntime(circuit),
    potentials: {},
    wires: Object.fromEntries(
      circuit.wires.map((w) => [w.id, { live: false, kind: null, dir: 0 }]),
    ),
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

function potOf(
  stamp: Map<string, Potential>,
  uf: UnionFind,
  node: string,
): Potential | null {
  return stamp.get(uf.find(node)) ?? null;
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
      return process.temperature >= (set ?? 60);
    case "pressure-no":
    case "pressure-nc":
      return process.pressure >= (set ?? 4);
    case "flow-no":
    case "flow-nc":
      return process.flow >= (set ?? 40);
    case "prox":
      return process.proxHit;
    case "photo":
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
    kind === "foot-nc"
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
    case "photo":
      if (closedSwitch(device, rt)) out.push(["1", "2"]);
      break;
    case "estop":
      if (!rt.actuated) out.push(["1", "2"]);
      else out.push(["3", "4"]);
      break;
    case "estop-nc":
      if (!rt.actuated) out.push(["11", "12"]);
      break;
    case "estop-no":
      if (rt.actuated) out.push(["13", "14"]);
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
      if (rt.position === 1) out.push(["COM", "FWD"]);
      if (rt.position === 2) out.push(["COM", "REV"]);
      break;
    case "breaker-1p":
    case "fuse":
      if (on) out.push(["1", "2"]);
      break;
    case "breaker-3p":
    case "isolator":
      if (on) add3(out);
      break;
    case "rcd":
      if (on) {
        add3(out);
        out.push(["N", "TN"]);
      }
      break;
    case "overload":
      if (!trip) {
        add3(out);
        out.push(["95", "96"]);
      } else {
        out.push(["97", "98"]);
      }
      break;
    case "contactor":
      if (e) add3(out);
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
      return [["A1", "A2"]];
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
      d.kind === "limit-no" ||
      d.kind === "limit-nc" ||
      d.kind === "prox" ||
      d.kind === "photo"
    ) {
      rt.actuated = sensed;
    }
    runtime[d.id] = rt;
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
      faults.push({ level: "warn", message: "斷線故障（選取該導線可復原）" });
    }
  }
  for (const d of circuit.devices) {
    if (d.params.welded) {
      faults.push({
        level: "warn",
        message: `${d.tag} 觸點熔死`,
        deviceId: d.id,
      });
    }
  }
  const stamp = new Map<string, Potential>();

  const stampNode = (deviceId: string, term: string, p: Potential) => {
    const root = uf.find(nk(deviceId, term));
    const existing = stamp.get(root);
    if (existing && (existing.sourceId !== p.sourceId || existing.kind !== p.kind)) {
      faults.push({
        level: "error",
        message: `短路：${existing.kind} 與 ${p.kind} 接到同一點`,
        deviceId,
      });
      return;
    }
    stamp.set(root, p);
  };

  const pot = (deviceId: string, term: string) =>
    potOf(stamp, uf, nk(deviceId, term));

  for (const d of circuit.devices) {
    const rt = runtime[d.id];
    if (d.kind === "mains-3ph") {
      stampNode(d.id, "L1", { sourceId: d.id, kind: "L1" });
      stampNode(d.id, "L2", { sourceId: d.id, kind: "L2" });
      stampNode(d.id, "L3", { sourceId: d.id, kind: "L3" });
      stampNode(d.id, "N", { sourceId: d.id, kind: "N" });
      stampNode(d.id, "PE", { sourceId: d.id, kind: "PE" });
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
        // Single-phase transformer: P1/P2 -> S1/S2
        if (voltageBetween(pot(d.id, "P1"), pot(d.id, "P2"))) {
          const s1 = pot(d.id, "S1");
          if (!s1) {
            stampNode(d.id, "S1", { sourceId: `xf-${d.id}`, kind: "L1" });
            stampNode(d.id, "S2", { sourceId: `xf-${d.id}`, kind: "N" });
            grew = true;
          }
        }
      }
      if (d.kind === "transformer3ph") {
        // Three-phase transformer: L1/L2/L3 -> T1/T2/T3 (and N/TN for Wye)
        // Allow single-phase operation: if any phase has voltage, pass it to secondary
        const p1 = pot(d.id, "L1");
        const p2 = pot(d.id, "L2");
        const p3 = pot(d.id, "L3");
        // Check if at least one phase has voltage from a 3-phase source
        const hasVoltage = (p1 || p2 || p3) && (
          (p1 && p2 && p1.sourceId === p2.sourceId) ||
          (p2 && p3 && p2.sourceId === p3.sourceId) ||
          (p1 && p3 && p1.sourceId === p3.sourceId) ||
          (p1 && p2 && p3 && p1.sourceId === p2.sourceId && p2.sourceId === p3.sourceId)
        );
        if (hasVoltage) {
          const t1 = pot(d.id, "T1");
          if (!t1) {
            // Pass L1/L2/L3 to T1/T2/T3
            if (p1) stampNode(d.id, "T1", { sourceId: `xf3-${d.id}`, kind: "L1" });
            if (p2) stampNode(d.id, "T2", { sourceId: `xf3-${d.id}`, kind: "L2" });
            if (p3) stampNode(d.id, "T3", { sourceId: `xf3-${d.id}`, kind: "L3" });
            // For Wye connection, also pass N
            if (d.params.secondaryConn === "wye") {
              stampNode(d.id, "TN", { sourceId: `xf3-${d.id}`, kind: "N" });
            }
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
      const live = voltageBetween(pot(d.id, a), pot(d.id, b));
      if (d.kind === "starter-rev-combo") {
        if (a === "A1F" && live) rt.energized = true;
        if (a === "A1R" && live) rt.energizedAlt = true;
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

    if (d.kind === "net-label" || d.kind === "junction") {
      rt.energized = Boolean(pot(d.id, "1"));
    }

    if (d.kind === "motor-3ph") {
      const pu = pot(d.id, "U") ?? pot(d.id, "U1");
      const pv = pot(d.id, "V") ?? pot(d.id, "V1");
      const pw = pot(d.id, "W") ?? pot(d.id, "W1");
      const iu = phaseIndex(pu);
      const iv = phaseIndex(pv);
      const iw = phaseIndex(pw);
      const same =
        pu && pv && pw && pu.sourceId === pv.sourceId && pv.sourceId === pw.sourceId;
      const dir = same && iu !== null && iv !== null && iw !== null ? permutationDir(iu, iv, iw) : 0;
      const star =
        uf.find(nk(d.id, "U2")) === uf.find(nk(d.id, "V2")) &&
        uf.find(nk(d.id, "V2")) === uf.find(nk(d.id, "W2")) &&
        uf.find(nk(d.id, "U2")) !== uf.find(nk(d.id, "U"));
      const delta =
        voltageBetween(pu, pot(d.id, "U2")) &&
        voltageBetween(pv, pot(d.id, "V2")) &&
        voltageBetween(pw, pot(d.id, "W2"));
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
      const live = voltageBetween(pot(d.id, "U1"), pot(d.id, "U2"));
      rt.energized = live;
      rt.direction = live ? 1 : 0;
      if (live) {
        loadNodes.add(nk(d.id, "U1"));
        loadNodes.add(nk(d.id, "U2"));
      }
    }

    if (d.kind === "motor-dc") {
      const a1 = pot(d.id, "A1");
      const a2 = pot(d.id, "A2");
      if (a1 && a2 && a1.sourceId === a2.sourceId) {
        if (a1.kind === "DC+" && a2.kind === "DC-") {
          rt.energized = true;
          rt.direction = 1;
        } else if (a1.kind === "DC-" && a2.kind === "DC+") {
          rt.energized = true;
          rt.direction = -1;
        } else {
          rt.direction = 0;
        }
      } else {
        rt.direction = 0;
      }
      if (rt.energized) {
        loadNodes.add(nk(d.id, "A1"));
        loadNodes.add(nk(d.id, "A2"));
      }
    }

    if (d.kind === "starter-rev-combo" && rt.energized && rt.energizedAlt) {
      faults.push({
        level: "warn",
        message: `${d.tag} 正反轉線圈同時得電，機械互鎖阻止主觸點閉合`,
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
      const pulse = rt.energized;
      if (pulse && !rt.prevPulse) rt.count += 1;
      rt.prevPulse = pulse;
      rt.done = rt.count >= preset;
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
    potentials[node] = stamp.get(uf.find(root)) ?? null;
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
      add("S1");
      add("S2");
    }
    if (d.kind === "transformer3ph") {
      add("T1");
      add("T2");
      add("T3");
      if (d.params.secondaryConn === "wye") {
        add("TN");
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
      wires[w.id] = { live: false, kind: null, dir: 0 };
      continue;
    }
    if (w.broken) {
      wires[w.id] = { live: false, kind: null, dir: 0 };
      continue;
    }
    const p = pot(a.deviceId, a.term);
    const na = nk(a.deviceId, a.term);
    const nb = nk(b.deviceId, b.term);
    const root = uf.find(na);
    const carrying = Boolean(p) && currentRoots.has(root);
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
      kind: p?.kind ?? null,
      dir,
    };
  }

  return { runtime, potentials, wires, faults, timeMs };
}

export { voltageBetween };
