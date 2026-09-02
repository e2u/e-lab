/**
 * Compile-time Feature Flags (編譯開關)
 *
 * 1. ENABLE_LADDER: 控制是否開啟梯圖入口 (預設: false / 隱藏)
 * 2. ENABLE_AUTO_LAYOUT: 控制是否開啟自動佈局按鈕 (預設: false / 隱藏)
 *
 * 編譯或構建時可透過以下方式開啟：
 * - 環境變數: VITE_ENABLE_LADDER=true / VITE_ENABLE_AUTO_LAYOUT=true
 * - 或: ENABLE_LADDER=true / ENABLE_AUTO_LAYOUT=true
 * - Vite 編譯參數 define: __ENABLE_LADDER__: true, __ENABLE_AUTO_LAYOUT__: true
 */

declare const __ENABLE_LADDER__: boolean | undefined;
declare const __ENABLE_AUTO_LAYOUT__: boolean | undefined;

export const ENABLE_LADDER: boolean =
  (typeof __ENABLE_LADDER__ !== "undefined" && Boolean(__ENABLE_LADDER__)) ||
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_ENABLE_LADDER === "true" || import.meta.env?.ENABLE_LADDER === "true"));

export const ENABLE_AUTO_LAYOUT: boolean =
  (typeof __ENABLE_AUTO_LAYOUT__ !== "undefined" && Boolean(__ENABLE_AUTO_LAYOUT__)) ||
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_ENABLE_AUTO_LAYOUT === "true" || import.meta.env?.ENABLE_AUTO_LAYOUT === "true"));
