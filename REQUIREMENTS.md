# Requirements

本文件明确列出 20-20-20 Reminder 的前置依赖、推荐版本、检测方式和自动修复边界。

## 1. 主实现依赖（Electron，Windows / Linux / macOS 主线）

必须满足：

- Node.js `>= 20.0.0`
- npm `>= 10.0.0`
- 可访问 npm registry 以安装项目依赖
- 可访问 Electron 二进制下载源，以完成 `electron` 运行时安装
- 图形桌面会话

项目内依赖：

- `electron`
- `electron-builder`

说明：

- `npm install` 会安装项目依赖
- `node node_modules/electron/install.js` 会补装 Electron 运行时二进制
- `npm run build:win` 生成 Windows 安装包和便携版
- `npm run build:mac` 生成 macOS `dmg` 和 `zip`
- `npm run build:linux` 生成 Linux AppImage

## 2. Windows 运行要求

必须满足：

- Windows 10 / 11
- Node.js 20 LTS 或更高
- npm 10 或更高

推荐安装命令：

```powershell
winget install OpenJS.NodeJS.LTS
npm install -g npm@latest
```

## 3. Linux 运行要求

Electron 主线必须满足：

- 现代 Linux 桌面环境
- Node.js 20+
- npm 10+
- 可用的 X11 或 Wayland 图形会话

GTK 备用实现额外要求：

- `python3`
- `python3-gi`
- `gir1.2-gtk-3.0`

Ubuntu / Debian 示例：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y python3-gi gir1.2-gtk-3.0
sudo npm install -g npm@latest
```

## 4. macOS 运行要求

Electron 主线必须满足：

- macOS 12 或更高
- Node.js 20+
- npm 10+
- 正常图形桌面会话

打包建议额外满足：

- Xcode Command Line Tools

推荐安装命令：

```bash
xcode-select --install
brew install node
npm install -g npm@latest
```

## 5. 自动检测与自动修复

环境检测脚本：

```bash
npm run check:env
```

自动修复模式：

```bash
npm run setup:env
```

脚本会做的事情：

- 检查 Node.js 版本
- 检查 npm 版本
- 检查是否存在图形桌面会话
- 在 macOS 上检查 Xcode Command Line Tools
- 检查 `node_modules`
- 检查 `electron` 包是否存在
- 检查 Electron 运行时二进制是否存在
- 检查 `electron-builder` 是否存在
- 在 Linux 上附带检查 GTK 备用运行时

自动修复模式当前会做的事情：

- 执行 `npm install` 安装项目依赖
- 执行 `node node_modules/electron/install.js` 补装 Electron 运行时

自动修复模式当前不会直接做的事情：

- 不会自动安装或升级系统级 Node.js
- 不会自动调用 `winget` / `apt` / `brew` 等系统包管理器
- 不会静默执行需要管理员权限的系统级修改

原因：

- 这些行为高度依赖平台、权限和企业网络策略
- 检测脚本会给出精确的安装命令，由使用者决定是否执行
