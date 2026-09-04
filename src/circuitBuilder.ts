import { variantDef } from "./catalog";
import { GRID } from "./types";
import { cleanPolyline, deriveJogToMatchPolyline, findOptimalJunctionForWires, portsEqual, terminalWorld, wireRoute } from "./geometry";
import { uid } from "./ids";
import type { Circuit, Device, DeviceKind, DeviceParams, PortRef, Rot, SymbolInst, Wire } from "./types";

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
  flipX?: boolean,
  flipY?: boolean,
): { device: Device; symbol: SymbolInst } {
  const device: Device = { id: uid("d"), kind, tag, params };
  const symbol: SymbolInst = {
    id: uid("s"),
    deviceId: device.id,
    variant,
    x,
    y,
    rot,
    ...(flipX !== undefined ? { flipX } : {}),
    ...(flipY !== undefined ? { flipY } : {}),
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
  flipX?: boolean,
  flipY?: boolean,
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
    ...(flipX !== undefined ? { flipX } : {}),
    ...(flipY !== undefined ? { flipY } : {}),
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
): Wire {
  const a = typeof sa === "string" ? sa : sa.id;
  const b = typeof sb === "string" ? sb : sb.id;
  const w: Wire = {
    id: uid("w"),
    a: { symbolId: a, term: ta },
    b: { symbolId: b, term: tb },
  };
  circuit.wires.push(w);
  return w;
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

/**
 * Deletes a wire without affecting other wires or causing them to shift.
 * Only cleans up orphan junctions (junctions with 0 remaining wires).
 */
export function deleteWireAndCleanJunctions(circuit: Circuit, wireId: string): void {
  const targetWire = circuit.wires.find((w) => w.id === wireId);
  if (!targetWire) return;

  // Only remove the target wire itself
  circuit.wires = circuit.wires.filter((w) => w.id !== wireId);

  // Clean up any junctions that have become completely orphaned (0 connected wires)
  pruneOrphanJunctions(circuit);
}

/** Remove a junction. If remaining legs are spliced, preserve the junction coordinate / layout so the wire does not shift. */
export function removeJunction(circuit: Circuit, symbolId: string): void {
  const sym = circuit.symbols.find((s) => s.id === symbolId);
  if (!sym) return;

  const legs = circuit.wires.filter((w) => w.a.symbolId === symbolId || w.b.symbolId === symbolId);
  const far = (w: Circuit["wires"][0]): PortRef => (w.a.symbolId === symbolId ? w.b : w.a);

  if (legs.length === 2) {
    const p1 = far(legs[0]);
    const p2 = far(legs[1]);

    const pts0 = wireRoute(circuit, legs[0].a, legs[0].b, legs[0].jog);
    const ordered0 = legs[0].a.symbolId === symbolId ? [...pts0].reverse() : pts0;

    const pts1 = wireRoute(circuit, legs[1].a, legs[1].b, legs[1].jog);
    const ordered1 = legs[1].b.symbolId === symbolId ? [...pts1].reverse() : pts1;

    const targetPts = cleanPolyline([...ordered0, ...ordered1.slice(1)]);

    circuit.wires = circuit.wires.filter((w) => w.id !== legs[0].id && w.id !== legs[1].id);
    circuit.symbols = circuit.symbols.filter((s) => s.id !== symbolId);
    if (!circuit.symbols.some((s) => s.deviceId === sym.deviceId)) {
      circuit.devices = circuit.devices.filter((d) => d.id !== sym.deviceId);
    }

    if (
      !portsEqual(p1, p2) &&
      !circuit.wires.some((w) => (portsEqual(w.a, p1) && portsEqual(w.b, p2)) || (portsEqual(w.a, p2) && portsEqual(w.b, p1)))
    ) {
      const jog = deriveJogToMatchPolyline(circuit, p1, p2, targetPts);
      circuit.wires.push({
        id: uid("w"),
        a: p1,
        b: p2,
        broken: Boolean(legs[0].broken || legs[1].broken),
        label: legs[0].label || legs[1].label,
        jog,
      });
    }
  } else if (legs.length > 2) {
    // Check if there is a straight/through pair among legs
    let pair: [Circuit["wires"][0], Circuit["wires"][0]] | null = null;

    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        const l0 = legs[i];
        const l1 = legs[j];
        const pts0 = wireRoute(circuit, l0.a, l0.b, l0.jog);
        const ord0 = l0.a.symbolId === symbolId ? [...pts0].reverse() : pts0;
        const pts1 = wireRoute(circuit, l1.a, l1.b, l1.jog);
        const ord1 = l1.b.symbolId === symbolId ? [...pts1].reverse() : pts1;

        if (ord0.length >= 2 && ord1.length >= 2) {
          const v0 = {
            x: ord0[ord0.length - 1].x - ord0[ord0.length - 2].x,
            y: ord0[ord0.length - 1].y - ord0[ord0.length - 2].y,
          };
          const v1 = {
            x: ord1[1].x - ord1[0].x,
            y: ord1[1].y - ord1[0].y,
          };
          // Check if collinear in same direction
          if (
            (Math.abs(v0.y) < 0.5 && Math.abs(v1.y) < 0.5 && v0.x * v1.x > 0) ||
            (Math.abs(v0.x) < 0.5 && Math.abs(v1.x) < 0.5 && v0.y * v1.y > 0)
          ) {
            pair = [l0, l1];
            break;
          }
        }
      }
      if (pair) break;
    }

    if (pair) {
      const [l0, l1] = pair;
      const p1 = far(l0);
      const p2 = far(l1);

      const pts0 = wireRoute(circuit, l0.a, l0.b, l0.jog);
      const ordered0 = l0.a.symbolId === symbolId ? [...pts0].reverse() : pts0;
      const pts1 = wireRoute(circuit, l1.a, l1.b, l1.jog);
      const ordered1 = l1.b.symbolId === symbolId ? [...pts1].reverse() : pts1;
      const targetPts = cleanPolyline([...ordered0, ...ordered1.slice(1)]);

      const legIds = new Set(legs.map((w) => w.id));
      circuit.wires = circuit.wires.filter((w) => !legIds.has(w.id));
      circuit.symbols = circuit.symbols.filter((s) => s.id !== symbolId);
      if (!circuit.symbols.some((s) => s.deviceId === sym.deviceId)) {
        circuit.devices = circuit.devices.filter((d) => d.id !== sym.deviceId);
      }

      if (
        !portsEqual(p1, p2) &&
        !circuit.wires.some((w) => (portsEqual(w.a, p1) && portsEqual(w.b, p2)) || (portsEqual(w.a, p2) && portsEqual(w.b, p1)))
      ) {
        const jog = deriveJogToMatchPolyline(circuit, p1, p2, targetPts);
        circuit.wires.push({
          id: uid("w"),
          a: p1,
          b: p2,
          broken: Boolean(l0.broken || l1.broken),
          label: l0.label || l1.label,
          jog,
        });
      }
    } else {
      const ids = new Set(legs.map((w) => w.id));
      circuit.wires = circuit.wires.filter((w) => !ids.has(w.id));
      circuit.symbols = circuit.symbols.filter((s) => s.id !== symbolId);
      if (!circuit.symbols.some((s) => s.deviceId === sym.deviceId)) {
        circuit.devices = circuit.devices.filter((d) => d.id !== sym.deviceId);
      }
    }
  } else {
    const ids = new Set(legs.map((w) => w.id));
    circuit.wires = circuit.wires.filter((w) => !ids.has(w.id));
    circuit.symbols = circuit.symbols.filter((s) => s.id !== symbolId);
    if (!circuit.symbols.some((s) => s.deviceId === sym.deviceId)) {
      circuit.devices = circuit.devices.filter((d) => d.id !== sym.deviceId);
    }
  }
}

/**
 * Merges two wires at an optimal junction point.
 * Computes the optimal junction position (or uses provided pos), inserts or reuses a junction at that position,
 * removes the two original wires, and creates clean wire connections from each distinct endpoint to the junction.
 */
export function mergeWires(
  circuit: Circuit,
  wireId1: string,
  wireId2: string,
  junctionPos?: { x: number; y: number }
): { junction: SymbolInst; newWires: Wire[] } | null {
  const w1 = circuit.wires.find((w) => w.id === wireId1);
  const w2 = circuit.wires.find((w) => w.id === wireId2);
  if (!w1 || !w2 || w1.id === w2.id) return null;

  const pos = junctionPos ?? findOptimalJunctionForWires(circuit, wireId1, wireId2);
  if (!pos) return null;

  let j = findJunctionAt(circuit, pos.x, pos.y);
  if (!j) {
    j = addJunction(circuit, pos.x, pos.y).symbol;
  }
  const jPort: PortRef = { symbolId: j.id, term: "1" };

  const allEndpoints: PortRef[] = [w1.a, w1.b, w2.a, w2.b];
  const distinctEndpoints: PortRef[] = [];

  for (const ep of allEndpoints) {
    if (portsEqual(ep, jPort)) continue;
    if (isJunctionSymbol(circuit, ep.symbolId)) {
      const jSym = circuit.symbols.find((s) => s.id === ep.symbolId);
      if (jSym && Math.abs(jSym.x - pos.x) <= 0.45 && Math.abs(jSym.y - pos.y) <= 0.45) {
        continue;
      }
    }
    if (!distinctEndpoints.some((existing) => portsEqual(existing, ep))) {
      distinctEndpoints.push(ep);
    }
  }

  // Remove the two merged wires
  circuit.wires = circuit.wires.filter((w) => w.id !== wireId1 && w.id !== wireId2);

  const createdWires: Wire[] = [];
  for (const ep of distinctEndpoints) {
    const alreadyConnected = circuit.wires.some(
      (w) =>
        (portsEqual(w.a, ep) && portsEqual(w.b, jPort)) ||
        (portsEqual(w.b, ep) && portsEqual(w.a, jPort))
    );
    if (!alreadyConnected) {
      const newWire: Wire = {
        id: uid("w"),
        a: ep,
        b: jPort,
        broken: w1.broken || w2.broken,
        label: w1.label || w2.label,
      };
      circuit.wires.push(newWire);
      createdWires.push(newWire);
    }
  }

  pruneOrphanJunctions(circuit);
  return { junction: j, newWires: createdWires };
}
