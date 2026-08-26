import { CATALOG, GROUPS } from "../catalog";
import { catalogCompKey, t, tOr } from "../i18n";
import { useLab } from "../store";

export function Palette() {
  const placing = useLab((s) => s.placing);
  const lang = useLab((s) => s.lang);
  return (
    <aside className="palette">
      <div className="palette-header">
        <span className="palette-title">{t("toolbar.palette")}</span>
        <button
          type="button"
          className="panel-close-btn"
          onClick={() => useLab.getState().setPaletteOpen(false)}
          title={t("toolbar.collapseLeft")}
          aria-label={t("toolbar.collapseLeft")}
        >
          ✕
        </button>
      </div>
      <p className="hint">{t("lib.paletteHint")}</p>
      {GROUPS.map((g) => {
        // Use the English label for filtering since CATALOG uses English group names
        const groupNameEn = g.id.replace(/_/g, " ");
        const items = CATALOG.filter((c) => c.group === g.label || c.group === g.labelEn || c.group === groupNameEn);
        if (!items.length) return null;
        return (
          <div className="group" key={g.id}>
            <h3>{tOr(`lib.group.${g.id}`, lang === "en" ? g.labelEn : g.label)}</h3>
            {items.map((c) => (
              <button
                key={c.id}
                className={`cat-item ${placing === c.id ? "selected" : ""}`}
                onClick={() => useLab.getState().setPlacing(placing === c.id ? null : c.id)}
              >
                <span>{tOr(catalogCompKey(c.id), lang === "en" ? c.labelEn : c.label)}</span>
                <small>{c.labelEn}</small>
              </button>
            ))}
          </div>
        );
      })}
    </aside>
  );
}
