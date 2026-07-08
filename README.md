# 20-20-20 Reminder

一个跨平台桌面提醒应用，主实现基于 Electron，目标行为在 Windows、Linux 和 macOS 保持一致：

- 每隔 20 分钟弹出提醒，要求远眺 20 秒
- 弹窗 20 秒后自动消失
- 弹窗出现时请求任务栏图标闪烁
- 支持用户自定义开机自启动、提醒时长、提醒间隔和是否常驻置顶

## 直接下载安装

普通用户不需要安装 Node.js，也不需要手动运行命令。

直接使用方式：

1. 打开 GitHub 仓库的 `Releases`
2. 按你的系统下载对应安装包或可执行文件
3. 下载后双击安装或直接运行

建议下载文件：

- Windows：`Setup.exe` 安装版，或 `portable.exe` 免安装版
- macOS：`.dmg`
- Linux：`.AppImage`

如果仓库里还没有现成安装包：

- 维护者只需要创建一个 `v*` 标签，例如 `v1.0.1`
- GitHub Actions 会自动构建并把安装包挂到该版本的 `Releases`

开发者发布示例：

```bash
git tag v1.0.1
git push origin v1.0.1
```

## 配置项

- 开机自启动：默认关闭
- 提醒时长：默认 `20s`，范围 `20s` 到 `300s`
- 提醒间隔：默认 `20min`，范围 `10min` 到 `60min`
- 弹窗常驻于所有窗口之上：默认关闭

设置入口位于提醒弹窗右下角的“设置”按钮，保存后立即生效并持久化到本地。

当前仓库同时保留一个 Linux GTK 备用实现 `app.py`，但跨平台主线以 `src/` 下的 Electron 版本为准。

## 项目结构

- `src/main.js`：提醒调度、窗口层级、任务栏提醒、自动隐藏
- `src/renderer/`：提醒弹窗 UI 和倒计时
- `app.py`：Linux GTK 备用实现
- `scripts/check-env.js`：环境检测和可自动修复脚本
- `outputs/`：启动脚本和桌面入口
- `REQUIREMENTS.md`：前置依赖说明

### Linux Dock 图标说明

在 Ubuntu GNOME / Wayland 下，想要让 Dock 上出现“这个应用自己的图标”并进入紧急状态，必须同时满足：

- 应用具有稳定的 `application_id`
- 桌面入口文件名与 `application_id` 一致
- `StartupWMClass` 与窗口 `WM_CLASS` 一致
- 桌面入口已安装到 `~/.local/share/applications`

仓库已提供：

- `outputs/com.codex.twentytwentytwentyreminder.desktop`
- `outputs/install-linux-desktop-entry.sh`
- `outputs/20-20-20-reminder.svg`

## Electron 版实现说明

### 任务栏 / Dock 提醒

- Windows：使用 `BrowserWindow.flashFrame(true)` 持续请求任务栏图标闪烁
- Linux：持续请求窗口 attention / 任务栏图标提示，最终显示方式取决于桌面环境
- macOS：使用 `BrowserWindow.flashFrame(true)` 触发 Dock 图标持续提醒，并补一个 Dock badge 作为兜底

说明：
- Linux 是否显示为“闪烁”取决于具体桌面环境和窗口管理器
- macOS 从 Electron 31 起，`flashFrame(true)` 会持续提示 Dock 图标
- Windows 和 macOS 是 Electron 原生支持最稳定的两个目标平台

### 置顶到非置顶的切换策略

当“弹窗常驻于所有窗口之上”关闭时，提醒窗口不会强制置顶。

当该选项开启时，提醒窗口会持续保持 `alwaysOnTop` 行为。

### macOS 适配说明

- macOS 下不再依赖 `dock.bounce()` 作为主提醒，因为 Electron 官方文档要求该 API 只能在应用未聚焦时使用
- 提醒首次出现时仍会置顶并获取焦点，以保证点击其他应用后可以稳定触发失焦降级
- 为避免 `setVisibleOnAllWorkspaces()` 在 macOS 上导致 Dock 短暂隐藏，当前该能力只在 Linux 上启用
- macOS 打包命令为 `npm run build:mac`

## 运行

这一节主要面向开发者。如果你只是使用这个应用，优先看上面的“直接下载安装”。

### 环境检测

```bash
npm run check:env
```

### 自动修复可修复项

```bash
npm run setup:env
```

### Electron 开发运行

```bash
npm install
npm start
```

### Linux GTK 备用运行

```bash
python3 app.py
```

或：

```bash
./outputs/start-reminder.sh
```

## Windows 打包

安装依赖后执行：

```bash
npm run build:win
```

输出目录：

```bash
outputs/build
```

默认会生成：

- `portable` 便携版
- `nsis` 安装版

## macOS 打包

```bash
npm run build:mac
```

默认会生成：

- `dmg`
- `zip`

## Linux 打包

```bash
npm run build:linux
```

## 已知边界

- Linux 桌面环境对任务栏闪烁、置顶层级和工作区可见性的支持并不完全统一
- macOS 下 Dock badge 是否可见还取决于系统通知权限设置
- Windows 和 macOS 上相同行为由 Electron 原生窗口能力覆盖，兼容性更好
- 系统级依赖安装和升级策略见 `REQUIREMENTS.md`

## 自动产出安装包

仓库已内置 GitHub Actions 发布流程：

- 工作流文件：`.github/workflows/release.yml`
- 触发方式：
  - 手动触发 `Build And Release`
  - 推送标签 `v*`

自动产物：

- Windows：安装版 `.exe` 和便携版 `.exe`
- macOS：`.dmg` 和 `.zip`
- Linux：`.AppImage`
