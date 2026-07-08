const path = require("path");
const { app, BrowserWindow, ipcMain, screen } = require("electron");

const REMINDER_INTERVAL_MS = 20 * 60 * 1000;
const AUTO_HIDE_MS = 20 * 1000;
const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 180;
const IS_MAC = process.platform === "darwin";
const IS_LINUX = process.platform === "linux";

let reminderWindow = null;
let hideTimer = null;
let intervalTimer = null;
let dockFlashTimer = null;
let topmostEnabled = true;
let hasShownReminder = false;

app.setAppUserModelId("com.codex.twentytwentytwentyreminder");

function createReminderWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  reminderWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: Math.max(0, width - WINDOW_WIDTH - 24),
    y: 24,
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
    alwaysOnTop: topmostEnabled,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (IS_LINUX) {
    reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  reminderWindow.setAlwaysOnTop(topmostEnabled, "screen-saver");
  reminderWindow.setFullScreenable(false);
  reminderWindow.setMenuBarVisibility(false);
  reminderWindow.setHiddenInMissionControl(false);
  reminderWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  reminderWindow.on("blur", () => {
    if (!hasShownReminder || !topmostEnabled || !reminderWindow?.isVisible()) {
      return;
    }

    disableTopmostPermanently();
  });

  reminderWindow.on("closed", () => {
    reminderWindow = null;
  });
}

function disableTopmostPermanently() {
  if (!reminderWindow || reminderWindow.isDestroyed() || !topmostEnabled) {
    return;
  }

  topmostEnabled = false;
  reminderWindow.setAlwaysOnTop(false);
  if (IS_LINUX) {
    reminderWindow.setVisibleOnAllWorkspaces(false);
  }
  reminderWindow.webContents.send("topmost-disabled");
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

  hasShownReminder = true;
  if (IS_LINUX) {
    reminderWindow.setVisibleOnAllWorkspaces(topmostEnabled, { visibleOnFullScreen: true });
  }

  reminderWindow.setAlwaysOnTop(topmostEnabled, topmostEnabled ? "screen-saver" : "normal");
  reminderWindow.setSkipTaskbar(false);
  reminderWindow.webContents.send("reminder-state", {
    topmostEnabled,
    autoHideSeconds: AUTO_HIDE_MS / 1000,
    platform: process.platform
  });

  if (topmostEnabled) {
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
  }, AUTO_HIDE_MS);
}

function startReminderLoop() {
  showReminder();
  intervalTimer = setInterval(showReminder, REMINDER_INTERVAL_MS);
}

app.whenReady().then(() => {
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
