import { describe, expect, it } from "vitest";
import { addDevice, addJunction, addWire, emptyCircuit } from "./circuitBuilder";
import { GRID } from "./types";
import { allWireRoutes, cleanPolyline, HOP_R, STUB, WIRE_LANE, findWireCrossovers, hopArcD, nearestOnPolyline, polylinePathD, snapOnSegment, terminalOutward, terminalWorld, textUnflipTransform, toggleWorldFlip, wireLabelPos, wireRoute } from "./geometry";

describe("wire routing stubs", () => {
  it("leaves a coil terminal in a straight stub before turning", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "KM1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "HL1", "body", 10, 10);
    addWire(c, km.symbol, "A2", lamp.symbol, "1");
    const w = c.wires[0];
    const pts = wireRoute(c, w.a, w.b);
    const start = terminalWorld(c, w.a)!;
    const out = terminalOutward(c, w.a);
    expect(out.x).toBe(1);
    expect(out.y).toBe(0);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    expect(pts[0].x).toBeCloseTo(start.x);
    expect(pts[0].y).toBeCloseTo(start.y);
    expect(pts[1].x).toBeCloseTo(start.x + STUB);
    expect(pts[1].y).toBeCloseTo(start.y);
  });

  it("does not bend inside the stub of the destination", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "KM1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "HL1", "body", 10, 10);
    addWire(c, km.symbol, "A2", lamp.symbol, "1");
    const w = c.wires[0];
    const pts = wireRoute(c, w.a, w.b);
    const end = terminalWorld(c, w.b)!;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    expect(last.x).toBeCloseTo(end.x);
    expect(last.y).toBeCloseTo(end.y);
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    expect(Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5).toBe(true);
    const len = Math.hypot(dx, dy);
    expect(len).toBeCloseTo(STUB, 0);
  });

  it("offsets a jogged run without moving the stubs", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "KM1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "HL1", "body", 10, 10);
    addWire(c, km.symbol, "A2", lamp.symbol, "1");
    const w = c.wires[0];
    const start = terminalWorld(c, w.a)!;
    const pts = wireRoute(c, w.a, w.b, { axis: "y", pos: start.y + 40 });
    const ys = new Set(pts.slice(1, -1).map((p) => Math.round(p.y)));
    expect(ys.has(Math.round(start.y + 40))).toBe(true);
    expect(pts[1].y).toBeCloseTo(start.y);
  });
});

describe("wire T-junctions", () => {
  it("snaps a point onto a horizontal run", () => {
    const pts = [
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ];
    const near = nearestOnPolyline(pts, { x: 41, y: 48 });
    expect(near).not.toBeNull();
    expect(near!.y).toBeCloseTo(40);
    expect(near!.d).toBeCloseTo(8);
    const snapped = snapOnSegment(pts[0], pts[1], { x: near!.x, y: near!.y });
    expect(snapped.y).toBe(40);
    expect(snapped.x % GRID).toBe(0);
  });

  it("does not add a terminal stub on a net label", () => {
    const c = emptyCircuit();
    const lab = addDevice(c, "net-label", "L1", "body", 8, 8);
    const hl = addDevice(c, "lamp", "HL1", "body", 16, 8);
    addWire(c, lab.symbol, "1", hl.symbol, "1");
    const pts = wireRoute(c, { symbolId: lab.symbol.id, term: "1" }, { symbolId: hl.symbol.id, term: "1" });
    const start = terminalWorld(c, { symbolId: lab.symbol.id, term: "1" })!;
    expect(pts[0].x).toBeCloseTo(start.x);
    expect(pts[0].y).toBeCloseTo(start.y);
    expect(pts[1].x).toBeGreaterThan(start.x - 1);
  });

  it("does not add a terminal stub on a junction", () => {
    const c = emptyCircuit();
    const j = addJunction(c, 8, 8);
    const hl = addDevice(c, "lamp", "HL1", "body", 16, 8);
    addWire(c, j.symbol, "1", hl.symbol, "1");
    const pts = wireRoute(c, { symbolId: j.symbol.id, term: "1" }, { symbolId: hl.symbol.id, term: "1" });
    const start = terminalWorld(c, { symbolId: j.symbol.id, term: "1" })!;
    expect(pts[0].x).toBeCloseTo(start.x);
    expect(pts[0].y).toBeCloseTo(start.y);
    expect(pts[1].x).toBeGreaterThan(start.x - 1);
  });
});

describe("symbol flip", () => {
  it("mirrors a coil terminal left-right and keeps the stub outward", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "KM1", "coil", 4, 4);
    const a1 = terminalWorld(c, { symbolId: km.symbol.id, term: "A1" })!;
    const out0 = terminalOutward(c, { symbolId: km.symbol.id, term: "A1" });
    expect(out0.x).toBe(-1);
    km.symbol.flipX = true;
    const a1f = terminalWorld(c, { symbolId: km.symbol.id, term: "A1" })!;
    expect(a1f.x).toBeGreaterThan(a1.x);
    expect(a1f.y).toBeCloseTo(a1.y);
    const out1 = terminalOutward(c, { symbolId: km.symbol.id, term: "A1" });
    expect(out1.x).toBe(1);
  });

  it("treats 左右 as world-horizontal after a 90° rotate", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "KM1", "coil", 4, 4, {}, 90);
    toggleWorldFlip(km.symbol, "h");
    expect(km.symbol.flipY).toBe(true);
    expect(Boolean(km.symbol.flipX)).toBe(false);
  });

  it("unflips text around its anchor", () => {
    expect(textUnflipTransform(10, 20)).toBeUndefined();
    expect(textUnflipTransform(10, 20, true, false)).toBe("translate(10 20) scale(-1 1) translate(-10 -20)");
  });
});

describe("wire crossovers", () => {
  it("detects an X crossing and hops the vertical wire", () => {
    const c = emptyCircuit();
    const left = addJunction(c, 4, 10);
    const right = addJunction(c, 16, 10);
    const top = addJunction(c, 10, 4);
    const bot = addJunction(c, 10, 16);
    addWire(c, left.symbol, "1", right.symbol, "1");
    addWire(c, top.symbol, "1", bot.symbol, "1");

    const crossovers = findWireCrossovers(c);
    expect(crossovers).toHaveLength(1);
    expect(crossovers[0].x).toBeCloseTo(10 * GRID);
    expect(crossovers[0].y).toBeCloseTo(10 * GRID);
    expect(crossovers[0].hopAxis).toBe("x");
    expect(crossovers[0].hopWireId).toBe(c.wires[1].id);

    const hops = crossovers.filter((x) => x.hopWireId === c.wires[1].id);
    const pts = wireRoute(c, c.wires[1].a, c.wires[1].b);
    const d = polylinePathD(pts, hops);
    expect(d).toContain("A ");
    expect(hopArcD(crossovers[0])).toContain(`A ${HOP_R} ${HOP_R}`);
  });

  it("does not treat a T-junction as a crossover", () => {
    const c = emptyCircuit();
    const left = addJunction(c, 4, 10);
    const mid = addJunction(c, 10, 10);
    const right = addJunction(c, 16, 10);
    const down = addJunction(c, 10, 16);
    addWire(c, left.symbol, "1", mid.symbol, "1");
    addWire(c, mid.symbol, "1", right.symbol, "1");
    addWire(c, mid.symbol, "1", down.symbol, "1");
    expect(findWireCrossovers(c)).toHaveLength(0);
  });

  it("separates overlapping parallel runs of unconnected wires", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 0, 6);
    const b = addJunction(c, 12, 6);
    const e = addJunction(c, 2, 6);
    const f = addJunction(c, 10, 6);
    addWire(c, a.symbol, "1", b.symbol, "1");
    addWire(c, e.symbol, "1", f.symbol, "1");
    const routes = allWireRoutes(c);
    const p1 = routes.get(c.wires[0].id)!;
    const p2 = routes.get(c.wires[1].id)!;
    const midY = (pts: { x: number; y: number }[]) => {
      let best = pts[0].y;
      let len = -1;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const L = Math.abs(pts[i + 1].x - pts[i].x);
        if (L > len) {
          len = L;
          best = pts[i].y;
        }
      }
      return best;
    };
    expect(Math.abs(midY(p1) - midY(p2))).toBeGreaterThanOrEqual(WIRE_LANE - 1);
  });

  it("places a wire label beside the longest run", () => {
    const pts = [
      { x: 0, y: 40 },
      { x: 200, y: 40 },
      { x: 200, y: 80 },
    ];
    const pos = wireLabelPos(pts);
    expect(pos).not.toBeNull();
    expect(pos!.horizontal).toBe(true);
    expect(pos!.x).toBeCloseTo(100);
    expect(pos!.y).toBeLessThan(40);
  });

  it("routes in the middle channel between horizontal terminals avoiding terminal overlap", () => {
    const c = emptyCircuit();
    const km1 = addDevice(c, "contactor", "KM1", "coil", 4, 4); // A2 at right (out.x = 1)
    const km2 = addDevice(c, "contactor", "KM2", "coil", 16, 8); // A1 at left (out.x = -1)
    addWire(c, km1.symbol, "A2", km2.symbol, "A1");
    const pts = wireRoute(c, c.wires[0].a, c.wires[0].b);
    const start = terminalWorld(c, c.wires[0].a)!;
    const end = terminalWorld(c, c.wires[0].b)!;

    // The vertical leg should be in the middle channel (around (start.x + end.x) / 2)
    const midX = (start.x + STUB + end.x - STUB) / 2;
    const vertPts = pts.filter((p, i) => i > 0 && i < pts.length - 1 && Math.abs(p.x - midX) < 2);
    expect(vertPts.length).toBeGreaterThanOrEqual(1);
  });

  it("simplifies collinear segments with cleanPolyline", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    const cleaned = cleanPolyline(pts);
    expect(cleaned).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });
});
