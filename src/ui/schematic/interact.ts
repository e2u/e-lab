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
  if (kind === "limit-no" || kind === "limit-nc") lab.setProcess({ limitHit: !lab.process.limitHit });
  if (kind === "prox") lab.setProcess({ proxHit: !lab.process.proxHit });
  if (kind === "photo") lab.setProcess({ photoHit: !lab.process.photoHit });
  if (kind === "gen-ac" || kind === "gen-dc") lab.toggleIo(id, "prime");
}
