const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("reminderApp", {
  dismiss: () => ipcRenderer.send("dismiss-reminder"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  setSettingsPanelOpen: (isOpen) => ipcRenderer.send("set-settings-panel-open", isOpen),
  onReminderState: (callback) => {
    ipcRenderer.on("reminder-state", (_event, payload) => callback(payload));
  },
  onSettingsState: (callback) => {
    ipcRenderer.on("settings-state", (_event, payload) => callback(payload));
  }
});
