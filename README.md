<div align="center">

<img src="./build/icon.png" alt="Piccc Logo" width="128" height="128" />

# 皮克西西 (Piccc) - 科学图表排版工具

**专为科研、学术论文与出版打造的高效科学图表拼图与排版桌面应用**  
*A Modern Scientific Figure Layout & Assembly Tool for Researchers and Academics*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.9.0-green.svg)](https://github.com/tianchaoyamen/Piccc)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](https://github.com/tianchaoyamen/Piccc)
[![Electron](https://img.shields.io/badge/Electron-35.x-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 📖 简介 / Introduction

**皮克西西 (Piccc)** 是一款专注于学术研究与科技出版的图表拼图与排版工具。科研人员在准备期刊论文（如 Nature, Science, Cell, IEEE, PNAS 等）时，通常需要将来自不同分析工具（R, Python, GraphPad Prism, 流式细胞仪, 共聚焦显微镜等）的数十张子图组合成规范的 Figure。

传统工具（如 Photoshop、Illustrator 或 PowerPoint）在处理大量子图对齐、编号样式统一、出血位与出版分辨率设定时往往繁琐且容易失误。**Piccc** 提供了直观的可视化网格排版系统、经典顶刊规范模板、智能子图序号生成、多格式高精导出（支持 300/600 DPI 出版级 TIFF 与 PDF），让科研拼图变得优雅、严谨且高效。

---

## ✨ 核心特性 / Features

- 📐 **可视化智能网格排版**
  - 所见即所得 (WYSIWYG) 的交互式排版画板。
  - 支持快捷创建任意行、列网格，自由切分、合并格子。
  - 内置经典期刊规格预设（如单栏 89mm、1.5 栏 120mm、双栏 183mm、A4 纸张、16:9 报告幻灯等）。
  - 支持自定义模板设计，保存后随时一键复用。

- 🏷️ **出版级智能编号体系**
  - 支持大写字母 (`A, B, C...`)、小写字母 (`a, b, c...`)、数字 (`1, 2, 3...`) 等多种编号方案。
  - 自由设定编号字体、字号、加粗、颜色及内外间距位置。
  - **空白格子智能识别**：导出及预览时自动隐去无内容格子的编号，保持图面整洁。

- 🖼️ **全方位图像处理与格式支持**
  - 原生支持常见与科学图像格式：`PNG`, `JPG`, `JPEG`, `SVG`, `TIFF / TIF`。
  - 内置高性能 TIFF 解码器，完美解析高位深科研原图。
  - 单元格内交互式图像裁切（Cropper）、比例锁定、等比缩放与居中适配。

- 📁 **本地素材库集成**
  - 便捷的侧边栏素材管理面板，支持一键刷新与分类浏览。
  - 拖拽即导入：将素材图片直接拖入目标网格即可完成排版。

- 💻 **内置 R 脚本交互编辑器**
  - 集成 CodeMirror 现代代码编辑器。
  - 支持实时编辑与运行 R 代码绘图，结果直达排版画板。

- 🖨️ **专业出版级多格式导出**
  - 支持导出高分辨率图像与矢量格式：`TIFF` (300 DPI / 600 DPI)、`PDF`、`PNG`、`SVG`。
  - 准确保留物理尺寸（毫米 mm / 英寸 inch），无缝满足各大顶刊投稿指南的要求。

- 🖥️ **跨平台桌面体验**
  - 全面支持 macOS（配备精致的 macOS Squircle 原生应用图标）与 Windows（提供友好的向导式安装程序）。

---

## 🚀 快速上手 / Quick Start

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 本地开发运行

```bash
# 1. 克隆仓库
git clone https://github.com/tianchaoyamen/Piccc.git
cd Piccc

# 2. 安装项目依赖
npm install

# 3. 启动本地开发模式 (包含 Vite 热重载)
npm run dev
```

### 构建与打包

项目内置了自动化打包脚本 `pack.sh`：

```bash
# 赋予打包脚本执行权限
chmod +x pack.sh

# 打包当前平台或所有平台 (macOS DMG / Windows EXE)
./pack.sh all

# 或单独构建指定平台：
./pack.sh mac    # 生成 macOS DMG 安装文件
./pack.sh win    # 生成 Windows NSIS 安装包 (x64)
```

打包生成的文件将位于 `dist/` 目录下。

---

## 🛠️ 技术栈 / Tech Stack

- **框架与运行时**: [Electron 35](https://www.electronjs.org/), [Node.js](https://nodejs.org/)
- **前端视图**: [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
- **构建工具**: [Vite 6](https://vitejs.dev/), [electron-vite](https://electron-vite.org/)
- **打包工具**: [electron-builder](https://www.electron.build/)
- **UI 组件库**: [Ant Design (antd 5)](https://ant.design/)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
- **代码编辑器**: [CodeMirror 6](https://codemirror.net/)
- **图像与科学文件支持**: `utif` (TIFF 解码)

---

## 📂 项目结构 / Project Structure

```text
piccc/
├── build/               # 应用图标及打包静态资产 (icon.png, icon.icns 等)
├── src/
│   ├── main/            # Electron 主进程代码
│   ├── preload/         # Electron 预加载脚本 (安全 IPC 桥接)
│   └── renderer/        # React 前端渲染进程
│       ├── assets/      # 前端静态图标与资产
│       ├── components/  # 核心 UI 组件 (导出模态框, 裁切器, R代码编辑器等)
│       ├── store/       # Zustand 项目与排版全局状态
│       ├── types/       # TypeScript 类型定义
│       ├── utils/       # 网格计算算法与模板数据定义
│       ├── App.tsx      # 主应用组件与画板控制中心
│       └── main.tsx     # 前端入口
├── pack.sh              # 自动化构建与跨平台打包脚本
├── package.json         # 项目元数据与依赖配置
├── tsconfig.json        # TypeScript 编译配置
└── LICENSE              # MIT 开源许可证
```

---

## 🤝 参与贡献 / Contributing

欢迎对科学图表排版感兴趣的开发者、科研工作者提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到您的远程分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 开源许可证 / License

本项目基于 [MIT 许可证](LICENSE) 开源。
欢迎科研人员、高校师生及商业团队自由使用与二次开发。
