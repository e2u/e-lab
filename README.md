# e-lab

e-lab 是一个基于 Web 的电子电路模拟实验室，允许用户设计、构建和模拟电子电路。

## 🚀 快速开始

### 环境要求
- [Deno](https://deno.com/) (推荐) 或 [Node.js](https://nodejs.org/)

### 安装依赖
如果你使用 Deno，通常不需要手动运行安装命令，但为了确保兼容性，可以在根目录下运行：
```bash
deno install
```
或者使用 npm：
```bash
npm install
```

### 开发模式启动
使用 Deno 启动本地开发服务器（支持热更新）：
```bash
deno task dev
```
或者使用 npm：
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
