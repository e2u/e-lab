import { t } from "../i18n";
import { useLab } from "../store";

interface DiscardModalProps {
  isOpen: boolean;
  onClose: (saveAndContinue?: boolean) => void;
}

export function DiscardModal({ isOpen, onClose }: DiscardModalProps) {
  if (!isOpen) return null;

  const handleSaveAndContinue = () => {
    // Export current circuit as JSON first
    useLab.getState().exportFile();
    // Then continue with the action
    onClose(true);
  };

  const handleDiscard = () => {
    onClose(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{t("msg.confirmDiscardTitle") || "Unsaved Changes"}</h3>
        <p>{t("msg.confirmDiscardMessage") || "You have unsaved changes. What would you like to do?"}</p>
        <div className="modal-actions">
          <button className="btn ok" onClick={handleSaveAndContinue}>
            {t("msg.saveAndContinue") || "Save & Continue"}
          </button>
          <button className="btn danger" onClick={handleDiscard}>
            {t("msg.discardChanges") || "Discard Changes"}
          </button>
          <button className="btn" onClick={() => onClose(undefined)}>
            {t("msg.cancel") || "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
