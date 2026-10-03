import type { DeviceRuntime, SimSnapshot, WireLive } from "../types";

/**
 * Fingerprint of what the schematic, bench, and ladder actually paint.
 * `step()` builds a new snapshot every 50ms; rpm keeps creeping while a
 * machine is energized, and `timeMs` always advances. Those must not appear
 * here, or Run re-renders the sheet forever.
 * Elapsed time is bucketed to 0.1s, matching the timer badge.
 */
export function runtimeVisualKey(
  runtime: Record<string, DeviceRuntime>,
  opts?: { elapsed?: boolean },
): string {
  const elapsed = opts?.elapsed !== false;
  const ids = Object.keys(runtime).sort();
  let out = "";
  for (const id of ids) out += devicePaintKey(id, runtime[id], elapsed);
  return out;
}

/** Inspector rpm text is two decimal places, so the panel follows that and not every float. */
export function inspectorRuntimeKey(runtime: Record<string, DeviceRuntime>): string {
  const ids = Object.keys(runtime).sort();
  let out = "";
  for (const id of ids) {
    const rt = runtime[id];
    out += devicePaintKey(id, rt, false);
    out += Math.round((rt?.rpm ?? 0) * 100);
    out += ";";
  }
  return out;
}

export function schematicVisualKey(snap: SimSnapshot): string {
  return runtimeVisualKey(snap.runtime) + "~" + wireVisualKey(snap.wires);
}

export function faultVisualKey(fault: { level?: string; message: string; msgKey?: string; msgParams?: Record<string, string | number>; deviceId?: string } | undefined): string {
  if (!fault) return "";
  const params = fault.msgParams
    ? Object.keys(fault.msgParams).sort().map((k) => `${k}=${fault.msgParams?.[k]}`).join(",")
    : "";
  return `${fault.level ?? ""}|${fault.msgKey ?? ""}|${fault.message}|${fault.deviceId ?? ""}|${params}`;
}

function devicePaintKey(id: string, rt: DeviceRuntime | undefined, elapsed: boolean): string {
  if (!rt) return id + "!";
  const rpm = rt.rpm ?? 0;
  return (
    id +
    ":" +
    bit(rt.energized) +
    bit(rt.energizedAlt) +
    bit(rt.actuated) +
    bit(rt.on) +
    bit(rt.tripped) +
    bit(rt.lit) +
    bit(rt.done) +
    bit(rt.short) +
    rt.direction +
    rt.position +
    rt.count +
    (rt.starDelta ?? "") +
    (rt.meterUnit ?? "") +
    (rt.meterValue ?? 0) +
    (elapsed ? "e" + Math.round((rt.elapsedMs ?? 0) / 100) : "") +
    (Math.abs(rpm) > 0.1 ? "r" : "") +
    (Math.abs(rpm) > 0.2 ? "R" : "") +
    "|"
  );
}

function wireVisualKey(wires: Record<string, WireLive>): string {
  const ids = Object.keys(wires).sort();
  let out = "";
  for (const id of ids) {
    const w = wires[id];
    if (!w) continue;
    out += id;
    out += w.live ? "1" : "0";
    out += w.kind ?? "";
    out += w.dir;
    out += w.short ? "s" : "";
    out += "|";
  }
  return out;
}

function bit(v: boolean | undefined): "1" | "0" {
  return v ? "1" : "0";
}
