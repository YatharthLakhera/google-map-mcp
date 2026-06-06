#!/usr/bin/env bash
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RESET="\033[0m"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo -e "${BOLD}Google Maps MCP — Rebuild & Restart${RESET}"
echo "────────────────────────────────────"

# ── Build ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Building...${RESET}"
cd "$REPO_DIR"
npm run build
echo -e "${GREEN}✓ dist/index.js updated${RESET}"

# ── Claude Code ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Claude Code${RESET}"
echo -e "  Type ${YELLOW}/mcp${RESET} in the Claude Code prompt to reload MCP servers."
echo "  (Claude Code detects file changes automatically on most setups.)"

# ── Claude Desktop ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Claude Desktop${RESET}"

if [[ "$OSTYPE" == "darwin"* ]]; then
  if pgrep -x "Claude" &>/dev/null; then
    echo "  Claude Desktop is running. Restarting it now..."
    osascript -e 'quit app "Claude"' 2>/dev/null || true
    sleep 1
    open -a "Claude" 2>/dev/null && echo -e "${GREEN}✓ Claude Desktop restarted${RESET}" || \
      echo -e "${YELLOW}  Could not auto-launch Claude Desktop — open it manually.${RESET}"
  else
    echo "  Claude Desktop is not running — no restart needed."
  fi
else
  echo "  Restart Claude Desktop manually to pick up the rebuilt server."
fi

echo ""
echo -e "${BOLD}────────────────────────────────────${RESET}"
echo -e "${GREEN}${BOLD}Done.${RESET} MCP server is running the latest build."
echo ""
