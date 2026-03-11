#!/bin/bash
# Serve conductor-web connecting to a remote jarvis-server backend.
# Usage: ./serve-remote.sh [BACKEND_IP]
# Example: ./serve-remote.sh 192.168.0.119

BACKEND_IP="${1:-192.168.0.119}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_FILE="$SCRIPT_DIR/proxy.conf.remote.json"

echo "==> Jarvis backend: $BACKEND_IP:12900"

sed "s/BACKEND_IP/$BACKEND_IP/g" "$SCRIPT_DIR/proxy.conf.remote.example.json" > "$PROXY_FILE"

echo "==> Generated $PROXY_FILE"
echo "==> Starting ng serve..."
echo ""
echo "    Open: http://localhost:4200/jarvis-ui"
echo ""

cd "$SCRIPT_DIR" && npx ng serve --proxy-config proxy.conf.remote.json
