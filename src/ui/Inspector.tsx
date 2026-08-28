import { GROUP_COLORS, KINDS, LAMP_COLORS } from "../catalog";
import { selectionHasGroup, selectionIsGroup } from "../groups";
import { catalogCompKey, t, tOr } from "../i18n";
import { useLab } from "../store";
import type { Circuit, DeviceKind } from "../types";
import { MeterHistoryChart } from "./MeterHistoryChart";

function NetLabelHint({
  circuit,
  deviceId,
  tag,
}: {
  circuit: Circuit;
  deviceId: string;
  tag: string;
}) {
  const key = tag.trim();
  const peers = circuit.devices.filter((d) => d.kind === "net-label" && d.id !== deviceId && d.tag.trim() === key);
  const names = [
    ...new Set(
      circuit.devices
        .filter((d) => d.kind === "net-label" && d.id !== deviceId && d.tag.trim())
        .map((d) => d.tag.trim()),
    ),
  ].sort();
  return (
    <>
      <p className="hint">
        {t("inspector.netLabelHint")}
      </p>
      {key ? (
        <p className="hint">
          {peers.length > 0 ? t("inspector.alreadyConnected", { count: peers.length.toString(), tag: key }) : t("inspector.noOtherLabels", { tag: key })}
        </p>
      ) : (
        <p className="hint">{t("inspector.enterLabel")}</p>
      )}
      {names.length > 0 && (
        <label>
          {t("inspector.existingLabels")}
          <select
            value={names.includes(key) ? key : ""}
            onChange={(e) => {
              if (e.target.value) useLab.getState().updateDevice(deviceId, { tag: e.target.value });
            }}
          >
            <option value="">{t("inspector.select")}</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

function weldable(kind: DeviceKind): boolean {
  return (
    kind === "contactor" ||
    kind === "relay" ||
    kind.startsWith("starter") ||
    kind === "pb-no" ||
    kind === "pb-nc" ||
    kind === "estop" ||
    kind === "estop-nc" ||
    kind === "estop-no" ||
    kind === "toggle" ||
    kind.startsWith("toggle-") ||
    kind.startsWith("limit") ||
    kind === "foot" ||
    kind === "foot-no" ||
    kind === "foot-nc"
  );
}

export function Inspector() {
  const selected = useLab((s) => s.selected);
  const selectedIds = useLab((s) => s.selectedIds);
  const circuit = useLab((s) => s.circuit);
  const runtime = useLab((s) => s.snapshot.runtime);
  const meterHistory = useLab((s) => s.meterHistory);

  const injected = [
    ...circuit.wires.filter((w) => w.broken).map((w) => ({ id: w.id, type: "wire" as const, label: t("inspector.broken") })),
    ...circuit.devices
      .filter((d) => d.params.welded)
      .map((d) => ({ id: d.id, type: "device" as const, label: `${d.tag} ${t("inspector.weldedContact")}` })),
  ];

  if (!selected) {
    return (
      <div className="inspector">
        <h3>{t("inspector.properties")}</h3>
        <p className="hint">{t("inspector.hint.editMode")}</p>
        {injected.length > 0 && (
          <>
            <h3>{t("runtime.faults")}</h3>
            {injected.map((f) => (
              <div key={f.id} className="hint">
                {f.label}
              </div>
            ))}
            <button className="btn danger" onClick={() => useLab.getState().clearFaults()}>
              {t("runtime.clearFaults")}
            </button>
          </>
        )}
      </div>
    );
  }

  if (selectedIds.length > 1) {
    const asGroup = selectionIsGroup(circuit, selectedIds);
    const hasGroup = Boolean(asGroup) || selectionHasGroup(circuit, selectedIds);
    return (
      <div className="inspector">
        <h3>{asGroup ? `${t("lib.group")} · ${selectedIds.length} ${t("unit.items")}` : `${t("toolbar.selected")}: ${selectedIds.length} ${t("unit.items")}`}</h3>
        {asGroup && (
          <div className="group-color-section">
            <label>
              {t("inspector.groupColor")}
              <input
                type="color"
                value={asGroup.color || "#3b7de0"}
                onChange={(e) => useLab.getState().updateGroup(asGroup.id, { color: e.target.value })}
              />
            </label>
            <div className="color-swatches">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch-btn ${((asGroup.color || "#3b7de0").toLowerCase() === c.toLowerCase()) ? "active" : ""}`}
                  style={{ backgroundColor: c }}
                  title={c}
                  onClick={() => useLab.getState().updateGroup(asGroup.id, { color: c })}
                />
              ))}
            </div>
          </div>
        )}
        <p className="hint">{t("inspector.hint.dragMove")}</p>
        <div className="align-grid">
          <button className="btn" onClick={() => useLab.getState().alignSelected("left")}>{t("ctx.alignLeft")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("hcenter")}>{t("ctx.alignCenterH")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("right")}>{t("ctx.alignRight")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("top")}>{t("ctx.alignTop")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("vcenter")}>{t("ctx.alignCenterV")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("bottom")}>{t("ctx.alignBottom")}</button>
        </div>
        <div className="distribute-grid">
          <button className="btn" onClick={() => useLab.getState().alignSelected("distribute-h")}>{t("ctx.distributeH")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("distribute-v")}>{t("ctx.distributeV")}</button>
        </div>
        <button className="btn" onClick={() => useLab.getState().rotateSelected(1)}>{t("ctx.rotate")}</button>
        <button className="btn" disabled={hasGroup} onClick={() => useLab.getState().flipSelected("h")}>{t("ctx.flipH")}</button>
        <button className="btn" disabled={hasGroup} onClick={() => useLab.getState().flipSelected("v")}>{t("ctx.flipV")}</button>
        <button className="btn" onClick={() => useLab.getState().duplicateSelected()}>{t("ctx.duplicate")}</button>
        {!asGroup && (
          <button className="btn" onClick={() => useLab.getState().groupSelected()}>{t("ctx.group")}</button>
        )}
        {selectionHasGroup(circuit, selectedIds) && (
          <button className="btn" onClick={() => useLab.getState().ungroupSelected()}>{t("ctx.ungroup")}</button>
        )}
        <button className="btn danger" onClick={() => useLab.getState().deleteSelected()}>{t("ctx.delete")}</button>
      </div>
    );
  }

  if (selected.type === "wire") {
    const wire = circuit.wires.find((w) => w.id === selected.id);
    return (
      <div className="inspector">
        <h3>{t("inspector.wire")}</h3>
        <label>
          {t("inspector.wireLabel")}
          <input
            value={wire?.label ?? ""}
            onChange={(e) => useLab.getState().updateWire(selected.id, { label: e.target.value })}
            placeholder={t("inspector.wireLabelPlaceholder")}
          />
        </label>
        <p className="hint">{t("inspector.wireLabelHint")}</p>
        <label className="chk">
          <input
            type="checkbox"
            checked={Boolean(wire?.broken)}
            onChange={() => useLab.getState().toggleWireBroken(selected.id)}
          />
          {t("inspector.broken")}
        </label>
        <p className="hint">{t("inspector.brokenHint")}</p>
        <button className="btn danger" onClick={() => useLab.getState().deleteSelected()}>
          {t("inspector.deleteWire")}
        </button>
      </div>
    );
  }

  const sym = circuit.symbols.find((s) => s.id === selected.id);
  const dev = sym && circuit.devices.find((d) => d.id === sym.deviceId);
  if (!sym || !dev) return null;
  const rt = runtime[dev.id];
  if (dev.kind === "junction") {
    const n = circuit.wires.filter((w) => w.a.symbolId === sym.id || w.b.symbolId === sym.id).length;
    return (
      <div className="inspector">
        <h3>{t("inspector.junction")}</h3>
        <p className="hint">{t("inspector.junctionHint")}</p>
        <p className="hint">{t("inspector.junctionWires", { count: n.toString(), hot: rt?.energized ? ` ${t("runtime.energized")}` : "" })}</p>
        <button className="btn danger" onClick={() => useLab.getState().deleteSelected()}>
          {t("inspector.deleteJunction")}
        </button>
      </div>
    );
  }
  const sameKind = circuit.devices.filter((d) => d.kind === dev.kind);
  const machines = circuit.devices.filter(
    (d) => d.kind.startsWith("motor") || d.kind.startsWith("gen") || d.kind === "fan",
  );

  return (
    <div className="inspector">
      <h3>{tOr(catalogCompKey(dev.kind), KINDS[dev.kind].label)}</h3>
      {dev.kind === "title-block" ? (
        <div className="title-block-editor">
          <label>
            <span>{t("inspector.projectName")}</span>
            <input
              value={dev.params.projectName ?? ""}
              placeholder="PROJECT NAME"
              onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, projectName: e.target.value } })}
            />
          </label>
          <label>
            <span>{t("inspector.projectNo")}</span>
            <input
              value={dev.params.projectNo ?? ""}
              placeholder="DWG-001"
              onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, projectNo: e.target.value } })}
            />
          </label>
          <div className="row-2">
            <label>
              <span>{t("inspector.rev")}</span>
              <input
                value={dev.params.rev ?? ""}
                placeholder="A"
                onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, rev: e.target.value } })}
              />
            </label>
            <label>
              <span>{t("inspector.sheet")}</span>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <input
                  style={{ width: "50%" }}
                  value={dev.params.sheetNum ?? "1"}
                  placeholder="1"
                  onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, sheetNum: e.target.value } })}
                />
                <span style={{ fontSize: "11px", color: "var(--text-dim, #7d8973)" }}>OF</span>
                <input
                  style={{ width: "50%" }}
                  value={dev.params.sheetTotal ?? "1"}
                  placeholder="1"
                  onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, sheetTotal: e.target.value } })}
                />
              </div>
            </label>
          </div>
          <label>
            <span>{t("inspector.description")}</span>
            <input
              value={dev.params.description ?? ""}
              placeholder="SCHEMATIC DIAGRAM"
              onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, description: e.target.value } })}
            />
          </label>
          <div className="row-2">
            <label>
              <span>{t("inspector.designedBy")}</span>
              <input
                value={dev.params.designedBy ?? ""}
                placeholder="ENGINEER"
                onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, designedBy: e.target.value } })}
              />
            </label>
            <label>
              <span>{t("inspector.date")}</span>
              <input
                value={dev.params.date ?? ""}
                placeholder="MM/DD/YYYY"
                onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, date: e.target.value } })}
              />
            </label>
          </div>
          <label>
            <span>{t("inspector.scale")} ({(dev.params.scale ?? 1).toFixed(2)}x)</span>
            <div className="title-block-scale-btns">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn ${Math.abs((dev.params.scale ?? 1) - s) < 0.01 ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, scale: s } })}
                >
                  {s}x
                </button>
              ))}
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              value={dev.params.scale ?? 1}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, scale: parseFloat(e.target.value) } })}
              style={{ width: "100%", marginTop: "6px" }}
            />
          </label>
        </div>
      ) : (
        <>
          <label>
            {dev.kind === "net-label" ? t("inspector.netLabel") : t("inspector.tag")}
            <input value={dev.tag} onChange={(e) => useLab.getState().updateDevice(dev.id, { tag: e.target.value })} />
          </label>
          {dev.kind === "net-label" ? (
            <NetLabelHint circuit={circuit} deviceId={dev.id} tag={dev.tag} />
          ) : (
            <div className="hint">{t("inspector.variant")}: {sym.variant} · {dev.kind}</div>
          )}
          {dev.kind !== "net-label" && sameKind.length > 1 && (
            <label>
              {t("inspector.deviceBinding")}
              <select value={dev.id} onChange={(e) => useLab.getState().rebind(sym.id, e.target.value)}>
                {sameKind.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.tag}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {(dev.kind === "voltmeter" || dev.kind === "ammeter") && (
        <MeterHistoryChart
          deviceId={dev.id}
          tag={dev.tag}
          kind={dev.kind}
          liveValue={rt?.meterValue ?? 0}
          unit={dev.kind === "voltmeter" ? "V" : "A"}
          history={meterHistory[dev.id] ?? []}
          onClear={() => useLab.getState().clearMeterHistory(dev.id)}
        />
      )}
      {dev.kind === "mains-3ph" && (
        <>
          <label>
            {t("inspector.supplyType")}
            <select
              value={dev.params.supplyType ?? (sym.variant === "delta" ? "delta" : "wye")}
              onChange={(e) => {
                const val = e.target.value as "wye" | "delta";
                useLab.getState().updateDevice(dev.id, { params: { ...dev.params, supplyType: val } });
              }}
            >
              <option value="wye">{t("inspector.wye")}</option>
              <option value="delta">{t("inspector.delta")}</option>
            </select>
          </label>
          <label>
            <span>{t("inspector.voltageSetting")} ({dev.params.voltage ?? 480}V)</span>
            <div style={{ display: "flex", gap: "4px", margin: "4px 0", flexWrap: "wrap" }}>
              {[208, 240, 380, 480, 600].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.voltage ?? 480) === v ? "primary" : ""}`}
                  style={{ padding: "3px 7px", fontSize: "11px" }}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, voltage: v } })}
                >
                  {v}V
                </button>
              ))}
            </div>
            <input
              type="number"
              min="100"
              max="1000"
              step="10"
              value={dev.params.voltage ?? 480}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, voltage: Number(e.target.value) || 480 } })}
            />
          </label>
          <label>
            <span>{t("inspector.maxCurrentSetting")} ({dev.params.maxCurrent ?? 400}A)</span>
            <div style={{ display: "flex", gap: "4px", margin: "4px 0", flexWrap: "wrap" }}>
              {[50, 100, 200, 400, 600, 800].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`btn ${(dev.params.maxCurrent ?? 400) === a ? "primary" : ""}`}
                  style={{ padding: "3px 7px", fontSize: "11px" }}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, maxCurrent: a } })}
                >
                  {a}A
                </button>
              ))}
            </div>
            <input
              type="number"
              min="5"
              max="2000"
              step="5"
              value={dev.params.maxCurrent ?? 400}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, maxCurrent: Number(e.target.value) || 400 } })}
            />
          </label>
        </>
      )}
      {dev.kind === "ammeter" && (
        <label>
          <span>{t("inspector.clampedWire")}</span>
          <select
            value={dev.params.clampedWireId ?? ""}
            onChange={(e) => {
              const wireId = e.target.value || undefined;
              useLab.getState().updateDevice(dev.id, { params: { ...dev.params, clampedWireId: wireId } });
            }}
          >
            <option value="">{t("meters.notClamped")}</option>
            {circuit.wires.map((w) => {
              const aDev = circuit.devices.find((d) => {
                const s = circuit.symbols.find((s) => s.id === w.a.symbolId);
                return s?.deviceId === d.id;
              });
              const bDev = circuit.devices.find((d) => {
                const s = circuit.symbols.find((s) => s.id === w.b.symbolId);
                return s?.deviceId === d.id;
              });
              const desc = `${w.label ? `[${w.label}] ` : ""}${aDev?.tag || "?"}.${w.a.term} ➔ ${bDev?.tag || "?"}.${w.b.term}`;
              return (
                <option key={w.id} value={w.id}>
                  {desc}
                </option>
              );
            })}
          </select>
          {dev.params.clampedWireId && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: "4px", fontSize: "11px", padding: "3px 8px" }}
              onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, clampedWireId: undefined } })}
            >
              ✕ {t("meters.clear")}
            </button>
          )}
        </label>
      )}
      {dev.kind === "lamp" && (
        <label>
          {t("inspector.color")}
          <select
            value={dev.params.color ?? "green"}
            onChange={(e) => useLab.getState().updateDevice(dev.id, { color: e.target.value })}
          >
            {LAMP_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {dev.kind === "net-label" && (
        <label>
          {t("inspector.color")}
          <input
            type="color"
            value={dev.params.color ?? "#efe6d0"}
            onChange={(e) => useLab.getState().updateDevice(dev.id, { color: e.target.value })}
          />
        </label>
      )}
      {(dev.kind === "timer-on" || dev.kind === "timer-off") && (
        <label>
          {t("inspector.delayMs")}
          <input
            type="number"
            value={dev.params.delayMs ?? 2000}
            onChange={(e) => useLab.getState().updateDevice(dev.id, { delayMs: Number(e.target.value) })}
          />
        </label>
      )}
      {dev.kind === "counter" && (
        <label>
          {t("inspector.preset")}
          <input
            type="number"
            value={dev.params.preset ?? 5}
            onChange={(e) => useLab.getState().updateDevice(dev.id, { preset: Number(e.target.value) })}
          />
        </label>
      )}
      {(dev.kind.startsWith("temp") || dev.kind.startsWith("pressure") || dev.kind.startsWith("flow") || dev.kind === "float") && (
        <label>
          {t("inspector.setpoint")}
          <input
            type="number"
            value={dev.params.setpoint ?? 0}
            onChange={(e) => useLab.getState().updateDevice(dev.id, { setpoint: Number(e.target.value) })}
          />
        </label>
      )}
      {dev.kind === "transformer" && (
        <label>
          {t("inspector.ratio")}
          <input
            type="text"
            value={dev.params.ratio ?? "480/120"}
            onChange={(e) => useLab.getState().updateDevice(dev.id, { ratio: e.target.value })}
          />
        </label>
      )}
      {(dev.kind === "motor-3ph" ||
        dev.kind === "motor-1ph" ||
        dev.kind === "motor-dc" ||
        dev.kind === "starter-dol" ||
        dev.kind === "starter-fwd" ||
        dev.kind === "starter-rev" ||
        dev.kind === "starter-rev-combo") && (
        <label>
          <span>
            {t("inspector.motorPower")} ({dev.params.power ?? (dev.kind === "motor-1ph" ? 1.5 : dev.kind === "motor-dc" ? 0.75 : 5.5)} kW / {((dev.params.power ?? (dev.kind === "motor-1ph" ? 1.5 : dev.kind === "motor-dc" ? 0.75 : 5.5)) * 1.341).toFixed(1)} HP)
          </span>
          <div style={{ display: "flex", gap: "4px", margin: "4px 0", flexWrap: "wrap" }}>
            {dev.kind === "motor-1ph" ? (
              [0.37, 0.75, 1.1, 1.5, 2.2, 3.0].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className={`btn ${(dev.params.power ?? 1.5) === kw ? "primary" : ""}`}
                  style={{ padding: "3px 7px", fontSize: "11px" }}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, power: kw } })}
                >
                  {kw}kW ({kw === 0.37 ? "0.5" : kw === 0.75 ? "1" : kw === 1.1 ? "1.5" : kw === 1.5 ? "2" : kw === 2.2 ? "3" : kw === 3.0 ? "4" : (kw * 1.341).toFixed(1)}HP)
                </button>
              ))
            ) : dev.kind === "motor-dc" ? (
              [0.37, 0.75, 1.5, 2.2, 3.7, 5.5].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className={`btn ${(dev.params.power ?? 0.75) === kw ? "primary" : ""}`}
                  style={{ padding: "3px 7px", fontSize: "11px" }}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, power: kw } })}
                >
                  {kw}kW ({kw === 0.37 ? "0.5" : kw === 0.75 ? "1" : kw === 1.5 ? "2" : kw === 2.2 ? "3" : kw === 3.7 ? "5" : kw === 5.5 ? "7.5" : (kw * 1.341).toFixed(1)}HP)
                </button>
              ))
            ) : (
              [0.75, 1.5, 2.2, 3.7, 5.5, 7.5, 11, 15, 22, 30].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className={`btn ${(dev.params.power ?? 5.5) === kw ? "primary" : ""}`}
                  style={{ padding: "3px 7px", fontSize: "11px" }}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, power: kw } })}
                >
                  {kw}kW ({kw === 0.75 ? "1" : kw === 1.5 ? "2" : kw === 2.2 ? "3" : kw === 3.7 ? "5" : kw === 5.5 ? "7.5" : kw === 7.5 ? "10" : kw === 11 ? "15" : kw === 15 ? "20" : kw === 22 ? "30" : kw === 30 ? "40" : (kw * 1.341).toFixed(1)}HP)
                </button>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="number"
              min="0.1"
              max="1000"
              step="0.1"
              style={{ flex: 1 }}
              value={dev.params.power ?? (dev.kind === "motor-1ph" ? 1.5 : dev.kind === "motor-dc" ? 0.75 : 5.5)}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                useLab.getState().updateDevice(dev.id, {
                  params: {
                    ...dev.params,
                    power: !isNaN(val) && val > 0 ? val : (dev.kind === "motor-1ph" ? 1.5 : dev.kind === "motor-dc" ? 0.75 : 5.5),
                  },
                });
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-dim, #7d8973)" }}>kW</span>
          </div>
        </label>
      )}
      {(dev.kind === "gen-ac" || dev.kind === "gen-dc") && (
        <>
          <label>
            {t("inspector.shaftCoupling")}
            <select
              value={dev.params.shaftWith ?? ""}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { shaftWith: e.target.value })}
            >
              <option value="">{t("inspector.none")}</option>
              {machines
                .filter((m) => m.id !== dev.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.tag}
                  </option>
                ))}
            </select>
          </label>
          <button className="btn" onClick={() => useLab.getState().toggleIo(dev.id, "prime")}>
            {t("inspector.primeMover")} {dev.params.primeMover ? ` (${t("inspector.on")})` : ` (${t("inspector.off")})`}
          </button>
        </>
      )}
      {weldable(dev.kind) && (
        <label className="chk">
          <input
            type="checkbox"
            checked={Boolean(dev.params.welded)}
            onChange={() => useLab.getState().toggleDeviceWelded(dev.id)}
          />
          {t("inspector.weldedContact")}
        </label>
      )}
      {rt && (
        <p className="hint">
          {rt.energized ? t("runtime.energized") : t("runtime.deenergized")}
          {rt.tripped ? ` ${t("runtime.tripped")}` : ""}
          {rt.lit ? ` ${t("runtime.lit")}` : ""}
          {rt.done ? ` ${t("runtime.done")}` : ""}
          {rt.starDelta === "star" ? ` ${t("runtime.starDeltaStar")}` : ""}
          {rt.starDelta === "delta" ? ` ${t("runtime.starDeltaDelta")}` : ""}
          {Math.abs(rt.rpm) > 0.05 ? ` · ${rt.rpm > 0 ? "+" : ""}${rt.rpm.toFixed(2)} pu` : ""}
        </p>
      )}
      <button className="btn" onClick={() => useLab.getState().rotateSelected(1)}>
        {t("inspector.rotate90")}
      </button>
      <button className="btn" disabled={selectionHasGroup(circuit, [sym.id])} onClick={() => useLab.getState().flipSelected("h")}>
        {t("inspector.flipH")}
      </button>
      <button className="btn" disabled={selectionHasGroup(circuit, [sym.id])} onClick={() => useLab.getState().flipSelected("v")}>
        {t("inspector.flipV")}
      </button>
      <button className="btn danger" onClick={() => useLab.getState().deleteSelected()}>
        {t("inspector.delete")}
      </button>
    </div>
  );
}
