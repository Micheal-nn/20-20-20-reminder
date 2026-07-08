# 20-20-20 Reminder

一个跨平台桌面提醒应用，主实现基于 Electron，目标行为在 Windows 和 Linux 保持一致：

- 每隔 20 分钟弹出提醒，要求远眺 20 秒
- 弹窗 20 秒后自动消失
- 弹窗出现时请求任务栏图标闪烁
- 第一次提醒置于所有窗口之上
- 用户点击桌面任意位置，或点击任意其他应用窗口后，后续提醒永久取消置顶

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

### 任务栏提醒

- Windows / Linux：使用 `BrowserWindow.flashFrame(true)` 持续请求任务栏注意力提示，弹窗隐藏后关闭
- macOS：使用 Dock bounce

说明：
- Linux 是否显示为“闪烁”取决于具体桌面环境和窗口管理器
- Windows 对 `flashFrame` 的支持稳定，属于主目标平台之一

### 置顶到非置顶的切换策略

Electron 没有跨平台的“桌面空白处点击事件”API，因此这里使用一个稳定且贴近需求的交互模型：

1. 提醒首次出现时主动获取焦点并置顶
2. 用户点击桌面空白处或任意其他应用窗口时，提醒窗口失焦
3. 一旦失焦，后续提醒永久关闭 `alwaysOnTop`

这个策略可以覆盖你要求的“点击桌面任意位置，包括其他应用窗口，都直接取消置顶”的核心行为。

## 运行

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

## Linux 打包

```bash
npm run build:linux
```

## 已知边界

- Linux 桌面环境对任务栏闪烁、置顶层级和工作区可见性的支持并不完全统一
- Windows 上相同行为由 Electron 原生窗口能力覆盖，兼容性更好
- 系统级依赖安装和升级策略见 `REQUIREMENTS.md`
