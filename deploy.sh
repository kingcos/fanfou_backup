#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/fanfou_backup"
DIST_DIR="$APP_DIR/dist"

echo "→ Running tests..."
cd "$APP_DIR"
npm test

echo "→ Building..."
npm run build

echo "→ Copying dist to repo root..."
cp -r "$DIST_DIR/." "$SCRIPT_DIR/"

echo "✓ Done. Files copied to repo root."
