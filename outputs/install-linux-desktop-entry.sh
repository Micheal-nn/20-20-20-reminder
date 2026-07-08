#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$HOME/.local/share/applications"
mkdir -p "$APP_DIR"

install -m 0644 \
  "/home/michaelma/Documents/Codex/2026-07-08/20min-20s-20s/outputs/com.codex.twentytwentytwentyreminder.desktop" \
  "$APP_DIR/com.codex.twentytwentytwentyreminder.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
fi

echo "Installed desktop entry to $APP_DIR/com.codex.twentytwentytwentyreminder.desktop"
