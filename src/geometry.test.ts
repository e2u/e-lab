import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addDevice, addJunction, addWire, emptyCircuit, mergeWires, removeJunction } from "./circuitBuilder";
import { GRID, type Circuit } from "./types";
import { allWireRoutes, avoidWireOverlap, alignRailWireEnds, alignStackedWireLabels, areWiresConnected, circuitRouteKey, cleanPolyline, dedupeWireLabels, ensureNetTerminalSideLabels, findOptimalJunctionForWires, findOverlappingTerminalPairs, getConnectedWireIds, HOP_R, STUB, findPortAtPoint, findWireCrossovers, hitWireSegment, hopArcD, jogForFixedSegmentDrag, jogForJunctionSlide, jogForPolyline, junctionDragBases, junctionDragMoves, junctionFollowVertices, nearestOnPolyline, pickJunctionPositionOnWire, pickVisibleWireLabels, polylinePathD, segmentAxis, slideOrthogonalSegment, slideSegmentWithJunctions, snapOnSegment, snapPointToGrid, terminalOutward, terminalWorld, textUnflipTransform, toggleWorldFlip, WIRE_LABEL_REPEAT, WIRE_LABEL_SEPARATION, WIRE_LANE, wireLabelAnchors, wireLabelOffset, wireLabelPos, wireLabelRadius, wireRoute, wiringTarget, wiresInRect } from "./geometry";
import { useLab } from "./store";

describe("wire routing stubs", () => {
  it("leaves a coil terminal in a straight stub before turning", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 10);
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
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 10);
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
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 10);
    addWire(c, km.symbol, "A2", lamp.symbol, "1");
    const w = c.wires[0];
    const start = terminalWorld(c, w.a)!;
    const pts = wireRoute(c, w.a, w.b, { axis: "y", pos: start.y + 40 });
    const ys = new Set(pts.slice(1, -1).map((p) => Math.round(p.y)));
    expect(ys.has(Math.round(start.y + 40))).toBe(true);
    expect(pts[1].y).toBeCloseTo(start.y);
  });

  it("drops a perpendicular leg shorter than one grid while drawing", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4);
    const from = { symbolId: km.symbol.id, term: "A2" };
    const a = terminalWorld(c, from)!;
    const near = wiringTarget(c, from, { x: a.x + 3 * GRID, y: a.y + GRID / 2 });
    expect(near).toEqual({ x: a.x + 3 * GRID, y: a.y });
    const oneCell = wiringTarget(c, from, { x: a.x + 3 * GRID, y: a.y + GRID });
    expect(oneCell).toEqual({ x: a.x + 3 * GRID, y: a.y });
    const far = wiringTarget(c, from, { x: a.x + 3 * GRID, y: a.y + 2 * GRID });
    expect(far).toEqual({ x: a.x + 3 * GRID, y: a.y + 2 * GRID });
    expect(wireRoute(c, from, near)).toEqual([a, near]);
  });

  it("moves a junction with the grabbed segment and drops the long way around", () => {
    const c = emptyCircuit();
    const j = addJunction(c, 4, 2);
    const dest = addJunction(c, 14, 6);
    const bus = addJunction(c, 0, 2);
    const drop = addWire(c, j.symbol, "1", dest.symbol, "1");
    const busWire = addWire(c, bus.symbol, "1", j.symbol, "1");
    const long = [
      { x: 4 * GRID, y: 2 * GRID },
      { x: 4 * GRID, y: 12 * GRID },
      { x: 14 * GRID, y: 12 * GRID },
      { x: 14 * GRID, y: 6 * GRID },
    ];
    const slid = slideSegmentWithJunctions(long, 0, "x", 14 * GRID, [true, false, false, false]);
    expect(slid).toEqual([
      { x: 14 * GRID, y: 2 * GRID },
      { x: 14 * GRID, y: 6 * GRID },
    ]);
    j.symbol.x = 14;
    expect(wireRoute(c, drop.a, drop.b)).toEqual(slid);
    expect(wireRoute(c, busWire.a, busWire.b)).toEqual([
      { x: 0, y: 2 * GRID },
      { x: 14 * GRID, y: 2 * GRID },
    ]);
  });

  it("keeps a one-elbow path when only the junction end follows the cursor", () => {
    const vertical = [
      { x: 4 * GRID, y: 2 * GRID },
      { x: 4 * GRID, y: 10 * GRID },
    ];
    expect(slideSegmentWithJunctions(vertical, 0, "x", 8 * GRID, [true, false])).toEqual([
      { x: 8 * GRID, y: 2 * GRID },
      { x: 8 * GRID, y: 10 * GRID },
      { x: 4 * GRID, y: 10 * GRID },
    ]);
    expect(slideSegmentWithJunctions(vertical, 0, "x", 8 * GRID, [true, true])).toEqual([
      { x: 8 * GRID, y: 2 * GRID },
      { x: 8 * GRID, y: 10 * GRID },
    ]);
    const horizontal = [
      { x: 2 * GRID, y: 4 * GRID },
      { x: 10 * GRID, y: 4 * GRID },
    ];
    const followed = slideSegmentWithJunctions(horizontal, 0, "y", 8 * GRID, [true, false]);
    expect(followed).toEqual([
      { x: 2 * GRID, y: 8 * GRID },
      { x: 10 * GRID, y: 8 * GRID },
      { x: 10 * GRID, y: 4 * GRID },
    ]);
    const c = emptyCircuit();
    const j = addJunction(c, 2, 8);
    const k = addJunction(c, 10, 4);
    const w = addWire(c, j.symbol, "1", k.symbol, "1");
    const jog = jogForPolyline(c, w.a, w.b, followed);
    expect(cleanPolyline(wireRoute(c, w.a, w.b, jog))).toEqual(followed);
  });

  it("slides a junction along a vertical run and keeps that run straight", () => {
    const c = emptyCircuit();
    const top = addJunction(c, 14, 0);
    const j = addJunction(c, 14, 4);
    const left = addJunction(c, 8, 8);
    const far = addJunction(c, 0, 8);
    const branch = addWire(c, j.symbol, "1", left.symbol, "1");
    const riser = addWire(c, top.symbol, "1", j.symbol, "1");
    addWire(c, far.symbol, "1", left.symbol, "1");
    const pts = wireRoute(c, branch.a, branch.b);
    expect(pts).toEqual([
      { x: 14 * GRID, y: 4 * GRID },
      { x: 14 * GRID, y: 8 * GRID },
      { x: 8 * GRID, y: 8 * GRID },
    ]);
    const across = hitWireSegment(pts, { x: 11 * GRID, y: 8 * GRID }, 1000);
    expect(across).toMatchObject({ index: 1, axis: "y" });
    const follow = junctionFollowVertices(c, branch, pts, across!.index, across!.axis);
    expect(follow).toEqual([true, false, true]);
    const aligned = slideSegmentWithJunctions(pts, across!.index, "y", 8 * GRID, follow);
    expect(aligned).toEqual([
      { x: 14 * GRID, y: 8 * GRID },
      { x: 8 * GRID, y: 8 * GRID },
    ]);
    const dropped = slideSegmentWithJunctions(pts, across!.index, "y", 6 * GRID, follow);
    expect(dropped).toEqual([
      { x: 14 * GRID, y: 6 * GRID },
      { x: 8 * GRID, y: 6 * GRID },
    ]);
    const dropMoves = junctionDragMoves(c, branch, follow, "y", 6 * GRID);
    expect(dropMoves).toEqual([
      { id: j.symbol.id, x: 14, y: 6 },
      { id: left.symbol.id, x: 8, y: 6 },
    ]);
    j.symbol.y = 6;
    left.symbol.y = 6;
    const jog = jogForJunctionSlide(c, branch.a, branch.b, dropped, "y", 6 * GRID);
    expect(cleanPolyline(wireRoute(c, branch.a, branch.b, jog))).toEqual(dropped);
    expect(wireRoute(c, riser.a, riser.b)).toEqual([
      { x: 14 * GRID, y: 0 },
      { x: 14 * GRID, y: 6 * GRID },
    ]);

    const upright = hitWireSegment(pts, { x: 14 * GRID, y: 6 * GRID }, 1000);
    expect(upright).toMatchObject({ index: 0, axis: "x" });
    const uprightFollow = junctionFollowVertices(c, branch, pts, upright!.index, upright!.axis);
    expect(uprightFollow[0]).toBe(true);
    expect(uprightFollow[2]).toBe(true);
    const slidAside = slideSegmentWithJunctions(pts, upright!.index, "x", 10 * GRID, uprightFollow);
    expect(slidAside).toEqual([
      { x: 10 * GRID, y: 4 * GRID },
      { x: 10 * GRID, y: 8 * GRID },
    ]);
  });

  it("keeps a coil stub when a vertical-run junction follows the horizontal leg", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "M1", "coil", 4, 8);
    const j = addJunction(c, 14, 4);
    const top = addJunction(c, 14, 0);
    const branch = addWire(c, km.symbol, "A2", j.symbol, "1");
    addWire(c, top.symbol, "1", j.symbol, "1");
    const from = { symbolId: km.symbol.id, term: "A2" };
    const a = terminalWorld(c, from)!;
    const pts = wireRoute(c, branch.a, branch.b);
    let hitIndex = -1;
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (segmentAxis(pts[i], pts[i + 1]) !== "y") continue;
      if (Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) <= STUB + 2) continue;
      hitIndex = i;
    }
    expect(hitIndex).toBeGreaterThanOrEqual(0);
    const follow = junctionFollowVertices(c, branch, pts, hitIndex, "y");
    const junctionAt = pts.findIndex((p) => Math.abs(p.x - 14 * GRID) < 0.5 && Math.abs(p.y - 4 * GRID) < 0.5);
    expect(follow[junctionAt]).toBe(true);
    const pos = Math.round(a.y / GRID) * GRID + 2 * GRID;
    const slid = slideSegmentWithJunctions(pts, hitIndex, "y", pos, follow);
    j.symbol.y = pos / GRID;
    const jog = jogForJunctionSlide(c, branch.a, branch.b, slid, "y", pos);
    const route = cleanPolyline(wireRoute(c, branch.a, branch.b, jog));
    expect(route[0].x).toBeCloseTo(a.x);
    expect(route[0].y).toBeCloseTo(a.y);
    expect(route[1].y).toBeCloseTo(a.y);
    expect(route[1].x).toBeGreaterThan(a.x);
    expect(route[route.length - 1]).toEqual({ x: 14 * GRID, y: pos });
    expect(route.some((p, i) => {
      const q = route[i + 1];
      return Boolean(q) && Math.abs(p.y - pos) < 0.5 && Math.abs(q.y - pos) < 0.5 && Math.abs(q.x - p.x) > GRID;
    })).toBe(true);
    expect(wireRoute(c, { symbolId: top.symbol.id, term: "1" }, { symbolId: j.symbol.id, term: "1" })).toEqual([
      { x: 14 * GRID, y: 0 },
      { x: 14 * GRID, y: pos },
    ]);
    j.symbol.y = 4;
    const verticalHit = hitWireSegment(pts, { x: 14 * GRID, y: (a.y + 4 * GRID) / 2 }, 1000);
    expect(verticalHit?.axis).toBe("x");
    const asideFollow = junctionFollowVertices(c, branch, pts, verticalHit!.index, "x");
    expect(asideFollow[junctionAt]).toBe(true);
    const asidePos = 10 * GRID;
    const aside = slideSegmentWithJunctions(pts, verticalHit!.index, "x", asidePos, asideFollow);
    j.symbol.x = asidePos / GRID;
    const asideJog = jogForJunctionSlide(c, branch.a, branch.b, aside, "x", asidePos);
    const asideRoute = cleanPolyline(wireRoute(c, branch.a, branch.b, asideJog));
    const asideEnd = asideRoute[asideRoute.length - 1];
    expect(asideEnd.x).toBeCloseTo(asidePos);
    expect(asideRoute[1].y).toBeCloseTo(a.y);
    expect(asideRoute[1].x).toBeGreaterThan(a.x);
    const span = Math.abs(asideRoute[0].x - asideEnd.x) + Math.abs(asideRoute[0].y - asideEnd.y);
    let length = 0;
    for (let i = 1; i < asideRoute.length; i += 1) {
      length += Math.abs(asideRoute[i].x - asideRoute[i - 1].x) + Math.abs(asideRoute[i].y - asideRoute[i - 1].y);
    }
    expect(length).toBeCloseTo(span);
  });

  it("straightens a one-grid hook by moving the junction onto the dragged row", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "M1", "coil", 4, 8);
    const a = terminalWorld(c, { symbolId: km.symbol.id, term: "A2" })!;
    const row = Math.round(a.y / GRID);
    const top = addJunction(c, 14, row - 4);
    const j = addJunction(c, 14, row + 1);
    const bot = addJunction(c, 14, row + 4);
    const branch = addWire(c, km.symbol, "A2", j.symbol, "1");
    addWire(c, top.symbol, "1", j.symbol, "1");
    addWire(c, j.symbol, "1", bot.symbol, "1");
    const pts = wireRoute(c, branch.a, branch.b);
    expect(pts[pts.length - 1].y).toBeCloseTo((row + 1) * GRID);
    const hit = hitWireSegment(pts, { x: (a.x + 14 * GRID) / 2, y: a.y }, 1000)!;
    expect(hit.axis).toBe("y");
    const follow = junctionFollowVertices(c, branch, pts, hit.index, hit.axis);
    const moves = junctionDragMoves(c, branch, follow, hit.axis, a.y);
    expect(moves).toEqual([{ id: j.symbol.id, x: 14, y: row }]);
    j.symbol.y = row;
    const seeded = slideSegmentWithJunctions(pts, hit.index, hit.axis, a.y, follow);
    const jog = jogForJunctionSlide(c, branch.a, branch.b, seeded, hit.axis, a.y);
    const route = cleanPolyline(wireRoute(c, branch.a, branch.b, jog));
    expect(route).toEqual([
      { x: a.x, y: a.y },
      { x: 14 * GRID, y: a.y },
    ]);
    expect(wireRoute(c, { symbolId: top.symbol.id, term: "1" }, { symbolId: j.symbol.id, term: "1" })).toEqual([
      { x: 14 * GRID, y: (row - 4) * GRID },
      { x: 14 * GRID, y: row * GRID },
    ]);
  });

  it("moves a junction one grid off a straight run and keeps one short elbow", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "M1", "coil", 4, 8);
    const a = terminalWorld(c, { symbolId: km.symbol.id, term: "A2" })!;
    const row = Math.round(a.y / GRID);
    const j = addJunction(c, 14, row);
    const branch = addWire(c, km.symbol, "A2", j.symbol, "1");
    const pts = wireRoute(c, branch.a, branch.b);
    expect(pts).toEqual([
      { x: a.x, y: a.y },
      { x: 14 * GRID, y: a.y },
    ]);
    const hit = hitWireSegment(pts, { x: (a.x + 14 * GRID) / 2, y: a.y }, 1000)!;
    expect(hit.axis).toBe("y");
    const follow = junctionFollowVertices(c, branch, pts, hit.index, hit.axis);
    expect(follow[follow.length - 1]).toBe(true);
    const pos = a.y + GRID;
    const moves = junctionDragMoves(c, branch, follow, hit.axis, pos);
    expect(moves).toEqual([{ id: j.symbol.id, x: 14, y: row + 1 }]);
    j.symbol.y = row + 1;
    const seeded = slideSegmentWithJunctions(pts, hit.index, hit.axis, pos, follow);
    const jog = jogForJunctionSlide(c, branch.a, branch.b, seeded, hit.axis, pos);
    const route = cleanPolyline(wireRoute(c, branch.a, branch.b, jog));
    expect(route[route.length - 1]).toEqual({ x: 14 * GRID, y: pos });
    expect(route[1].y).toBeCloseTo(a.y);
    expect(route[1].x).toBeGreaterThan(a.x);
    const span = Math.abs(route[0].x - route[route.length - 1].x) + Math.abs(route[0].y - route[route.length - 1].y);
    let length = 0;
    for (let i = 1; i < route.length; i += 1) {
      length += Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y);
    }
    expect(length).toBeCloseTo(span);
    expect(route.some((p, i) => {
      const q = route[i + 1];
      return Boolean(q) && Math.abs(p.y - pos) < 0.5 && Math.abs(q.y - pos) < 0.5 && Math.abs(q.x - p.x) > GRID;
    })).toBe(true);

    const hooked = cleanPolyline(wireRoute(c, branch.a, branch.b, jog));
    const drop = hooked.findIndex((p, i) => {
      const q = hooked[i + 1];
      return Boolean(q) && Math.abs(p.x - q.x) < 0.5 && Math.abs(q.y - p.y) > 1;
    });
    expect(drop).toBeGreaterThanOrEqual(0);
    const verticalHit = hitWireSegment(hooked, {
      x: hooked[drop].x,
      y: (hooked[drop].y + hooked[drop + 1].y) / 2,
    }, 1000)!;
    expect(verticalHit.axis).toBe("x");
    const asideFollow = junctionFollowVertices(c, branch, hooked, verticalHit.index, "x");
    expect(asideFollow[hooked.length - 1]).toBe(true);
    const asidePos = 13 * GRID;
    const asideMoves = junctionDragMoves(c, branch, asideFollow, "x", asidePos);
    expect(asideMoves).toEqual([{ id: j.symbol.id, x: 13, y: row + 1 }]);
  });

  it("moves a horizontal-bus junction with a downward drag and drops the U", () => {
    const c = emptyCircuit();
    const busL = addJunction(c, 0, 4);
    const j = addJunction(c, 6, 4);
    const busR = addJunction(c, 16, 4);
    const contact = addDevice(c, "relay", "CR1", "aux-nc", 10, 3);
    addWire(c, busL.symbol, "1", j.symbol, "1");
    addWire(c, j.symbol, "1", busR.symbol, "1");
    const term = { symbolId: contact.symbol.id, term: "3" };
    const end = terminalWorld(c, term)!;
    const branch = addWire(c, j.symbol, "1", contact.symbol, "3");
    const pts = wireRoute(c, branch.a, branch.b);
    const hit = hitWireSegment(pts, { x: (pts[0].x + end.x) / 2, y: pts[0].y }, 1000)!;
    expect(hit.axis).toBe("y");
    const follow = junctionFollowVertices(c, branch, pts, hit.index, hit.axis);
    expect(follow[0]).toBe(true);
    expect(follow[follow.length - 1]).toBe(false);
    const pos = pts[0].y + 3 * GRID;
    const u = slideOrthogonalSegment(pts, hit.index, hit.axis, pos);
    expect(u.length).toBeGreaterThan(3);
    const moves = junctionDragMoves(c, branch, follow, hit.axis, pos);
    expect(moves).toEqual([{ id: j.symbol.id, x: 6, y: Math.round(pos / GRID) }]);
    j.symbol.y = Math.round(pos / GRID);
    const seeded = slideSegmentWithJunctions(pts, hit.index, hit.axis, pos, follow);
    const jog = jogForJunctionSlide(c, branch.a, branch.b, seeded, hit.axis, pos);
    const route = cleanPolyline(wireRoute(c, branch.a, branch.b, jog));
    const span = Math.abs(route[0].x - route[route.length - 1].x) + Math.abs(route[0].y - route[route.length - 1].y);
    let length = 0;
    for (let i = 1; i < route.length; i += 1) length += Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y);
    expect(length).toBeCloseTo(span);
    expect(route.some((p, i) => {
      const q = route[i + 1];
      return Boolean(q) && Math.abs(p.y - pos) < 0.5 && Math.abs(q.y - pos) < 0.5;
    })).toBe(true);
    expect(route[route.length - 1]).toEqual(end);
  });

  it("moves both junctions of a U when either the side or the arm is dragged", () => {
    const c = emptyCircuit();
    const above = addJunction(c, 14, 0);
    const top = addJunction(c, 14, 4);
    const bot = addJunction(c, 14, 12);
    const below = addJunction(c, 14, 16);
    addWire(c, above.symbol, "1", top.symbol, "1");
    addWire(c, bot.symbol, "1", below.symbol, "1");
    const branch = addWire(c, top.symbol, "1", bot.symbol, "1");
    branch.jog = { axis: "x", pos: 10 * GRID, x: 10 * GRID };
    const pts = wireRoute(c, branch.a, branch.b, branch.jog);
    expect(pts).toEqual([
      { x: 14 * GRID, y: 4 * GRID },
      { x: 10 * GRID, y: 4 * GRID },
      { x: 10 * GRID, y: 12 * GRID },
      { x: 14 * GRID, y: 12 * GRID },
    ]);
    const side = hitWireSegment(pts, { x: 10 * GRID, y: 8 * GRID }, 1000)!;
    expect(side).toMatchObject({ index: 1, axis: "x" });
    const sideFollow = junctionFollowVertices(c, branch, pts, side.index, side.axis);
    expect(sideFollow).toEqual([true, false, false, true]);
    const bases = junctionDragBases(c, branch, pts);
    const sideMoves = junctionDragMoves(c, branch, sideFollow, "x", 8 * GRID, pts, side.index, bases);
    expect(sideMoves).toEqual([
      { id: top.symbol.id, x: 8, y: 4 },
      { id: bot.symbol.id, x: 8, y: 12 },
    ]);
    top.symbol.x = 8;
    bot.symbol.x = 8;
    branch.jog = undefined;
    const sideJog = jogForJunctionSlide(
      c,
      branch.a,
      branch.b,
      slideSegmentWithJunctions(pts, side.index, "x", 8 * GRID, sideFollow),
      "x",
      8 * GRID,
    );
    expect(cleanPolyline(wireRoute(c, branch.a, branch.b, sideJog))).toEqual([
      { x: 8 * GRID, y: 4 * GRID },
      { x: 8 * GRID, y: 12 * GRID },
    ]);
    expect(wireRoute(c, { symbolId: above.symbol.id, term: "1" }, { symbolId: top.symbol.id, term: "1" })).toEqual([
      { x: 14 * GRID, y: 0 },
      { x: 14 * GRID, y: 4 * GRID },
      { x: 8 * GRID, y: 4 * GRID },
    ]);

    top.symbol.x = 14;
    bot.symbol.x = 14;
    branch.jog = { axis: "x", pos: 10 * GRID, x: 10 * GRID };
    const arm = hitWireSegment(pts, { x: 12 * GRID, y: 12 * GRID }, 1000)!;
    expect(arm).toMatchObject({ index: 2, axis: "y" });
    const armFollow = junctionFollowVertices(c, branch, pts, arm.index, arm.axis);
    expect(armFollow[0]).toBe(true);
    expect(armFollow[armFollow.length - 1]).toBe(true);
    const armMoves = junctionDragMoves(c, branch, armFollow, "y", 13 * GRID, pts, arm.index, bases);
    expect(armMoves).toEqual([
      { id: top.symbol.id, x: 14, y: 5 },
      { id: bot.symbol.id, x: 14, y: 13 },
    ]);
    top.symbol.y = 5;
    bot.symbol.y = 13;
    const continued = junctionDragMoves(c, branch, armFollow, "y", 14 * GRID, pts, arm.index, bases);
    expect(continued).toEqual([
      { id: top.symbol.id, x: 14, y: 6 },
      { id: bot.symbol.id, x: 14, y: 14 },
    ]);
    top.symbol.y = 6;
    bot.symbol.y = 14;
    branch.jog = undefined;
    const armJog = jogForJunctionSlide(
      c,
      branch.a,
      branch.b,
      slideSegmentWithJunctions(pts, arm.index, "y", 14 * GRID, armFollow),
      "y",
      14 * GRID,
    );
    expect(cleanPolyline(wireRoute(c, branch.a, branch.b, armJog))).toEqual([
      { x: 14 * GRID, y: 6 * GRID },
      { x: 14 * GRID, y: 14 * GRID },
    ]);
    expect(top.symbol.y).not.toBe(bot.symbol.y);
  });

  it("slides a straight run onto the cursor line and stores that jog", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 4, 2);
    const b = addJunction(c, 4, 10);
    addWire(c, a.symbol, "1", b.symbol, "1");
    const w = c.wires[0];
    const pts = wireRoute(c, w.a, w.b);
    expect(pts).toEqual([
      { x: 4 * GRID, y: 2 * GRID },
      { x: 4 * GRID, y: 10 * GRID },
    ]);
    const slid = slideOrthogonalSegment(pts, 0, "x", 7 * GRID);
    expect(slid).toEqual([
      { x: 4 * GRID, y: 2 * GRID },
      { x: 7 * GRID, y: 2 * GRID },
      { x: 7 * GRID, y: 10 * GRID },
      { x: 4 * GRID, y: 10 * GRID },
    ]);
    const jog = jogForPolyline(c, w.a, w.b, slid);
    expect(jog?.x).toBe(7 * GRID);
    expect(cleanPolyline(wireRoute(c, w.a, w.b, jog))).toEqual(slid);
  });

  it("keeps a straight terminal run straight when that wire is dragged", () => {
    const c = emptyCircuit();
    const btn = addDevice(c, "pb-no", "PB1", "body", 4, 4);
    const relay = addDevice(c, "relay", "CR1", "aux-no", 4, 8);
    const w = addWire(c, btn.symbol, "1", relay.symbol, "1");
    const pts = wireRoute(c, w.a, w.b);
    expect(pts).toEqual([
      { x: 4 * GRID, y: 5 * GRID },
      { x: 4 * GRID, y: 9 * GRID },
    ]);
    const pos = 7 * GRID;
    expect(slideOrthogonalSegment(pts, 0, "x", pos)).toHaveLength(4);
    expect(jogForFixedSegmentDrag(c, w.a, w.b, pts, 0, "x", pos)).toBeUndefined();
    expect(cleanPolyline(wireRoute(c, w.a, w.b))).toEqual(pts);

    w.jog = { axis: "x", pos, x: pos };
    const hooked = wireRoute(c, w.a, w.b, w.jog);
    expect(hooked.length).toBeGreaterThan(3);
    const side = hitWireSegment(hooked, { x: pos, y: 7 * GRID }, 1000)!;
    expect(side.axis).toBe("x");
    expect(jogForFixedSegmentDrag(c, w.a, w.b, hooked, side.index, "x", 8 * GRID)).toBeUndefined();
    expect(cleanPolyline(wireRoute(c, w.a, w.b))).toEqual(pts);
  });

  it("does not fold a contact terminal back when its junction follows", () => {
    const c = emptyCircuit();
    const contact = addDevice(c, "timer-ss-on", "TR1", "inst-no", 8, 6);
    const pin = { symbolId: contact.symbol.id, term: "3" };
    const end = terminalWorld(c, pin)!;
    expect(terminalOutward(c, pin)).toEqual({ x: 1, y: 0 });
    const row = Math.round(end.y / GRID);
    const col = Math.round(end.x / GRID);
    const j = addJunction(c, col + 4, row);
    const branch = addWire(c, contact.symbol, "3", j.symbol, "1");
    const pts = wireRoute(c, branch.a, branch.b);
    const hit = hitWireSegment(pts, { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: end.y }, 1000)!;
    expect(hit.axis).toBe("y");
    const follow = junctionFollowVertices(c, branch, pts, hit.index, hit.axis);
    expect(follow.some(Boolean)).toBe(true);
    const pos = end.y + 3 * GRID;
    const moves = junctionDragMoves(c, branch, follow, hit.axis, pos, pts, hit.index, junctionDragBases(c, branch, pts));
    expect(moves).toEqual([{ id: j.symbol.id, x: col + 4, y: row + 3 }]);
    j.symbol.y = row + 3;
    const seeded = slideSegmentWithJunctions(pts, hit.index, hit.axis, pos, follow);
    const jog = jogForJunctionSlide(c, branch.a, branch.b, seeded, hit.axis, pos);
    const route = cleanPolyline(wireRoute(c, branch.a, branch.b, jog));
    expect(route[0]).toEqual(end);
    expect(route[route.length - 1]).toEqual({ x: (col + 4) * GRID, y: pos });
    const minX = Math.min(route[0].x, route[route.length - 1].x) - STUB - 1;
    const maxX = Math.max(route[0].x, route[route.length - 1].x) + STUB + 1;
    const minY = Math.min(route[0].y, route[route.length - 1].y) - STUB - 1;
    const maxY = Math.max(route[0].y, route[route.length - 1].y) + STUB + 1;
    for (const p of route) {
      expect(p.x).toBeGreaterThanOrEqual(minX);
      expect(p.x).toBeLessThanOrEqual(maxX);
      expect(p.y).toBeGreaterThanOrEqual(minY);
      expect(p.y).toBeLessThanOrEqual(maxY);
    }
    if (route.length > 2) {
      expect(route[1].y).toBeCloseTo(end.y);
      expect(route[1].x).toBeGreaterThan(end.x);
    }
    let length = 0;
    for (let i = 1; i < route.length; i += 1) {
      length += Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y);
    }
    const span = Math.abs(route[0].x - route[route.length - 1].x) + Math.abs(route[0].y - route[route.length - 1].y);
    expect(length).toBeLessThanOrEqual(span + STUB + 1);
  });

  it("drops a return bend between a junction and a contact terminal", () => {
    const c = emptyCircuit();
    const contact = addDevice(c, "timer-ss-on", "TR1", "inst-no", 10, 8);
    const pin = { symbolId: contact.symbol.id, term: "1" };
    const end = terminalWorld(c, pin)!;
    expect(terminalOutward(c, pin).x).toBe(-1);
    const col = Math.round(end.x / GRID);
    const row = Math.round(end.y / GRID);
    const j = addJunction(c, col, row - 4);
    const branch = addWire(c, j.symbol, "1", contact.symbol, "1");
    branch.jog = { axis: "x", pos: (col - 3) * GRID, x: (col - 3) * GRID };
    const pts = wireRoute(c, branch.a, branch.b, branch.jog);
    expect(pts.length).toBeGreaterThan(3);
    const side = hitWireSegment(pts, { x: (col - 3) * GRID, y: (row - 2) * GRID }, 1000)!;
    expect(side.axis).toBe("x");
    const follow = junctionFollowVertices(c, branch, pts, side.index, side.axis);
    expect(follow[0] || follow[follow.length - 1]).toBe(true);
    const pos = (col - 4) * GRID;
    const moves = junctionDragMoves(c, branch, follow, "x", pos, pts, side.index, junctionDragBases(c, branch, pts));
    expect(moves.some((m) => m.id === j.symbol.id && m.x === col - 4)).toBe(true);
    j.symbol.x = col - 4;
    branch.jog = undefined;
    const seeded = slideSegmentWithJunctions(pts, side.index, "x", pos, follow);
    const jog = jogForJunctionSlide(c, branch.a, branch.b, seeded, "x", pos);
    const route = cleanPolyline(wireRoute(c, branch.a, branch.b, jog));
    expect(route[route.length - 1].x).toBeCloseTo(end.x);
    expect(route[route.length - 1].y).toBeCloseTo(end.y);
    expect(route[0]).toEqual({ x: (col - 4) * GRID, y: (row - 4) * GRID });
    const minX = Math.min(route[0].x, route[route.length - 1].x) - STUB - 1;
    const maxX = Math.max(route[0].x, route[route.length - 1].x) + STUB - 1;
    for (const p of route) {
      expect(p.x).toBeGreaterThanOrEqual(minX);
      expect(p.x).toBeLessThanOrEqual(maxX + 2);
    }
    let length = 0;
    for (let i = 1; i < route.length; i += 1) {
      length += Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y);
    }
    const span = Math.abs(route[0].x - route[route.length - 1].x) + Math.abs(route[0].y - route[route.length - 1].y);
    expect(length).toBeLessThanOrEqual(span + STUB + 1);
  });

  it("slides only the grabbed segment and can store that path as a jog", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "LT1", "body", 16, 12);
    addWire(c, km.symbol, "A2", lamp.symbol, "1");
    const w = c.wires[0];
    const pts = wireRoute(c, w.a, w.b);
    const index = pts.findIndex((p, i) => i < pts.length - 1 && Math.abs(p.x - pts[i + 1].x) < 0.5 && Math.abs(pts[i + 1].y - p.y) > GRID);
    expect(index).toBeGreaterThan(0);
    const slid = slideOrthogonalSegment(pts, index, "x", 10 * GRID);
    expect(slid[0]).toEqual(pts[0]);
    expect(slid[slid.length - 1]).toEqual(pts[pts.length - 1]);
    expect(slid.some((p) => p.x === 10 * GRID)).toBe(true);
    const keptY = pts[index].y;
    expect(slid.some((p) => p.y === keptY)).toBe(true);
    const jog = jogForPolyline(c, w.a, w.b, slid);
    expect(jog?.x).toBe(10 * GRID);
    const again = wireRoute(c, w.a, w.b, jog);
    expect(again.some((p) => p.x === 10 * GRID)).toBe(true);
    expect(again[0]).toEqual(pts[0]);
    expect(again[again.length - 1]).toEqual(pts[pts.length - 1]);
  });

  it("keeps an anchored wire on its jog line and shifts the neighbour", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 0, 0);
    const b = addJunction(c, 0, 10);
    const e = addJunction(c, 0, 2);
    const f = addJunction(c, 0, 8);
    const w1 = addWire(c, a.symbol, "1", b.symbol, "1");
    const w2 = addWire(c, e.symbol, "1", f.symbol, "1");
    w1.jog = { axis: "x", pos: 6 * GRID, x: 6 * GRID };
    w2.jog = { axis: "x", pos: 6 * GRID, x: 6 * GRID };
    const routes = allWireRoutes(c, w1.id);
    const anchored = routes.get(w1.id)!;
    expect(anchored.some((p) => p.x === 6 * GRID)).toBe(true);
    const other = routes.get(w2.id)!;
    const otherX = other.find((p) => Math.abs(p.x - 6 * GRID) > 0.5)?.x ?? other[1].x;
    expect(Math.abs(otherX - 6 * GRID)).toBeGreaterThanOrEqual(WIRE_LANE - 1);
  });

  it("turns an end-square rail tap beside the device and enters the rail horizontally", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 2, 0, { railY0: 0, railY1: 20 });
    const pb = addDevice(c, "pb-no", "PB1", "body", 8, 4);
    const w = addWire(c, pb.symbol, "2", hot.symbol, "y0");
    w.b.railPin = "y0";
    w.jog = { axis: "x", pos: 6 * GRID, x: 6 * GRID };
    const pts = wireRoute(c, w.a, w.b, w.jog);
    const rail = terminalWorld(c, w.b)!;
    expect(pts[pts.length - 1]).toEqual(rail);
    expect(pts[pts.length - 2].y).toBeCloseTo(rail.y);
    expect(pts.some((p) => p.x === 6 * GRID)).toBe(true);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const dx = Math.abs(pts[i + 1].x - pts[i].x);
      const dy = Math.abs(pts[i + 1].y - pts[i].y);
      expect(dx < 0.5 || dy < 0.5).toBe(true);
    }
  });

  it("snaps a free wiring destination to the integer grid", () => {
    const c = emptyCircuit();
    const pb = addDevice(c, "pb-no", "PB1", "body", 4, 4);
    const pts = wireRoute(c, { symbolId: pb.symbol.id, term: "2" }, { x: 10.4 * GRID, y: 8.7 * GRID });
    const dest = pts[pts.length - 1];
    expect(dest).toEqual(snapPointToGrid({ x: 10.4 * GRID, y: 8.7 * GRID }));
    expect(dest.x).toBe(10 * GRID);
    expect(dest.y).toBe(9 * GRID);
    for (const p of pts.slice(2)) {
      expect(p.x).toBe(Math.round(p.x / GRID) * GRID);
      expect(p.y).toBe(Math.round(p.y / GRID) * GRID);
    }
  });

  it("connects vertically or horizontally collinear terminals with a straight grid-aligned line without stub offsets", () => {
    const c = emptyCircuit();
    const btn = addDevice(c, "pb-no", "PB1", "body", 4, 4);
    const relay = addDevice(c, "relay", "CR1", "aux-no", 4, 8);

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
    const hl = addDevice(c, "lamp", "LT1", "body", 16, 8);
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
    const hl = addDevice(c, "lamp", "LT1", "body", 16, 8);
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
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4);
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
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4, {}, 90);
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

  it("does not lane-separate overlapping wires of the same net", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 0, 6);
    const b = addJunction(c, 12, 6);
    const e = addJunction(c, 2, 6);
    addWire(c, a.symbol, "1", b.symbol, "1");
    addWire(c, a.symbol, "1", e.symbol, "1");
    const routes = allWireRoutes(c);
    for (const w of c.wires) {
      expect(routes.get(w.id)!.every((p) => p.y === 6 * GRID)).toBe(true);
    }
  });

  it("shifts an overlapping middle run without adding extra bends", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 0, 0);
    const b = addJunction(c, 0, 10);
    const e = addJunction(c, 0, 2);
    const f = addJunction(c, 0, 8);
    addWire(c, a.symbol, "1", b.symbol, "1").jog = { axis: "x", pos: 6 * GRID };
    addWire(c, e.symbol, "1", f.symbol, "1").jog = { axis: "x", pos: 6 * GRID };
    const routes = allWireRoutes(c);
    for (const w of c.wires) {
      expect(routes.get(w.id)!.length).toBeLessThanOrEqual(4);
    }
    const xs = c.wires.map((w) => routes.get(w.id)![1].x);
    expect(Math.abs(xs[0] - xs[1])).toBeGreaterThanOrEqual(WIRE_LANE - 1);
  });

  it("pushes a dragged jog off another net's run", () => {
    const c = emptyCircuit();
    const a = addJunction(c, 0, 0);
    const b = addJunction(c, 0, 10);
    const e = addJunction(c, 2, 0);
    const f = addJunction(c, 2, 10);
    addWire(c, a.symbol, "1", b.symbol, "1").jog = { axis: "x", pos: 6 * GRID, x: 6 * GRID };
    const w2 = addWire(c, e.symbol, "1", f.symbol, "1");
    const jog = avoidWireOverlap(c, w2.id, w2.a, w2.b, { axis: "x", pos: 6 * GRID, x: 6 * GRID });
    expect(jog?.x).not.toBe(6 * GRID);
  });

  it("places a vertical label so the circle is tangent to the wire", () => {
    const pts = [
      { x: 100, y: 0 },
      { x: 100, y: GRID * 12 },
    ];
    const offset = wireLabelOffset("2");
    const anchors = wireLabelAnchors(pts, offset);
    expect(anchors.length).toBeGreaterThanOrEqual(1);
    expect(anchors[0].horizontal).toBe(false);
    expect(anchors[0].x).toBeCloseTo(100 + offset);
    expect(anchors[0].x - 100).toBeCloseTo(wireLabelRadius("2") + 1.1);
  });

  it("still anchors a label on a short hop between close devices", () => {
    const pts = [
      { x: 0, y: 40 },
      { x: GRID * 0.5, y: 40 },
    ];
    const anchors = wireLabelAnchors(pts, 6);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].t).toBeCloseTo(0.5);
    expect(anchors[0].y).toBeCloseTo(46);
  });

  it("keeps 3/4/5 on short neighboring wires instead of dropping them", () => {
    const mk = (id: string, tag: string, x: number) => ({
      wireId: id,
      tag,
      anchors: [{ x, y: 40, horizontal: true, segLen: GRID * 0.5, t: 0.5 }],
    });
    const kept = pickVisibleWireLabels([
      mk("w3", "3", 0),
      mk("w4", "4", GRID * 0.8),
      mk("w5", "5", GRID * 1.6),
    ]);
    expect(kept.get("w3")).toHaveLength(1);
    expect(kept.get("w4")).toHaveLength(1);
    expect(kept.get("w5")).toHaveLength(1);
  });

  it("places extra labels along a long run", () => {
    const pts = [
      { x: 0, y: 40 },
      { x: GRID * 30, y: 40 },
    ];
    const anchors = wireLabelAnchors(pts);
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    expect(anchors.every((a) => a.horizontal)).toBe(true);
    const xs = anchors.map((a) => a.x).sort((a, b) => a - b);
    expect(xs[xs.length - 1] - xs[0]).toBeGreaterThan(GRID * 8);
  });

  it("keeps distant same-number labels and drops overlapping ones", () => {
    const kept = pickVisibleWireLabels([
      {
        wireId: "long",
        tag: "2",
        anchors: [
          { x: 0, y: 0, horizontal: true, segLen: 400, t: 0.2 },
          { x: GRID * 20, y: 0, horizontal: true, segLen: 400, t: 0.8 },
        ],
      },
      {
        wireId: "stub",
        tag: "2",
        anchors: [{ x: 8, y: 0, horizontal: true, segLen: 50, t: 0.5 }],
      },
      {
        wireId: "branch",
        tag: "6",
        anchors: [{ x: 0, y: 200, horizontal: true, segLen: 80, t: 0.5 }],
      },
      {
        wireId: "lamp",
        tag: "6",
        anchors: [{ x: GRID * 3, y: 200 + GRID * 2, horizontal: true, segLen: 70, t: 0.5 }],
      },
    ]);
    expect(kept.get("long")!.length).toBe(2);
    expect(kept.has("stub")).toBe(false);
    expect(kept.has("branch")).toBe(true);
    expect(kept.has("lamp")).toBe(true);
  });

  it("slides a label away from another number and a junction", () => {
    const avoid = [{ x: 200, y: 40 }];
    const kept = pickVisibleWireLabels(
      [
        {
          wireId: "a",
          tag: "101",
          anchors: [
            { x: 200, y: 40, horizontal: true, segLen: 100, t: 0.8 },
            { x: 80, y: 40, horizontal: true, segLen: 100, t: 0.3 },
          ],
        },
        {
          wireId: "b",
          tag: "102",
          anchors: [{ x: 210, y: 40, horizontal: true, segLen: 120, t: 0.5 }],
        },
      ],
      GRID * 2.5,
      avoid,
    );
    const a = kept.get("a")!;
    expect(a.some((p) => p.x < 120)).toBe(true);
    expect(a.every((p) => Math.hypot(p.x - 200, p.y - 40) > GRID)).toBe(true);
  });

  it("aligns stacked 100/101/102 onto one column on the main runs", () => {
    const offset = 11;
    const pts100 = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ];
    const pts101 = [
      { x: 0, y: GRID * 2 },
      { x: 200, y: GRID * 2 },
      { x: 200, y: GRID * 8 },
    ];
    const pts102 = [
      { x: 0, y: GRID * 4 },
      { x: 400, y: GRID * 4 },
    ];
    const byWire = new Map([
      ["w100", [{ x: 120, y: offset, horizontal: true, segLen: 400, t: 0.3 }]],
      ["w101", [{ x: 200 + offset, y: GRID * 5, horizontal: false, segLen: 80, t: 0.7 }]],
      ["w102", [{ x: 140, y: GRID * 4 + offset, horizontal: true, segLen: 400, t: 0.35 }]],
    ]);
    const info = new Map([
      ["w100", { pts: pts100, tag: "100", offset }],
      ["w101", { pts: pts101, tag: "101", offset }],
      ["w102", { pts: pts102, tag: "102", offset }],
    ]);
    const aligned = alignStackedWireLabels(byWire, info);
    const x100 = aligned.get("w100")![0].x;
    const a101 = [...(aligned.get("w101") ?? [])];
    const x102 = aligned.get("w102")![0].x;
    expect(Math.abs(x100 - x102)).toBeLessThan(GRID);
    expect(a101.some((a) => a.horizontal && Math.abs(a.x - x100) < GRID)).toBe(true);
  });

  it("keeps a single number on a short 3-phase span", () => {
    const mk = (x: number, y: number, t: number, tag: string, id: string) => ({
      wireId: id,
      tag,
      anchors: [
        { x, y, horizontal: true, segLen: GRID * 8, t },
        { x: x + GRID * 4, y, horizontal: true, segLen: GRID * 8, t: t + 0.3 },
        { x: x + GRID * 7, y, horizontal: true, segLen: GRID * 8, t: t + 0.6 },
      ],
    });
    const kept = pickVisibleWireLabels([
      mk(100, 0, 0.2, "100", "w100"),
      mk(100, GRID * 2, 0.2, "101", "w101"),
      mk(100, GRID * 4, 0.2, "102", "w102"),
    ]);
    expect(kept.get("w100")!.length).toBe(1);
    expect(kept.get("w101")!.length).toBe(1);
    expect(kept.get("w102")!.length).toBe(1);
  });

  it("does not pull a 100-column into a nearby 90-column", () => {
    const offset = 11;
    const mkPts = (y: number) => [
      { x: 0, y },
      { x: 500, y },
    ];
    const byWire = new Map([
      ["w90", [{ x: 120, y: offset, horizontal: true, segLen: 500, t: 0.24 }]],
      ["w91", [{ x: 120, y: GRID * 2 + offset, horizontal: true, segLen: 500, t: 0.24 }]],
      ["w92", [{ x: 120, y: GRID * 4 + offset, horizontal: true, segLen: 500, t: 0.24 }]],
      ["w100", [{ x: 200, y: offset, horizontal: true, segLen: 500, t: 0.4 }]],
      ["w101", [{ x: 200, y: GRID * 2 + offset, horizontal: true, segLen: 500, t: 0.4 }]],
      ["w102", [{ x: 200, y: GRID * 4 + offset, horizontal: true, segLen: 500, t: 0.4 }]],
    ]);
    const info = new Map([
      ["w90", { pts: mkPts(0), tag: "90", offset }],
      ["w91", { pts: mkPts(GRID * 2), tag: "91", offset }],
      ["w92", { pts: mkPts(GRID * 4), tag: "92", offset }],
      ["w100", { pts: mkPts(0), tag: "100", offset }],
      ["w101", { pts: mkPts(GRID * 2), tag: "101", offset }],
      ["w102", { pts: mkPts(GRID * 4), tag: "102", offset }],
    ]);
    const aligned = alignStackedWireLabels(byWire, info);
    const x90 = aligned.get("w90")![0].x;
    const x100 = aligned.get("w100")![0].x;
    expect(Math.abs(x90 - x100)).toBeGreaterThan(GRID * 2);
    expect(aligned.get("w90")!.length).toBe(1);
    expect(aligned.get("w100")!.length).toBe(1);
  });

  it("keeps one copy of a number in a stacked column", () => {
    const offset = 11;
    const pts = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ];
    const byWire = new Map([
      [
        "w90a",
        [
          { x: 120, y: offset, horizontal: true, segLen: 400, t: 0.3 },
          { x: 132, y: offset, horizontal: true, segLen: 400, t: 0.33 },
        ],
      ],
      ["w91", [{ x: 125, y: GRID * 2 + offset, horizontal: true, segLen: 400, t: 0.31 }]],
      ["w92", [{ x: 118, y: GRID * 4 + offset, horizontal: true, segLen: 400, t: 0.29 }]],
    ]);
    const info = new Map([
      ["w90a", { pts, tag: "90", offset }],
      ["w91", { pts: [{ x: 0, y: GRID * 2 }, { x: 400, y: GRID * 2 }], tag: "91", offset }],
      ["w92", { pts: [{ x: 0, y: GRID * 4 }, { x: 400, y: GRID * 4 }], tag: "92", offset }],
    ]);
    const aligned = dedupeWireLabels(alignStackedWireLabels(byWire, info), info);
    const tags90 = [...aligned.entries()].flatMap(([id, list]) =>
      info.get(id)?.tag === "90" ? list : [],
    );
    expect(tags90.length).toBe(1);
    expect(aligned.get("w91")!.length).toBe(1);
    expect(aligned.get("w92")!.length).toBe(1);
  });

  it("dedupes a leftover auto label sitting on a pinned copy", () => {
    const info = new Map([
      ["w2", { tag: "2" }],
    ]);
    const byWire = new Map([
      [
        "w2",
        [
          { x: 100, y: 40, horizontal: true, segLen: 200, t: 0.3 },
          { x: 108, y: 42, horizontal: true, segLen: 180, t: 0.55 },
        ],
      ],
    ]);
    const kept = dedupeWireLabels(byWire, info);
    expect(kept.get("w2")!.length).toBe(1);
  });

  it("does not stack duplicate numbers on the dual-station 3-phase spans", () => {
    const doc = JSON.parse(readFileSync("src/examples/10-dual-station.json", "utf8"));
    useLab.setState({ circuit: doc.circuit });
    useLab.getState().autoLabelWires();
    const circuit: Circuit = useLab.getState().circuit;
    const routes = allWireRoutes(circuit);
    const candidates = circuit.wires.flatMap((w) => {
      const tag = (w.label ?? "").trim();
      if (!tag) return [];
      const pts = routes.get(w.id);
      if (!pts || pts.length < 2) return [];
      const anchors = wireLabelAnchors(pts, wireLabelOffset(tag));
      if (!anchors.length) return [];
      return [{ wireId: w.id, tag, anchors }];
    });
    const wireInfo = new Map(
      circuit.wires.flatMap((w) => {
        const tag = (w.label ?? "").trim();
        const pts = routes.get(w.id);
        return tag && pts ? [[w.id, { pts, tag, offset: wireLabelOffset(tag) }] as const] : [];
      }),
    );
    const placed = dedupeWireLabels(
      alignStackedWireLabels(pickVisibleWireLabels(candidates), wireInfo),
      wireInfo,
    );
    const all = [...placed.entries()].flatMap(([id, list]) =>
      list.map((a) => ({ tag: wireInfo.get(id)!.tag, a })),
    );
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[i].tag !== all[j].tag) continue;
        const dx = Math.abs(all[i].a.x - all[j].a.x);
        const dy = Math.abs(all[i].a.y - all[j].a.y);
        const d = Math.hypot(dx, dy);
        expect(d).toBeGreaterThanOrEqual(WIRE_LABEL_SEPARATION);
        expect(dx < GRID * 2 && dy < GRID * 12).toBe(false);
        if (dx < GRID * 2 || dy < GRID * 2) {
          expect(d).toBeGreaterThanOrEqual(WIRE_LABEL_REPEAT);
        }
      }
    }
    const x90 = all.filter((it) => it.tag === "90").map((it) => it.a.x);
    const x100 = all.filter((it) => it.tag === "100").map((it) => it.a.x);
    expect(x90.length).toBe(1);
    expect(x100.length).toBe(1);
    expect(Math.abs(x90[0] - x100[0])).toBeGreaterThan(GRID * 2);
  });

  it("keeps the same number on both sides of a net-terminal", () => {
    const c = emptyCircuit();
    const left = addDevice(c, "lamp", "LT1", "body", 0, 4);
    const strip = addDevice(c, "net-terminal", "L1", "body", 8, 4, { pinCount: 3 });
    const right = addDevice(c, "lamp", "LT2", "body", 16, 4);
    addWire(c, left.symbol, "2", strip.symbol, "1");
    addWire(c, strip.symbol, "2", right.symbol, "1");
    c.wires[0].label = "4";
    c.wires[1].label = "4";
    const routes = allWireRoutes(c);
    const candidates = c.wires.flatMap((w) => {
      const tag = (w.label ?? "").trim();
      const pts = routes.get(w.id);
      if (!tag || !pts) return [];
      const anchors = wireLabelAnchors(pts, wireLabelOffset(tag));
      return anchors.length ? [{ wireId: w.id, tag, anchors }] : [];
    });
    const wireInfo = new Map(
      c.wires.flatMap((w) => {
        const tag = (w.label ?? "").trim();
        const pts = routes.get(w.id);
        return tag && pts ? [[w.id, { pts, tag, offset: wireLabelOffset(tag) }] as const] : [];
      }),
    );
    const dropped = dedupeWireLabels(alignStackedWireLabels(pickVisibleWireLabels(candidates), wireInfo), wireInfo);
    const keptWires = [...dropped.keys()].filter((id) => (dropped.get(id) ?? []).length > 0);
    expect(keptWires.length).toBe(1);

    const placed = ensureNetTerminalSideLabels(c, dropped, wireInfo);
    expect((placed.get(c.wires[0].id) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((placed.get(c.wires[1].id) ?? []).length).toBeGreaterThanOrEqual(1);
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
    expect(pos!.y).toBeGreaterThan(40);  // Label is below the wire
  });

  it("draws an ordinary control-rail tap as one horizontal line", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 2, 0, { railY0: 0, railY1: 20 });
    const pb = addDevice(c, "pb-no", "CR1", "body", 8, 4);
    addWire(c, pb.symbol, "2", hot.symbol, "y16");
    alignRailWireEnds(c);
    const pts = wireRoute(c, c.wires[0].a, c.wires[0].b);
    const row = terminalWorld(c, { symbolId: pb.symbol.id, term: "2" })!;
    expect(pts).toEqual([row, { x: 2 * GRID, y: row.y }]);
  });

  it("keeps a wire pinned to a control-rail end square straight", () => {
    const c = emptyCircuit();
    const hot = addDevice(c, "rail-l", "L", "body", 2, 0, { railY0: 0, railY1: 20 });
    const pb = addDevice(c, "pb-no", "CR1", "body", 8, 4);
    const w = addWire(c, pb.symbol, "2", hot.symbol, "y0");
    w.b.railPin = "y0";
    alignRailWireEnds(c);
    const pts = wireRoute(c, w.a, w.b);
    expect(pts).toHaveLength(2);
    expect(pts[0].y).toBe(pts[1].y);
    expect(pts[1].x).toBe(2 * GRID);
  });

  it("routes in the middle channel between horizontal terminals avoiding terminal overlap", () => {
    const c = emptyCircuit();
    const km1 = addDevice(c, "contactor", "M1", "coil", 4, 4); // A2 at right (out.x = 1)
    const km2 = addDevice(c, "contactor", "M2", "coil", 16, 8); // A1 at left (out.x = -1)
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
    const km1 = addDevice(c, "contactor", "M1", "coil", 4, 4); // A2 at right (out.x = 1)
    const km2 = addDevice(c, "contactor", "M2", "coil", 4, 8); // A2 at right (out.x = 1)
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
      const tc1 = addDevice(c, "transformer", "T1", "body", 4, 4);
      const tc2 = addDevice(c, "transformer", "T2", "body", 16, 4 + dy);
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
      const tc1 = addDevice(c, "transformer", "T1", "body", 4, 4);
      const tc2 = addDevice(c, "transformer", "T2", "body", 16, 4 + dy);
      addWire(c, tc1.symbol, "X1", tc2.symbol, "H4");
      addWire(c, tc1.symbol, "X2", tc2.symbol, "H1");
      const routes = allWireRoutes(c);
      const crossovers = findWireCrossovers(c, routes);
      expect(crossovers.length).toBeLessThanOrEqual(1);
    }
  });

  it("straightens a jogged wire by resetting its jog offset", () => {
    const c = emptyCircuit();
    const km = addDevice(c, "contactor", "M1", "coil", 4, 4);
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 10);
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
    const lamp1 = addDevice(c, "lamp", "LT1", "body", 4, 4);
    const lamp2 = addDevice(c, "lamp", "LT2", "body", 16, 4);
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
    const lamp = addDevice(c, "lamp", "LT1", "body", 4, 4);
    const world = terminalWorld(c, { symbolId: lamp.symbol.id, term: "1" })!;

    const port = findPortAtPoint(c, world.x + 2, world.y + 2, 10);
    expect(port).toEqual({ symbolId: lamp.symbol.id, term: "1" });

    const none = findPortAtPoint(c, world.x + 50, world.y + 50, 10);
    expect(none).toBeNull();
  });

  it("finds overlapping terminals after a symbol is moved onto another port", () => {
    const c = emptyCircuit();
    const a = addDevice(c, "pb-no", "PB1", "body", 0, 0);
    const b = addDevice(c, "pb-no", "PB2", "body", 10, 0);
    const a2 = terminalWorld(c, { symbolId: a.symbol.id, term: "2" })!;
    const b1 = terminalWorld(c, { symbolId: b.symbol.id, term: "1" })!;
    a.symbol.x += (b1.x - a2.x) / GRID;
    a.symbol.y += (b1.y - a2.y) / GRID;
    const pairs = findOverlappingTerminalPairs(c, [a.symbol.id]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toEqual({ symbolId: a.symbol.id, term: "2" });
    expect(pairs[0].b).toEqual({ symbolId: b.symbol.id, term: "1" });
  });

  it("does not pair terminals of the same symbol", () => {
    const c = emptyCircuit();
    const lamp = addDevice(c, "lamp", "LT1", "body", 0, 0);
    const pairs = findOverlappingTerminalPairs(c, [lamp.symbol.id]);
    expect(pairs).toEqual([]);
  });

  it("prefers an already-wired isolator alias when overlapping that screw", () => {
    const c = emptyCircuit();
    const g = addDevice(c, "mains-3ph", "PWR1", "body", 0, 0);
    const disc = addDevice(c, "isolator", "DISC1", "body", 8, 0);
    const tag = addDevice(c, "net-label", "L1", "body", 20, 0);
    addWire(c, g.symbol, "L1", disc.symbol, "1");
    const disc1 = terminalWorld(c, { symbolId: disc.symbol.id, term: "1" })!;
    const tag1 = terminalWorld(c, { symbolId: tag.symbol.id, term: "1" })!;
    tag.symbol.x += (disc1.x - tag1.x) / GRID;
    tag.symbol.y += (disc1.y - tag1.y) / GRID;
    const pairs = findOverlappingTerminalPairs(c, [tag.symbol.id]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toEqual({ symbolId: tag.symbol.id, term: "1" });
    expect(pairs[0].b).toEqual({ symbolId: disc.symbol.id, term: "1" });
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
    const l1 = addDevice(c, "lamp", "LT1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "LT2", "body", 14, 4);
    const l3 = addDevice(c, "lamp", "LT3", "body", 14, 14);

    const w1 = addWire(c, l1.symbol, "1", l2.symbol, "1");
    const w2 = addWire(c, l2.symbol, "1", l3.symbol, "1");

    // w1 and w2 share the same port l2.1
    expect(areWiresConnected(c, w1.id, w2.id)).toBe(true);

    // Add unconnected device & wire
    const l4 = addDevice(c, "lamp", "LT4", "body", 24, 24);
    const l5 = addDevice(c, "lamp", "LT5", "body", 34, 24);
    const w3 = addWire(c, l4.symbol, "1", l5.symbol, "1");
    expect(areWiresConnected(c, w1.id, w3.id)).toBe(false);
  });

  it("calculates optimal junction position when merging T-connected or intersecting wires", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "LT1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "LT2", "body", 16, 4);
    const l3 = addDevice(c, "lamp", "LT3", "body", 10, 14);

    const w1 = addWire(c, l1.symbol, "1", l2.symbol, "1");
    const w2 = addWire(c, l3.symbol, "1", l1.symbol, "1");

    const optPos = findOptimalJunctionForWires(c, w1.id, w2.id);
    expect(optPos).not.toBeNull();
    expect(optPos?.y).toBe(4);
  });

  it("merges two connected wires and creates junction with clean connections", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "LT1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "LT2", "body", 16, 4);
    const l3 = addDevice(c, "lamp", "LT3", "body", 10, 14);

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
    const l1 = addDevice(c, "lamp", "LT1", "body", 4, 4);
    const l2 = addDevice(c, "lamp", "LT2", "body", 16, 4);
    const w = addWire(c, l1.symbol, "1", l2.symbol, "1");

    const inBox = wiresInRect(c, { x: 6, y: 2, w: 6, h: 4 });
    expect(inBox).toContain(w.id);

    const outBox = wiresInRect(c, { x: 20, y: 20, w: 4, h: 4 });
    expect(outBox).not.toContain(w.id);
  });

  it("finds all connected/contiguous wires across junctions, shared ports, and net labels", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "LT1", "body", 4, 4);
    const j1 = addJunction(c, 10, 4);
    const j2 = addJunction(c, 16, 4);
    const l2 = addDevice(c, "lamp", "LT2", "body", 22, 4);
    const l3 = addDevice(c, "lamp", "LT3", "body", 10, 12);

    // Segment 1: l1 -> j1
    const w1 = addWire(c, l1.symbol, "1", j1.symbol, "1");
    // Segment 2: j1 -> j2
    const w2 = addWire(c, j1.symbol, "1", j2.symbol, "1");
    // Segment 3: j2 -> l2
    const w3 = addWire(c, j2.symbol, "1", l2.symbol, "1");
    // Branch: j1 -> l3
    const w4 = addWire(c, j1.symbol, "1", l3.symbol, "1");

    // Independent wire elsewhere
    const l4 = addDevice(c, "lamp", "LT4", "body", 30, 30);
    const l5 = addDevice(c, "lamp", "LT5", "body", 40, 30);
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

  it("connects wires across same-named net terminals including mixed flags", () => {
    const c = emptyCircuit();
    const l1 = addDevice(c, "lamp", "LT1", "body", 0, 0);
    const l2 = addDevice(c, "lamp", "LT2", "body", 20, 0);
    const stripA = addDevice(c, "net-terminal", "BUS", "body", 6, 0, { pinCount: 4 });
    const stripB = addDevice(c, "net-terminal", "BUS", "body", 14, 0, { pinCount: 4 });
    const wA = addWire(c, l1.symbol, "1", stripA.symbol, "3");
    const wB = addWire(c, stripB.symbol, "1", l2.symbol, "1");
    const conn = getConnectedWireIds(c, wA.id);
    expect(conn.has(wB.id)).toBe(true);

    const flag = addDevice(c, "net-label", "HOT", "body", 0, 10);
    const strip = addDevice(c, "net-terminal", "HOT", "body", 10, 10, { pinCount: 4 });
    const l3 = addDevice(c, "lamp", "LT3", "body", 0, 16);
    const l4 = addDevice(c, "lamp", "LT4", "body", 16, 16);
    const wFlag = addWire(c, l3.symbol, "1", flag.symbol, "1");
    const wStrip = addWire(c, strip.symbol, "2", l4.symbol, "1");
    expect(getConnectedWireIds(c, wFlag.id).has(wStrip.id)).toBe(true);

    const emptyA = addDevice(c, "net-terminal", "", "body", 0, 24, { pinCount: 4 });
    const emptyB = addDevice(c, "net-terminal", "", "body", 10, 24, { pinCount: 4 });
    const l5 = addDevice(c, "lamp", "LT5", "body", 0, 30);
    const l6 = addDevice(c, "lamp", "LT6", "body", 10, 30);
    const wEmpty1 = addWire(c, l5.symbol, "1", emptyA.symbol, "1");
    const wEmpty2 = addWire(c, emptyA.symbol, "2", l5.symbol, "2");
    const wOther = addWire(c, l6.symbol, "1", emptyB.symbol, "1");
    expect(getConnectedWireIds(c, wEmpty1.id).has(wEmpty2.id)).toBe(true);
    expect(getConnectedWireIds(c, wEmpty1.id).has(wOther.id)).toBe(false);

    const p8 = addDevice(c, "net-terminal", "X", "body", 30, 0, { pinCount: 8 });
    const worldL = terminalWorld(c, { symbolId: p8.symbol.id, term: "15" });
    const worldR = terminalWorld(c, { symbolId: p8.symbol.id, term: "16" });
    expect(worldL).not.toBeNull();
    expect(worldR).not.toBeNull();
    expect(worldR!.x).toBeGreaterThan(worldL!.x);
  });

  it("routes around the component when connecting different terminals of the same symbol (self-loopback)", () => {
    const c = emptyCircuit();
    const btn = addDevice(c, "pb-no", "PB_START", "body", 4, 4);
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
    const tc = addDevice(c, "transformer", "T1", "body", 2, 10);
    const fr = addDevice(c, "overload", "OL1", "aux-nc", 12, 2);
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
    const tc = addDevice(c, "transformer", "T1", "body", 2, 10);
    const fr = addDevice(c, "overload", "OL1", "aux-nc", 12, 2);
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
    const fr = addDevice(c, "overload", "OL1", "aux-nc", 22, 4);
    const sb = addDevice(c, "pb-nc", "PB1", "body", 16, 17);
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
    const sb = addDevice(c, "pb-nc", "PB1", "body", 4, 2); // term 1 exits LEFT
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
      const left = addDevice(c, "lamp", "LT1", "body", 4, 4);
      const mid = addJunction(c, 10, 5);
      const right = addDevice(c, "lamp", "LT2", "body", 16, 4);

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
      const right = addDevice(c, "pb-no", "PB1", "body", 12, 10); // term 1 exits LEFT at (12, 10)*GRID

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
      const left = addDevice(c, "lamp", "LT1", "body", 2, 4);
      const mid = addJunction(c, 8, 5);
      const right = addDevice(c, "lamp", "LT2", "body", 14, 4);
      const tap = addDevice(c, "lamp", "LT3", "body", 8, 12);

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

  describe("wire label collision with junctions", () => {
    it("avoids placing wire labels on top of junctions", () => {
      const c = emptyCircuit();
      
      // Create a horizontal wire
      const left = addDevice(c, "lamp", "LT1", "body", 2, 4);
      const right = addDevice(c, "lamp", "LT2", "body", 14, 4);
      addWire(c, left.symbol, "2", right.symbol, "1");
      
      // Add a junction very close to the wire's midpoint
      const junc = addJunction(c, 8, 5); // Very close to horizontal wire at y=4
      
      const w = c.wires[0];
      const pts = wireRoute(c, w.a, w.b);
      
      // Label position without circuit (no collision check)
      const tagPosNoCheck = wireLabelPos(pts);
      expect(tagPosNoCheck).not.toBeNull();
      
      // Label position with circuit (with collision check)
      const tagPosWithCheck = wireLabelPos(pts, 6, c);
      expect(tagPosWithCheck).not.toBeNull();
      
      // Check if label would have collided with junction
      if (tagPosNoCheck && tagPosWithCheck) {
        // The label should be moved to avoid the junction
        const distToJunction = Math.hypot(
          tagPosWithCheck.x - junc.symbol.x * GRID,
          tagPosWithCheck.y - junc.symbol.y * GRID
        );
        expect(distToJunction).toBeGreaterThan(5); // Should be at least 5 units away
      }
    });


  });
});

describe("circuitRouteKey", () => {
  it("changes when pinCount or scale change, not when tag or wire label change", () => {
    const c = emptyCircuit();
    const strip = addDevice(c, "net-terminal", "L1", "body", 0, 0, { pinCount: 4 });
    const lamp = addDevice(c, "lamp", "LT1", "body", 10, 0);
    addWire(c, strip.symbol, "1", lamp.symbol, "1");
    const base = circuitRouteKey(c);

    c.devices[0].tag = "L2";
    c.wires[0].label = "17";
    expect(circuitRouteKey(c)).toBe(base);

    c.devices[0].params.pinCount = 8;
    expect(circuitRouteKey(c)).not.toBe(base);

    c.devices[0].params.pinCount = 4;
    expect(circuitRouteKey(c)).toBe(base);

    const xf = emptyCircuit();
    addDevice(xf, "transformer", "T1", "body", 4, 4);
    const s1 = circuitRouteKey(xf);
    xf.devices[0].params.scale = 1.5;
    expect(circuitRouteKey(xf)).not.toBe(s1);
  });
});
