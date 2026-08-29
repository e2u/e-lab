import type { Circuit, Device, DeviceKind, DeviceParams, SymbolInst } from "../types";
import { uid } from "../ids";

/**
 * Helper to find available schematic coordinates for new control circuit components.
 */
function findNextControlColumn(circuit: Circuit): { x: number; y: number } {
  // Look for existing control components (contacts, push buttons, coils, relays, lamps)
  const controlKinds = new Set<DeviceKind>([
    "contactor", "relay", "timer-on", "timer-off", "lamp",
    "pb-no", "pb-nc", "estop", "toggle", "limit-no", "limit-nc",
    "temp-no", "temp-nc", "pressure-no", "pressure-nc", "float",
    "solenoid", "heater", "alarm", "horn", "fan"
  ]);

  let maxX = 22;
  let startY = 16;

  for (const s of circuit.symbols) {
    const dev = circuit.devices.find((d) => d.id === s.deviceId);
    if (dev && controlKinds.has(dev.kind)) {
      if (s.x > maxX) maxX = s.x;
    }
  }

  return { x: maxX + 6, y: startY };
}

/**
 * Find the primary control source and return terminals (e.g. Transformer X1 & X2, or Mains L1 & N)
 */
export function findControlSupplyTerminals(circuit: Circuit): {
  source: { symbolId: string; term: string } | null;
  returnTerm: { symbolId: string; term: string } | null;
} {
  // 1. Check transformer first (preferred for industrial control)
  const xformDev = circuit.devices.find((d) => d.kind === "transformer");
  if (xformDev) {
    const xformSym = circuit.symbols.find((s) => s.deviceId === xformDev.id);
    if (xformSym) {
      return {
        source: { symbolId: xformSym.id, term: "X1" },
        returnTerm: { symbolId: xformSym.id, term: "X2" },
      };
    }
  }

  // 2. Check DC supply
  const dcDev = circuit.devices.find((d) => d.kind === "dc-supply");
  if (dcDev) {
    const dcSym = circuit.symbols.find((s) => s.deviceId === dcDev.id);
    if (dcSym) {
      return {
        source: { symbolId: dcSym.id, term: "PLUS" },
        returnTerm: { symbolId: dcSym.id, term: "MINUS" },
      };
    }
  }

  // 3. Check Mains (L1 & N, or L1 & L2)
  const mainsDev = circuit.devices.find((d) => d.kind === "mains-3ph");
  if (mainsDev) {
    const mainsSym = circuit.symbols.find((s) => s.deviceId === mainsDev.id);
    if (mainsSym) {
      return {
        source: { symbolId: mainsSym.id, term: "L1" },
        returnTerm: { symbolId: mainsSym.id, term: mainsDev.params.supplyType === "delta" ? "L2" : "N" },
      };
    }
  }

  return { source: null, returnTerm: null };
}

export interface NewContactOptions {
  existingDeviceId?: string;
  kind?: DeviceKind;
  variant?: string;
  tag?: string;
  contactType?: string;
}

// ✅ TERMINAL_MAP 已移除 - 使用硬編碼值代替

export interface NewCoilOptions {
  existingDeviceId?: string;
  kind?: DeviceKind;
  tag?: string;
  color?: string;
  delay?: number;
}

// ✅ 保留 TERMINAL_MAP 以備未來使用（目前未調用 getTerminalForRole）

/**
 * Add a new Rung to the circuit with optional initial contact and output coil.
 */
export function synthesizeAddRung(
  circuit: Circuit,
  options?: {
    contact?: NewContactOptions;
    coil?: NewCoilOptions;
    title?: string;
  }
): { circuit: Circuit; newSymbolIds: string[] } {
  const next: Circuit = {
    devices: [...circuit.devices],
    symbols: [...circuit.symbols],
    wires: [...circuit.wires],
    groups: circuit.groups ? [...circuit.groups] : [],
    ladderRungOrder: circuit.ladderRungOrder ? [...circuit.ladderRungOrder] : undefined,
  };

  const newSymbolIds: string[] = [];
  const col = findNextControlColumn(next);
  const supply = findControlSupplyTerminals(next);

  // 1. Create or bind Input Contact (Default: Start Pushbutton PB-NO if none specified)
  let contactSym: SymbolInst | null = null;
  const contactOpt = options?.contact;

  if (contactOpt?.existingDeviceId) {
    // Add auxiliary contact for existing device (e.g. KM1 aux-no)
    const dev = next.devices.find((d) => d.id === contactOpt.existingDeviceId);
    if (dev) {
      const symId = uid("s");
      const variant = contactOpt.variant || (dev.kind === "contactor" ? "aux-no" : "no");
      const sym: SymbolInst = {
        id: symId,
        deviceId: dev.id,
        variant,
        x: col.x,
        y: col.y,
        rot: 0,
      };
      next.symbols.push(sym);
      newSymbolIds.push(symId);
      contactSym = sym;
    }
  } else {
    // Create new contact device (e.g. pb-no)
    const kind = contactOpt?.kind || "pb-no";
    const tag = contactOpt?.tag || (kind === "pb-no" ? `SB${next.devices.filter(d => d.kind === "pb-no").length + 1}` : `S${next.devices.length + 1}`);
    const devId = uid("d");
    const symId = uid("s");

    const dev: Device = {
      id: devId,
      kind,
      tag,
      params: {},
    };
    const sym: SymbolInst = {
      id: symId,
      deviceId: devId,
      variant: contactOpt?.variant || "body",
      x: col.x,
      y: col.y,
      rot: 0,
    };
    next.devices.push(dev);
    next.symbols.push(sym);
    newSymbolIds.push(symId);
    contactSym = sym;
  }

  // 2. Create or bind Output Coil / Load (Default: Pilot Lamp or Contactor Coil)
  let coilSym: SymbolInst | null = null;
  const coilOpt = options?.coil;

  if (coilOpt?.existingDeviceId) {
    const dev = next.devices.find((d) => d.id === coilOpt.existingDeviceId);
    if (dev) {
      const symId = uid("s");
      const sym: SymbolInst = {
        id: symId,
        deviceId: dev.id,
        variant: "coil",
        x: col.x,
        y: col.y + 6,
        rot: 0,
      };
      next.symbols.push(sym);
      newSymbolIds.push(symId);
      coilSym = sym;
    }
  } else {
    const kind = coilOpt?.kind || "lamp";
    const tag = coilOpt?.tag || (kind === "lamp" ? `HL${next.devices.filter(d => d.kind === "lamp").length + 1}` : kind === "relay" ? `KA${next.devices.filter(d => d.kind === "relay").length + 1}` : `KM${next.devices.filter(d => d.kind === "contactor").length + 1}`);
    const devId = uid("d");
    const symId = uid("s");

    const params: DeviceParams = {};
    if (coilOpt?.color) params.color = coilOpt.color;
    if (coilOpt?.delay) params.delayMs = coilOpt.delay * 1000;

    const dev: Device = {
      id: devId,
      kind,
      tag,
      params,
    };
    const sym: SymbolInst = {
      id: symId,
      deviceId: devId,
      variant: kind === "contactor" || kind === "relay" || kind === "timer-on" || kind === "timer-off" ? "coil" : "body",
      x: col.x,
      y: col.y + 6,
      rot: 0,
    };
    next.devices.push(dev);
    next.symbols.push(sym);
    newSymbolIds.push(symId);
    coilSym = sym;
  }

  // 3. Connect Control Wires: Source -> Contact (IN->OUT) -> Coil (A1->A2) -> Return
  if (contactSym && coilSym) {
    const devKind = coilOpt?.kind || "lamp";
    
    // 獲取終端名稱（支援多種命名慣例）
    const getCoilTerm = (variant?: string): string => {
      if (variant === "coil") return "A1";  // Contactor/Relay coil
      // Light/Horn/Solenoid etc.
      switch (devKind) {
        case "lamp": return "X1";
        case "horn":
        case "alarm": return "+";
        case "heater": return "1";
        default: return "1";
      }
    };

    const getReturnTerm = (variant?: string): string => {
      if (variant === "coil") return "A2";
      switch (devKind) {
        case "lamp": return "X2";
        case "horn":
        case "alarm": return "-";
        case "heater": return "2";
        default: return "2";
      }
    };
    
    const getContactInTerm = (variant?: string): string => {
      if (variant === "aux-no" || variant === "aux-nc") return "13";
      if (variant === "aux-no2" || variant === "aux-nc2") return "43";
      return "1";
    };

    const getContactOutTerm = (variant?: string): string => {
      if (variant === "aux-no" || variant === "aux-nc") return "14";
      if (variant === "aux-no2" || variant === "aux-nc2") return "44";
      return "2";
    };

    // Wire: Contact Out -> Coil In
    next.wires.push({
      id: uid("w"),
      a: { symbolId: contactSym.id, term: getContactOutTerm(contactSym.variant) },
      b: { symbolId: coilSym.id, term: getCoilTerm(coilSym.variant) },
    });

    if (supply.source) {
      // Wire: Source -> Contact In
      next.wires.push({
        id: uid("w"),
        a: { symbolId: supply.source.symbolId, term: supply.source.term },
        b: { symbolId: contactSym.id, term: getContactInTerm(contactSym.variant) },
      });
    }

    if (supply.returnTerm) {
      // Wire: Coil Out -> Return
      next.wires.push({
        id: uid("w"),
        a: { symbolId: coilSym.id, term: getReturnTerm(coilSym.variant) },
        b: { symbolId: supply.returnTerm.symbolId, term: supply.returnTerm.term },
      });
    }
  }

  return { circuit: next, newSymbolIds };
}

/**
 * Insert a contact in series into an existing Rung item.
 */
export function synthesizeInsertContact(
  circuit: Circuit,
  targetSymbolId: string,
  options: NewContactOptions
): { circuit: Circuit; newSymbolId: string | null } {
  const next: Circuit = {
    devices: [...circuit.devices],
    symbols: [...circuit.symbols],
    wires: [...circuit.wires],
    groups: circuit.groups ? [...circuit.groups] : [],
    ladderRungOrder: circuit.ladderRungOrder ? [...circuit.ladderRungOrder] : undefined,
  };

  const targetSym = next.symbols.find((s) => s.id === targetSymbolId);
  if (!targetSym) return { circuit, newSymbolId: null };

  let newSym: SymbolInst | null = null;
  const symId = uid("s");

  if (options.existingDeviceId) {
    const dev = next.devices.find((d) => d.id === options.existingDeviceId);
    if (dev) {
      const variant = options.variant || (dev.kind === "contactor" ? "aux-no" : "no");
      newSym = {
        id: symId,
        deviceId: dev.id,
        variant,
        x: targetSym.x,
        y: targetSym.y + 4,
        rot: targetSym.rot || 0,
      };
      next.symbols.push(newSym);
    }
  } else {
    const kind = options.kind || "pb-no";
    const tag = options.tag || (kind === "pb-no" ? `SB${next.devices.filter(d => d.kind === "pb-no").length + 1}` : `S${next.devices.length + 1}`);
    const devId = uid("d");

    const dev: Device = {
      id: devId,
      kind,
      tag,
      params: {},
    };
    newSym = {
      id: symId,
      deviceId: devId,
      variant: options.variant || "body",
      x: targetSym.x,
      y: targetSym.y + 4,
      rot: targetSym.rot || 0,
    };
    next.devices.push(dev);
    next.symbols.push(newSym);
  }

  if (!newSym) return { circuit, newSymbolId: null };

  // Connect in series: find outgoing wires from targetSym and redirect one through newSym
  const termOut = targetSym.variant === "aux-no" || targetSym.variant === "aux-nc" ? "14" : "2";
  const newTermIn = newSym.variant === "aux-no" || newSym.variant === "aux-nc" ? "13" : "1";
  const newTermOut = newSym.variant === "aux-no" || newSym.variant === "aux-nc" ? "14" : "2";

  const outgoingWire = next.wires.find(
    (w) =>
      (w.a.symbolId === targetSym.id && w.a.term === termOut) ||
      (w.b.symbolId === targetSym.id && w.b.term === termOut)
  );

  if (outgoingWire) {
    if (outgoingWire.a.symbolId === targetSym.id && outgoingWire.a.term === termOut) {
      outgoingWire.a = { symbolId: newSym.id, term: newTermOut };
    } else {
      outgoingWire.b = { symbolId: newSym.id, term: newTermOut };
    }
    // Bridge targetSym Out to newSym In
    next.wires.push({
      id: uid("w"),
      a: { symbolId: targetSym.id, term: termOut },
      b: { symbolId: newSym.id, term: newTermIn },
    });
  } else {
    // If no outgoing wire, just connect targetSym Out to newSym In
    next.wires.push({
      id: uid("w"),
      a: { symbolId: targetSym.id, term: termOut },
      b: { symbolId: newSym.id, term: newTermIn },
    });
  }

  return { circuit: next, newSymbolId: newSym.id };
}

/**
 * Add a parallel branch (Seal-in contact) across an existing contact.
 */
export function synthesizeAddParallelBranch(
  circuit: Circuit,
  targetSymbolId: string,
  options: NewContactOptions
): { circuit: Circuit; newSymbolId: string | null } {
  const next: Circuit = {
    devices: [...circuit.devices],
    symbols: [...circuit.symbols],
    wires: [...circuit.wires],
    groups: circuit.groups ? [...circuit.groups] : [],
    ladderRungOrder: circuit.ladderRungOrder ? [...circuit.ladderRungOrder] : undefined,
  };

  const targetSym = next.symbols.find((s) => s.id === targetSymbolId);
  if (!targetSym) return { circuit, newSymbolId: null };

  let newSym: SymbolInst | null = null;
  const symId = uid("s");

  if (options.existingDeviceId) {
    const dev = next.devices.find((d) => d.id === options.existingDeviceId);
    if (dev) {
      const variant = options.variant || "aux-no";
      newSym = {
        id: symId,
        deviceId: dev.id,
        variant,
        x: targetSym.x + 3.5,
        y: targetSym.y,
        rot: targetSym.rot || 0,
      };
      next.symbols.push(newSym);
    }
  } else {
    const kind = options.kind || "pb-no";
    const tag = options.tag || `SB${next.devices.filter(d => d.kind === "pb-no").length + 1}`;
    const devId = uid("d");

    const dev: Device = {
      id: devId,
      kind,
      tag,
      params: {},
    };
    newSym = {
      id: symId,
      deviceId: devId,
      variant: options.variant || "body",
      x: targetSym.x + 3.5,
      y: targetSym.y,
      rot: targetSym.rot || 0,
    };
    next.devices.push(dev);
    next.symbols.push(newSym);
  }

  if (!newSym) return { circuit, newSymbolId: null };

  // Connect parallel terminals:
  // targetIn <-> newIn, targetOut <-> newOut
  const targetTermIn = targetSym.variant === "aux-no" || targetSym.variant === "aux-nc" ? "13" : "1";
  const targetTermOut = targetSym.variant === "aux-no" || targetSym.variant === "aux-nc" ? "14" : "2";

  const newTermIn = newSym.variant === "aux-no" || newSym.variant === "aux-nc" ? "13" : "1";
  const newTermOut = newSym.variant === "aux-no" || newSym.variant === "aux-nc" ? "14" : "2";

  next.wires.push({
    id: uid("w"),
    a: { symbolId: targetSym.id, term: targetTermIn },
    b: { symbolId: newSym.id, term: newTermIn },
  });

  next.wires.push({
    id: uid("w"),
    a: { symbolId: targetSym.id, term: targetTermOut },
    b: { symbolId: newSym.id, term: newTermOut },
  });

  return { circuit: next, newSymbolId: newSym.id };
}

/**
 * Toggle contact variant between NO and NC (e.g. aux-no <-> aux-nc, pb-no <-> pb-nc, temp-no <-> temp-nc).
 */
export function synthesizeToggleContactVariant(
  circuit: Circuit,
  symbolId: string
): Circuit {
  const next: Circuit = {
    devices: [...circuit.devices],
    symbols: [...circuit.symbols],
    wires: [...circuit.wires],
    groups: circuit.groups ? [...circuit.groups] : [],
    ladderRungOrder: circuit.ladderRungOrder ? [...circuit.ladderRungOrder] : undefined,
  };

  const sym = next.symbols.find((s) => s.id === symbolId);
  if (!sym) return circuit;

  const dev = next.devices.find((d) => d.id === sym.deviceId);
  if (!dev) return circuit;

  // Toggle variant or device kind
  if (sym.variant === "aux-no") {
    sym.variant = "aux-nc";
  } else if (sym.variant === "aux-nc") {
    sym.variant = "aux-no";
  } else if (sym.variant === "no") {
    sym.variant = "nc";
  } else if (sym.variant === "nc") {
    sym.variant = "no";
  } else if (dev.kind === "pb-no") {
    dev.kind = "pb-nc";
  } else if (dev.kind === "pb-nc") {
    dev.kind = "pb-no";
  } else if (dev.kind === "limit-no") {
    dev.kind = "limit-nc";
  } else if (dev.kind === "limit-nc") {
    dev.kind = "limit-no";
  } else if (dev.kind === "temp-no") {
    dev.kind = "temp-nc";
  } else if (dev.kind === "temp-nc") {
    dev.kind = "temp-no";
  } else if (dev.kind === "pressure-no") {
    dev.kind = "pressure-nc";
  } else if (dev.kind === "pressure-nc") {
    dev.kind = "pressure-no";
  } else if (dev.kind === "flow-no") {
    dev.kind = "flow-nc";
  } else if (dev.kind === "flow-nc") {
    dev.kind = "flow-no";
  }

  return next;
}

// ✅ 支援的 rung ID 前綴列表（用於清理）
const RUNG_ID_PREFIXES = ["rung_", "rung_aux_"];

/**
 * Check if an ID is a valid rung ID that should be tracked in ladderRungOrder
 */
function isValidRungId(id: string): boolean {
  return RUNG_ID_PREFIXES.some(prefix => id.startsWith(prefix));
}

/**
 * Extract device kind and coordinates from rung ID (for stable identification)
 */
function parseRungId(rungId: string): { kind?: string; x?: number; y?: number } | null {
  // Format: rung_<kind>_<x>_<y>
  if (!rungId.startsWith("rung_")) return null;
  
  const parts = rungId.split("_");
  if (parts.length < 4) return null;
  
  try {
    const kind = parts[1];
    const x = parseInt(parts[2], 10);
    const y = parseInt(parts[3], 10);
    
    if (isNaN(x) || isNaN(y)) return null;
    
    return { kind, x, y };
  } catch {
    return null;
  }
}

/**
 * Delete a symbol/device from the circuit by symbolId.
 */
export function synthesizeDeleteElement(
  circuit: Circuit,
  symbolId: string
): Circuit {
  const next: Circuit = {
    devices: [...circuit.devices],
    symbols: circuit.symbols.filter((s) => s.id !== symbolId),
    wires: circuit.wires.filter((w) => w.a.symbolId !== symbolId && w.b.symbolId !== symbolId),
    groups: circuit.groups ? [...circuit.groups] : [],
    ladderRungOrder: circuit.ladderRungOrder ? [...circuit.ladderRungOrder] : undefined,
  };

  const sym = circuit.symbols.find((s) => s.id === symbolId);
  if (sym) {
    const hasOtherSymbols = next.symbols.some((s) => s.deviceId === sym.deviceId);
    if (!hasOtherSymbols) {
      next.devices = next.devices.filter((d) => d.id !== sym.deviceId);
      
      // ✅ 改進：清理所有與此裝置相關的 rung IDs（包括 aux contacts 和 coil rungs）
      if (next.ladderRungOrder) {
        const deviceIdPrefix = `rung_${sym.deviceId}`;
        
        // 刪除主 coil rung
        next.ladderRungOrder = next.ladderRungOrder.filter(id => 
          !isValidRungId(id) || 
          !id.startsWith(deviceIdPrefix)
        );
      }
    } else if (next.ladderRungOrder) {
      // 即使有其他符號，也可能需要清理 auxiliary contact rungs
      // 檢查是否刪除了 auxiliary contact
      if (sym.variant?.includes("aux") || sym.variant === "no" || sym.variant === "nc") {
        const deviceId = sym.deviceId;
        next.ladderRungOrder = next.ladderRungOrder.filter(id => {
          if (!isValidRungId(id)) return true;
          
          // 解析 rung ID 並檢查是否匹配裝置
          const parsed = parseRungId(id);
          if (parsed && parsed.kind) {
            // 查找是否有相同裝置在相同位置的符號
            const hasMatchingSym = next.symbols.some(s => 
              s.deviceId === deviceId &&
              Math.abs(s.x - parsed!.x!) < 1 &&
              Math.abs(s.y - parsed!.y!) < 1
            );
            return hasMatchingSym;
          }
          return true;
        });
      }
    }
  }

  return next;
}
