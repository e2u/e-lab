# e-lab

e-lab 是一个基于 Web 的电子电路模拟实验室，允许用户设计、构建和模拟电子电路。

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-deployed-brightgreen)](https://e2u.github.io/e-lab/)

## 🚀 快速开始

### 环境要求
- Node.js >= 18.x
- npm >= 9.x

### 安装依赖
```bash
npm install
```

### 开发模式启动
启动本地开发服务器（支持热更新）：
```bash
make dev
```
或直接运行：
```bash
npm run dev
```
启动后，你可以在浏览器中访问终端显示的地址（通常是 `http://localhost:5173`）。

## 🛠️ 构建与部署

### 构建生产版本
编译 TypeScript 代码并进行打包优化：
```bash
deno task build
```
或者使用 npm：
```bash
npm run build
```
构建产物将生成在 `dist/` 目录中。

### 预览构建结果
在本地预览打包后的生产版本：
```bash
deno task preview
```
或者使用 npm：
```bash
npm run preview
```

## 🧪 测试

本项目使用 [Vitest](https://vitest.dev/) 进行单元测试。

### 运行所有测试
```bash
deno task test
```
或者使用 npm：
```bash
npm test
```

## 🛠️ 构建与部署

### 使用 Makefile（推薦）

本項目提供了一個 Makefile 來簡化開發流程。以下是可用的命令：

| 命令 | 說明 |
|------|------|
| `make install` | 安裝依賴 |
| `make dev` | 啟動開發服務器 |
| `make build` | 構建生產版本 |
| `make preview` | 預覽生產版本 |
| `make test` | 運行測試 |

### 手動運行 NPM 命令

#### 構建生產版本
編譯 TypeScript 代碼並進行打包優化：
```bash
npm run build
```
構建產物將生成在 `dist/` 目錄中。

#### 預覽構建結果
在本地預覽打包後的生產版本：
```bash
npm run preview
```

### 部署到 GitHub Pages

1. **首次設置**：確保已創建 `gh-pages` 分支
   ```bash
   git branch gh-pages
   git push origin gh-pages --set-upstream
   ```

2. **配置 GitHub Pages**：
   - 訪問 https://github.com/e2u/e-lab/settings/pages
   - 在「Source」部分選擇：
     - Branch: `gh-pages`
     - Folder: `/ (root)`
   - 點擊 Save

3. **完成後你的網站會在**：
   ```
   https://e2u.github.io/e-lab/
   ```

4. **每次更新後重新部署**：
   ```bash
   make build
   # 然後手動推送到 gh-pages 分支
   git add dist/
   git commit -m "Update to GitHub Pages"
   git subtree push --prefix dist origin gh-pages
   ```

## 📦 技术栈
- **框架**: [React 19](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **状态管理**: [Zustand](https://zustand-demo.pmnd.rs/)
- **测试**: Vitest

## 📂 项目结构
- `src/sim`: 电路仿真引擎核心逻辑
- `src/ui`: 用户界面组件（如 Schematic, Palette, Inspector）
- `src/types.ts`: 全局类型定义
- `src/store.ts`: Zustand 状态存储
