import { useState } from "react";
import type { Circuit, DeviceKind } from "../types";
import { t } from "../i18n";

export type PickerActionType = "add-rung" | "insert-contact" | "add-parallel" | "insert-coil";

interface LadderItemPickerModalProps {
  isOpen: boolean;
  actionType: PickerActionType;
  circuit: Circuit;
  targetSymbolId?: string;
  onClose: () => void;
  onSubmit: (data: {
    contact?: {
      existingDeviceId?: string;
      kind?: DeviceKind;
      variant?: string;
      tag?: string;
    };
    coil?: {
      existingDeviceId?: string;
      kind?: DeviceKind;
      tag?: string;
      color?: string;
      delay?: number;
    };
  }) => void;
}

export function LadderItemPickerModal({
  isOpen,
  actionType,
  circuit,
  onClose,
  onSubmit,
}: LadderItemPickerModalProps) {
  if (!isOpen) return null;

  const [contactMode, setContactMode] = useState<"new" | "existing">("new");
  const [selectedContactDevId, setSelectedContactDevId] = useState<string>("");
  const [selectedContactVariant, setSelectedContactVariant] = useState<string>("aux-no");
  const [newContactKind, setNewContactKind] = useState<DeviceKind>("pb-no");

  const [coilMode, setCoilMode] = useState<"new" | "existing">("new");
  const [selectedCoilDevId, setSelectedCoilDevId] = useState<string>("");
  const [newCoilKind, setNewCoilKind] = useState<DeviceKind>("lamp");
  const [newCoilColor, setNewCoilColor] = useState<string>("green");
  const [newCoilDelay, setNewCoilDelay] = useState<number>(5);

  // Existing devices eligible for auxiliary contacts
  const contactEligibleDevices = circuit.devices.filter(
    (d) =>
      d.kind === "contactor" ||
      d.kind === "relay" ||
      d.kind === "timer-on" ||
      d.kind === "timer-off" ||
      d.kind === "overload"
  );

  // Existing devices eligible for coils
  const coilEligibleDevices = circuit.devices.filter(
    (d) =>
      d.kind === "contactor" ||
      d.kind === "relay" ||
      d.kind === "timer-on" ||
      d.kind === "timer-off" ||
      d.kind === "lamp"
  );

  const handleConfirm = () => {
    if (actionType === "add-rung") {
      const contactData =
        contactMode === "existing" && selectedContactDevId
          ? { existingDeviceId: selectedContactDevId, variant: selectedContactVariant }
          : { kind: newContactKind };

      const coilData =
        coilMode === "existing" && selectedCoilDevId
          ? { existingDeviceId: selectedCoilDevId }
          : { kind: newCoilKind, color: newCoilColor, delay: newCoilDelay };

      onSubmit({ contact: contactData, coil: coilData });
    } else if (actionType === "insert-contact" || actionType === "add-parallel") {
      const contactData =
        contactMode === "existing" && selectedContactDevId
          ? { existingDeviceId: selectedContactDevId, variant: selectedContactVariant }
          : { kind: newContactKind };
      onSubmit({ contact: contactData });
    } else if (actionType === "insert-coil") {
      const coilData =
        coilMode === "existing" && selectedCoilDevId
          ? { existingDeviceId: selectedCoilDevId }
          : { kind: newCoilKind, color: newCoilColor, delay: newCoilDelay };
      onSubmit({ coil: coilData });
    }
    onClose();
  };

  const isAddingRung = actionType === "add-rung";
  const isContactAction = actionType === "insert-contact" || actionType === "add-parallel";
  const isCoilAction = actionType === "insert-coil";

  const modalTitle =
    actionType === "add-rung"
      ? t("ladder.picker.addRungTitle")
      : actionType === "add-parallel"
      ? t("ladder.picker.addParallelTitle")
      : actionType === "insert-contact"
      ? t("ladder.picker.insertContactTitle")
      : t("ladder.picker.insertCoilTitle");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card ladder-picker-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "520px", maxWidth: "95vw" }}
      >
        <div className="modal-header">
          <h3>{modalTitle}</h3>
          <button type="button" className="panel-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Contact Section */}
          {(isAddingRung || isContactAction) && (
            <div className="picker-section">
              <div className="picker-section-title">
                {t("ladder.picker.inputSection")}
              </div>
              <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="contactMode"
                    checked={contactMode === "new"}
                    onChange={() => setContactMode("new")}
                  />
                  <span>{t("ladder.picker.newContact")}</span>
                </label>
                {contactEligibleDevices.length > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="contactMode"
                      checked={contactMode === "existing"}
                      onChange={() => {
                        setContactMode("existing");
                        if (!selectedContactDevId && contactEligibleDevices.length > 0) {
                          setSelectedContactDevId(contactEligibleDevices[0].id);
                        }
                      }}
                    />
                    <span>{t("ladder.picker.existingContact")}</span>
                  </label>
                )}
              </div>

              {contactMode === "new" ? (
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    {t("ladder.picker.contactKind")}
                  </label>
                  <select
                    value={newContactKind}
                    onChange={(e) => setNewContactKind(e.target.value as DeviceKind)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px" }}
                  >
                    <option value="pb-no">{t("ladder.opt.pbNo")}</option>
                    <option value="pb-nc">{t("ladder.opt.pbNc")}</option>
                    <option value="estop">{t("ladder.opt.estop")}</option>
                    <option value="toggle">{t("ladder.opt.toggle")}</option>
                    <option value="limit-no">{t("ladder.opt.limitNo")}</option>
                    <option value="limit-nc">{t("ladder.opt.limitNc")}</option>
                    <option value="temp-no">{t("ladder.opt.tempNo")}</option>
                    <option value="pressure-no">{t("ladder.opt.pressureNo")}</option>
                    <option value="float">{t("ladder.opt.float")}</option>
                    <option value="prox">{t("ladder.opt.prox")}</option>
                    <option value="photo">{t("ladder.opt.photo")}</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      {t("ladder.picker.selectDevice")}
                    </label>
                    <select
                      value={selectedContactDevId}
                      onChange={(e) => setSelectedContactDevId(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px" }}
                    >
                      {contactEligibleDevices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.tag} ({d.kind})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: "140px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      {t("ladder.picker.contactVariant")}
                    </label>
                    <select
                      value={selectedContactVariant}
                      onChange={(e) => setSelectedContactVariant(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px" }}
                    >
                      <option value="aux-no">{t("ladder.picker.auxNo")}</option>
                      <option value="aux-nc">{t("ladder.picker.auxNc")}</option>
                      <option value="overload-trip">{t("ladder.picker.overloadTrip")}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Coil Section */}
          {(isAddingRung || isCoilAction) && (
            <div className="picker-section">
              <div className="picker-section-title">
                {t("ladder.picker.outputSection")}
              </div>
              <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="coilMode"
                    checked={coilMode === "new"}
                    onChange={() => setCoilMode("new")}
                  />
                  <span>{t("ladder.picker.newCoil")}</span>
                </label>
                {coilEligibleDevices.length > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="coilMode"
                      checked={coilMode === "existing"}
                      onChange={() => {
                        setCoilMode("existing");
                        if (!selectedCoilDevId && coilEligibleDevices.length > 0) {
                          setSelectedCoilDevId(coilEligibleDevices[0].id);
                        }
                      }}
                    />
                    <span>{t("ladder.picker.existingCoil")}</span>
                  </label>
                )}
              </div>

              {coilMode === "new" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      {t("ladder.picker.coilKind")}
                    </label>
                    <select
                      value={newCoilKind}
                      onChange={(e) => setNewCoilKind(e.target.value as DeviceKind)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px" }}
                    >
                      <option value="lamp">{t("ladder.opt.lamp")}</option>
                      <option value="contactor">{t("ladder.opt.contactor")}</option>
                      <option value="relay">{t("ladder.opt.relay")}</option>
                      <option value="timer-on">{t("ladder.opt.timerOn")}</option>
                      <option value="timer-off">{t("ladder.opt.timerOff")}</option>
                      <option value="solenoid">{t("ladder.opt.solenoid")}</option>
                      <option value="heater">{t("ladder.opt.heater")}</option>
                      <option value="alarm">{t("ladder.opt.alarm")}</option>
                    </select>
                  </div>

                  {newCoilKind === "lamp" && (
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                        {t("ladder.picker.lampColor")}
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {[
                          { id: "green", labelKey: "ladder.color.green", bg: "#10b981" },
                          { id: "red", labelKey: "ladder.color.red", bg: "#ef4444" },
                          { id: "yellow", labelKey: "ladder.color.yellow", bg: "#eab308" },
                          { id: "blue", labelKey: "ladder.color.blue", bg: "#3b82f6" },
                          { id: "white", labelKey: "ladder.color.white", bg: "#f8fafc" },
                          { id: "amber", labelKey: "ladder.color.amber", bg: "#f59e0b" },
                        ].map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => setNewCoilColor(c.id)}
                            style={{
                              flex: 1,
                              padding: "4px",
                              fontSize: "11px",
                              fontWeight: 700,
                              borderRadius: "4px",
                              border: newCoilColor === c.id ? "2px solid #000" : "1px solid #cbd5e1",
                              background: c.bg,
                              color: c.id === "white" || c.id === "yellow" ? "#000" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            {t(c.labelKey).split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(newCoilKind === "timer-on" || newCoilKind === "timer-off") && (
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                        {t("ladder.picker.presetDelay")} {newCoilDelay}s
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={newCoilDelay}
                        onChange={(e) => setNewCoilDelay(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    {t("ladder.picker.selectCoilDevice")}
                  </label>
                  <select
                    value={selectedCoilDevId}
                    onChange={(e) => setSelectedCoilDevId(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px" }}
                  >
                    {coilEligibleDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.tag} ({d.kind})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button type="button" className="btn" onClick={onClose}>
            {t("ladder.picker.cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            {t("ladder.picker.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
