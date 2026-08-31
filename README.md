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
**e-lab** is an interactive, browser-based electrical and industrial automation circuit simulation laboratory. It allows users to place electrical components, draw orthogonal wires, toggle between Edit and Run simulation modes, view NEMA/JIC industrial ladder logic diagrams, and test complex industrial control circuits in real-time—including 3-phase power supplies, control transformers, contactors, relays, timers, push buttons, limit switches, protection devices, motors, and measuring instruments.

### 中文
**e-lab** 是一個基於 Web 的電子電氣與工控電路模擬實驗室。使用者可以在瀏覽器中自由放置電氣元件、繪製正交接線、切換編輯與運行仿真模式、同步檢視標準 NEMA/JIC 梯形圖（Ladder Diagram），並即時模擬三相電源、控制變壓器、接觸器、中間繼電器、時間繼電器、按鈕開關、行程開關、熱過載保護、馬達動力迴路與測量儀表等各類工控電路。

---

## ✨ Key Features / 核心特性

- **⚡ Real-time Electrical Simulation / 即時電氣仿真**
  - Graph/Union-Find electrical node solver for real-time live potential, interlock, self-holding, and dynamic state evaluation.
  - 基於並查集與拓撲圖的電氣節點求解器，即時計算電位分佈、自鎖、互鎖與設備動態狀態。
  - Supports 3-phase Wye (Y) and Delta (Δ) power supplies, multi-PE grounding, and short-circuit strobe warnings.
  - 支援三相 Y 形與 Δ 形電源切換、多點 PE 接地共存與短路頻閃警報。

- **🪜 Industrial Ladder Diagram Mode / 工控梯形圖模式 (NEMA / JIC)**
  - Dual layout views: Seamlessly toggle between Wiring Schematic and Ladder Logic Diagram views.
  - 原理圖與梯形圖雙視圖：支援一鍵在接線原理圖與 PLC / 工控階梯圖之間無縫切換。
  - Automated DFS netlist analysis to synthesize ladder rungs from schematic wiring.
  - 內建 DFS 網絡拓撲分析算法，自動將電路接線圖轉換合成為標準梯形圖行（Rung）。
  - Drag-and-drop rung reordering and interactive contact / coil insertion modal.
  - 支援階梯行自由拖曳重排，提供專屬彈窗快速插入常開/常閉接點、線圈與定時器。

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

- **📑 Engineering Annotations & Precision Rulers / 工程標註與工規標尺**
  - Industrial Title Block component with customizable metadata (Project Name, Rev, Date).
  - 標準工程圖紙標題欄元件，支援專案名稱、圖號、修訂版本與日期標註。
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
  - Complete English and Traditional Chinese (zh-TW / zh-CN) internationalization.
  - 100% 覆蓋的繁體中文 / 英文雙語國際化字典切換。

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

---

## 📋 Makefile Commands / Makefile 命令一覽

| Command / 命令 | Description / 說明 |
|---|---|
| `make install` | Install dependencies / 安裝依賴 (`yarn install`) |
| `make dev` | Start development server / 啟動開發服務器 (`yarn dev`) |
| `make build` | Build production bundle / 構建生產版本 (`yarn build`) |
| `make preview` | Preview production bundle / 預覽生產版本 (`yarn preview`) |
| `make test` | Run unit tests / 運行單元測試 (`yarn test`) |
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
  │   ├── engine.ts         # Electrical graph solver & meter calculations / 節點求解與物理量測計算
  │   └── engine.test.ts    # Simulation engine unit tests / 仿真引擎單元測試
  ├── ladder/               # Industrial Ladder diagram engine / 工控梯形圖模組
  │   ├── ladderTypes.ts    # Ladder data model / 梯形圖數據模型
  │   ├── ladderLayout.ts   # DFS netlist graph pathfinder & rung layout / 網絡圖拓撲分析與階梯行生成
  │   ├── LadderGlyphs.tsx  # NEMA/JIC industrial standard ladder glyphs / 標準梯形圖圖元
  │   ├── LadderItemPickerModal.tsx # Component insertion modal / 接點與線圈插入彈窗
  │   └── ladderSynthesis.ts # Bidirectional circuit synthesis / 雙向電路合成與佈線
  ├── tutorial/             # Interactive onboarding tutorial / 互動新手指引系統
  │   ├── types.ts          # Step & circuit definitions / 引導步驟與階段型別
  │   ├── tutorialData.ts   # PC & Mobile step data & dictionary / PC 與移動端引導數據
  │   ├── stageCircuits.ts  # Demo circuits for each step / 各階段電路演示數據
  │   └── TutorialOverlay.tsx # Spotlight highlight & guide cards / 聚焦點遮罩與步驟卡片
  ├── examples/             # Built-in examples / 內建工控範例 (JSON circuits & loaders)
  │   ├── list.json         # Example metadata list / 範例清單配置
  │   ├── index.ts          # Dynamic example loader / 動態範例載入器
  │   └── *.json            # 20+ Industrial Circuit JSON templates / 20+ 內建電路範例檔
  ├── examplesBuilder.ts    # Procedural example generator / 程式化範例電路構造器
  ├── ui/                   # UI components & Layered canvas / UI 組件與分層畫布
  │   ├── schematic/        # Layered schematic canvas / 原理圖分層畫布架構
  │   │   ├── layers/       # Rendering layers / 獨立渲染圖層 (WireLayer, SymbolLayer, PortLayer, etc.)
  │   │   ├── useSchematicEvents.ts # Pointer events, gestures & rAF throttling / 指針事件與手勢
  │   │   ├── interact.ts   # Runtime device interaction & haptics / 運行模式互動與觸覺回饋
  │   │   └── Ruler.tsx     # Precision canvas edge rulers / 畫布邊緣工規標尺
  │   ├── Schematic.tsx     # Schematic canvas root container / 原理圖主容器
  │   ├── LadderSchematic.tsx # Ladder diagram canvas & rung drag-drop / 梯形圖畫布與拖曳重排
  │   ├── Palette.tsx       # Component palette drawer / 左側元件庫
  │   ├── Inspector.tsx     # Property inspector / 右側屬性檢查器
  │   ├── Bench.tsx         # Motor & meter workbench / 運行工作台
  │   ├── FloatingActionBar.tsx # Mobile quick action bar / 行動端浮動快捷工具列
  │   ├── PrintModal.tsx    # Print options & preview modal / 列印選項與預覽彈窗
  │   ├── MeterHistoryChart.tsx # Waveform trend chart & stats / 儀表歷史波形趨勢圖
  │   ├── MobileMenuModal.tsx # Mobile full-feature menu sheet / 行動端功能選單抽屜
  │   ├── FilesMenu.tsx     # Topbar files dropdown menu / 檔案管理下拉選單
  │   ├── DiscardModal.tsx  # Unsaved changes confirmation / 未保存變更確認彈窗
  │   ├── ErrorBoundary.tsx # React error boundary container / 異常邊界捕獲容器
  │   └── TogglePanelButton.tsx # Collapsible sidebar toggle button / 側邊欄展開收起按鈕
  ├── catalog.ts            # Component catalog & 2-grid terminal standards / 元件目錄與端子定義
  ├── Glyphs.tsx            # Schematic SVG component glyphs / 原理圖 SVG 元件圖形繪製
  ├── geometry.ts           # Orthogonal routing, lane allocation & hops / 正交佈線、空間分軌與跨線檢測
  ├── tagPlacement.ts       # Symbol tag positioning calculations / 元件標籤位置計算
  ├── groups.ts             # Group alignment, distribution & colors / 群組對齊與等間距分佈
  ├── print.ts              # Auto-crop content bounds algorithm / 列印內容包圍盒自動裁剪算法
  ├── persist.ts            # Local storage, validation & URL hash / 本地持久化、結構校驗與 URL 分享
  ├── firebase.ts           # Firebase client initialization & fallback / Firebase 客戶端初始化與降級
  ├── analytics.ts          # Telemetry & event tracking module / 數據遙測與自訂事件追蹤
  ├── errorLogger.ts        # Global exception interception & Firestore logging / 全域異常攔截與日誌
  ├── store.ts              # Zustand state center (isDirty, zoom, undo stack) / 全局狀態中心
  ├── types.ts              # Global TypeScript interfaces / 全局型別定義
  ├── i18n.ts               # Bilingual dictionary (ZH/EN 100% coverage) / 雙語國際化字典
  ├── App.tsx               # App shell, responsive layout & hotkeys / 應用主殼層與頂部導航
  └── styles.css            # Responsive styles & light/dark themes / 響應式佈局與深淺雙主題
```

---

## 🌐 Deployment / 部署到 GitHub Pages

This project is automatically built and deployed to GitHub Pages via **GitHub Actions** (`.github/workflows/deploy.yml`) upon pushing or merging into the `main` branch.  
本項目使用 **GitHub Actions** (`.github/workflows/deploy.yml`) 實現自動化部署，當代碼提交（Push）或合併至 `main` 分支時，會自動觸發構建並發布至 GitHub Pages。

---

## 📄 License / 許可證

MIT License. Copyright @2026 DW. All rights reserved.
