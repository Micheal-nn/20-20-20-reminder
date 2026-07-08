const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("reminderApp", {
  dismiss: () => ipcRenderer.send("dismiss-reminder"),
  onReminderState: (callback) => {
    ipcRenderer.on("reminder-state", (_event, payload) => callback(payload));
  },
  onTopmostDisabled: (callback) => {
    ipcRenderer.on("topmost-disabled", () => callback());
  }
});
