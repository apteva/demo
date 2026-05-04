#!/usr/bin/env bash
# Copy the built `demo` bundle into apteva-server's app catalog so the
# server picks it up without going through the marketplace install
# flow (which would otherwise want to clone the GitHub source).
#
# The server scans BUILTIN_APPS_DIR (default /opt/apteva/apps) on
# every boot and registers every apteva.yaml it finds. Locally the
# default path doesn't exist, so we either:
#
#   1. Drop the `demo/` folder under whatever directory the local
#      apteva-server uses (matches simple's pattern), OR
#   2. SQL-insert the apps row directly (faster path during dev).
#
# This script does (1) — copies dist/ + apteva.yaml under
# BUILTIN_APPS_DIR/demo/. Restart apteva-server afterwards to pick up
# the new manifest.
#
# Usage:
#   ./scripts/install-into-server.sh
#   BUILTIN_APPS_DIR=/custom/path ./scripts/install-into-server.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Default to a writable per-user location for local dev. The docker
# image presets BUILTIN_APPS_DIR=/opt/apteva/apps so prod still works.
DEFAULT_LOCAL_DIR="${HOME}/.apteva/builtin-apps"
if [[ -z "${BUILTIN_APPS_DIR:-}" ]]; then
  if [[ -d /opt/apteva/apps && -w /opt/apteva/apps ]]; then
    BUILTIN_APPS_DIR=/opt/apteva/apps
  else
    BUILTIN_APPS_DIR="$DEFAULT_LOCAL_DIR"
  fi
fi
DEST_ROOT="$BUILTIN_APPS_DIR"
DEST="$DEST_ROOT/demo"

echo "→ Building..."
bun run build

echo "→ Installing into $DEST"
mkdir -p "$DEST/dist"
rm -rf "$DEST/dist"/*
cp -r dist/* "$DEST/dist"/
cp apteva.yaml "$DEST/apteva.yaml"

echo
echo "✓ Installed at $DEST"
echo
echo "Run apteva locally so it picks this up:"
echo
echo "    BUILTIN_APPS_DIR=$DEST_ROOT $(cd "$(dirname "$0")/../.." && pwd)/apteva/apteva"
echo
echo "Then open the dashboard → Apps tab → install \"Demo Runner\","
echo "or open /demo/ directly once the install completes."
