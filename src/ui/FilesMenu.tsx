import { useRef } from "react";
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
      <summary className="btn">檔案</summary>
      <div className="menu-pop">
        <label className="menu-name">
          圖名
          <input
            value={docName}
            onChange={(e) => useLab.getState().setDocName(e.target.value)}
          />
        </label>
        <button className="btn" onClick={() => useLab.getState().saveToLibrary()}>
          存到本機圖庫
        </button>
        <button className="btn" onClick={() => useLab.getState().exportFile()}>
          匯出 JSON
        </button>
        <button className="btn" onClick={() => inputRef.current?.click()}>
          開啟檔案
        </button>
        <button className="btn ok" onClick={() => void useLab.getState().copyShareLink()}>
          複製分享連結
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
                useLab.getState().setNotice("無法讀取檔案");
              }
            });
          }}
        />
        {saves.length > 0 && (
          <>
            <div className="menu-label">本機圖庫</div>
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
