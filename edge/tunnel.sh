#!/usr/bin/env bash
# tunnel.sh — Run this on the BACKEND machine (the one running test_ws_server.py).
# It exposes the local WebSocket server via a free Cloudflare quick tunnel.
#
# Usage:
#   1. Start the backend:   python test_ws_server.py
#   2. In another terminal:  ./tunnel.sh
#   3. Copy the tunnel URL printed below and set it on the edge device:
#        export EDGE_WS_URL=wss://<tunnel-url>/ws/edge
#        python main.py

set -euo pipefail

PORT="${1:-8000}"

# --- Install cloudflared if missing ---
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    if [[ "$(uname -m)" == "aarch64" ]]; then
        # Jetson Nano / ARM64
        curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
    else
        # x86_64
        curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    fi
    sudo dpkg -i /tmp/cloudflared.deb
    rm /tmp/cloudflared.deb
    echo "cloudflared installed."
fi

echo ""
echo "Starting Cloudflare tunnel to localhost:${PORT}..."
echo "Look for the line with 'https://<random>.trycloudflare.com'"
echo "On the edge device, run:"
echo "  export EDGE_WS_URL=wss://<that-url>/ws/edge"
echo "  python main.py"
echo ""

cloudflared tunnel --url http://localhost:${PORT}
