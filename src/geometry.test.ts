import { describe, expect, it } from "vitest";
import { addDevice, addJunction, addWire, emptyCircuit, mergeWires, removeJunction } from "./circuitBuilder";
import { GRID } from "./types";
import { allWireRoutes, areWiresConnected, cleanPolyline, deriveJogToMatchPolyline, findOptimalJunctionForWires, getConnectedWireIds, HOP_R, STUB, WIRE_LANE, findPortAtPoint, findWireCrossovers, hitWireSegment, hopArcD, nearestOnPolyline, pickJunctionPositionOnWire, polylinePathD, snapOnSegment, terminalOutward, terminalWorld, textUnflipTransform, toggleWorldFlip, wireLabelPos, wireRoute, wiresInRect } from "./geometry";

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
    expect(pts[1].x).toBeGreaterThan(start.x);
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
    expect(len).toBeGreaterThanOrEqual(STUB);
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

  it("connects vertically or horizontally collinear terminals with a straight grid-aligned line without stub offsets", () => {
    const c = emptyCircuit();
    const btn = addDevice(c, "pb-no", "SB1", "body", 4, 4);
    const relay = addDevice(c, "relay", "KA1", "aux-no", 4, 8);

    // Terminal 1 of button (13) is at (4, 5)*GRID, terminal 1 of KA1 is at (4, 9)*GRID
    addWire(c, btn.symbol, "1", relay.symbol, "1");
    const wLeft = c.wires[0];
    const ptsLeft = wireRoute(c, wLeft.a, wLeft.b);
    expect(ptsLeft).toEqual([
      { x: 4 * GRID, y: 5 * GRID },
      { x: 4 * GRID, y: 9 * GRID },
    ]);

    // Terminal 2 of button (14) is at (8, 5)*GRID, terminal 2 of KA1 is at (8, 9)*GRID
    addWire(c, btn.symbol, "2", relay.symbol, "2");
    const wRight = c.wires[1];
    const ptsRight = wireRoute(c, wRight.a, wRight.b);
    expect(ptsRight).toEqual([
      { x: 8 * GRID, y: 5 * GRID },
      { x: 8 * GRID, y: 9 * GRID },
    ]);
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

  it("merges multiple parallel wire crossings into a single larger arch", () => {
    const c = emptyCircuit();
    // 3 parallel horizontal lines (e.g. 3-phase lines L1, L2, L3 at y = 8, 9, 10)
    const h1L = addJunction(c, 4, 8);
    const h1R = addJunction(c, 16, 8);
    const h2L = addJunction(c, 4, 9);
    const h2R = addJunction(c, 16, 9);
    const h3L = addJunction(c, 4, 10);
    const h3R = addJunction(c, 16, 10);
    addWire(c, h1L.symbol, "1", h1R.symbol, "1");
    addWire(c, h2L.symbol, "1", h2R.symbol, "1");
    addWire(c, h3L.symbol, "1", h3R.symbol, "1");

    // 1 vertical wire crossing all 3 horizontal lines at x = 10
    const vT = addJunction(c, 10, 4);
    const vB = addJunction(c, 10, 16);
    addWire(c, vT.symbol, "1", vB.symbol, "1");

    const crossovers = findWireCrossovers(c);
    expect(crossovers).toHaveLength(1);
    expect(crossovers[0].count).toBe(3);
    expect(crossovers[0].hopAxis).toBe("x");
    expect(crossovers[0].x).toBeCloseTo(10 * GRID);
    expect(crossovers[0].y).toBeCloseTo(9 * GRID); // Middle of y = 8, 9, 10
    expect(crossovers[0].ry).toBeGreaterThan(HOP_R); // Larger vertical span
    expect(crossovers[0].rx).toBeGreaterThanOrEqual(HOP_R); // Proportional bulge

    const hops = crossovers.filter((x) => x.hopWireId === c.wires[3].id);
    const pts = wireRoute(c, c.wires[3].a, c.wires[3].b);
    const d = polylinePathD(pts, hops);

    // Should only contain a single arc command leaping over all 3 lines
    const arcMatches = d.match(/A /g);
    expect(arcMatches).toHaveLength(1);
    expect(d).toContain(`A ${crossovers[0].rx} ${crossovers[0].ry}`);
  });

  it("keeps distant crossings separate when gap exceeds threshold", () => {
    const c = emptyCircuit();
    // 2 horizontal lines far apart (y = 6 and y = 14, gap = 8 grids = 176px > 50px)
    const h1L = addJunction(c, 4, 6);
    const h1R = addJunction(c, 16, 6);
    const h2L = addJunction(c, 4, 14);
    const h2R = addJunction(c, 16, 14);
    addWire(c, h1L.symbol, "1", h1R.symbol, "1");
    addWire(c, h2L.symbol, "1", h2R.symbol, "1");

    const vT = addJunction(c, 10, 2);
    const vB = addJunction(c, 10, 18);
    addWire(c, vT.symbol, "1", vB.symbol, "1");

    const crossovers = findWireCrossovers(c);
    expect(crossovers).toHaveLength(2);
    expect(crossovers[0].count).toBe(1);
    expect(crossovers[1].count).toBe(1);
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

  it("routes U-turn for same-direction terminals without folding back onto symbols", () => {
    const c = emptyCircuit();
    const km1 = addDevice(c, "contactor", "KM1", "coil", 4, 4); // A2 at right (out.x = 1)
    const km2 = addDevice(c, "contactor", "KM2", "coil", 4, 8); // A2 at right (out.x = 1)
    addWire(c, km1.symbol, "A2", km2.symbol, "A2");
    const pts = wireRoute(c, c.wires[0].a, c.wires[0].b);
    const start = terminalWorld(c, c.wires[0].a)!;
    const end = terminalWorld(c, c.wires[0].b)!;

    // Both terminals face right, so the outer vertical channel must be to the right of both terminals
    const maxX = Math.max(start.x, end.x);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(maxX - 0.5);
    }
  });

  it("separates overlapping vertical runs of parallel wires", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 6, 0);
    const b = addJunction(c, 6, 12);
    const e = addJunction(c, 6, 2);
    const f = addJunction(c, 6, 10);
    addWire(c, a.symbol, "1", b.symbol, "1");
    addWire(c, e.symbol, "1", f.symbol, "1");
    const routes = allWireRoutes(c);
    const p1 = routes.get(c.wires[0].id)!;
    const p2 = routes.get(c.wires[1].id)!;
    const midX = (pts: { x: number; y: number }[]) => {
      let best = pts[0].x;
      let len = -1;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const L = Math.abs(pts[i + 1].y - pts[i].y);
        if (L > len) {
          len = L;
          best = pts[i].x;
        }
      }
      return best;
    };
    expect(Math.abs(midX(p1) - midX(p2))).toBeGreaterThanOrEqual(WIRE_LANE - 1);
  });

  it("handles parallel straight wires between two devices without spurious crossovers", () => {
    for (const dy of [0, 1, 2, 3, 4, 5, 6, -1, -2, -3]) {
      const c = emptyCircuit();
      const tc1 = addDevice(c, "transformer", "TC1", "body", 4, 4);
      const tc2 = addDevice(c, "transformer", "TC2", "body", 16, 4 + dy);
      addWire(c, tc1.symbol, "X1", tc2.symbol, "H1");
      addWire(c, tc1.symbol, "X2", tc2.symbol, "H4");
      const routes = allWireRoutes(c);
      const crossovers = findWireCrossovers(c, routes);
      expect(crossovers).toHaveLength(0);
    }
  });

  it("handles cross-connected wires cleanly with at most one crossover", () => {
    for (const dy of [0, 2, 4, 6]) {
      const c = emptyCircuit();
      const tc1 = addDevice(c, "transformer", "TC1", "body", 4, 4);
      const tc2 = addDevice(c, "transformer", "TC2", "body", 16, 4 + dy);
      addWire(c, tc1.symbol, "X1", tc2.symbol, "H4");
      addWire(c, tc1.symbol, "X2", tc2.symbol, "H1");
      const routes = allWireRoutes(c);
      const crossovers = findWireCrossovers(c, routes);
      expect(crossovers.length).toBeLessThanOrEqual(1);
    }
  });

  it("straightens a jogged wire by resetting its jog offset", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "KM1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "HL1", "body", 10, 10);
    addWire(c, km.symbol, "A2", lamp.symbol, "1");
    const w = c.wires[0];
    w.jog = { axis: "y", pos: 120 };

    const joggedPts = wireRoute(c, w.a, w.b, w.jog);
    expect(joggedPts.some((p) => Math.round(p.y) === 120)).toBe(true);

    delete w.jog;
    const defaultPts = wireRoute(c, w.a, w.b, w.jog);
    expect(defaultPts).not.toEqual(joggedPts);
  });

  it("calculates junction position on a wire via pickJunctionPositionOnWire", () => {
    const c = emptyCircuit();
    const lamp1 = addDevice(c, "lamp", "HL1", "body", 4, 4);
    const lamp2 = addDevice(c, "lamp", "HL2", "body", 16, 4);
    addWire(c, lamp1.symbol, "1", lamp2.symbol, "1");
    const wire = c.wires[0];

    // Midpoint position when worldPos is not specified
    const midPos = pickJunctionPositionOnWire(c, wire.id);
    expect(midPos).not.toBeNull();
    expect(midPos!.y).toBe(4);
    expect(midPos!.x).toBeGreaterThan(4);
    expect(midPos!.x).toBeLessThan(16);

    // Specific position when worldPos is provided
    const specificPos = pickJunctionPositionOnWire(c, wire.id, { x: 8 * GRID, y: 4 * GRID });
    expect(specificPos).toEqual({ x: 8, y: 4 });
  });

  it("finds closest port with findPortAtPoint", () => {
    const c = emptyCircuit();
    const lamp = addDevice(c, "lamp", "HL1", "body", 4, 4);
    const world = terminalWorld(c, { symbolId: lamp.symbol.id, term: "1" })!;

    const port = findPortAtPoint(c, world.x + 2, world.y + 2, 10);
    expect(port).toEqual({ symbolId: lamp.symbol.id, term: "1" });

    const none = findPortAtPoint(c, world.x + 50, world.y + 50, 10);
    expect(none).toBeNull();
  });

  it("hits draggable wire segments for 2-point, 3-point, and multi-point wires", () => {
    // 2-point horizontal wire: dragging moves in Y
    const pts2H = [{ x: 50, y: 100 }, { x: 250, y: 100 }];
    const hit2H = hitWireSegment(pts2H, { x: 150, y: 102 });
    expect(hit2H).not.toBeNull();
    expect(hit2H?.axis).toBe("y");

    // 2-point vertical wire: dragging moves in X
    const pts2V = [{ x: 100, y: 50 }, { x: 100, y: 250 }];
    const hit2V = hitWireSegment(pts2V, { x: 102, y: 150 });
    expect(hit2V).not.toBeNull();
    expect(hit2V?.axis).toBe("x");

    // 3-point L-shaped wire
    const pts3 = [{ x: 50, y: 100 }, { x: 150, y: 100 }, { x: 150, y: 200 }];
    const hit3Seg0 = hitWireSegment(pts3, { x: 80, y: 102 });
    expect(hit3Seg0?.axis).toBe("y");
    const hit3Seg1 = hitWireSegment(pts3, { x: 152, y: 160 });
    expect(hit3Seg1?.axis).toBe("x");
  });
});

describe("wire merge and optimal junction point", () => {
  it("detects connected wires via areWiresConnected", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "HL2", "body", 14, 4);
    const l3 = addDevice(c, "lamp", "HL3", "body", 14, 14);

    const w1 = addWire(c, l1.symbol, "1", l2.symbol, "1");
    const w2 = addWire(c, l2.symbol, "1", l3.symbol, "1");

    // w1 and w2 share the same port l2.1
    expect(areWiresConnected(c, w1.id, w2.id)).toBe(true);

    // Add unconnected device & wire
    const l4 = addDevice(c, "lamp", "HL4", "body", 24, 24);
    const l5 = addDevice(c, "lamp", "HL5", "body", 34, 24);
    const w3 = addWire(c, l4.symbol, "1", l5.symbol, "1");
    expect(areWiresConnected(c, w1.id, w3.id)).toBe(false);
  });

  it("calculates optimal junction position when merging T-connected or intersecting wires", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "HL2", "body", 16, 4);
    const l3 = addDevice(c, "lamp", "HL3", "body", 10, 14);

    const w1 = addWire(c, l1.symbol, "1", l2.symbol, "1");
    const w2 = addWire(c, l3.symbol, "1", l1.symbol, "1");

    const optPos = findOptimalJunctionForWires(c, w1.id, w2.id);
    expect(optPos).not.toBeNull();
    expect(optPos?.y).toBe(4);
  });

  it("merges two connected wires and creates junction with clean connections", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "HL2", "body", 16, 4);
    const l3 = addDevice(c, "lamp", "HL3", "body", 10, 14);

    const w1 = addWire(c, l1.symbol, "1", l2.symbol, "1");
    const w2 = addWire(c, l3.symbol, "1", l1.symbol, "1");

    const res = mergeWires(c, w1.id, w2.id, { x: 10, y: 4 });
    expect(res).not.toBeNull();
    expect(res?.junction.x).toBe(10);
    expect(res?.junction.y).toBe(4);

    // Old wires removed, 3 new branches created to the junction
    expect(c.wires.some((w) => w.id === w1.id)).toBe(false);
    expect(c.wires.some((w) => w.id === w2.id)).toBe(false);
    expect(c.wires.length).toBe(3);
  });

  it("finds wires within rectangular marquee selection using wiresInRect", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "HL2", "body", 16, 4);
    const w = addWire(c, l1.symbol, "1", l2.symbol, "1");

    const inBox = wiresInRect(c, { x: 6, y: 2, w: 6, h: 4 });
    expect(inBox).toContain(w.id);

    const outBox = wiresInRect(c, { x: 20, y: 20, w: 4, h: 4 });
    expect(outBox).not.toContain(w.id);
  });

  it("finds all connected/contiguous wires across junctions, shared ports, and net labels", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "HL1", "body", 4, 4);
    const j1 = addJunction(c, 10, 4);
    const j2 = addJunction(c, 16, 4);
    const l2 = addDevice(c, "lamp", "HL2", "body", 22, 4);
    const l3 = addDevice(c, "lamp", "HL3", "body", 10, 12);

    // Segment 1: l1 -> j1
    const w1 = addWire(c, l1.symbol, "1", j1.symbol, "1");
    // Segment 2: j1 -> j2
    const w2 = addWire(c, j1.symbol, "1", j2.symbol, "1");
    // Segment 3: j2 -> l2
    const w3 = addWire(c, j2.symbol, "1", l2.symbol, "1");
    // Branch: j1 -> l3
    const w4 = addWire(c, j1.symbol, "1", l3.symbol, "1");

    // Independent wire elsewhere
    const l4 = addDevice(c, "lamp", "HL4", "body", 30, 30);
    const l5 = addDevice(c, "lamp", "HL5", "body", 40, 30);
    const wIsolated = addWire(c, l4.symbol, "1", l5.symbol, "1");

    // Selecting w1 should find all connected wire segments: w1, w2, w3, w4
    const conn1 = getConnectedWireIds(c, w1.id);
    expect(conn1.size).toBe(4);
    expect(conn1.has(w1.id)).toBe(true);
    expect(conn1.has(w2.id)).toBe(true);
    expect(conn1.has(w3.id)).toBe(true);
    expect(conn1.has(w4.id)).toBe(true);
    expect(conn1.has(wIsolated.id)).toBe(false);

    // Selecting branch w4 should also return the entire connected tree
    const conn4 = getConnectedWireIds(c, w4.id);
    expect(conn4.size).toBe(4);
    expect(conn4.has(w1.id)).toBe(true);
    expect(conn4.has(w2.id)).toBe(true);
    expect(conn4.has(w3.id)).toBe(true);
    expect(conn4.has(w4.id)).toBe(true);
    expect(conn4.has(wIsolated.id)).toBe(false);

    // Selecting isolated wire should only return itself
    const connIso = getConnectedWireIds(c, wIsolated.id);
    expect(connIso.size).toBe(1);
    expect(connIso.has(wIsolated.id)).toBe(true);
    expect(connIso.has(w1.id)).toBe(false);

    // Connecting wires via net-labels with matching tag
    const net1 = addDevice(c, "net-label", "L1", "body", 10, 20);
    const net2 = addDevice(c, "net-label", "L1", "body", 30, 20);
    const wNetA = addWire(c, l3.symbol, "2", net1.symbol, "1");
    const wNetB = addWire(c, net2.symbol, "1", l4.symbol, "2");

    const connWithNets = getConnectedWireIds(c, wNetA.id);
    expect(connWithNets.has(wNetA.id)).toBe(true);
    expect(connWithNets.has(wNetB.id)).toBe(true);
  });

  it("routes around the component when connecting different terminals of the same symbol (self-loopback)", () => {
    const c = emptyCircuit();
    const btn = addDevice(c, "pb-no", "SB_START", "body", 4, 4);
    // Connect terminal 1 (x=0, y=1) and 2 (x=4, y=1) of the same push button
    addWire(c, btn.symbol, "1", btn.symbol, "2");
    const w = c.wires[0];

    const pts = wireRoute(c, w.a, w.b);
    expect(pts.length).toBeGreaterThanOrEqual(4);

    // The wire should loop around rather than cutting horizontally straight through the symbol body at y=5
    const bodyY = (4 + 1) * GRID;
    const detourPoints = pts.filter((p) => Math.abs(p.y - bodyY) > 10);
    expect(detourPoints.length).toBeGreaterThan(0);

    // Verify it is hittable and draggable
    const midPt = pts[Math.floor(pts.length / 2)];
    const hit = hitWireSegment(pts, { x: midPt.x, y: midPt.y + 1 });
    expect(hit).not.toBeNull();
  });

  it("strictly aligns all vertices to GRID during autorouting", () => {
    const c = emptyCircuit();
    const tc = addDevice(c, "transformer", "TC1", "body", 2, 10);
    const fr = addDevice(c, "overload", "FR1", "aux-nc", 12, 2);
    addWire(c, tc.symbol, "X1", fr.symbol, "95");
    const w = c.wires[0];

    const pts = wireRoute(c, w.a, w.b);
    expect(pts.length).toBeGreaterThanOrEqual(4);
    for (const p of pts) {
      expect(p.x % GRID).toBe(0);
      expect(p.y % GRID).toBe(0);
    }
  });

  it("left/right wire jog movement does not affect horizontal segments and stays grid aligned", () => {
    const c = emptyCircuit();
    const tc = addDevice(c, "transformer", "TC1", "body", 2, 10);
    const fr = addDevice(c, "overload", "FR1", "aux-nc", 12, 2);
    addWire(c, tc.symbol, "X1", fr.symbol, "95");
    const w = c.wires[0];

    const start = terminalWorld(c, w.a)!;
    const end = terminalWorld(c, w.b)!;

    // Moving vertical segment left/right to x = 10 * GRID (in between start.x=176 and end.x=264)
    const jogX = 10 * GRID;
    const pts = wireRoute(c, w.a, w.b, { axis: "x", pos: jogX });

    // Every point must be strictly on grid
    for (const p of pts) {
      expect(p.x % GRID).toBe(0);
      expect(p.y % GRID).toBe(0);
    }

    // Horizontal segments must remain at the exact heights of the terminals
    const horizSegments = [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (Math.abs(pts[i].y - pts[i + 1].y) < 0.5) {
        horizSegments.push(pts[i].y);
      }
    }
    expect(horizSegments).toContain(start.y);
    expect(horizSegments).toContain(end.y);

    // Vertical segment is strictly at jogX
    const vertSegments = [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (Math.abs(pts[i].x - pts[i + 1].x) < 0.5) {
        vertSegments.push(pts[i].x);
      }
    }
    expect(vertSegments).toContain(jogX);
  });

  it("horizontal / up-down wire jog movement does not affect vertical segments and stays grid aligned", () => {
    const c = emptyCircuit();
    const fu1 = addDevice(c, "fuse", "FU1", "body", 4, 4);
    const fu2 = addDevice(c, "fuse", "FU2", "body", 12, 12);
    // Connect vertical terminals (FU1 terminal 2 exits down, FU2 terminal 1 exits up)
    addWire(c, fu1.symbol, "2", fu2.symbol, "1");
    const w = c.wires[0];

    const start = terminalWorld(c, w.a)!;
    const end = terminalWorld(c, w.b)!;

    // Moving horizontal segment to y = 10 * GRID (in between start.y=176 and end.y=264)
    const jogY = 10 * GRID;
    const pts = wireRoute(c, w.a, w.b, { axis: "y", pos: jogY });

    // Every point must be strictly on grid
    for (const p of pts) {
      expect(p.x % GRID).toBe(0);
      expect(p.y % GRID).toBe(0);
    }

    // Vertical segments must remain at the exact x of the terminals
    const vertSegments = [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (Math.abs(pts[i].x - pts[i + 1].x) < 0.5) {
        vertSegments.push(pts[i].x);
      }
    }
    expect(vertSegments).toContain(start.x);
    expect(vertSegments).toContain(end.x);

    // Horizontal segment is strictly at jogY
    const horizSegments = [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (Math.abs(pts[i].y - pts[i + 1].y) < 0.5) {
        horizSegments.push(pts[i].y);
      }
    }
    expect(horizSegments).toContain(jogY);
  });

  it("ensures no wire route ever contains diagonal lines (all segments are purely horizontal or vertical)", () => {
    const c = emptyCircuit();
    const fr = addDevice(c, "overload", "FR1", "aux-nc", 22, 4);
    const sb = addDevice(c, "pb-nc", "SB1", "body", 16, 17);
    // FR1 aux-nc terminal 96 faces RIGHT; SB1 terminal 1 faces LEFT and is located to the left and lower than FR1
    addWire(c, fr.symbol, "96", sb.symbol, "1");
    const w = c.wires[0];

    const pts = wireRoute(c, w.a, w.b);
    expect(pts.length).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < pts.length - 1; i++) {
      const isHorizontal = Math.abs(pts[i].y - pts[i + 1].y) < 0.01;
      const isVertical = Math.abs(pts[i].x - pts[i + 1].x) < 0.01;
      expect(isHorizontal || isVertical).toBe(true);
    }
  });

  it("ensures vertical-to-horizontal crossed-over routes contain no diagonal lines", () => {
    const c = emptyCircuit();
    const fu = addDevice(c, "fuse", "FU1", "body", 10, 4); // term 2 exits DOWN
    const sb = addDevice(c, "pb-nc", "SB1", "body", 4, 2); // term 1 exits LEFT
    addWire(c, fu.symbol, "2", sb.symbol, "1");
    const w = c.wires[0];

    const pts = wireRoute(c, w.a, w.b);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < pts.length - 1; i++) {
      const isHorizontal = Math.abs(pts[i].y - pts[i + 1].y) < 0.01;
      const isVertical = Math.abs(pts[i].x - pts[i + 1].x) < 0.01;
      expect(isHorizontal || isVertical).toBe(true);
    }
  });

  describe("junction deletion preserves wire layout", () => {
    it("preserves layout when deleting junction on a straight horizontal line", () => {
      const c = emptyCircuit();
      const left = addDevice(c, "lamp", "HL1", "body", 4, 4);
      const mid = addJunction(c, 10, 5);
      const right = addDevice(c, "lamp", "HL2", "body", 16, 4);

      addWire(c, left.symbol, "2", mid.symbol, "1");
      addWire(c, mid.symbol, "1", right.symbol, "1");

      const pts0 = wireRoute(c, c.wires[0].a, c.wires[0].b);
      const pts1 = wireRoute(c, c.wires[1].a, c.wires[1].b);
      const originalPath = cleanPolyline([...pts0, ...pts1.slice(1)]);

      removeJunction(c, mid.symbol.id);

      expect(c.wires.length).toBe(1);
      const newPath = wireRoute(c, c.wires[0].a, c.wires[0].b, c.wires[0].jog);
      expect(cleanPolyline(newPath)).toEqual(originalPath);
    });

    it("preserves layout when deleting junction at an L-shaped corner", () => {
      const c = emptyCircuit();
      const top = addDevice(c, "fuse", "FU1", "body", 4, 2); // term 2 exits DOWN at (4, 4)*GRID
      const corner = addJunction(c, 4, 10);
      const right = addDevice(c, "pb-no", "SB1", "body", 12, 10); // term 1 exits LEFT at (12, 10)*GRID

      addWire(c, top.symbol, "2", corner.symbol, "1");
      addWire(c, corner.symbol, "1", right.symbol, "1");

      const pts0 = wireRoute(c, c.wires[0].a, c.wires[0].b);
      const pts1 = wireRoute(c, c.wires[1].a, c.wires[1].b);
      const originalPath = cleanPolyline([...pts0, ...pts1.slice(1)]);

      removeJunction(c, corner.symbol.id);

      expect(c.wires.length).toBe(1);
      const newPath = wireRoute(c, c.wires[0].a, c.wires[0].b, c.wires[0].jog);
      expect(cleanPolyline(newPath)).toEqual(originalPath);
    });

    it("preserves layout when deleting junction on a jogged wire", () => {
      const c = emptyCircuit();
      const top = addDevice(c, "fuse", "FU1", "body", 4, 2);
      const mid = addJunction(c, 10, 6);
      const bot = addDevice(c, "fuse", "FU2", "body", 16, 12);

      // Wire 1 with a jog
      const w1 = addWire(c, top.symbol, "2", mid.symbol, "1");
      w1.jog = { axis: "y", pos: 6 * GRID };
      // Wire 2 straight
      addWire(c, mid.symbol, "1", bot.symbol, "1");

      const pts0 = wireRoute(c, c.wires[0].a, c.wires[0].b, c.wires[0].jog);
      const pts1 = wireRoute(c, c.wires[1].a, c.wires[1].b, c.wires[1].jog);
      const originalPath = cleanPolyline([...pts0, ...pts1.slice(1)]);

      removeJunction(c, mid.symbol.id);

      expect(c.wires.length).toBe(1);
      const newPath = wireRoute(c, c.wires[0].a, c.wires[0].b, c.wires[0].jog);
      expect(cleanPolyline(newPath)).toEqual(originalPath);
    });

    it("preserves through-wire layout when deleting a T-junction with 3 legs", () => {
      const c = emptyCircuit();
      const left = addDevice(c, "lamp", "HL1", "body", 2, 4);
      const mid = addJunction(c, 8, 5);
      const right = addDevice(c, "lamp", "HL2", "body", 14, 4);
      const tap = addDevice(c, "lamp", "HL3", "body", 8, 12);

      // Left to mid (horizontal through)
      addWire(c, left.symbol, "2", mid.symbol, "1");
      // Mid to right (horizontal through)
      addWire(c, mid.symbol, "1", right.symbol, "1");
      // Mid to tap (vertical branch)
      addWire(c, mid.symbol, "1", tap.symbol, "1");

      const pts0 = wireRoute(c, c.wires[0].a, c.wires[0].b);
      const pts1 = wireRoute(c, c.wires[1].a, c.wires[1].b);
      const throughPath = cleanPolyline([...pts0, ...pts1.slice(1)]);

      removeJunction(c, mid.symbol.id);

      expect(c.wires.length).toBe(1);
      const newPath = wireRoute(c, c.wires[0].a, c.wires[0].b, c.wires[0].jog);
      expect(cleanPolyline(newPath)).toEqual(throughPath);
    });
  });
});
