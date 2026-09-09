# e-lab

<p align="center">
  <strong>Web-based Electrical & Industrial Automation Schematic Simulator</strong><br>
  <strong>基於 Web 的電子電氣與工控控制電路模擬實驗室</strong>
</p>

<p align="center">
  <a href="https://e2u.github.io/e-lab/">
    <img src="https://img.shields.io/badge/GitHub_Pages-deployed-brightgreen" alt="GitHub Pages">
  </a>
  <img src="https://img.shields.io/badge/React-19-blue" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue" alt="TypeScript 5.9">
  <img src="https://img.shields.io/badge/Vite-7-purple" alt="Vite 7">
  <img src="https://img.shields.io/badge/Deno-2.x-black" alt="Deno 2">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## 📖 Introduction / 簡介

### English
**e-lab** is an interactive, browser-based electrical and industrial automation circuit simulation laboratory. Place components, route orthogonal wires, switch among **Edit**, **Wiring**, and **Run**, number wires by electrical net, annotate the sheet, and simulate industrial control circuits in the browser—including 3-phase supplies, control transformers, contactors, relays, timers, push buttons, sensors, overload protection, motors, and meters.

### 中文
**e-lab** 是一個基於 Web 的電子電氣與工控電路模擬實驗室。使用者可以在瀏覽器中放置電氣元件、繪製正交接線，在**編輯 / 配線 / 運行**模式之間切換，按電氣網絡自動編號導線、加上圖紙備註，並即時模擬三相電源、控制變壓器、接觸器、中間繼電器、時間繼電器、按鈕開關、感測器、熱過載保護、馬達動力迴路與測量儀表等工控電路。

---

## ✨ Key Features / 核心特性

- **⚡ Real-time Electrical Simulation / 即時電氣仿真**
  - Graph/Union-Find electrical node solver for real-time live potential, interlock, self-holding, and dynamic state evaluation.
  - 基於並查集與拓撲圖的電氣節點求解器，即時計算電位分佈、自鎖、互鎖與設備動態狀態。
  - Supports 3-phase Wye (Y) and Delta (Δ) power supplies, multi-PE grounding, and short-circuit strobe warnings.
  - 支援三相 Y 形與 Δ 形電源切換、多點 PE 接地共存與短路頻閃警報。
  - Each auxiliary / timer contact pole is electrically independent, so parallel copies of the same device contact do not short.
  - 同一裝置的輔助／延時觸點按符號獨立成極，並聯多份相同觸點不會誤判短路。

- **✏️ Edit, Wiring & Run / 編輯、配線與運行**
  - Edit mode moves, rotates, and groups symbols without creating wires; Wiring mode draws wires and junction points; Run mode simulates the live circuit.
  - 編輯模式負責拖曳、旋轉與編組（不拉線）；配線模式拉線與增刪連接點；運行模式即時仿真。

- **🔢 Connectivity-Based Wire Numbers / 按電氣網絡編號導線**
  - Union-Find groups electrically connected wires so one net shares one number; auto-label skips reserved tags (transformer X1/X2 or DC ± as 1/2; L1/L2/L3/N as 90–93).
  - 以並查集把電氣相連的導線編成同一線號；自動編號會保留變壓器 X1/X2 或直流正負為 1/2，以及 L1/L2/L3/N 為 90–93。
  - Labels sit in an empty circle on the longest segment of the net, can be dragged along the path, and refuse duplicate numbers on other nets.
  - 線號圓圈顯示在該網絡最長線段上，可沿路徑拖曳；手動改號會檢查其他網絡是否衝突。

- **📐 Smart Orthogonal Wire Routing / 智能正交佈線**
  - Channel-aware orthogonal routing with automatic parallel lane allocation to prevent overlapping wires and crossovers.
  - 通道感知正交佈線與平行軌道自動分配，徹底避免導線重疊與交錯穿透。
  - Full color-coding standards support (US NEC & IEC standards: L1/L2/L3, Neutral, PE, DC+/DC-).
  - 完整支援美規 NEC 與歐規 IEC 導線色標標準與線路標籤標註。

- **📚 20+ Built-in Industrial Automation Examples / 20+ 套內建工控經典電路**
  - Comprehensive teaching & industrial template library: Motor Direct-on-Line (DOL) Starter, Forward/Reverse Interlocking, Star-Delta (Y-Δ) Reduced Voltage Starter, On/Off-Delay Timers, Limit Switch Auto-Reciprocating, Liquid Level Automatic Pump, ATS Dual-Power Transfer, and Automated Manufacturing Cell.
  - 涵蓋豐富的教學與工程範例：三相馬達直接起動、正反轉電氣互鎖、星三角降壓起動、通電/斷電延時控制、行程開關自動往返、水箱液位泵控、雙電源自動切換（ATS）及自動化加工單元。

- **📱 Full Responsive & Touch Gestures / 全平台響應式與觸控手勢**
  - Seamless desktop, tablet, and mobile support with collapsible drawers and floating action bars.
  - 完美支援電腦、平板與手機自適應佈局，具備側邊欄抽屜模式與浮動快捷工具列。
  - Multi-touch gestures: pinch-to-zoom, two-finger pan, 32px touch targets, and haptic vibration feedback.
  - 多點觸控手勢：雙指縮放、雙指平移、32px 端子感應熱區與觸覺震動回饋。

- **🧲 Instruments & Waveform Charts / 儀表探針與歷史波形**
  - Live Voltmeter and non-invasive Clamp Ammeter probes in both Edit and Run modes.
  - 支援電壓表與非侵入式鉗形電流表探針，可在編輯與運行模式下即時量測。
  - Real-time sampling trend chart with dynamic Y-axis scaling, hover tooltips, and statistics.
  - 即時歷史波形趨勢曲線圖，具備動態 Y 軸縮放、懸停數值指示與極值統計卡片。

- **📑 Engineering Annotations, Groups & Precision Rulers / 工程標註、編組與工規標尺**
  - Industrial Title Block (project name, drawing no., rev, date) and comment cards with optional leader lines bound to a device or a group.
  - 標準工程圖紙標題欄（專案名稱、圖號、修訂、日期），以及可綁定元件或群組、可顯示指引線的備註框。
  - Multi-select grouping with named/colored frames; groups, comments, and device tags can stay visible in Edit/Run (translucent) while omitted from print.
  - 多選編組、命名與顏色框；群組、備註與裝置標籤可在編輯／運行中半透明顯示，列印時隱藏。
  - Precision edge rulers on PC canvas with dynamic pointer coordinate tracking.
  - PC 畫布邊緣精密工規標尺與鼠標動態指示線。

- **🖨️ Smart Printing & Vector Export / 智能列印與向量匯出**
  - Auto-crops white-space content bounds, supports custom background (White/Kraft/Transparent) and vector print preview.
  - 自動採集電路內容包圍盒（排除空白）、自訂紙張背景與高解析向量列印預覽。
  - Local document library, JSON export/import, and shareable URL hash links.
  - 支援瀏覽器本地存檔、JSON 文件匯入匯出與 Base64 URL 短鏈接分享。

- **📊 Telemetry & Client Error Diagnostics / 遙測分析與客戶端錯誤診斷**
  - Lightweight, privacy-friendly telemetry tracking for usage stats, component frequency, and session duration.
  - 輕量化、隱私友好的使用數據遙測，精確統計元件使用率、模擬運行頻率與停留時長。
  - Automated client-side error and console exception recording with rate-limiting and deduplication.
  - 自動捕獲客戶端未處理異常與 Console 報錯，內建頻率限制與去重防護。

- **🎓 Interactive Onboarding Tutorial / 互動式新手指引**
  - Step-by-step guidance for building and running a 3-phase motor control circuit (separate PC and Mobile versions).
  - 內建三相電機控制電路搭建與運行的互動引導流程（提供 PC 與移動設備雙版本）。

- **🌗 Modern Themes & i18n / 雙色外觀主題與雙語支援**
  - Industrial Light (Default) and Dark themes with one-click instant toggle and persistence.
  - 現代工規淺色（預設）與深色主題，支援一鍵切換與本地持久化。
  - English and Traditional Chinese (`en` / `zh`) UI, including component library and inspector names.
  - 英文與繁體中文介面切換，元件庫與屬性檢查器名稱隨語言顯示。

- **🧪 Optional: Ladder view & Auto Layout / 可選：梯形圖與自動排版**
  - NEMA/JIC ladder synthesis and auto-layout exist in the codebase but are **off by default** (`ENABLE_LADDER` / `ENABLE_AUTO_LAYOUT` compile flags). GitHub Pages and a plain `yarn dev` / `deno task dev` do not show them unless the env vars below are set.
  - 梯形圖合成與自動排版已實作，但**預設關閉**。GitHub Pages 與一般 `yarn dev` / `deno task dev` 不會顯示，除非設定下列環境變數。

---

## 🚀 Quick Start / 快速開始

### Prerequisites / 環境要求
- **Deno**: `>= 2.x` *(Recommended / 推薦)*
- **Node.js**: `>= 18.x` / **Yarn**: `>= 1.22.x` (or npm `>= 9.x`)

### Using Deno (Recommended) / 使用 Deno（推薦）
```bash
# Start local development server / 啟動本地開發服務器
deno task dev

# Run test suites / 運行單元與整合測試
deno task test

# Build production bundle / 構建生產版本
deno task build

# Preview production build / 預覽構建結果
deno task preview
```

### Using Yarn / npm / 使用 Yarn 或 npm
```bash
# Install dependencies / 安裝依賴
yarn install

# Start development server / 啟動開發服務器
yarn dev

# Run tests / 運行測試
yarn test

# Build production bundle / 構建生產版本
yarn build
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

Optional compile-time flags (default **off**):

```bash
# Show ladder diagram UI / 顯示梯形圖
VITE_ENABLE_LADDER=true yarn dev

# Show auto-layout action / 顯示自動排版
VITE_ENABLE_AUTO_LAYOUT=true yarn dev
```

The same `VITE_ENABLE_LADDER` / `VITE_ENABLE_AUTO_LAYOUT` variables work with `deno task dev` and production builds.  
上述變數同樣適用於 `deno task dev` 與正式構建。

---

## 📋 Makefile Commands / Makefile 命令一覽

| Command / 命令 | Description / 說明 |
|---|---|
| `make help` | List available targets / 列出可用命令 |
| `make install` | Install dependencies / 安裝依賴 (`yarn install`) |
| `make dev` | Start development server / 啟動開發服務器 (`yarn dev`) |
| `make build` | Build production bundle / 構建生產版本 (`yarn build`) |
| `make preview` | Preview production bundle / 預覽生產版本 (`yarn preview`) |
| `make test` | Run unit tests / 運行單元測試 (`yarn test`) |
| `make deploy` | Print GitHub Pages deploy instructions / 顯示 GitHub Pages 部署說明 |
| `make clean` | Clean build artifacts / 清理構建產物 `dist/` |

---

## 📦 Tech Stack / 技術棧

- **Framework / 框架**: [React 19](https://react.dev/)
- **Runtime & Package Engine**: [Deno 2](https://deno.com/) & [Node.js](https://nodejs.org/)
- **Build Tool / 構建工具**: [Vite 7](https://vitejs.dev/)
- **Language / 語言**: [TypeScript 5.9](https://www.typescriptlang.org/)
- **State Management / 狀態管理**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Testing Framework / 測試框架**: [Vitest](https://vitest.dev/)
- **Backend Services (Optional) / 雲端服務**: Firebase Analytics & Cloud Firestore (Spark Plan)
- **Styling / 樣式**: Pure CSS with CSS Grid & Custom Properties (Zero runtime CSS-in-JS)

---

## 📂 Project Structure / 項目結構

```plain text
src/
  ├── sim/                  # Simulation engine / 仿真引擎 (Union-Find, potential, dynamic states)
  │   └── engine.ts         # Electrical graph solver, contact poles & meters / 節點求解、觸點極與量測
  ├── ladder/               # Ladder diagram engine (feature-flagged) / 梯形圖模組（編譯開關）
  ├── layout/               # Auto-layout of power & control rungs (feature-flagged) / 動力與控制迴路自動排版
  ├── tutorial/             # Interactive onboarding tutorial / 互動新手指引
  ├── examples/             # Built-in examples / 內建工控範例 (JSON + loader)
  ├── examplesBuilder.ts    # Procedural example generator / 程式化範例構造器
  ├── circuitBuilder.ts     # Add/remove devices, symbols, wires, junctions / 增刪元件、導線與連接點
  ├── ui/                   # UI components & layered canvas / UI 與分層畫布
  │   ├── schematic/        # Schematic canvas / 原理圖畫布
  │   │   ├── layers/       # Wire, symbol, port, interaction overlays / 導線、符號、端子與互動層
  │   │   ├── useSchematicEvents.ts
  │   │   ├── interact.ts
  │   │   └── Ruler.tsx
  │   ├── Schematic.tsx
  │   ├── LadderSchematic.tsx
  │   ├── Palette.tsx       # Component library / 元件庫
  │   ├── Inspector.tsx     # Properties, wire numbers, comments / 屬性、線號、備註
  │   ├── ContextMenu.tsx   # Canvas context menu / 畫布右鍵選單
  │   ├── Bench.tsx
  │   ├── PrintModal.tsx
  │   ├── PanelResizer.tsx
  │   └── ...
  ├── catalog.ts            # Component catalog & terminals / 元件目錄與端子
  ├── Glyphs.tsx            # Schematic SVG glyphs / 原理圖 SVG
  ├── geometry.ts           # Orthogonal routing & wire-label placement / 正交佈線與線號位置
  ├── tagPlacement.ts       # Device tag offsets / 裝置標籤偏移
  ├── groups.ts             # Groups, alignment, print-hide ids / 編組、對齊、列印隱藏
  ├── print.ts              # Print content bounds / 列印包圍盒
  ├── persist.ts            # Local saves & URL hash / 本地存檔與分享連結
  ├── features.ts           # ENABLE_LADDER / ENABLE_AUTO_LAYOUT flags / 編譯開關
  ├── keyboard.ts           # Hotkeys / 快捷鍵
  ├── i18n.ts               # en / zh dictionary / 英／繁字典
  ├── store.ts              # Zustand store (circuit, sim, undo, wire labels) / 全局狀態
  ├── types.ts
  ├── App.tsx
  └── styles.css
```

---

## 🌐 Deployment / 部署到 GitHub Pages

This project is automatically built and deployed to GitHub Pages via **GitHub Actions** (`.github/workflows/deploy.yml`) upon pushing or merging into the `main` branch.  
本項目使用 **GitHub Actions** (`.github/workflows/deploy.yml`) 實現自動化部署，當代碼提交（Push）或合併至 `main` 分支時，會自動觸發構建並發布至 GitHub Pages。

---

## 📄 License / 許可證

MIT License. Copyright @2026 DW. All rights reserved.
