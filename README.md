# 桌面待办（Desktop Todo）

一款**嵌入式透明桌面待办清单工具**，灵感来自小黄条（YYNote）。窗口完全透明、置顶于桌面、开机自启，把待办清单像贴纸一样钉在桌面上。

> 当前为 **MVP（最小可用版本）**：聚焦待办增删改 + 透明置顶窗口 + 本地 JSON 存储。
> 参考完整需求见 `/workspace/yynote_requirements.md`，技术选型见 `/workspace/tech_decision.md`。

---

## ✨ MVP 功能

- ✅ 透明、置顶、无边框的桌面窗口，适配任意壁纸
- ✅ 待办增 / 删 / 改 / 完成（点击列表空白处添加，点圆圈完成）
- ✅ 行内编辑标题、详情编辑（🔧 标签 / 备注 / 目标日期 / 类型）
- ✅ 拖拽排序（拖左侧 `⋮⋮`）、一键置顶（📌）
- ✅ 多清单切换 + 标签分类
- ✅ 日期倒数（设置目标日后显示「还有 N 天 / 已经 N 天」）
- ✅ 窗口可拖拽移动、可拖拽右下角调整大小
- ✅ 设置抽屉：窗口透明度、开机自启、标签管理、清单管理
- ✅ 全局快捷键 `Ctrl + `` ` 隐藏 / 显示窗口
- ✅ 数据本地存储（JSON 文件，自动读写）

---

## 🧱 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 桌面壳 | **Tauri v2** | 体积小（~10MB）、后台内存低、跨 Windows/macOS |
| 前端 | **原生 TypeScript + Vite** | 无框架，易读易改 |
| 后端 | **Rust** | 窗口能力、文件读写命令 |
| 存储 | **纯 JSON 文件** | 零依赖、人可直接查看 |

---

## 🚀 在 Windows 上运行（首次）

### 1. 准备环境

- **Node.js 18+** 与 **pnpm**：https://nodejs.org ，然后 `npm i -g pnpm`
- **Rust 工具链**：https://rustup.rs （安装时选默认，会自动配好）
- **MSVC 编译环境**：安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/zh-hans/downloads/)，勾选「使用 C++ 的桌面开发」工作负载
- **WebView2**：Win11 自带；Win10 较新版本也自带，缺失时从微软官网安装

### 2. 运行

```bash
git clone <你的仓库地址> desktop-todo
cd desktop-todo
pnpm install
pnpm tauri dev      # 开发模式，自动弹出透明窗口
```

### 3. 打包发布

```bash
pnpm tauri build    # 在 src-tauri/target/release/bundle/ 生成安装包
```

---

## 🔓 关于「代码签名」（给自己/朋友用，不用花钱）

未签名的 `.exe` 在 Windows 10/11 会被 SmartScreen 弹窗拦截，提示「Windows 已保护你的电脑」。**这不影响功能**，朋友下载后：

> 弹窗 → 点「详细信息」→ 点「仍要运行」

即可正常安装使用。个人/朋友自用完全不需要买代码签名证书（约 ¥700~5000/年）。等工具出圈、有陌生用户时，再考虑买便宜的 OV 证书并接入 GitHub Actions 自动签名即可。

---

## 💻 浏览器预览（不需要 Rust / Tauri）

本项目的存储层做了「浏览器预览」兜底：直接用 Vite 跑前端也能看 UI（数据存在浏览器 localStorage）。

```bash
pnpm install
pnpm dev            # 打开 http://localhost:1420 即可预览界面
```

适合先看交互、或在不装 Rust 的机器上调整界面。

---

## 📁 目录结构

```
desktop-todo/
├── prototype.html          # 高保真可交互原型（浏览器双击打开即可预览）
├── index.html              # 前端入口
├── package.json
├── vite.config.ts          # Vite + Vitest 配置
├── generate_icon.py        # 生成应用图标
├── src/
│   ├── main.ts             # 前端 UI 与全部交互逻辑
│   ├── style.css           # 透明主题样式
│   ├── lib/
│   │   ├── types.ts        # 数据模型
│   │   ├── logic.ts        # 纯逻辑（增删改/排序/过滤/倒数），可单测
│   │   └── logic.test.ts   # 单元测试
│   ├── store/
│   │   └── db.ts           # 存储层（Tauri 命令 / 浏览器 localStorage 兜底）
│   └── components/
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json     # 窗口透明/置顶/无边框配置
    ├── build.rs
    ├── icons/              # 应用图标
    └── src/
        └── main.rs         # Rust 后端：load/save 命令、自启、全局快捷键
```

---

## ✅ 测试

```bash
pnpm test       # 运行数据层单元测试（增删改/排序/过滤/倒数）
```

---

## 📌 已知边界

- 透明窗口 / 置顶 / 嵌入效果**只能在 Windows 上验证**（本项目在 Linux 沙箱中开发，已验证前端构建与全部逻辑单测，窗口表现需你在 Windows 确认）。
- macOS 支持为后续计划，前端代码可复用，仅需补 macOS 相关窗口处理。
- 边缘自动隐藏、系统通知提醒、日历视图、第三方日历同步等为后续 P1/P2 功能，尚未实现。

---

## 📜 开源许可

MIT —— 允许个人/商用、修改、再分发。
