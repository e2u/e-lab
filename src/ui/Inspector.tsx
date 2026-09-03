import { GROUP_COLORS, KINDS, LAMP_COLORS } from "../catalog";
import { selectionHasGroup, selectionIsGroup } from "../groups";
import { areWiresConnected } from "../geometry";
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

function getVariantDisplayName(kind: string, variantKey: string): string {
  if (kind === "timer-on") {
    switch (variantKey) {
      case "coil": return t("comp.timerOn");
      case "delayed-nc": return t("comp.timerOnNc");
      case "delayed-no": return t("comp.timerOnNo");
      case "inst-nc": return t("comp.timerOnInstNc");
      case "inst-no": return t("comp.timerOnInstNo");
    }
  } else if (kind === "timer-off") {
    switch (variantKey) {
      case "coil": return t("comp.timerOff");
      case "delayed-nc": return t("comp.timerOffNc");
      case "delayed-no": return t("comp.timerOffNo");
      case "inst-nc": return t("comp.timerOffInstNc");
      case "inst-no": return t("comp.timerOffInstNo");
    }
  } else if (kind === "contactor") {
    switch (variantKey) {
      case "coil": return t("comp.contactorCoil");
      case "main": return t("comp.contactorMain");
      case "aux-no": return t("comp.contactorAuxNo");
      case "aux-nc": return t("comp.contactorAuxNc");
      case "aux-no2": return t("comp.contactorAuxNo2");
      case "aux-nc2": return t("comp.contactorAuxNc2");
    }
  } else if (kind === "relay") {
    switch (variantKey) {
      case "coil": return t("comp.relayCoil");
      case "aux-no": return t("comp.relayAuxNo");
      case "aux-nc": return t("comp.relayAuxNc");
      case "aux-no2": return t("comp.relayAuxNo2");
      case "aux-nc2": return t("comp.relayAuxNc2");
    }
  } else if (kind === "overload") {
    switch (variantKey) {
      case "body":
      case "main": return t("comp.overloadMain");
      case "aux-no": return t("comp.overloadAuxNo");
      case "aux-nc": return t("comp.overloadAuxNc");
    }
  }
  return variantKey;
}

export function Inspector() {
  const selected = useLab((s) => s.selected);
  const selectedIds = useLab((s) => s.selectedIds);
  const selectedWireIds = useLab((s) => s.selectedWireIds);
  const circuit = useLab((s) => s.circuit);
  const runtime = useLab((s) => s.snapshot.runtime);
  const meterHistory = useLab((s) => s.meterHistory);
  const process = useLab((s) => s.process);

  const injected = [
    ...circuit.wires.filter((w) => w.broken).map((w) => ({ id: w.id, type: "wire" as const, label: t("inspector.broken") })),
    ...circuit.devices
      .filter((d) => d.params.welded)
      .map((d) => ({ id: d.id, type: "device" as const, label: `${d.tag} ${t("inspector.weldedContact")}` })),
  ];

  if (selectedWireIds && selectedWireIds.length > 1) {
    const canMerge =
      selectedWireIds.length === 2 &&
      areWiresConnected(circuit, selectedWireIds[0], selectedWireIds[1]);
    return (
      <div className="inspector">
        <h3>{t("inspector.selectedWires", { count: selectedWireIds.length.toString() })}</h3>
        <p className="hint">{t("inspector.selectedWiresHint")}</p>
        {selectedWireIds.length === 2 && (
          <button
            className="btn"
            disabled={!canMerge}
            onClick={() => useLab.getState().mergeSelectedWires()}
          >
            🔗 {t("ctx.mergeWires")}
          </button>
        )}
        <button
          className="btn"
          onClick={() => {
            for (const id of selectedWireIds) {
              useLab.getState().straightenWire(id);
            }
          }}
        >
          {t("ctx.straightenWire")}
        </button>
        <button className="btn danger" onClick={() => useLab.getState().deleteSelected()}>
          {t("inspector.deleteWire")}
        </button>
      </div>
    );
  }

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
        <button className="btn" onClick={() => useLab.getState().addJunctionOnWire(selected.id)}>
          {t("inspector.addJunction")}
        </button>
        {wire?.jog && (
          <button className="btn" onClick={() => useLab.getState().straightenWire(selected.id)}>
            {t("ctx.straightenWire")}
          </button>
        )}
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
      {dev.kind === "comment" ? (
        <div className="comment-editor">
          <label>
            <span>{t("inspector.commentText")}</span>
            <textarea
              rows={4}
              value={dev.params.text ?? ""}
              placeholder={t("inspector.commentPlaceholder")}
              style={{ width: "100%", padding: "6px 8px", fontSize: `${dev.params.fontSize ?? 12}px`, resize: "vertical" }}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { text: e.target.value })}
            />
          </label>
          <label>
            <span>{t("inspector.bindTarget")}</span>
            <select
              value={dev.params.targetDeviceId ?? ""}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { targetDeviceId: e.target.value })}
            >
              <option value="">{t("inspector.noneUnbound")}</option>
              {circuit.devices
                .filter((d) => d.id !== dev.id && d.kind !== "comment" && d.kind !== "junction" && d.kind !== "title-block")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.tag} ({tOr(catalogCompKey(d.kind), KINDS[d.kind]?.label ?? d.kind)})
                  </option>
                ))}
            </select>
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={dev.params.showLeaderLine !== false}
              onChange={(e) => useLab.getState().updateDevice(dev.id, { showLeaderLine: e.target.checked })}
            />
            {t("inspector.showLeaderLine")}
          </label>
          <label>
            <span>{t("inspector.bgColor")}</span>
            <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
              {[
                { val: "#fef9c3", label: t("color.yellow"), bg: "#fef9c3", border: "#ca8a04" },
                { val: "#e0f2fe", label: t("color.blue"), bg: "#e0f2fe", border: "#0284c7" },
                { val: "#dcfce7", label: t("color.green"), bg: "#dcfce7", border: "#16a34a" },
                { val: "#ffffff", label: t("color.white"), bg: "#ffffff", border: "#94a3b8" },
                { val: "#f3f4f6", label: t("color.gray"), bg: "#f3f4f6", border: "#6b7280" },
                { val: "transparent", label: t("color.transparent"), bg: "transparent", border: "#94a3b8" },
              ].map((c) => (
                <button
                  key={c.val}
                  type="button"
                  className={`btn ${(dev.params.bgColor ?? "#fef9c3") === c.val ? "primary" : ""}`}
                  style={{
                    backgroundColor: c.bg,
                    border: `1.5px solid ${c.border}`,
                    color: "#1f2937",
                    fontSize: "11px",
                    padding: "3px 8px",
                  }}
                  onClick={() => useLab.getState().updateDevice(dev.id, { bgColor: c.val })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span>{t("inspector.fontSize")} ({dev.params.fontSize ?? 12}px)</span>
            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
              {[10, 12, 14, 16].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  className={`btn ${(dev.params.fontSize ?? 12) === sz ? "primary" : ""}`}
                  style={{ flex: 1, padding: "3px 6px", fontSize: "11px" }}
                  onClick={() => useLab.getState().updateDevice(dev.id, { fontSize: sz })}
                >
                  {sz}px
                </button>
              ))}
            </div>
          </label>
          <div className="row-2">
            <label>
              <span>{t("inspector.widthGrids")}</span>
              <input
                type="number"
                min="3"
                max="30"
                value={dev.params.width ?? 6}
                onChange={(e) => {
                  const wVal = parseInt(e.target.value, 10);
                  if (!isNaN(wVal) && wVal >= 3) {
                    useLab.getState().updateDevice(dev.id, { width: wVal });
                  }
                }}
              />
            </label>
            <label>
              <span>{t("inspector.heightGrids")}</span>
              <input
                type="number"
                min="2"
                max="20"
                value={dev.params.height ?? 3}
                onChange={(e) => {
                  const hVal = parseInt(e.target.value, 10);
                  if (!isNaN(hVal) && hVal >= 2) {
                    useLab.getState().updateDevice(dev.id, { height: hVal });
                  }
                }}
              />
            </label>
          </div>
          <label>
            <span>{t("inspector.tag")}</span>
            <input value={dev.tag} onChange={(e) => useLab.getState().updateDevice(dev.id, { tag: e.target.value })} />
          </label>
        </div>
      ) : dev.kind === "title-block" ? (
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
          {KINDS[dev.kind] && Object.keys(KINDS[dev.kind].variants).length > 1 && (
            <label style={{ marginTop: "6px" }}>
              <span>{t("inspector.contactVariant")}</span>
              <select
                value={sym.variant}
                onChange={(e) => useLab.getState().setSymbolVariant(sym.id, e.target.value)}
              >
                {Object.keys(KINDS[dev.kind].variants).map((vKey) => (
                  <option key={vKey} value={vKey}>
                    {getVariantDisplayName(dev.kind, vKey)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(dev.kind === "timer-on" || dev.kind === "timer-off") && (
            <div
              style={{
                marginTop: "6px",
                padding: "6px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                lineHeight: "1.4",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
              }}
            >
              {dev.kind === "timer-on" && sym.variant === "delayed-nc" && t("inspector.hintTonNc")}
              {dev.kind === "timer-on" && sym.variant === "delayed-no" && t("inspector.hintTonNo")}
              {dev.kind === "timer-off" && sym.variant === "delayed-no" && t("inspector.hintTofNo")}
              {dev.kind === "timer-off" && sym.variant === "delayed-nc" && t("inspector.hintTofNc")}
              {sym.variant === "coil" && (
                dev.kind === "timer-on"
                  ? "⏱️ 通電延時線圈：通電後開始延時計時，時間到達後所有延時觸點動作。"
                  : "⏱️ 斷電延時線圈：通電後觸點立即動作；斷電後開始延時計時，時間到達後觸點復位。"
              )}
            </div>
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
          {sym.tagOffset && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: "6px", fontSize: "12px", width: "100%" }}
              onClick={() => useLab.getState().resetSymbolTagOffset(sym.id)}
            >
              {t("inspector.resetTagPosition")}
            </button>
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
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.voltageSetting")} ({dev.params.voltage ?? 480}V)</span>
            </div>
            <div className="inspector-preset-row">
              {[208, 240, 380, 480, 600].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.voltage ?? 480) === v ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, voltage: v } })}
                >
                  {v}V
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="number"
                min="100"
                max="1000"
                step="10"
                style={{ width: "100%" }}
                value={dev.params.voltage ?? 480}
                onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, voltage: Number(e.target.value) || 480 } })}
              />
            </div>
          </div>
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.maxCurrentSetting")} ({dev.params.maxCurrent ?? 400}A)</span>
            </div>
            <div className="inspector-preset-row">
              {[50, 100, 200, 400, 600, 800].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`btn ${(dev.params.maxCurrent ?? 400) === a ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, maxCurrent: a } })}
                >
                  {a}A
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="number"
                min="5"
                max="2000"
                step="5"
                style={{ width: "100%" }}
                value={dev.params.maxCurrent ?? 400}
                onChange={(e) => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, maxCurrent: Number(e.target.value) || 400 } })}
              />
            </div>
          </div>
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
        <div className="inspector-field-group">
          <div className="inspector-field-title">
            <span>{t("inspector.preset")} ({dev.params.preset ?? 5})</span>
            {rt && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    background: rt.done ? "rgba(234, 179, 8, 0.2)" : "rgba(100, 116, 139, 0.15)",
                    color: rt.done ? "#ca8a04" : "var(--text-dim, #64748b)",
                    border: `1px solid ${rt.done ? "#fde047" : "transparent"}`,
                  }}
                >
                  {rt.done ? `✅ ${t("inspector.actuated")}` : `⏳ ${rt.count ?? 0}/${dev.params.preset ?? 5}`}
                </span>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => {
                    const snap = useLab.getState().simSnapshot;
                    if (snap?.runtime[dev.id]) {
                      snap.runtime[dev.id].count = 0;
                      snap.runtime[dev.id].done = false;
                      snap.runtime[dev.id].prevPulse = false;
                    }
                  }}
                  title="Reset Counter"
                >
                  🔄 Reset
                </button>
              </div>
            )}
          </div>
          <div className="inspector-preset-row">
            {[1, 2, 3, 5, 10, 20, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                className={`btn ${(dev.params.preset ?? 5) === v ? "primary" : ""}`}
                onClick={() => useLab.getState().updateDevice(dev.id, { preset: v, params: { ...dev.params, preset: v } })}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="inspector-slider-row">
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={dev.params.preset ?? 5}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                useLab.getState().updateDevice(dev.id, { preset: v, params: { ...dev.params, preset: v } });
              }}
            />
            <input
              type="number"
              min="1"
              max="9999"
              step="1"
              value={dev.params.preset ?? 5}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                useLab.getState().updateDevice(dev.id, { preset: v, params: { ...dev.params, preset: v } });
              }}
            />
          </div>
        </div>
      )}
      {dev.kind === "float" && (
        <>
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.setpoint")} ({dev.params.setpoint ?? 50}%)</span>
            </div>
            <div className="inspector-preset-row">
              {[10, 25, 40, 50, 60, 75, 90].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.setpoint ?? 50) === v ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } })}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={dev.params.setpoint ?? 50}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={dev.params.setpoint ?? 50}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <span style={{ fontSize: "12px", color: "var(--text-dim, #7d8973)" }}>%</span>
            </div>
          </div>

          <div className="inspector-process-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>💧 {t("inspector.currentLevel")}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  background: rt?.actuated ? "rgba(37, 99, 235, 0.15)" : "rgba(100, 116, 139, 0.15)",
                  color: rt?.actuated ? "#2563eb" : "var(--text-dim, #64748b)",
                  border: `1px solid ${rt?.actuated ? "#93c5fd" : "transparent"}`
                }}
              >
                {rt?.actuated ? `💧 ${t("inspector.actuated")}` : `⚪ ${t("inspector.normal")}`} ({process.level}%)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={process.level}
              onChange={(e) => useLab.getState().setProcess({ level: Number(e.target.value) })}
            />
            <div className="inspector-card-actions">
              <button
                type="button"
                className="btn"
                title={`<${dev.params.setpoint ?? 50}%`}
                onClick={() => useLab.getState().setProcess({ level: Math.max(0, (dev.params.setpoint ?? 50) - 10) })}
              >
                ⬇️ &lt;{dev.params.setpoint ?? 50}%
              </button>
              <button
                type="button"
                className="btn primary"
                title={`≥${dev.params.setpoint ?? 50}%`}
                onClick={() => useLab.getState().setProcess({ level: dev.params.setpoint ?? 50 })}
              >
                ⬆️ ≥{dev.params.setpoint ?? 50}%
              </button>
            </div>
          </div>
        </>
      )}
      {(dev.kind === "temp-no" || dev.kind === "temp-nc") && (
        <>
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.setpoint")} ({dev.params.setpoint ?? 140}°F)</span>
            </div>
            <div className="inspector-preset-row">
              {[80, 100, 120, 140, 160, 180, 200].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.setpoint ?? 140) === v ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } })}
                >
                  {v}°F
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="range"
                min="0"
                max="250"
                step="1"
                value={dev.params.setpoint ?? 140}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <input
                type="number"
                min="0"
                max="250"
                step="1"
                value={dev.params.setpoint ?? 140}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(250, Number(e.target.value) || 0));
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <span style={{ fontSize: "12px", color: "var(--text-dim, #7d8973)" }}>°F</span>
            </div>
          </div>

          <div className="inspector-process-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>🌡️ {t("inspector.currentTemperature")}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  background: rt?.actuated ? "rgba(239, 68, 68, 0.15)" : "rgba(100, 116, 139, 0.15)",
                  color: rt?.actuated ? "#dc2626" : "var(--text-dim, #64748b)",
                  border: `1px solid ${rt?.actuated ? "#fca5a5" : "transparent"}`
                }}
              >
                {rt?.actuated ? `🔥 ${t("inspector.actuated")}` : `⚪ ${t("inspector.normal")}`} ({process.temperature}°F)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="1"
              value={process.temperature}
              onChange={(e) => useLab.getState().setProcess({ temperature: Number(e.target.value) })}
            />
            <div className="inspector-card-actions">
              <button
                type="button"
                className="btn"
                title={`<${dev.params.setpoint ?? 140}°F`}
                onClick={() => useLab.getState().setProcess({ temperature: Math.max(0, (dev.params.setpoint ?? 140) - 10) })}
              >
                ❄️ &lt;{dev.params.setpoint ?? 140}°F
              </button>
              <button
                type="button"
                className="btn primary"
                title={`≥${dev.params.setpoint ?? 140}°F`}
                onClick={() => useLab.getState().setProcess({ temperature: dev.params.setpoint ?? 140 })}
              >
                🔥 ≥{dev.params.setpoint ?? 140}°F
              </button>
            </div>
          </div>
        </>
      )}
      {(dev.kind === "pressure-no" || dev.kind === "pressure-nc") && (
        <>
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.setpoint")} ({dev.params.setpoint ?? 4} bar)</span>
            </div>
            <div className="inspector-preset-row">
              {[1, 2, 4, 6, 8, 10, 12].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.setpoint ?? 4) === v ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } })}
                >
                  {v} bar
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="range"
                min="0"
                max="16"
                step="0.1"
                value={dev.params.setpoint ?? 4}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <input
                type="number"
                min="0"
                max="16"
                step="0.1"
                value={dev.params.setpoint ?? 4}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(16, Number(e.target.value) || 0));
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <span style={{ fontSize: "12px", color: "var(--text-dim, #7d8973)" }}>bar</span>
            </div>
          </div>

          <div className="inspector-process-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>💨 {t("inspector.currentPressure")}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  background: rt?.actuated ? "rgba(245, 158, 11, 0.15)" : "rgba(100, 116, 139, 0.15)",
                  color: rt?.actuated ? "#d97706" : "var(--text-dim, #64748b)",
                  border: `1px solid ${rt?.actuated ? "#fde68a" : "transparent"}`
                }}
              >
                {rt?.actuated ? `💨 ${t("inspector.actuated")}` : `⚪ ${t("inspector.normal")}`} ({process.pressure.toFixed(1)} bar)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="16"
              step="0.1"
              value={process.pressure}
              onChange={(e) => useLab.getState().setProcess({ pressure: Number(e.target.value) })}
            />
            <div className="inspector-card-actions">
              <button
                type="button"
                className="btn"
                title={`<${dev.params.setpoint ?? 4} bar`}
                onClick={() => useLab.getState().setProcess({ pressure: Math.max(0, Math.round(((dev.params.setpoint ?? 4) - 1) * 10) / 10) })}
              >
                ⬇️ &lt;{dev.params.setpoint ?? 4} bar
              </button>
              <button
                type="button"
                className="btn primary"
                title={`≥${dev.params.setpoint ?? 4} bar`}
                onClick={() => useLab.getState().setProcess({ pressure: dev.params.setpoint ?? 4 })}
              >
                ⬆️ ≥{dev.params.setpoint ?? 4} bar
              </button>
            </div>
          </div>
        </>
      )}
      {(dev.kind === "flow-no" || dev.kind === "flow-nc") && (
        <>
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.setpoint")} ({dev.params.setpoint ?? 40}%)</span>
            </div>
            <div className="inspector-preset-row">
              {[10, 20, 30, 40, 50, 60, 80].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.setpoint ?? 40) === v ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } })}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={dev.params.setpoint ?? 40}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={dev.params.setpoint ?? 40}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  useLab.getState().updateDevice(dev.id, { setpoint: v, params: { ...dev.params, setpoint: v } });
                }}
              />
              <span style={{ fontSize: "12px", color: "var(--text-dim, #7d8973)" }}>%</span>
            </div>
          </div>

          <div className="inspector-process-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>🌊 {t("inspector.currentFlow")}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  background: rt?.actuated ? "rgba(14, 165, 233, 0.15)" : "rgba(100, 116, 139, 0.15)",
                  color: rt?.actuated ? "#0284c7" : "var(--text-dim, #64748b)",
                  border: `1px solid ${rt?.actuated ? "#7dd3fc" : "transparent"}`
                }}
              >
                {rt?.actuated ? `🌊 ${t("inspector.actuated")}` : `⚪ ${t("inspector.normal")}`} ({process.flow}%)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={process.flow}
              onChange={(e) => useLab.getState().setProcess({ flow: Number(e.target.value) })}
            />
            <div className="inspector-card-actions">
              <button
                type="button"
                className="btn"
                title={`<${dev.params.setpoint ?? 40}%`}
                onClick={() => useLab.getState().setProcess({ flow: Math.max(0, (dev.params.setpoint ?? 40) - 10) })}
              >
                ⬇️ &lt;{dev.params.setpoint ?? 40}%
              </button>
              <button
                type="button"
                className="btn primary"
                title={`≥${dev.params.setpoint ?? 40}%`}
                onClick={() => useLab.getState().setProcess({ flow: dev.params.setpoint ?? 40 })}
              >
                ⬆️ ≥{dev.params.setpoint ?? 40}%
              </button>
            </div>
          </div>
        </>
      )}
      {(dev.kind === "limit-no" || dev.kind === "limit-nc") && (
        <div className="inspector-process-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold" }}>🛑 {t("inspector.sensorState")}</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: "bold",
                background: (rt?.actuated || process.limitHit) ? "rgba(239, 68, 68, 0.15)" : "rgba(100, 116, 139, 0.15)",
                color: (rt?.actuated || process.limitHit) ? "#dc2626" : "var(--text-dim, #64748b)",
                border: `1px solid ${(rt?.actuated || process.limitHit) ? "#fca5a5" : "transparent"}`
              }}
            >
              {(rt?.actuated || process.limitHit) ? `🛑 ${t("inspector.actuated")}` : `⚪ ${t("inspector.normal")}`}
            </span>
          </div>
          <button
            type="button"
            className={`btn ${(rt?.actuated || process.limitHit) ? "primary" : ""}`}
            style={{ width: "100%", fontSize: "11px", padding: "5px 8px", marginTop: "4px" }}
            onClick={() => {
              useLab.getState().toggleIo(dev.id, "actuated");
              useLab.getState().setProcess({ limitHit: !process.limitHit });
            }}
          >
            {(rt?.actuated || process.limitHit) ? `⚪ ${t("inspector.clearLimit")}` : `🛑 ${t("inspector.hitLimit")}`}
          </button>
        </div>
      )}
      {(dev.kind === "prox" || dev.kind === "prox-no" || dev.kind === "prox-nc") && (
        <div className="inspector-process-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold" }}>🧲 {t("inspector.sensorState")}</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: "bold",
                background: process.proxHit ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                color: process.proxHit ? "#059669" : "var(--text-dim, #64748b)",
                border: `1px solid ${process.proxHit ? "#6ee7b7" : "transparent"}`
              }}
            >
              {process.proxHit ? `🧲 ${t("inspector.actuated")}` : `⚪ ${t("inspector.normal")}`}
            </span>
          </div>
          <button
            type="button"
            className={`btn ${process.proxHit ? "primary" : ""}`}
            style={{ width: "100%", fontSize: "11px", padding: "5px 8px", marginTop: "4px" }}
            onClick={() => useLab.getState().setProcess({ proxHit: !process.proxHit })}
          >
            {process.proxHit ? `⚪ ${t("inspector.clearMetal")}` : `🧲 ${t("inspector.detectMetal")}`}
          </button>
        </div>
      )}
      {(dev.kind === "photo" || dev.kind === "photo-no" || dev.kind === "photo-nc") && (
        <div className="inspector-process-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold" }}>💡 {t("inspector.sensorState")}</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: "bold",
                background: process.photoHit ? "rgba(234, 179, 8, 0.15)" : "rgba(100, 116, 139, 0.15)",
                color: process.photoHit ? "#ca8a04" : "var(--text-dim, #64748b)",
                border: `1px solid ${process.photoHit ? "#fde047" : "transparent"}`
              }}
            >
              {process.photoHit ? `💡 ${t("inspector.actuated")}` : `⚪ ${t("inspector.normal")}`}
            </span>
          </div>
          <button
            type="button"
            className={`btn ${process.photoHit ? "primary" : ""}`}
            style={{ width: "100%", fontSize: "11px", padding: "5px 8px", marginTop: "4px" }}
            onClick={() => useLab.getState().setProcess({ photoHit: !process.photoHit })}
          >
            {process.photoHit ? `⚪ ${t("inspector.clearBeam")}` : `💡 ${t("inspector.blockBeam")}`}
          </button>
        </div>
      )}
      {dev.kind === "transformer" && (
        <>
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.primaryVolts")} ({dev.params.primaryVoltage ?? (dev.params.primaryVolts ? Number(dev.params.primaryVolts) : 480)}V)</span>
            </div>
            <div className="inspector-preset-row">
              {[120, 208, 240, 380, 480, 600].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.primaryVoltage ?? (dev.params.primaryVolts ? Number(dev.params.primaryVolts) : 480)) === v ? "primary" : ""}`}
                  onClick={() => {
                    const sec = dev.params.secondaryVoltage ?? (dev.params.secondaryVolts ? Number(dev.params.secondaryVolts) : 120);
                    useLab.getState().updateDevice(dev.id, {
                      params: {
                        ...dev.params,
                        primaryVoltage: v,
                        primaryVolts: String(v),
                        ratio: `${v}/${sec}`,
                      },
                    });
                  }}
                >
                  {v}V
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="number"
                min="10"
                max="10000"
                step="10"
                style={{ width: "100%" }}
                value={dev.params.primaryVoltage ?? (dev.params.primaryVolts ? Number(dev.params.primaryVolts) : 480)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const v = !isNaN(val) && val > 0 ? val : 480;
                  const sec = dev.params.secondaryVoltage ?? (dev.params.secondaryVolts ? Number(dev.params.secondaryVolts) : 120);
                  useLab.getState().updateDevice(dev.id, {
                    params: {
                      ...dev.params,
                      primaryVoltage: v,
                      primaryVolts: String(v),
                      ratio: `${v}/${sec}`,
                    },
                  });
                }}
              />
            </div>
          </div>
          <div className="inspector-field-group">
            <div className="inspector-field-title">
              <span>{t("inspector.secondaryVolts")} ({dev.params.secondaryVoltage ?? (dev.params.secondaryVolts ? Number(dev.params.secondaryVolts) : 120)}V)</span>
            </div>
            <div className="inspector-preset-row">
              {[12, 24, 48, 120, 208, 220, 240].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${(dev.params.secondaryVoltage ?? (dev.params.secondaryVolts ? Number(dev.params.secondaryVolts) : 120)) === v ? "primary" : ""}`}
                  onClick={() => {
                    const pri = dev.params.primaryVoltage ?? (dev.params.primaryVolts ? Number(dev.params.primaryVolts) : 480);
                    useLab.getState().updateDevice(dev.id, {
                      params: {
                        ...dev.params,
                        secondaryVoltage: v,
                        secondaryVolts: String(v),
                        ratio: `${pri}/${v}`,
                      },
                    });
                  }}
                >
                  {v}V
                </button>
              ))}
            </div>
            <div className="inspector-slider-row">
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                style={{ width: "100%" }}
                value={dev.params.secondaryVoltage ?? (dev.params.secondaryVolts ? Number(dev.params.secondaryVolts) : 120)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const v = !isNaN(val) && val > 0 ? val : 120;
                  const pri = dev.params.primaryVoltage ?? (dev.params.primaryVolts ? Number(dev.params.primaryVolts) : 480);
                  useLab.getState().updateDevice(dev.id, {
                    params: {
                      ...dev.params,
                      secondaryVoltage: v,
                      secondaryVolts: String(v),
                      ratio: `${pri}/${v}`,
                    },
                  });
                }}
              />
            </div>
          </div>
        </>
      )}
      {(dev.kind === "motor-3ph" ||
        dev.kind === "motor-1ph" ||
        dev.kind === "motor-dc" ||
        dev.kind === "starter-dol" ||
        dev.kind === "starter-fwd" ||
        dev.kind === "starter-rev" ||
        dev.kind === "starter-rev-combo") && (
        <div className="inspector-field-group">
          <div className="inspector-field-title">
            <span>
              {t("inspector.motorPower")} ({dev.params.power ?? (dev.kind === "motor-1ph" ? 1.5 : dev.kind === "motor-dc" ? 0.75 : 5.5)} kW / {((dev.params.power ?? (dev.kind === "motor-1ph" ? 1.5 : dev.kind === "motor-dc" ? 0.75 : 5.5)) * 1.341).toFixed(1)} HP)
            </span>
          </div>
          <div className="inspector-preset-row">
            {dev.kind === "motor-1ph" ? (
              [0.37, 0.75, 1.1, 1.5, 2.2, 3.0].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className={`btn ${(dev.params.power ?? 1.5) === kw ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, power: kw } })}
                >
                  {kw}kW
                </button>
              ))
            ) : dev.kind === "motor-dc" ? (
              [0.37, 0.75, 1.5, 2.2, 3.7, 5.5].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className={`btn ${(dev.params.power ?? 0.75) === kw ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, power: kw } })}
                >
                  {kw}kW
                </button>
              ))
            ) : (
              [0.75, 1.5, 2.2, 3.7, 5.5, 7.5, 11, 15, 22, 30].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className={`btn ${(dev.params.power ?? 5.5) === kw ? "primary" : ""}`}
                  onClick={() => useLab.getState().updateDevice(dev.id, { params: { ...dev.params, power: kw } })}
                >
                  {kw}kW
                </button>
              ))
            )}
          </div>
          <div className="inspector-slider-row">
            <input
              type="number"
              min="0.1"
              max="1000"
              step="0.1"
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
        </div>
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
      {dev.kind !== "comment" && dev.kind !== "title-block" && (
        <div style={{ margin: "8px 0" }}>
          <button
            type="button"
            className="btn"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            onClick={() => useLab.getState().addCommentForSymbol(sym.id)}
          >
            💬 {t("inspector.addComment")}
          </button>
          {(() => {
            const boundComments = circuit.devices.filter(
              (d) => d.kind === "comment" && d.params?.targetDeviceId === dev.id
            );
            if (!boundComments.length) return null;
            return (
              <div style={{ marginTop: "6px" }}>
                <span className="hint" style={{ fontSize: "11px", fontWeight: "bold" }}>
                  {t("inspector.boundComments")}:
                </span>
                {boundComments.map((cd) => {
                  const csym = circuit.symbols.find((s) => s.deviceId === cd.id);
                  return (
                    <div key={cd.id} style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                      <span style={{ fontSize: "11px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📝 {cd.params?.text || cd.tag}
                      </span>
                      {csym && (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "2px 6px", fontSize: "10px" }}
                          onClick={() => useLab.getState().select({ type: "symbol", id: csym.id })}
                        >
                          {t("inspector.jumpTo")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
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
