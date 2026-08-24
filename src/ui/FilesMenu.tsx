import { useRef } from "react";
import { t } from "../i18n";
import { listSaves } from "../persist";
import { useLab } from "../store";

export function FilesMenu() {
  const tick = useLab((s) => s.savesTick);
  const docName = useLab((s) => s.docName);
  const inputRef = useRef<HTMLInputElement>(null);
  void tick;
  const saves = listSaves();

  return (
    <details className="menu">
      <summary className="btn">{t("files.menuLabel") || "File"}</summary>
      <div className="menu-pop">
        <label className="menu-name">
          {t("files.docName")}
          <input
            value={docName}
            onChange={(e) => useLab.getState().setDocName(e.target.value)}
          />
        </label>
        <button className="btn" onClick={() => useLab.getState().saveToLibrary()}>
          {t("files.saveToLibrary")}
        </button>
        <button className="btn" onClick={() => useLab.getState().exportFile()}>
          {t("files.exportJson")}
        </button>
        <button className="btn" onClick={() => inputRef.current?.click()}>
          {t("files.openFile")}
        </button>
        <button className="btn ok" onClick={() => void useLab.getState().copyShareLink()}>
          {t("files.copyShareLink")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void file.text().then((text) => {
              try {
                useLab.getState().importDoc(JSON.parse(text));
              } catch {
                useLab.getState().setNotice(t("files.unableToRead"));
              }
            });
          }}
        />
        {saves.length > 0 && (
          <>
            <div className="menu-label">{t("files.localLibrary")}</div>
            {saves.map((s) => (
              <div className="save-row" key={s.id}>
                <button className="cat-item" onClick={() => useLab.getState().loadSave(s.id)}>
                  <span>{s.name}</span>
                  <small>{new Date(s.savedAt).toLocaleString()}</small>
                </button>
                <button className="btn danger" onClick={() => useLab.getState().deleteSave(s.id)}>
                  ×
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
