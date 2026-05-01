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

DEST_ROOT="${BUILTIN_APPS_DIR:-/opt/apteva/apps}"
DEST="$DEST_ROOT/demo"

echo "→ Building..."
bun run build

echo "→ Installing into $DEST"
mkdir -p "$DEST/dist"
rm -rf "$DEST/dist"/*
cp -r dist/* "$DEST/dist"/
cp apteva.yaml "$DEST/apteva.yaml"

echo "✓ Installed. Restart apteva-server to pick up the manifest."
echo "  After restart, the demo app appears in the dashboard's Apps tab"
echo "  ready to install with one click. Or open /demo/ directly once"
echo "  the install completes."
