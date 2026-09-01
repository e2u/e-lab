import { LAMP_COLORS } from "../catalog";
import { t } from "../i18n";
import { useLab } from "../store";

const lampHex: Record<string, string> = {
  red: "#e23d2b",
  green: "#3dd16a",
  yellow: "#f0c42e",
  white: "#f4f0e1",
  blue: "#3b7de0",
  amber: "#f59e0b",
  orange: "#f97316",
};

export function Bench() {
  const circuit = useLab((s) => s.circuit);
  const runtime = useLab((s) => s.snapshot.runtime);
  const held = useLab((s) => s.held);
  const mode = useLab((s) => s.mode);
  const process = useLab((s) => s.process);

  // Filter and collect all interactive devices with runtime state
  const activeDevices = circuit.devices.filter((d) => {
    const rt = runtime[d.id];
    if (!rt) return false;
    return (
      d.kind === "estop" ||
      d.kind === "estop-nc" ||
      d.kind === "estop-no" ||
      d.kind === "pb-no" ||
      d.kind === "pb-nc" ||
      d.kind === "lamp" ||
      d.kind === "motor-3ph" ||
      d.kind === "motor-1ph" ||
      d.kind === "motor-dc" ||
      d.kind === "fan" ||
      d.kind === "gen-ac" ||
      d.kind === "gen-dc" ||
      d.kind === "heater" ||
      d.kind === "solenoid" ||
      d.kind === "breaker-3p" ||
      d.kind === "breaker-1p" ||
      d.kind === "isolator" ||
      d.kind === "rcd" ||
      d.kind === "overload" ||
      d.kind === "alarm" ||
      d.kind === "horn" ||
      d.kind === "voltmeter" ||
      d.kind === "ammeter" ||
      d.kind === "selector-2" ||
      d.kind === "selector-3" ||
      d.kind === "toggle" ||
      d.kind.startsWith("toggle-") ||
      d.kind.startsWith("limit") ||
      d.kind.startsWith("foot") ||
      d.kind === "float" ||
      d.kind.startsWith("temp-") ||
      d.kind.startsWith("pressure-") ||
      d.kind.startsWith("flow-") ||
      d.kind === "prox" ||
      d.kind === "photo"
    );
  });

  return (
    <div className="bench">
      <div className="bench-header">
        <div className="bench-title-wrap">
          <h3>{t("bench.title") || t("lib.title")}</h3>
          {activeDevices.length > 0 && (
            <span className="bench-count-badge">
              {activeDevices.length} {t("bench.items") || "items"}
            </span>
          )}
        </div>
      </div>

      {activeDevices.length === 0 ? (
        <p className="hint bench-empty-hint">{t("bench.empty") || "No interactive components in circuit."}</p>
      ) : (
        <div className="bench-grid">
          {activeDevices.map((d) => {
            const rt = runtime[d.id];
            if (!rt) return null;

            // E-Stop Buttons
            if (d.kind === "estop" || d.kind === "estop-nc" || d.kind === "estop-no") {
              const extra = d.kind === "estop-no" ? " NO" : d.kind === "estop-nc" ? " NC" : "";
              return (
                <div className="widget" key={d.id} title={`${d.tag} (${t("bench.estop")}${extra})`}>
                  <button
                    className={`bakelite estop ${rt.actuated ? "actuated" : ""}`}
                    disabled={mode !== "run"}
                    onClick={() => useLab.getState().toggleIo(d.id, "actuated")}
                  />
                  <span className="widget-label">{d.tag}{extra}</span>
                </div>
              );
            }

            // Push Buttons (NO / NC)
            if (d.kind === "pb-no" || d.kind === "pb-nc") {
              const color = d.kind === "pb-nc" ? "red" : "green";
              return (
                <div className="widget" key={d.id} title={`${d.tag} (${d.kind === "pb-nc" ? t("bench.pbNc") : t("bench.pbNo")})`}>
                  <button
                    className={`bakelite ${color}`}
                    disabled={mode !== "run"}
                    onPointerDown={() => useLab.getState().pointerDevice(d.id, true)}
                    onPointerUp={() => useLab.getState().pointerDevice(d.id, false)}
                    onPointerLeave={() => useLab.getState().pointerDevice(d.id, false)}
                    style={held.includes(d.id) ? { transform: "translateY(3px)" } : undefined}
                  />
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Pilot Lamps
            if (d.kind === "lamp") {
              const col = lampHex[d.params.color ?? "green"] ?? lampHex.green;
              return (
                <div className="widget" key={d.id} title={`${d.tag} (Lamp ${d.params.color || "green"})`}>
                  <div
                    className="pilot"
                    style={{
                      background: rt.lit ? col : "#2a241c",
                      boxShadow: rt.lit ? `0 0 16px ${col}` : undefined,
                    }}
                  />
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Motors & Fans & Generators
            if (
              d.kind === "motor-3ph" ||
              d.kind === "motor-1ph" ||
              d.kind === "motor-dc" ||
              d.kind === "fan" ||
              d.kind === "gen-ac" ||
              d.kind === "gen-dc"
            ) {
              const powerVal = d.params.power ?? (d.kind === "motor-1ph" ? 1.5 : d.kind === "motor-dc" ? 0.75 : 5.5);
              const powerStr = (d.kind === "motor-3ph" || d.kind === "motor-1ph" || d.kind === "motor-dc")
                ? `${powerVal}kW`
                : "";
              return (
                <div className="widget motor-widget" key={d.id} title={`${d.tag} [${powerStr}]`}>
                  <div className={`machine ${Math.abs(rt.rpm) > 0.2 ? "spin" : ""}`}>
                    <div className="hub" />
                  </div>
                  <span className="widget-label">{d.tag}</span>
                  {powerStr && <span className="widget-sublabel">{powerStr}</span>}
                  {rt.direction !== 0 && (
                    <span className={`widget-dir-badge ${rt.direction > 0 ? "fwd" : "rev"}`}>
                      {rt.direction < 0 ? t("bench.rev") : t("bench.fwd")}
                    </span>
                  )}
                  {rt.starDelta && (
                    <span className="widget-stardelta-badge">
                      {rt.starDelta === "star" ? t("bench.starDeltaStar") : t("bench.starDeltaDelta")}
                    </span>
                  )}
                </div>
              );
            }

            // Breakers, Isolators, Disconnects
            if (d.kind === "breaker-3p" || d.kind === "breaker-1p" || d.kind === "isolator" || d.kind === "rcd") {
              const isOn = rt.on && !rt.tripped;
              return (
                <div className="widget" key={d.id} title={`${d.tag} (${isOn ? t("bench.on") : t("bench.off")})`}>
                  <button
                    className={`btn btn-toggle-switch ${isOn ? "on" : "off"}`}
                    disabled={mode !== "run"}
                    onClick={() => useLab.getState().toggleIo(d.id, "on")}
                  >
                    {isOn ? t("bench.on") : t("bench.off")}
                  </button>
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Overload Relays
            if (d.kind === "overload") {
              return (
                <div className="widget" key={d.id} title={`${d.tag} (${rt.tripped ? t("bench.overloadTrip") : t("bench.overloadReset")})`}>
                  <button
                    className={`btn danger ${rt.tripped ? "tripped" : ""}`}
                    disabled={mode !== "run"}
                    onClick={() => useLab.getState().toggleIo(d.id, "tripped")}
                  >
                    {rt.tripped ? t("bench.overloadTrip") : t("bench.overloadReset")}
                  </button>
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Alarms & Horns
            if (d.kind === "alarm" || d.kind === "horn") {
              return (
                <div className="widget" key={d.id} title={`${d.tag}`}>
                  <div className={`pilot alarm-pilot ${rt.lit ? "active" : ""}`} style={{ background: rt.lit ? "#e23d2b" : "#2a241c" }} />
                  <span className="widget-label">{d.tag}</span>
                  {rt.lit && <span className="widget-alarm-badge">{t("bench.alarmSound")}</span>}
                </div>
              );
            }

            // Selector Switches
            if (d.kind === "selector-2" || d.kind === "selector-3") {
              const pos = rt.position || 1;
              return (
                <div className="widget" key={d.id} title={`${d.tag} (POS ${pos})`}>
                  <button
                    className="btn btn-selector"
                    disabled={mode !== "run"}
                    onClick={() => useLab.getState().cyclePosition(d.id)}
                  >
                    POS {pos}
                  </button>
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Toggle Switches
            if (d.kind === "toggle" || d.kind.startsWith("toggle-")) {
              const isClosed = !!rt.actuated;
              return (
                <div className="widget" key={d.id} title={`${d.tag} (${isClosed ? t("bench.on") : t("bench.off")})`}>
                  <button
                    className={`btn btn-toggle-switch ${isClosed ? "on" : "off"}`}
                    disabled={mode !== "run"}
                    onClick={() => useLab.getState().toggleIo(d.id, "actuated")}
                  >
                    {isClosed ? t("bench.on") : t("bench.off")}
                  </button>
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Limit & Foot Switches
            if (d.kind.startsWith("limit") || d.kind.startsWith("foot")) {
              const isHeld = held.includes(d.id);
              const isAct = Boolean(rt.actuated || isHeld);
              return (
                <div className="widget" key={d.id} title={`${d.tag}`}>
                  <button
                    className={`btn btn-momentary ${isAct ? "active" : ""}`}
                    disabled={mode !== "run"}
                    onPointerDown={() => useLab.getState().pointerDevice(d.id, true)}
                    onPointerUp={() => useLab.getState().pointerDevice(d.id, false)}
                    onPointerLeave={() => useLab.getState().pointerDevice(d.id, false)}
                    onClick={() => {
                      if (d.kind.startsWith("limit")) {
                        useLab.getState().toggleIo(d.id, "actuated");
                      }
                    }}
                  >
                    {isAct ? "ACT" : "NORM"}
                  </button>
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Voltmeters & Clamp Ammeters
            if (d.kind === "voltmeter" || d.kind === "ammeter") {
              const isV = d.kind === "voltmeter";
              const val = rt.meterValue ?? 0;
              const text = isV ? `${val.toFixed(1)} V` : `${val.toFixed(2)} A`;
              const color = isV ? "#3b82f6" : "#f59e0b";
              return (
                <div
                  className="widget meter-widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={t("meters.clickToInspect")}
                >
                  <span className="meter-badge" style={{ borderColor: color, color }}>
                    {isV ? "V" : "A"}
                  </span>
                  <span className="meter-reading" style={{ color: rt.energized ? "#4ade80" : "inherit" }}>
                    {d.tag}: {text}
                  </span>
                </div>
              );
            }

            // Float Switches
            if (d.kind === "float") {
              const sp = d.params.setpoint ?? 50;
              const isAct = Boolean(rt.actuated);
              return (
                <div
                  className="widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={`${d.tag} (${t("bench.float")}: ${sp}% | ${t("process.level")}: ${process.level}%)`}
                >
                  <button
                    className={`btn btn-toggle-switch ${isAct ? "on" : "off"}`}
                    disabled={mode !== "run"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAct) {
                        useLab.getState().setProcess({ level: Math.max(0, sp - 10) });
                      } else {
                        useLab.getState().setProcess({ level: sp });
                      }
                    }}
                  >
                    {isAct ? "💧 ACT" : "⚪ NORM"}
                  </button>
                  <span className="widget-label">{d.tag} ({sp}%)</span>
                </div>
              );
            }

            // Temperature Switches
            if (d.kind.startsWith("temp-")) {
              const sp = d.params.setpoint ?? 140;
              const isAct = Boolean(rt.actuated);
              return (
                <div
                  className="widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={`${d.tag} (${t("bench.tempSw")}: ${sp}°F | ${t("process.temperature")}: ${process.temperature}°F)`}
                >
                  <button
                    className={`btn btn-toggle-switch ${isAct ? "on" : "off"}`}
                    disabled={mode !== "run"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAct) {
                        useLab.getState().setProcess({ temperature: Math.max(0, sp - 10) });
                      } else {
                        useLab.getState().setProcess({ temperature: sp });
                      }
                    }}
                  >
                    {isAct ? "🔥 ACT" : "❄️ NORM"}
                  </button>
                  <span className="widget-label">{d.tag} ({sp}°F)</span>
                </div>
              );
            }

            // Pressure Switches
            if (d.kind.startsWith("pressure-")) {
              const sp = d.params.setpoint ?? 4;
              const isAct = Boolean(rt.actuated);
              return (
                <div
                  className="widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={`${d.tag} (${t("bench.pressureSw")}: ${sp}bar | ${t("process.pressure")}: ${process.pressure.toFixed(1)}bar)`}
                >
                  <button
                    className={`btn btn-toggle-switch ${isAct ? "on" : "off"}`}
                    disabled={mode !== "run"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAct) {
                        useLab.getState().setProcess({ pressure: Math.max(0, Math.round((sp - 1) * 10) / 10) });
                      } else {
                        useLab.getState().setProcess({ pressure: sp });
                      }
                    }}
                  >
                    {isAct ? "💨 ACT" : "⚪ NORM"}
                  </button>
                  <span className="widget-label">{d.tag} ({sp}b)</span>
                </div>
              );
            }

            // Flow Switches
            if (d.kind.startsWith("flow-")) {
              const sp = d.params.setpoint ?? 40;
              const isAct = Boolean(rt.actuated);
              return (
                <div
                  className="widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={`${d.tag} (${t("bench.flowSw")}: ${sp}% | ${t("process.flow")}: ${process.flow}%)`}
                >
                  <button
                    className={`btn btn-toggle-switch ${isAct ? "on" : "off"}`}
                    disabled={mode !== "run"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAct) {
                        useLab.getState().setProcess({ flow: Math.max(0, sp - 10) });
                      } else {
                        useLab.getState().setProcess({ flow: sp });
                      }
                    }}
                  >
                    {isAct ? "🌊 ACT" : "⚪ NORM"}
                  </button>
                  <span className="widget-label">{d.tag} ({sp}%)</span>
                </div>
              );
            }

            // Proximity Sensors
            if (d.kind === "prox") {
              const isHit = Boolean(process.proxHit);
              return (
                <div
                  className="widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={`${d.tag} (${t("bench.proxSw")})`}
                >
                  <button
                    className={`btn btn-momentary ${isHit ? "active" : ""}`}
                    disabled={mode !== "run"}
                    onClick={(e) => {
                      e.stopPropagation();
                      useLab.getState().setProcess({ proxHit: !process.proxHit });
                    }}
                  >
                    {isHit ? "🧲 ACT" : "⚪ NORM"}
                  </button>
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Photoelectric Sensors
            if (d.kind === "photo") {
              const isHit = Boolean(process.photoHit);
              return (
                <div
                  className="widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={`${d.tag} (${t("bench.photoSw")})`}
                >
                  <button
                    className={`btn btn-momentary ${isHit ? "active" : ""}`}
                    disabled={mode !== "run"}
                    onClick={(e) => {
                      e.stopPropagation();
                      useLab.getState().setProcess({ photoHit: !process.photoHit });
                    }}
                  >
                    {isHit ? "💡 ACT" : "⚪ NORM"}
                  </button>
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            // Counters
            if (d.kind === "counter") {
              const preset = d.params.preset ?? 5;
              const count = rt.count ?? 0;
              const isDone = Boolean(rt.done);
              return (
                <div
                  className="widget meter-widget"
                  key={d.id}
                  onClick={() => {
                    const sym = circuit.symbols.find((s) => s.deviceId === d.id);
                    if (sym) useLab.getState().select({ type: "symbol", id: sym.id }, true);
                  }}
                  title={`${d.tag} (${t("comp.counter")}: ${count}/${preset})`}
                >
                  <span className="meter-badge" style={{ borderColor: isDone ? "#eab308" : "#64748b", color: isDone ? "#eab308" : "#94a3b8" }}>
                    CT
                  </span>
                  <span className="meter-reading" style={{ color: isDone ? "#eab308" : "inherit" }}>
                    {d.tag}: {count}/{preset}
                  </span>
                </div>
              );
            }

            // Heaters & Solenoids
            if (d.kind === "heater" || d.kind === "solenoid") {
              const isHot = Boolean(rt.energized);
              return (
                <div className="widget" key={d.id} title={`${d.tag} (${d.kind === "heater" ? t("bench.heater") : t("bench.solenoid")})`}>
                  <div
                    className="pilot"
                    style={{
                      background: isHot ? (d.kind === "heater" ? "#f97316" : "#06b6d4") : "#2a241c",
                      boxShadow: isHot ? `0 0 16px ${d.kind === "heater" ? "#f97316" : "#06b6d4"}` : undefined,
                    }}
                  />
                  <span className="widget-label">{d.tag}</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      <p className="hint bench-footer-hint">
        {t("bench.hint")}{LAMP_COLORS.length ? "" : ""}
      </p>
    </div>
  );
}

export function ProcessRack() {
  const p = useLab((s) => s.process);
  const set = useLab((s) => s.setProcess);
  return (
    <div className="process">
      <h3>{t("lib.processVars")}</h3>
      <label>
        {t("process.temperature")}
        <input type="range" min={0} max={250} value={p.temperature} onChange={(e) => set({ temperature: Number(e.target.value) })} />
        <span>{p.temperature}°F</span>
      </label>
      <label>
        {t("process.level")}
        <input type="range" min={0} max={100} value={p.level} onChange={(e) => set({ level: Number(e.target.value) })} />
        <span>{p.level}%</span>
      </label>
      <label>
        {t("process.flow")}
        <input type="range" min={0} max={100} value={p.flow} onChange={(e) => set({ flow: Number(e.target.value) })} />
        <span>{p.flow}%</span>
      </label>
      <label>
        {t("process.pressure")}
        <input type="range" min={0} max={16} step={0.1} value={p.pressure} onChange={(e) => set({ pressure: Number(e.target.value) })} />
        <span>{p.pressure.toFixed(1)}</span>
      </label>
      <label className="chk">
        <input type="checkbox" checked={p.limitHit} onChange={(e) => set({ limitHit: e.target.checked })} />
        {t("process.limitHit")}
      </label>
    </div>
  );
}
