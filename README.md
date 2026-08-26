# e-lab

e-lab 是一個基於 Web 的電子與工控電路模擬實驗室，提供在瀏覽器中放置電氣元件、繪製接線、切換編輯與運行模式、模擬三相電源、接觸器、繼電器、按鈕、保護器件、馬達等工控電路的能力。

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-deployed-brightgreen)](https://e2u.github.io/e-lab/)

## 🚀 快速開始

### 環境要求
- Node.js >= 18.x
- Yarn >= 1.22.x (或 npm >= 9.x)

### 安裝依賴
```bash
yarn install
```

### 開發模式啟動
啟動本地開發服務器（支持熱更新）：
```bash
yarn dev
# 或使用 Makefile
make dev
```
啟動後，在瀏覽器中訪問 `http://localhost:5173`。

## 🛠️ 構建與預覽

### 構建生產版本
編譯 TypeScript 代碼並進行打包優化：
```bash
yarn build
# 或使用 Makefile
make build
```
構建產物將生成在 `dist/` 目錄中。

### 預覽構建結果
在本地預覽打包後的生產版本：
```bash
yarn preview
# 或使用 Makefile
make preview
```

## 🧪 測試

本項目使用 [Vitest](https://vitest.dev/) 進行單元測試。

### 運行測試
```bash
yarn test
# 或使用 Makefile
make test
```

## 📋 Makefile 命令一覽

本項目提供了 `Makefile` 來簡化開發與構建流程：

| 命令 | 說明 |
|------|------|
| `make install` | 安裝依賴（`yarn install`） |
| `make dev` | 啟動開發服務器（`yarn dev`） |
| `make build` | 構建生產版本（`yarn build`） |
| `make preview` | 預覽生產版本（`yarn preview`） |
| `make test` | 運行單元測試（`yarn test`） |
| `make clean` | 清理構建產物 `dist/` |

## 🌐 部署到 GitHub Pages

1. **配置 GitHub Pages**：
   - 訪問倉庫 `Settings > Pages`
   - Source 選擇 `Deploy from a branch`
   - Branch: `gh-pages`，Folder: `/ (root)`
   - 點擊 Save

2. **部署產物**：
   ```bash
   make build
   # 將 dist 內容推送到 gh-pages 分支
   git subtree push --prefix dist origin gh-pages
   ```

## 📦 技術棧
- **框架**: [React 19](https://react.dev/)
- **構建工具**: [Vite 7](https://vitejs.dev/)
- **語言**: [TypeScript 5.9](https://www.typescriptlang.org/)
- **狀態管理**: [Zustand](https://zustand-demo.pmnd.rs/)
- **測試**: [Vitest](https://vitest.dev/)

## 📂 項目結構
- `src/sim`: 電路仿真引擎核心邏輯（Union-Find 節點求解、電位與動態狀態更新）
- `src/ui`: 用戶界面組件（Schematic 畫布、Palette 元件盤、Inspector 屬性欄）
- `src/catalog.ts`: 元件目錄與端子定義
- `src/store.ts`: Zustand 全局狀態中心與撤銷重做
- `src/geometry.ts`: 坐標變換、端子位置、接線路由與碰撞判定
- `src/types.ts`: 全局數據模型與類型定義
- `src/examples.ts` / `src/examples/`: 內建工控教學範例
- `src/i18n.ts`: 國際化語言配置
