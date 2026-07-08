#!/usr/bin/env python3

import math

import gi

gi.require_version("Gio", "2.0")
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")

from gi.repository import Gio, GLib, Gdk, Gtk  # noqa: E402


REMINDER_INTERVAL_SECONDS = 20 * 60
AUTO_HIDE_SECONDS = 20
APP_ID = "com.codex.twentytwentytwentyreminder"
WM_CLASS = "20-20-20-reminder"
APP_ICON_PATH = "/home/michaelma/Documents/Codex/2026-07-08/20min-20s-20s/outputs/20-20-20-reminder.svg"


class ReminderApp(Gtk.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.FLAGS_NONE)
        self.topmost_enabled = True
        self.has_shown_once = False
        self.auto_hide_source_id = None
        self.countdown_source_id = None
        self.remaining_seconds = AUTO_HIDE_SECONDS
        self.window = None

        self.connect("activate", self.on_activate)

    def on_activate(self, *_args):
        if self.window is not None:
            self.window.present()
            return

        self.window = Gtk.ApplicationWindow(application=self, title="20-20-20 Reminder")
        self.window.set_default_size(360, 180)
        self.window.set_resizable(False)
        self.window.set_decorated(False)
        self.window.set_keep_above(True)
        self.window.set_skip_taskbar_hint(False)
        self.window.set_type_hint(Gdk.WindowTypeHint.DIALOG)
        self.window.set_icon_name(APP_ID)
        if Gio.File.new_for_path(APP_ICON_PATH).query_exists():
            self.window.set_icon_from_file(APP_ICON_PATH)
        self.window.set_wmclass(WM_CLASS, WM_CLASS)
        self.window.set_position(Gtk.WindowPosition.NONE)
        self.window.set_border_width(0)
        self.window.connect("delete-event", self.on_delete_event)
        self.window.connect("focus-out-event", self.on_focus_out)
        self.window.connect("realize", self.on_realize)

        visual = self.window.get_screen().get_rgba_visual()
        if visual and self.window.get_screen().is_composited():
            self.window.set_visual(visual)
            self.window.set_app_paintable(True)

        self.overlay = Gtk.Overlay()
        self.window.add(self.overlay)

        frame = Gtk.Frame()
        frame.get_style_context().add_class("reminder-frame")
        self.overlay.add(frame)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        box.set_margin_top(18)
        box.set_margin_bottom(18)
        box.set_margin_start(18)
        box.set_margin_end(18)
        frame.add(box)

        eyebrow = Gtk.Label(label="20-20-20 BREAK")
        eyebrow.set_xalign(0)
        eyebrow.get_style_context().add_class("eyebrow")
        box.pack_start(eyebrow, False, False, 0)

        title = Gtk.Label(label="请远眺 20 秒")
        title.set_xalign(0)
        title.get_style_context().add_class("title")
        box.pack_start(title, False, False, 0)

        message = Gtk.Label(label="看向 20 英尺外，放松眼睛。提醒会在 20 秒后自动消失。")
        message.set_xalign(0)
        message.set_line_wrap(True)
        message.get_style_context().add_class("message")
        box.pack_start(message, False, False, 0)

        footer = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        box.pack_end(footer, False, False, 0)

        self.status_label = Gtk.Label(label="首次提醒会置顶显示")
        self.status_label.set_xalign(0)
        self.status_label.get_style_context().add_class("status")
        footer.pack_start(self.status_label, True, True, 0)

        self.countdown_label = Gtk.Label(label="20s")
        self.countdown_label.get_style_context().add_class("countdown")
        footer.pack_start(self.countdown_label, False, False, 0)

        close_button = Gtk.Button(label="提前关闭")
        close_button.connect("clicked", self.on_close_clicked)
        close_button.get_style_context().add_class("pill-button")
        footer.pack_end(close_button, False, False, 0)

        self.apply_css()
        self.window.hide()

        GLib.timeout_add_seconds(REMINDER_INTERVAL_SECONDS, self.on_interval)
        GLib.idle_add(self.show_reminder)

    def on_realize(self, *_args):
        gdk_window = self.window.get_window()
        if gdk_window is not None:
            gdk_window.set_urgency_hint(False)

    def apply_css(self):
        css = b"""
        window {
          background: transparent;
        }

        .reminder-frame {
          background-image: linear-gradient(135deg, rgba(20, 30, 48, 0.95), rgba(8, 15, 24, 0.92));
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 22px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        }

        .eyebrow {
          color: #7dd3fc;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.2em;
        }

        .title {
          color: #f7fbff;
          font-weight: 700;
          font-size: 28px;
        }

        .message, .status {
          color: rgba(247, 251, 255, 0.8);
          font-size: 14px;
        }

        .countdown {
          color: #f7fbff;
          font-weight: 700;
          font-size: 18px;
        }

        .pill-button {
          background-image: none;
          background-color: rgba(125, 211, 252, 0.18);
          border: 1px solid rgba(125, 211, 252, 0.42);
          border-radius: 999px;
          color: #f7fbff;
          padding: 8px 14px;
          box-shadow: none;
        }

        .pill-button:hover {
          background-color: rgba(125, 211, 252, 0.3);
        }
        """

        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

    def on_delete_event(self, *_args):
        self.hide_reminder()
        return True

    def on_close_clicked(self, *_args):
        self.hide_reminder()

    def on_focus_out(self, *_args):
        if self.has_shown_once and self.topmost_enabled and self.window.get_visible():
            self.topmost_enabled = False
            self.window.set_keep_above(False)
            self.status_label.set_text("已永久取消置顶，后续提醒保持普通层级")
        return False

    def on_interval(self):
        self.show_reminder()
        return True

    def position_window(self):
        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor() if display else None
        if not monitor:
            return

        geometry = monitor.get_workarea()
        window_width = 360
        x = geometry.x + geometry.width - window_width - 24
        y = geometry.y + 24
        self.window.move(max(geometry.x, x), y)

    def show_reminder(self):
        self.has_shown_once = True
        self.remaining_seconds = AUTO_HIDE_SECONDS
        self.update_countdown_label()
        self.status_label.set_text(
            "当前提醒会置顶显示，失焦后后续提醒不再置顶"
            if self.topmost_enabled
            else "已永久取消置顶，后续提醒保持普通层级"
        )
        self.window.set_keep_above(self.topmost_enabled)
        self.window.set_urgency_hint(True)
        self.position_window()
        self.window.show_all()
        self.window.present()
        self.push_attention_signals()

        if self.auto_hide_source_id:
            GLib.source_remove(self.auto_hide_source_id)
        if self.countdown_source_id:
            GLib.source_remove(self.countdown_source_id)

        self.auto_hide_source_id = GLib.timeout_add_seconds(AUTO_HIDE_SECONDS, self.on_auto_hide)
        self.countdown_source_id = GLib.timeout_add_seconds(1, self.on_countdown_tick)
        return False

    def hide_reminder(self):
        if self.auto_hide_source_id:
            GLib.source_remove(self.auto_hide_source_id)
            self.auto_hide_source_id = None
        if self.countdown_source_id:
            GLib.source_remove(self.countdown_source_id)
            self.countdown_source_id = None
        self.window.set_urgency_hint(False)
        self.withdraw_notification("eye-break-reminder")
        gdk_window = self.window.get_window()
        if gdk_window is not None:
            gdk_window.set_urgency_hint(False)
        self.window.hide()

    def on_auto_hide(self):
        self.hide_reminder()
        return False

    def on_countdown_tick(self):
        self.remaining_seconds = max(0, self.remaining_seconds - 1)
        self.update_countdown_label()
        return self.remaining_seconds > 0

    def update_countdown_label(self):
        self.countdown_label.set_text(f"{math.ceil(self.remaining_seconds)}s")

    def push_attention_signals(self):
        gdk_window = self.window.get_window()
        if gdk_window is not None:
            gdk_window.set_urgency_hint(True)

        notification = Gio.Notification.new("请远眺 20 秒")
        notification.set_body("看向 20 英尺外，放松眼睛。20 秒后会自动关闭提醒。")
        notification.set_priority(Gio.NotificationPriority.URGENT)
        self.send_notification("eye-break-reminder", notification)

    def run(self):
        return super().run(None)


if __name__ == "__main__":
    initialized, _argv = Gtk.init_check()
    if not initialized:
        raise SystemExit("No graphical display is available. Launch this app from a desktop session.")
    GLib.set_prgname(WM_CLASS)
    raise SystemExit(ReminderApp().run())
