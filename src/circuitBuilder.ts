import { variantDef } from "./catalog";
import { GRID } from "./types";
import { portsEqual, terminalWorld } from "./geometry";
import { uid } from "./ids";
import type { Circuit, Device, DeviceKind, DeviceParams, PortRef, Rot, SymbolInst } from "./types";

export function emptyCircuit(): Circuit {
  return { devices: [], symbols: [], wires: [], groups: [] };
}

export function addDevice(
  circuit: Circuit,
  kind: DeviceKind,
  tag: string,
  variant: string,
  x: number,
  y: number,
  params: DeviceParams = {},
  rot: Rot = 0,
): { device: Device; symbol: SymbolInst } {
  const device: Device = { id: uid("d"), kind, tag, params };
  const symbol: SymbolInst = {
    id: uid("s"),
    deviceId: device.id,
    variant,
    x,
    y,
    rot,
  };
  circuit.devices.push(device);
  circuit.symbols.push(symbol);
  return { device, symbol };
}

export function addSymbol(
  circuit: Circuit,
  deviceId: string,
  variant: string,
  x: number,
  y: number,
  rot: Rot = 0,
): SymbolInst {
  const device = circuit.devices.find((d) => d.id === deviceId);
  if (!device) throw new Error("device not found");
  variantDef(device.kind, variant);
  const symbol: SymbolInst = {
    id: uid("s"),
    deviceId,
    variant,
    x,
    y,
    rot,
  };
  circuit.symbols.push(symbol);
  return symbol;
}

export function addWire(
  circuit: Circuit,
  sa: SymbolInst | string,
  ta: string,
  sb: SymbolInst | string,
  tb: string,
): void {
  const a = typeof sa === "string" ? sa : sa.id;
  const b = typeof sb === "string" ? sb : sb.id;
  circuit.wires.push({
    id: uid("w"),
    a: { symbolId: a, term: ta },
    b: { symbolId: b, term: tb },
  });
}

export function isJunctionSymbol(circuit: Circuit, symbolId: string): boolean {
  const sym = circuit.symbols.find((s) => s.id === symbolId);
  if (!sym) return false;
  return circuit.devices.find((d) => d.id === sym.deviceId)?.kind === "junction";
}

export function addJunction(circuit: Circuit, x: number, y: number): { device: Device; symbol: SymbolInst } {
  return addDevice(circuit, "junction", "", "body", x, y);
}

export function findJunctionAt(circuit: Circuit, x: number, y: number, tol = 0.45): SymbolInst | null {
  for (const s of circuit.symbols) {
    if (!isJunctionSymbol(circuit, s.id)) continue;
    if (Math.abs(s.x - x) <= tol && Math.abs(s.y - y) <= tol) return s;
  }
  return null;
}

/** Insert or reuse a junction on a wire. Returns the port to connect to. */
export function splitWireAt(circuit: Circuit, wireId: string, x: number, y: number): PortRef | null {
  const w = circuit.wires.find((item) => item.id === wireId);
  if (!w) return null;
  const world = { x: x * GRID, y: y * GRID };
  const tol = GRID * 0.45;
  const a = terminalWorld(circuit, w.a);
  const b = terminalWorld(circuit, w.b);
  if (a && Math.hypot(a.x - world.x, a.y - world.y) <= tol) return w.a;
  if (b && Math.hypot(b.x - world.x, b.y - world.y) <= tol) return w.b;
  let j = findJunctionAt(circuit, x, y);
  if (!j) j = addJunction(circuit, x, y).symbol;
  const jp: PortRef = { symbolId: j.id, term: "1" };
  if (portsEqual(w.a, jp) || portsEqual(w.b, jp)) return jp;
  const oldB = w.b;
  w.b = jp;
  w.jog = undefined;
  circuit.wires.push({
    id: uid("w"),
    a: jp,
    b: oldB,
    broken: w.broken,
    label: w.label,
  });
  return jp;
}

export function pruneOrphanJunctions(circuit: Circuit): void {
  const used = new Set<string>();
  for (const w of circuit.wires) {
    used.add(w.a.symbolId);
    used.add(w.b.symbolId);
  }
  const keepSym: SymbolInst[] = [];
  const dropDev = new Set<string>();
  for (const s of circuit.symbols) {
    if (isJunctionSymbol(circuit, s.id) && !used.has(s.id)) {
      dropDev.add(s.deviceId);
      continue;
    }
    keepSym.push(s);
  }
  circuit.symbols = keepSym;
  circuit.devices = circuit.devices.filter((d) => !dropDev.has(d.id) || circuit.symbols.some((s) => s.deviceId === d.id));
}

/** Remove a junction. Two remaining legs are spliced back into one wire. */
export function removeJunction(circuit: Circuit, symbolId: string): void {
  const legs = circuit.wires.filter((w) => w.a.symbolId === symbolId || w.b.symbolId === symbolId);
  const far = (w: Circuit["wires"][0]): PortRef => (w.a.symbolId === symbolId ? w.b : w.a);
  if (legs.length === 2) {
    const p1 = far(legs[0]);
    const p2 = far(legs[1]);
    circuit.wires = circuit.wires.filter((w) => w.id !== legs[0].id && w.id !== legs[1].id);
    if (!portsEqual(p1, p2) && !circuit.wires.some((w) => (portsEqual(w.a, p1) && portsEqual(w.b, p2)) || (portsEqual(w.a, p2) && portsEqual(w.b, p1)))) {
      circuit.wires.push({
        id: uid("w"),
        a: p1,
        b: p2,
        broken: Boolean(legs[0].broken || legs[1].broken),
        label: legs[0].label || legs[1].label,
      });
    }
  } else {
    const ids = new Set(legs.map((w) => w.id));
    circuit.wires = circuit.wires.filter((w) => !ids.has(w.id));
  }
  const sym = circuit.symbols.find((s) => s.id === symbolId);
  circuit.symbols = circuit.symbols.filter((s) => s.id !== symbolId);
  if (sym && !circuit.symbols.some((s) => s.deviceId === sym.deviceId)) {
    circuit.devices = circuit.devices.filter((d) => d.id !== sym.deviceId);
  }
}
