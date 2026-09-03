import { useLab } from "../../store";

export function triggerHaptic(duration = 15) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignore vibration errors on unsupported devices
    }
  }
}

export function interact(kind: string, id: string, down: boolean) {
  const lab = useLab.getState();
  if (lab.mode !== "run") return;
  if (down) {
    triggerHaptic(15);
  }
  if (kind === "pb-no" || kind === "pb-nc" || kind === "foot" || kind === "foot-no" || kind === "foot-nc") {
    lab.pointerDevice(id, down);
    return;
  }
  if (!down) return;
  if (
    kind === "estop" ||
    kind === "estop-nc" ||
    kind === "estop-no" ||
    kind === "toggle" ||
    kind.startsWith("toggle-")
  ) {
    lab.toggleIo(id, "actuated");
  }
  if (kind === "breaker-1p" || kind === "breaker-3p" || kind === "isolator" || kind === "rcd") {
    lab.toggleIo(id, "on");
  }
  if (kind === "overload" || kind === "fuse") lab.toggleIo(id, "tripped");
  if (kind === "selector-2" || kind === "selector-3") lab.cyclePosition(id);
  if (kind === "limit-no" || kind === "limit-nc") {
    const dev = lab.circuit.devices.find((d) => d.id === id);
    if (dev) {
      lab.toggleIo(id, "actuated");
    } else {
      lab.setProcess({ limitHit: !lab.process.limitHit });
    }
  }
  if (kind === "float") {
    const dev = lab.circuit.devices.find((d) => d.id === id);
    const sp = dev?.params?.setpoint ?? 50;
    if (lab.process.level >= sp) {
      lab.setProcess({ level: Math.max(0, sp - 10) });
    } else {
      lab.setProcess({ level: sp });
    }
  }
  if (kind.startsWith("temp-")) {
    const dev = lab.circuit.devices.find((d) => d.id === id);
    const sp = dev?.params?.setpoint ?? 140;
    if (lab.process.temperature >= sp) {
      lab.setProcess({ temperature: Math.max(0, sp - 10) });
    } else {
      lab.setProcess({ temperature: sp });
    }
  }
  if (kind.startsWith("pressure-")) {
    const dev = lab.circuit.devices.find((d) => d.id === id);
    const sp = dev?.params?.setpoint ?? 4;
    if (lab.process.pressure >= sp) {
      lab.setProcess({ pressure: Math.max(0, Math.round((sp - 1) * 10) / 10) });
    } else {
      lab.setProcess({ pressure: sp });
    }
  }
  if (kind.startsWith("flow-")) {
    const dev = lab.circuit.devices.find((d) => d.id === id);
    const sp = dev?.params?.setpoint ?? 40;
    if (lab.process.flow >= sp) {
      lab.setProcess({ flow: Math.max(0, sp - 10) });
    } else {
      lab.setProcess({ flow: sp });
    }
  }
  if (kind.startsWith("prox")) lab.setProcess({ proxHit: !lab.process.proxHit });
  if (kind.startsWith("photo")) lab.setProcess({ photoHit: !lab.process.photoHit });
  if (kind === "gen-ac" || kind === "gen-dc") lab.toggleIo(id, "prime");
}
