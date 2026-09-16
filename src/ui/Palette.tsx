import { useMemo, useState } from "react";
import { CATALOG, GROUPS } from "../catalog";
import { catalogCompKey, t, tOr } from "../i18n";
import { useLab } from "../store";
import type { CatalogItem, CatalogSubgroup } from "../types";

export interface PaletteProps {
  className?: string;
  onClose?: () => void;
}

interface ProcessedSubgroup extends CatalogSubgroup {
  totalCount: number;
  items: CatalogItem[];
}

interface ProcessedGroup {
  id: string;
  label: string;
  labelEn: string;
  totalCount: number;
  matchingCount: number;
  subgroups: ProcessedSubgroup[];
}

export function Palette({ className = "", onClose }: PaletteProps) {
  const placing = useLab((s) => s.placing);
  const lang = useLab((s) => s.lang);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Record<string, boolean>>({});

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      useLab.getState().setPaletteOpen(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleSubgroup = (subgroupId: string) => {
    setCollapsedSubgroups((prev) => ({
      ...prev,
      [subgroupId]: !prev[subgroupId],
    }));
  };

  const allCollapsed = useMemo(() => {
    return GROUPS.every((g) => collapsedGroups[g.id]);
  }, [collapsedGroups]);

  const toggleExpandAll = () => {
    if (allCollapsed) {
      setCollapsedGroups({});
      setCollapsedSubgroups({});
    } else {
      const nextGroupCollapsed: Record<string, boolean> = {};
      const nextSubCollapsed: Record<string, boolean> = {};
      for (const g of GROUPS) {
        nextGroupCollapsed[g.id] = true;
        if (g.subgroups) {
          for (const sub of g.subgroups) {
            nextSubCollapsed[sub.id] = true;
          }
        }
      }
      setCollapsedGroups(nextGroupCollapsed);
      setCollapsedSubgroups(nextSubCollapsed);
    }
  };

  // Filter items based on search query and category
  const q = searchQuery.trim().toLowerCase();

  const groupData = useMemo<ProcessedGroup[]>(() => {
    return GROUPS.map((g) => {
      const groupNameEn = g.id.replace(/_/g, " ");
      const groupItems = CATALOG.filter(
        (c) => c.group === g.label || c.group === g.labelEn || c.group === groupNameEn,
      );

      const rawSubgroups: readonly CatalogSubgroup[] =
        g.subgroups || [{ id: g.id, groupId: g.id, label: g.label, labelEn: g.labelEn }];

      // Subgroup partitions
      const subgroups: ProcessedSubgroup[] = rawSubgroups.map((sub: CatalogSubgroup) => {
        const subItems = groupItems.filter((c: CatalogItem) => {
          if (c.subgroupId) return c.subgroupId === sub.id;
          return true;
        });

        // Search match on subItems
        const matchingItems = subItems.filter((c: CatalogItem) => {
          if (!q) return true;
          const nameZh = tOr(catalogCompKey(c.id), c.label).toLowerCase();
          const nameEn = (c.labelEn || "").toLowerCase();
          const prefix = (c.prefix || "").toLowerCase();
          const id = c.id.toLowerCase();
          const subNameZh = sub.label.toLowerCase();
          const subNameEn = sub.labelEn.toLowerCase();
          const gNameZh = g.label.toLowerCase();
          const gNameEn = g.labelEn.toLowerCase();
          return (
            nameZh.includes(q) ||
            nameEn.includes(q) ||
            prefix.includes(q) ||
            id.includes(q) ||
            subNameZh.includes(q) ||
            subNameEn.includes(q) ||
            gNameZh.includes(q) ||
            gNameEn.includes(q)
          );
        });

        return {
          ...sub,
          totalCount: subItems.length,
          items: matchingItems,
        };
      });

      const matchingSubgroups = subgroups.filter((s: ProcessedSubgroup) => s.items.length > 0);
      const totalMatchingCount = matchingSubgroups.reduce(
        (acc: number, s: ProcessedSubgroup) => acc + s.items.length,
        0,
      );

      return {
        id: g.id,
        label: g.label,
        labelEn: g.labelEn,
        totalCount: groupItems.length,
        matchingCount: totalMatchingCount,
        subgroups: matchingSubgroups,
      };
    }).filter((g) => {
      if (selectedCategory && g.id !== selectedCategory) return false;
      return g.matchingCount > 0;
    });
  }, [q, selectedCategory]);

  const totalFound = useMemo(() => {
    return groupData.reduce((acc, g) => acc + g.matchingCount, 0);
  }, [groupData]);

  return (
    <aside className={`palette ${className}`.trim()}>
      <div className="palette-header">
        <span className="palette-title">{t("toolbar.palette")}</span>
        <button
          type="button"
          className="panel-close-btn"
          onClick={handleClose}
          title={t("toolbar.collapseLeft")}
          aria-label={t("toolbar.collapseLeft")}
        >
          ✕
        </button>
      </div>

      {/* Search Input Box */}
      <div className="palette-search-wrap">
        <div className="palette-search-box">
          <span className="palette-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="palette-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("lib.searchPlaceholder")}
            aria-label={t("lib.searchPlaceholder")}
          />
          {searchQuery && (
            <button
              type="button"
              className="palette-search-clear"
              onClick={() => setSearchQuery("")}
              title={t("lib.clearSearch")}
              aria-label={t("lib.clearSearch")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Filter Bar */}
      <div className="palette-category-pills">
        <button
          type="button"
          className={`category-pill ${selectedCategory === null ? "active" : ""}`}
          onClick={() => setSelectedCategory(null)}
        >
          {t("lib.allCategories")}
        </button>
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`category-pill ${selectedCategory === g.id ? "active" : ""}`}
            onClick={() => setSelectedCategory(selectedCategory === g.id ? null : g.id)}
            title={lang === "en" ? g.labelEn : g.label}
          >
            {tOr(`lib.group.${g.id}`, lang === "en" ? g.labelEn : g.label)}
          </button>
        ))}
      </div>

      {/* Toolbar / Actions */}
      <div className="palette-toolbar-row">
        <button
          type="button"
          className="palette-toggle-all-btn"
          onClick={toggleExpandAll}
        >
          {allCollapsed ? `▸ ${t("lib.expandAll")}` : `▾ ${t("lib.collapseAll")}`}
        </button>
        {q && (
          <span className="palette-search-count">
            {totalFound} {lang === "en" ? "results" : "項相符"}
          </span>
        )}
      </div>

      {/* Component Tree */}
      <div className="palette-content-tree">
        {groupData.length === 0 ? (
          <div className="palette-empty-state">
            <p>{t("lib.noMatches")}</p>
            {q && (
              <button
                type="button"
                className="palette-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                {t("lib.clearSearch")}
              </button>
            )}
          </div>
        ) : (
          groupData.map((g) => {
            const isGroupCollapsed = !q && Boolean(collapsedGroups[g.id]);
            const hasMultipleSubgroups = g.subgroups.length > 1;

            return (
              <div className={`palette-group-card ${isGroupCollapsed ? "collapsed" : ""}`} key={g.id}>
                {/* Level 1 Group Header */}
                <button
                  type="button"
                  className="palette-group-header"
                  onClick={() => toggleGroup(g.id)}
                  aria-expanded={!isGroupCollapsed}
                >
                  <span className="palette-group-chevron">{isGroupCollapsed ? "▸" : "▾"}</span>
                  <span className="palette-group-title">
                    {tOr(`lib.group.${g.id}`, lang === "en" ? g.labelEn : g.label)}
                  </span>
                  <span className="palette-count-badge">
                    {g.matchingCount}
                  </span>
                </button>

                {/* Group Content */}
                {!isGroupCollapsed && (
                  <div className="palette-group-body">
                    {g.subgroups.map((sub) => {
                      const isSubCollapsed = !q && Boolean(collapsedSubgroups[sub.id]);

                      return (
                        <div
                          className={`palette-subgroup-card ${isSubCollapsed ? "collapsed" : ""} ${!hasMultipleSubgroups ? "single-subgroup" : ""}`}
                          key={sub.id}
                        >
                          {/* Level 2 Subgroup Header (shown when group has multiple subgroups) */}
                          {hasMultipleSubgroups && (
                            <button
                              type="button"
                              className="palette-subgroup-header"
                              onClick={() => toggleSubgroup(sub.id)}
                              aria-expanded={!isSubCollapsed}
                            >
                              <span className="palette-subgroup-chevron">{isSubCollapsed ? "▸" : "▾"}</span>
                              <span className="palette-subgroup-title">
                                {tOr(`lib.subgroup.${sub.id}`, lang === "en" ? sub.labelEn : sub.label)}
                              </span>
                              <span className="palette-subgroup-count">
                                {sub.items.length}
                              </span>
                            </button>
                          )}

                          {/* Subgroup Items */}
                          {(!hasMultipleSubgroups || !isSubCollapsed) && (
                            <div className="palette-items-grid">
                              {sub.items.map((c) => {
                                const isSelected = placing === c.id;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className={`cat-item ${isSelected ? "selected" : ""}`}
                                    onClick={() => useLab.getState().setPlacing(isSelected ? null : c.id)}
                                    title={`${c.labelEn} (${c.prefix})`}
                                  >
                                    <span className="cat-item-main">
                                      <span className="cat-item-label">
                                        {tOr(catalogCompKey(c.id), lang === "en" ? c.labelEn : c.label)}
                                      </span>
                                    </span>
                                    <small className="cat-item-sub">{c.labelEn}</small>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="hint palette-footer-hint">{t("lib.paletteHint")}</p>
    </aside>
  );
}
