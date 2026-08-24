import { KINDS, LAMP_COLORS } from "../catalog";
import { selectionHasGroup, selectionIsGroup } from "../groups";
import { t } from "../i18n";
import { useLab } from "../store";
import type { Circuit, DeviceKind } from "../types";

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
            <option value="">(Select)</option>
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
    return (
      <div className="inspector">
        <h3>{asGroup ? `${t("lib.group")} · ${selectedIds.length} ${t("unit.items")}` : `${t("toolbar.selected")}: ${selectedIds.length} ${t("unit.items")}`}</h3>
        <p className="hint">{t("inspector.hint.dragMove")}</p>
        <div className="align-grid">
          <button className="btn" onClick={() => useLab.getState().alignSelected("left")}>{t("ctx.alignLeft")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("hcenter")}>{t("ctx.alignCenterH")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("right")}>{t("ctx.alignRight")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("top")}>{t("ctx.alignTop")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("vcenter")}>{t("ctx.alignCenterV")}</button>
          <button className="btn" onClick={() => useLab.getState().alignSelected("bottom")}>{t("ctx.alignBottom")}</button>
        </div>
        <button className="btn" onClick={() => useLab.getState().rotateSelected(1)}>{t("ctx.rotate")}</button>
        <button className="btn" onClick={() => useLab.getState().flipSelected("h")}>{t("ctx.flipH")}</button>
        <button className="btn" onClick={() => useLab.getState().flipSelected("v")}>{t("ctx.flipV")}</button>
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
      <h3>{KINDS[dev.kind].label}</h3>
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
      {(dev.kind === "gen-ac" || dev.kind === "gen-dc") && (
        <>
          <label>
            {t("inspector.shaftCoupling")}
            <select
              value={dev.params.shaftWith ?? ""}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { shaftWith: e.target.value })}
            >
              <option value="">(None)</option>
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
            {t("inspector.primeMover")} {dev.params.primeMover ? "(ON)" : "(OFF)"}
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
      <button className="btn" onClick={() => useLab.getState().flipSelected("h")}>
        {t("inspector.flipH")}
      </button>
      <button className="btn" onClick={() => useLab.getState().flipSelected("v")}>
        {t("inspector.flipV")}
      </button>
      <button className="btn danger" onClick={() => useLab.getState().deleteSelected()}>
        {t("inspector.delete")}
      </button>
    </div>
  );
}
