#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const mode = process.argv.includes("--fix") ? "fix" : "check";
const platform = process.platform;
const nodeMajor = Number(process.versions.node.split(".")[0]);
const requiredNodeMajor = 20;
const requiredNpmMajor = 10;

const results = [];
const warnings = [];
const fixes = [];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    shell: false
  });
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function addResult(status, title, detail) {
  results.push({ status, title, detail });
}

function addWarning(detail) {
  warnings.push(detail);
}

function addFix(title, fn) {
  fixes.push({ title, fn });
}

function parseMajor(versionText) {
  const match = String(versionText || "").match(/(\d+)\./);
  return match ? Number(match[1]) : null;
}

function detectNpm() {
  const userAgentMatch = (process.env.npm_config_user_agent || "").match(/npm\/(\d+\.\d+\.\d+)/);
  let npmVersion = userAgentMatch ? userAgentMatch[1] : "";

  if (!npmVersion && process.env.npm_execpath) {
    const npmByNode = run(process.execPath, [process.env.npm_execpath, "--version"]);
    npmVersion = [npmByNode.stdout, npmByNode.stderr]
      .join("\n")
      .split(/\s+/)
      .find((token) => /^\d+\.\d+\.\d+$/.test(token)) || "";
  }

  if (!npmVersion && platform !== "win32") {
    const npmByShell = run("bash", ["-lc", "npm --version"]);
    npmVersion = [npmByShell.stdout, npmByShell.stderr]
      .join("\n")
      .split(/\s+/)
      .find((token) => /^\d+\.\d+\.\d+$/.test(token)) || "";
  }

  if (!npmVersion) {
    addResult("fail", "npm", "未检测到可用的 npm。");
    return;
  }

  const npmMajor = parseMajor(npmVersion);
  if (npmMajor === null || npmMajor < requiredNpmMajor) {
    addResult("fail", "npm", `当前版本 ${npmVersion}，要求 >= ${requiredNpmMajor}.x。`);
  } else {
    addResult("pass", "npm", `版本 ${npmVersion}`);
  }
}

function detectNode() {
  if (nodeMajor < requiredNodeMajor) {
    addResult("fail", "Node.js", `当前版本 ${process.versions.node}，要求 >= ${requiredNodeMajor}.0.0。`);
  } else {
    addResult("pass", "Node.js", `版本 ${process.versions.node}`);
  }
}

function detectDesktopSession() {
  if (platform === "linux") {
    const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
    if (!hasDisplay) {
      addResult("warn", "图形桌面会话", "未检测到 DISPLAY 或 WAYLAND_DISPLAY；当前终端可能无法直接启动桌面应用。");
    } else {
      addResult("pass", "图形桌面会话", "已检测到图形桌面环境。");
    }
  } else {
    addResult("pass", "图形桌面会话", "该检查在当前平台交由系统图形会话处理。");
  }
}

function detectProjectDependencies() {
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  const electronPkgPath = path.join(nodeModulesPath, "electron");
  const electronDistPath = path.join(electronPkgPath, "dist");
  const builderPkgPath = path.join(nodeModulesPath, "electron-builder");

  if (!exists(nodeModulesPath)) {
    addResult("fail", "项目依赖", "未检测到 node_modules。");
    addFix("安装项目依赖", () => run("npm", ["install"], { stdio: "inherit" }));
    return;
  }

  addResult("pass", "项目依赖", "已检测到 node_modules。");

  if (!exists(electronPkgPath)) {
    addResult("fail", "Electron 包", "未检测到 electron 包。");
    addFix("安装 Electron 依赖", () => run("npm", ["install"], { stdio: "inherit" }));
  } else {
    addResult("pass", "Electron 包", "electron 包已存在。");
  }

  if (!exists(electronDistPath)) {
    addResult("fail", "Electron 运行时", "Electron 运行时缺失，通常是安装脚本未成功下载二进制。");
    addFix("补装 Electron 运行时", () => run("node", ["node_modules/electron/install.js"], { stdio: "inherit" }));
  } else {
    addResult("pass", "Electron 运行时", "Electron 运行时已存在。");
  }

  if (!exists(builderPkgPath)) {
    addResult("warn", "electron-builder", "未检测到 electron-builder；打包命令不可用。");
    addFix("安装打包依赖", () => run("npm", ["install"], { stdio: "inherit" }));
  } else {
    addResult("pass", "electron-builder", "已检测到 electron-builder。");
  }
}

function detectOptionalGtkRuntime() {
  if (platform !== "linux") {
    return;
  }

  const pythonCheck = run("python3", ["-c", "import sys; print(sys.version.split()[0])"]);
  if (pythonCheck.status !== 0) {
    addResult("warn", "GTK 备用运行时", "未检测到 python3；Linux GTK 备用实现不可用。");
    return;
  }

  const giCheck = run("python3", ["-c", "import gi; gi.require_version('Gtk', '3.0'); from gi.repository import Gtk; print(Gtk.MAJOR_VERSION)"]);
  if (giCheck.status !== 0) {
    addResult("warn", "GTK 备用运行时", "python3 已存在，但缺少 PyGObject / GTK 3。");
  } else {
    addResult("pass", "GTK 备用运行时", `python3 ${pythonCheck.stdout.trim()}，GTK 可用。`);
  }
}

function printSystemInstallHints() {
  console.log("\n系统级依赖安装建议：");

  if (platform === "win32") {
    console.log("- 安装或升级 Node.js 20 LTS+: `winget install OpenJS.NodeJS.LTS`");
    console.log("- 升级 npm: `npm install -g npm@latest`");
  } else if (platform === "darwin") {
    console.log("- 安装 Homebrew 后执行: `brew install node`");
    console.log("- 升级 npm: `npm install -g npm@latest`");
  } else {
    console.log("- Ubuntu/Debian 安装 Node.js 20+: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`");
    console.log("- Ubuntu/Debian 安装 GTK 备用运行时: `sudo apt-get install -y python3-gi gir1.2-gtk-3.0`");
    console.log("- 升级 npm: `sudo npm install -g npm@latest`");
  }
}

function runFixes() {
  if (fixes.length === 0) {
    console.log("\n无需自动修复。");
    return;
  }

  console.log("\n开始执行可自动修复项：");
  for (const fix of fixes) {
    console.log(`- ${fix.title}`);
    const result = fix.fn();
    if (result.status !== 0) {
      addWarning(`${fix.title} 执行失败，退出码 ${result.status}。`);
    }
  }
}

function printResults() {
  console.log(`20-20-20 Reminder 环境检测 (${mode === "fix" ? "自动修复模式" : "只读检测模式"})`);
  console.log(`项目: ${packageJson.name} ${packageJson.version}`);
  console.log(`平台: ${platform} ${process.arch}`);
  console.log("");

  for (const result of results) {
    const icon = result.status === "pass" ? "OK " : result.status === "warn" ? "WARN" : "FAIL";
    console.log(`[${icon}] ${result.title}: ${result.detail}`);
  }

  if (warnings.length > 0) {
    console.log("\n额外提示：");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

detectNode();
detectNpm();
detectDesktopSession();
detectProjectDependencies();
detectOptionalGtkRuntime();

printResults();
printSystemInstallHints();

if (mode === "fix") {
  runFixes();
}

const hasFailures = results.some((result) => result.status === "fail");
process.exitCode = hasFailures ? 1 : 0;
