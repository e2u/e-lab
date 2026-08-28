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
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## 📖 Introduction / 簡介

### English
**e-lab** is an interactive, browser-based electrical and industrial automation circuit simulation laboratory. It allows users to place electrical components, draw orthogonal wires, toggle between Edit and Run simulation modes, and test industrial control circuits in real-time—including 3-phase power supplies, transformers, contactors, relays, push buttons, protection devices, motors, and measuring instruments.

### 中文
**e-lab** 是一個基於 Web 的電子電氣與工控電路模擬實驗室。使用者可以在瀏覽器中自由放置電氣元件、繪製正交接線、切換編輯與運行仿真模式，並即時模擬三相電源、控制變壓器、接觸器、繼電器、按鈕、保護器件、馬達動力迴路與測量儀表等工控電路。

---

## ✨ Key Features / 核心特性

- **⚡ Real-time Electrical Simulation / 即時電氣仿真**
  - Graph/Union-Find electrical node solver for real-time live potential, interlock, self-holding, and dynamic state evaluation.
  - 基於並查集與拓撲圖的電氣節點求解器，即時計算電位、自鎖、互鎖與設備動態狀態。
  - Supports 3-phase Wye (Y) and Delta (Δ) power supplies, multi-PE grounding, and short-circuit strobe warnings.
  - 支援三相 Y 形與 Δ 形電源切換、多點 PE 接地共存與短路頻閃警報。

- **📐 Smart Orthogonal Wire Routing / 智能正交佈線**
  - Channel-aware orthogonal routing with automatic parallel lane allocation to prevent overlapping wires and crossovers.
  - 通道感知正交佈線與平行軌道自動分配，徹底避免導線重疊與交錯穿透。

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

- **📑 Engineering Annotations & Rulers / 工程標註與標尺**
  - Industrial Title Block component with scalable fields (Project Name, Rev, Date format `MM/DD/YYYY`).
  - 標準工程圖紙標題欄元件，支援大寫字段與整體縮放。
  - Precision edge rulers on PC canvas with dynamic pointer tracking.
  - PC 畫布邊緣精密工規標尺與鼠標動態指示線。

- **🖨️ Smart Printing & Export / 智能列印與匯入匯出**
  - Auto-crops white-space content bounds, supports custom background (White/Kraft/Transparent) and vector print preview.
  - 自動採集電路內容包圍盒（排除空白）、自訂紙張背景與高解析向量列印預覽。
  - Local saves, JSON export/import, and shareable URL hash links.
  - 支援本地庫存檔、JSON 文件匯入匯出與 Base64 URL 分享連結。

- **🎓 Interactive Onboarding Tutorial / 互動式新手指引**
  - Step-by-step guidance for building and running a 3-phase motor control circuit (separate PC and Mobile versions).
  - 內建三相電機控制電路搭建與運行的互動引導流程（提供 PC 與移動設備雙版本）。

- **🌗 Modern Themes / 雙色外觀主題**
  - Industrial Light (Default) and Dark themes with one-click instant toggle and persistence.
  - 現代工規淺色（預設）與深色主題，支援一鍵切換與本地持久化。

---

## 🚀 Quick Start / 快速開始

### Prerequisites / 環境要求
- **Node.js**: `>= 18.x`
- **Yarn**: `>= 1.22.x` (or npm `>= 9.x`)

### Installation / 安裝依賴
```bash
yarn install
```

### Development Server / 啟動開發服務器
Start local development server with hot module replacement (HMR):
```bash
yarn dev
# or via Makefile / 或使用 Makefile
make dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛠️ Build & Preview / 構建與預覽

### Production Build / 構建生產版本
Compile TypeScript and bundle optimized assets into `dist/`:
```bash
yarn build
# or via Makefile / 或使用 Makefile
make build
```

### Preview Build / 預覽構建結果
Preview the production build locally:
```bash
yarn preview
# or via Makefile / 或使用 Makefile
make preview
```

---

## 🧪 Testing / 測試

This project uses [Vitest](https://vitest.dev/) for unit and integration testing.  
本項目使用 [Vitest](https://vitest.dev/) 進行單元與集成測試。

```bash
yarn test
# or via Makefile / 或使用 Makefile
make test
```

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
- **Build Tool / 構建工具**: [Vite 7](https://vitejs.dev/)
- **Language / 語言**: [TypeScript 5.9](https://www.typescriptlang.org/)
- **State Management / 狀態管理**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Testing Framework / 測試框架**: [Vitest](https://vitest.dev/)
- **Styling / 樣式**: Pure CSS with CSS Grid & Custom Properties (Zero runtime CSS-in-JS)

---

## 📂 Project Structure / 項目結構

```plain text
src/
  ├── sim/                  # Simulation engine / 仿真引擎 (Union-Find, potential, dynamic states)
  ├── ui/                   # UI components & Layered canvas / UI 組件與分層畫布
  │   ├── schematic/        # Layered canvas / 分層畫布 (WireLayer, SymbolLayer, PortLayer, Ruler)
  │   ├── Palette.tsx       # Component palette / 左側元件庫
  │   ├── Inspector.tsx     # Property inspector / 右側屬性檢查器
  │   ├── Bench.tsx         # Motor & meter workbench / 運行工作台
  │   ├── FloatingActionBar.tsx # Mobile quick action bar / 行動端浮動工具列
  │   ├── PrintModal.tsx    # Print preview modal / 列印預覽彈窗
  │   └── MeterHistoryChart.tsx # Waveform chart / 儀表歷史趨勢圖
  ├── tutorial/             # Interactive onboarding tutorial / 互動新手指引系統
  ├── catalog.ts            # Component catalog & terminal definitions / 元件目錄與端子定義
  ├── geometry.ts           # Orthogonal routing & collision detection / 正交佈線與幾何計算
  ├── tagPlacement.ts       # Symbol tag positioning calculations / 元件標籤位置計算
  ├── groups.ts             # Group alignment, distribution & colors / 群組對齊與等間距分佈
  ├── print.ts              # Auto-crop bounds calculation / 列印包圍盒計算
  ├── store.ts              # Zustand global state center / 全局狀態中心
  ├── types.ts              # Global TypeScript interfaces / 全局型別定義
  ├── i18n.ts               # Internationalization catalog (ZH/EN) / 雙語國際化字典
  ├── App.tsx               # App shell & top navigation / 應用主殼層與頂部導航
  └── styles.css            # Responsive layout & theme styles / 響應式佈局與主題樣式
```

---

## 🌐 Deployment / 部署到 GitHub Pages

1. **Configure GitHub Pages / 配置 GitHub Pages**:
   - Navigate to repository `Settings > Pages`
   - Source: `Deploy from a branch`
   - Branch: `gh-pages`, Folder: `/ (root)`
   - Click **Save**

2. **Deploy / 構建並發布**:
   ```bash
   make build
   git subtree push --prefix dist origin gh-pages
   ```

---

## 📄 License / 許可證

MIT License. Copyright @2026 DW. All rights reserved.
