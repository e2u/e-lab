import { LAMP_COLORS } from "../catalog";
import { t } from "../i18n";
import { useLab } from "../store";

const lampHex: Record<string, string> = {
  red: "#e23d2b",
  green: "#3dd16a",
  yellow: "#f0c42e",
  white: "#f4f0e1",
  blue: "#3b7de0",
};

export function Bench() {
  const circuit = useLab((s) => s.circuit);
  const runtime = useLab((s) => s.snapshot.runtime);
  const held = useLab((s) => s.held);
  const mode = useLab((s) => s.mode);

  return (
    <div className="bench">
      <h3>實物檯</h3>
      <div className="bench-grid">
        {circuit.devices.map((d) => {
          const rt = runtime[d.id];
          if (!rt) return null;
          if (d.kind === "estop" || d.kind === "estop-nc" || d.kind === "estop-no") {
            const extra = d.kind === "estop-no" ? " NO" : d.kind === "estop-nc" ? " NC" : "";
            return (
              <div className="widget" key={d.id}>
                <button
                  className="bakelite estop"
                  disabled={mode !== "run"}
                  onClick={() => useLab.getState().toggleIo(d.id, "actuated")}
                />
                {d.tag} 急停{extra}
              </div>
            );
          }
          if (d.kind === "pb-no" || d.kind === "pb-nc") {
            const color = d.kind === "pb-nc" ? "red" : "green";
            return (
              <div className="widget" key={d.id}>
                <button
                  className={`bakelite ${color}`}
                  disabled={mode !== "run"}
                  onPointerDown={() => useLab.getState().pointerDevice(d.id, true)}
                  onPointerUp={() => useLab.getState().pointerDevice(d.id, false)}
                  onPointerLeave={() => useLab.getState().pointerDevice(d.id, false)}
                  style={held.includes(d.id) ? { transform: "translateY(3px)" } : undefined}
                />
                {d.tag}
              </div>
            );
          }
          if (d.kind === "lamp") {
            const col = lampHex[d.params.color ?? "green"] ?? lampHex.green;
            return (
              <div className="widget" key={d.id}>
                <div
                  className="pilot"
                  style={{
                    background: rt.lit ? col : "#2a241c",
                    boxShadow: rt.lit ? `0 0 16px ${col}` : undefined,
                  }}
                />
                {d.tag}
              </div>
            );
          }
          if (d.kind === "motor-3ph" || d.kind === "motor-1ph" || d.kind === "motor-dc" || d.kind === "fan" || d.kind === "gen-ac" || d.kind === "gen-dc") {
            return (
              <div className="widget" key={d.id}>
                <div className={`machine ${Math.abs(rt.rpm) > 0.2 ? "spin" : ""}`}>
                  <div className="hub" />
                </div>
                {d.tag} {rt.direction < 0 ? "REV" : rt.direction > 0 ? "FWD" : ""}
                {rt.starDelta === "star" ? " Y" : rt.starDelta === "delta" ? " Δ" : ""}
              </div>
            );
          }
          if (d.kind === "breaker-3p" || d.kind === "breaker-1p" || d.kind === "isolator" || d.kind === "rcd") {
            return (
              <div className="widget" key={d.id}>
                <button
                  className="btn"
                  disabled={mode !== "run"}
                  onClick={() => useLab.getState().toggleIo(d.id, "on")}
                >
                  {rt.on && !rt.tripped ? "ON" : "OFF"}
                </button>
                {d.tag}
              </div>
            );
          }
          if (d.kind === "overload") {
            return (
              <div className="widget" key={d.id}>
                <button
                  className="btn danger"
                  disabled={mode !== "run"}
                  onClick={() => useLab.getState().toggleIo(d.id, "tripped")}
                >
                  {rt.tripped ? "跳脫" : "復位"}
                </button>
                {d.tag}
              </div>
            );
          }
          if (d.kind === "alarm" || d.kind === "horn") {
            return (
              <div className="widget" key={d.id}>
                <div className="pilot" style={{ background: rt.lit ? "#e23d2b" : "#2a241c" }} />
                {d.tag} {rt.lit ? "鳴" : ""}
              </div>
            );
          }
          return null;
        })}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        運行模式下按綠鈕起動、紅鈕停止。熱繼電可模擬跳脫。{LAMP_COLORS.length ? "" : ""}
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
        <input type="range" min={0} max={120} value={p.temperature} onChange={(e) => set({ temperature: Number(e.target.value) })} />
        <span>{p.temperature}°</span>
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
