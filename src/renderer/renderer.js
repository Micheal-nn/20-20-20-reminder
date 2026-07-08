const dismissButton = document.getElementById("dismiss");
const toggleSettingsButton = document.getElementById("toggle-settings");
const topmostStatus = document.getElementById("topmost-status");
const countdown = document.getElementById("countdown");
const settingsPanel = document.getElementById("settings-panel");
const settingsForm = document.getElementById("settings-form");
const autoLaunchInput = document.getElementById("auto-launch");
const durationInput = document.getElementById("duration-seconds");
const intervalInput = document.getElementById("interval-minutes");
const alwaysOnTopInput = document.getElementById("always-on-top");
const settingsFeedback = document.getElementById("settings-feedback");
let countdownTimer = null;
let limits = null;

dismissButton.addEventListener("click", () => {
  window.reminderApp.dismiss();
});

toggleSettingsButton.addEventListener("click", () => {
  settingsPanel.open = !settingsPanel.open;
});

settingsPanel.addEventListener("toggle", () => {
  window.reminderApp.setSettingsPanelOpen(settingsPanel.open);
});

function startCountdown(totalSeconds) {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
  }

  let remaining = totalSeconds;
  countdown.textContent = `${remaining}s`;

  countdownTimer = window.setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    countdown.textContent = `${remaining}s`;

    if (remaining === 0) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

function setFeedback(message, isError = false) {
  settingsFeedback.hidden = !message;
  settingsFeedback.textContent = message;
  settingsFeedback.dataset.tone = isError ? "error" : "success";
}

function fillForm(settings, nextLimits) {
  limits = nextLimits;
  autoLaunchInput.checked = settings.autoLaunch;
  durationInput.value = String(settings.reminderDurationSeconds);
  durationInput.min = String(limits.reminderDurationSeconds.min);
  durationInput.max = String(limits.reminderDurationSeconds.max);
  intervalInput.value = String(settings.reminderIntervalMinutes);
  intervalInput.min = String(limits.reminderIntervalMinutes.min);
  intervalInput.max = String(limits.reminderIntervalMinutes.max);
  alwaysOnTopInput.checked = settings.alwaysOnTop;
}

function validateForm() {
  const durationSeconds = Number(durationInput.value);
  const intervalMinutes = Number(intervalInput.value);

  if (!Number.isFinite(durationSeconds) || durationSeconds < limits.reminderDurationSeconds.min || durationSeconds > limits.reminderDurationSeconds.max) {
    return `提醒时长需在 ${limits.reminderDurationSeconds.min} 到 ${limits.reminderDurationSeconds.max} 秒之间。`;
  }

  if (!Number.isFinite(intervalMinutes) || intervalMinutes < limits.reminderIntervalMinutes.min || intervalMinutes > limits.reminderIntervalMinutes.max) {
    return `提醒间隔需在 ${limits.reminderIntervalMinutes.min} 到 ${limits.reminderIntervalMinutes.max} 分钟之间。`;
  }

  return null;
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const validationError = validateForm();
  if (validationError) {
    setFeedback(validationError, true);
    return;
  }

  const payload = {
    autoLaunch: autoLaunchInput.checked,
    reminderDurationSeconds: Number(durationInput.value),
    reminderIntervalMinutes: Number(intervalInput.value),
    alwaysOnTop: alwaysOnTopInput.checked
  };

  const state = await window.reminderApp.saveSettings(payload);
  fillForm(state.settings, state.limits);
  setFeedback("设置已保存并生效。");
});

window.reminderApp.onReminderState(({ alwaysOnTop, autoHideSeconds }) => {
  topmostStatus.textContent = alwaysOnTop
    ? "当前提醒会常驻于所有窗口之上"
    : "当前提醒不会常驻置顶";
  startCountdown(autoHideSeconds);
});

window.reminderApp.onSettingsState(({ settings, limits: nextLimits, settingsPanelOpen }) => {
  fillForm(settings, nextLimits);
  settingsPanel.open = settingsPanelOpen;
});

window.reminderApp.getSettings().then(({ settings, limits: nextLimits, settingsPanelOpen }) => {
  fillForm(settings, nextLimits);
  settingsPanel.open = settingsPanelOpen;
});
