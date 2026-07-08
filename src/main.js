const path = require("path");
const fs = require("fs");
const os = require("os");
const { app, BrowserWindow, ipcMain, screen } = require("electron");

const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT_COLLAPSED = 260;
const WINDOW_HEIGHT_EXPANDED = 470;
const IS_MAC = process.platform === "darwin";
const IS_LINUX = process.platform === "linux";
const DEFAULT_SETTINGS = Object.freeze({
  autoLaunch: false,
  reminderDurationSeconds: 20,
  reminderIntervalMinutes: 20,
  alwaysOnTop: false
});
const SETTINGS_LIMITS = Object.freeze({
  reminderDurationSeconds: { min: 20, max: 5 * 60 },
  reminderIntervalMinutes: { min: 10, max: 60 }
});
const APP_ID = "com.codex.twentytwentytwentyreminder";
const LINUX_AUTOSTART_FILE = path.join(os.homedir(), ".config", "autostart", `${APP_ID}.desktop`);

let reminderWindow = null;
let hideTimer = null;
let intervalTimer = null;
let dockFlashTimer = null;
let settingsPanelOpen = false;
let appSettings = null;

app.setAppUserModelId(APP_ID);

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeSettings(input) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(input || {})
  };

  return {
    autoLaunch: Boolean(merged.autoLaunch),
    reminderDurationSeconds: clamp(
      Number.isFinite(Number(merged.reminderDurationSeconds))
        ? Math.round(Number(merged.reminderDurationSeconds))
        : DEFAULT_SETTINGS.reminderDurationSeconds,
      SETTINGS_LIMITS.reminderDurationSeconds.min,
      SETTINGS_LIMITS.reminderDurationSeconds.max
    ),
    reminderIntervalMinutes: clamp(
      Number.isFinite(Number(merged.reminderIntervalMinutes))
        ? Math.round(Number(merged.reminderIntervalMinutes))
        : DEFAULT_SETTINGS.reminderIntervalMinutes,
      SETTINGS_LIMITS.reminderIntervalMinutes.min,
      SETTINGS_LIMITS.reminderIntervalMinutes.max
    ),
    alwaysOnTop: Boolean(merged.alwaysOnTop)
  };
}

function getRuntimeState() {
  return {
    settings: appSettings,
    limits: SETTINGS_LIMITS,
    settingsPanelOpen
  };
}

function loadSettings() {
  let stored = {};

  try {
    stored = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
  } catch (_error) {
    stored = {};
  }

  const sanitized = sanitizeSettings(stored);
  sanitized.autoLaunch = readAutoLaunchStatus() ?? sanitized.autoLaunch;
  return sanitized;
}

function saveSettingsToDisk() {
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), `${JSON.stringify(appSettings, null, 2)}\n`, "utf8");
}

function escapeDesktopExecArg(value) {
  return `"${String(value).replace(/(["\\`$])/g, "\\$1")}"`;
}

function getLaunchArguments() {
  if (app.isPackaged) {
    return [];
  }

  return [app.getAppPath()];
}

function getLinuxAutostartDesktopEntry() {
  const args = getLaunchArguments();
  const execParts = [escapeDesktopExecArg(process.execPath), ...args.map(escapeDesktopExecArg)];

  return [
    "[Desktop Entry]",
    "Type=Application",
    "Version=1.0",
    "Name=20-20-20 Reminder",
    "Comment=Every 20 minutes, remind to look far away for 20 seconds",
    `Exec=${execParts.join(" ")}`,
    "Terminal=false",
    "Categories=Utility;",
    `StartupWMClass=${APP_ID}`,
    `Icon=${APP_ID}`
  ].join("\n");
}

function readAutoLaunchStatus() {
  if (IS_LINUX) {
    return fs.existsSync(LINUX_AUTOSTART_FILE);
  }

  if (IS_MAC || process.platform === "win32") {
    return app.getLoginItemSettings({
      path: process.execPath,
      args: getLaunchArguments()
    }).openAtLogin;
  }

  return null;
}

function applyAutoLaunchSetting(enabled) {
  if (IS_LINUX) {
    fs.mkdirSync(path.dirname(LINUX_AUTOSTART_FILE), { recursive: true });

    if (enabled) {
      fs.writeFileSync(LINUX_AUTOSTART_FILE, `${getLinuxAutostartDesktopEntry()}\n`, "utf8");
    } else if (fs.existsSync(LINUX_AUTOSTART_FILE)) {
      fs.unlinkSync(LINUX_AUTOSTART_FILE);
    }

    return;
  }

  if (IS_MAC || process.platform === "win32") {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
      path: process.execPath,
      args: getLaunchArguments()
    });
  }
}

function restartReminderLoop() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }

  startReminderLoop();
}

function positionReminderWindow(targetHeight = settingsPanelOpen ? WINDOW_HEIGHT_EXPANDED : WINDOW_HEIGHT_COLLAPSED) {
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { x: originX, y: originY } = display.workArea;
  const targetX = originX + Math.max(0, width - WINDOW_WIDTH - 24);
  const targetY = originY + Math.max(0, Math.min(24, height - targetHeight - 24));

  reminderWindow.setBounds({
    x: targetX,
    y: targetY,
    width: WINDOW_WIDTH,
    height: targetHeight
  }, false);
}

function syncRendererState() {
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    return;
  }

  reminderWindow.webContents.send("settings-state", getRuntimeState());
}

function createReminderWindow() {
  reminderWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT_COLLAPSED,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    movable: false,
    transparent: true,
    backgroundColor: "#00000000",
    focusable: true,
    alwaysOnTop: appSettings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (IS_LINUX) {
    reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  reminderWindow.setAlwaysOnTop(appSettings.alwaysOnTop, appSettings.alwaysOnTop ? "screen-saver" : "normal");
  reminderWindow.setFullScreenable(false);
  reminderWindow.setMenuBarVisibility(false);
  if (typeof reminderWindow.setHiddenInMissionControl === "function") {
    reminderWindow.setHiddenInMissionControl(false);
  }
  reminderWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  positionReminderWindow();

  reminderWindow.on("blur", () => {
    if (!appSettings.alwaysOnTop || !reminderWindow?.isVisible()) {
      return;
    }

    reminderWindow.moveTop();
    reminderWindow.focus();
  });

  reminderWindow.on("closed", () => {
    reminderWindow = null;
  });

  reminderWindow.webContents.on("did-finish-load", () => {
    syncRendererState();
  });
}

function stopTaskbarFlash() {
  if (dockFlashTimer) {
    clearInterval(dockFlashTimer);
    dockFlashTimer = null;
  }

  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.flashFrame(false);
  }

  if (IS_MAC) {
    app.dock?.setBadge?.("");
  }
}

function startTaskbarFlash() {
  stopTaskbarFlash();

  if (!reminderWindow || reminderWindow.isDestroyed()) {
    return;
  }

  if (IS_MAC) {
    app.dock?.show?.();
    app.dock?.setBadge?.("•");
  }

  reminderWindow.flashFrame(true);

  if (IS_LINUX) {
    dockFlashTimer = setInterval(() => {
      if (!reminderWindow || reminderWindow.isDestroyed() || !reminderWindow.isVisible()) {
        return;
      }

      reminderWindow.flashFrame(true);
    }, 1500);
  }
}

function hideReminder() {
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    return;
  }

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  reminderWindow.hide();
  stopTaskbarFlash();
}

function showReminder() {
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    return;
  }

  if (IS_LINUX) {
    reminderWindow.setVisibleOnAllWorkspaces(appSettings.alwaysOnTop, { visibleOnFullScreen: true });
  }

  reminderWindow.setAlwaysOnTop(appSettings.alwaysOnTop, appSettings.alwaysOnTop ? "screen-saver" : "normal");
  reminderWindow.setSkipTaskbar(false);
  reminderWindow.webContents.send("reminder-state", {
    alwaysOnTop: appSettings.alwaysOnTop,
    autoHideSeconds: appSettings.reminderDurationSeconds,
    platform: process.platform
  });
  syncRendererState();
  positionReminderWindow();

  if (appSettings.alwaysOnTop) {
    reminderWindow.show();
    reminderWindow.focus();
    reminderWindow.moveTop();
  } else {
    reminderWindow.showInactive();
  }

  startTaskbarFlash();

  if (hideTimer) {
    clearTimeout(hideTimer);
  }

  hideTimer = setTimeout(() => {
    hideReminder();
  }, appSettings.reminderDurationSeconds * 1000);
}

function startReminderLoop() {
  showReminder();
  intervalTimer = setInterval(showReminder, appSettings.reminderIntervalMinutes * 60 * 1000);
}

app.whenReady().then(() => {
  appSettings = loadSettings();
  applyAutoLaunchSetting(appSettings.autoLaunch);
  createReminderWindow();
  startReminderLoop();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createReminderWindow();
    }
  });
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  if (hideTimer) {
    clearTimeout(hideTimer);
  }

  stopTaskbarFlash();
});

ipcMain.on("dismiss-reminder", () => {
  hideReminder();
});

ipcMain.handle("get-settings", () => getRuntimeState());

ipcMain.handle("save-settings", (_event, nextSettings) => {
  appSettings = sanitizeSettings(nextSettings);
  saveSettingsToDisk();
  applyAutoLaunchSetting(appSettings.autoLaunch);
  restartReminderLoop();

  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.setAlwaysOnTop(appSettings.alwaysOnTop, appSettings.alwaysOnTop ? "screen-saver" : "normal");
    if (IS_LINUX) {
      reminderWindow.setVisibleOnAllWorkspaces(appSettings.alwaysOnTop, { visibleOnFullScreen: true });
    }
  }

  syncRendererState();
  return getRuntimeState();
});

ipcMain.on("set-settings-panel-open", (_event, isOpen) => {
  settingsPanelOpen = Boolean(isOpen);
  positionReminderWindow(settingsPanelOpen ? WINDOW_HEIGHT_EXPANDED : WINDOW_HEIGHT_COLLAPSED);
  syncRendererState();
});
