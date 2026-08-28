import { GRID, type DeviceKind } from "./types";

export interface TagPlacement {
  tagX: number;
  tagY: number;
  textAnchor: "start" | "middle";
}

/**
 * Computes world-coordinate placement for symbol device tags.
 */
export function getSymbolTagPlacement(
  kind: DeviceKind,
  sym: { x: number; y: number },
  v: { w: number; h: number },
): TagPlacement {
  // Breaker 1P and Fuse - placed on the right side
  if (kind === "breaker-1p") {
    return {
      tagX: (sym.x + v.w - 1) * GRID,
      tagY: (sym.y + v.h - 5) * GRID,
      textAnchor: "start",
    };
  }
  if (kind === "fuse") {
    return {
      tagX: (sym.x + v.w - 1) * GRID,
      tagY: (sym.y + v.h - 3.5) * GRID,
      textAnchor: "start",
    };
  }

  // Push buttons and E-Stops with specific internal offsets
  if (kind === "pb-no" || kind === "estop-no") {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: (sym.y + v.h - 3.5) * GRID,
      textAnchor: "middle",
    };
  }
  if (kind === "pb-nc") {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: (sym.y + v.h - 2.9) * GRID,
      textAnchor: "middle",
    };
  }
  if (kind === "estop-nc") {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: (sym.y + v.h - 3.2) * GRID,
      textAnchor: "middle",
    };
  }

  // Selectors
  if (kind === "selector-2") {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: (sym.y + v.h - 5.7) * GRID,
      textAnchor: "middle",
    };
  }
  if (kind === "selector-3") {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: (sym.y + v.h - 6.5) * GRID,
      textAnchor: "middle",
    };
  }

  // Top-placed devices
  if (
    kind === "transformer" ||
    kind === "breaker-3p" ||
    kind === "isolator" ||
    kind === "rcd" ||
    kind === "overload"
  ) {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: sym.y * GRID - 0.5 * GRID,
      textAnchor: "middle",
    };
  }

  if (kind === "alarm") {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: (sym.y + v.h - 3.7) * GRID,
      textAnchor: "middle",
    };
  }

  // Bottom-placed devices (default for most actuators, coils, indicators, motors)
  const bottomPlacedKinds: readonly DeviceKind[] = [
    "estop",
    "toggle",
    "toggle-spst",
    "toggle-spdt",
    "toggle-dpst",
    "toggle-dpdt",
    "toggle-4pdt",
    "foot",
    "foot-no",
    "foot-nc",
    "limit-no",
    "limit-nc",
    "float",
    "temp-no",
    "temp-nc",
    "pressure-no",
    "pressure-nc",
    "flow-no",
    "flow-nc",
    "prox",
    "photo",
    "contactor",
    "relay",
    "timer-on",
    "timer-off",
    "counter",
    "lamp",
    "fan",
    "heater",
    "solenoid",
    "motor-3ph",
    "motor-1ph",
    "motor-dc",
    "gen-ac",
    "gen-dc",
    "starter-dol",
    "starter-fwd",
    "starter-rev",
    "starter-rev-combo",
    "voltmeter",
    "ammeter",
    "dc-supply",
    "horn",
    "ground",
  ];

  if (bottomPlacedKinds.includes(kind)) {
    return {
      tagX: (sym.x + v.w / 2) * GRID,
      tagY: (sym.y + v.h + 0.5) * GRID,
      textAnchor: "middle",
    };
  }

  // Fallback: top placement
  return {
    tagX: (sym.x + v.w / 2) * GRID,
    tagY: sym.y * GRID - 0.5 * GRID,
    textAnchor: "middle",
  };
}
