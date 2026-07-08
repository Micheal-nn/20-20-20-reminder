const dismissButton = document.getElementById("dismiss");
const topmostStatus = document.getElementById("topmost-status");
const countdown = document.getElementById("countdown");
let countdownTimer = null;

dismissButton.addEventListener("click", () => {
  window.reminderApp.dismiss();
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

window.reminderApp.onReminderState(({ topmostEnabled, autoHideSeconds }) => {
  topmostStatus.textContent = topmostEnabled
    ? "当前提醒会先置顶；点击桌面或其他应用后，后续提醒永久取消置顶"
    : "已永久取消置顶，后续提醒会保持普通窗口层级";
  startCountdown(autoHideSeconds);
});

window.reminderApp.onTopmostDisabled(() => {
  topmostStatus.textContent = "已永久取消置顶，后续提醒会保持普通窗口层级";
});
