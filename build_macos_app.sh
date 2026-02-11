#!/usr/bin/env bash
set -euo pipefail

APP_NAME="SavantVideoTool"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

echo "Building from: $(pwd)"

if [[ ! -f "desktop_app.py" ]]; then
  echo "Error: desktop_app.py not found. Run this script from the Savant-Video-Tool repo." >&2
  exit 1
fi

python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt pyinstaller

pyinstaller \
  --noconfirm \
  --windowed \
  --name "$APP_NAME" \
  --add-data "templates:templates" \
  desktop_app.py

echo "Build complete: $SCRIPT_DIR/dist/${APP_NAME}.app"
