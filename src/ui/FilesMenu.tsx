import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { listSaves } from "../persist";
import { useLab } from "../store";

export function FilesMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const tick = useLab((s) => s.savesTick);
  const docName = useLab((s) => s.docName);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  void tick;
  const saves = listSaves();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <details ref={menuRef} className="menu files-menu" open={isOpen}>
      <summary
        className="btn"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }}
      >
        {t("files.menuLabel") || "File"}
      </summary>
      <div className="menu-pop">
        <label className="menu-name">
          {t("files.docName")}
          <input
            value={docName}
            onChange={(e) => useLab.getState().setDocName(e.target.value)}
          />
        </label>
        <button className="btn" onClick={() => handleAction(() => useLab.getState().saveToLibrary())}>
          {t("files.saveToLibrary")}
        </button>
        <button className="btn" onClick={() => handleAction(() => useLab.getState().exportFile())}>
          {t("files.exportJson")}
        </button>
        <button className="btn" onClick={() => {
          inputRef.current?.click();
          setIsOpen(false);
        }}>
          {t("files.openFile")}
        </button>
        <button className="btn" onClick={() => handleAction(() => useLab.getState().openPrint())}>
          {t("files.print") || "Print..."}
        </button>
        <button className="btn ok" onClick={() => handleAction(() => void useLab.getState().copyShareLink())}>
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
                <button className="cat-item" onClick={() => handleAction(() => useLab.getState().loadSave(s.id))}>
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
