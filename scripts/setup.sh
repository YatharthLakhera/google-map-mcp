#!/usr/bin/env bash
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_ENTRY="$REPO_DIR/dist/index.js"

echo ""
echo -e "${BOLD}Google Maps MCP — Setup${RESET}"
echo "────────────────────────────────────"

# ── 1. Node version check ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[1/5] Checking Node.js...${RESET}"
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install Node 18+ from https://nodejs.org${RESET}"
  exit 1
fi
NODE_VERSION=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo -e "${RED}✗ Node.js $NODE_VERSION found but 18+ is required.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $NODE_VERSION${RESET}"

# ── 2. Install dependencies ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[2/5] Installing dependencies...${RESET}"
cd "$REPO_DIR"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${RESET}"

# ── 3. Build ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[3/5] Building...${RESET}"
npm run build
echo -e "${GREEN}✓ Built → dist/index.js${RESET}"

# ── 4. API key ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[4/5] Google Places API key${RESET}"
echo "  Get one at: https://console.cloud.google.com/apis/credentials"
echo "  Make sure 'Places API (New)' is enabled (not the legacy 'Places API')."
echo ""

if [ -n "${GOOGLE_PLACES_API_KEY:-}" ]; then
  API_KEY="$GOOGLE_PLACES_API_KEY"
  echo -e "${GREEN}✓ Using key from \$GOOGLE_PLACES_API_KEY${RESET}"
else
  read -rp "  Paste your API key: " API_KEY
  if [ -z "$API_KEY" ]; then
    echo -e "${YELLOW}⚠ No key provided — skipping config generation. You can run this script again later.${RESET}"
    API_KEY="YOUR_API_KEY_HERE"
  fi
fi

# ── 5. Write configs ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[5/5] Writing config files...${RESET}"

# .claude/settings.json (Claude Code — project-local)
mkdir -p "$REPO_DIR/.claude"
cat > "$REPO_DIR/.claude/settings.json" <<JSON
{
  "mcpServers": {
    "google-maps": {
      "command": "node",
      "args": ["$DIST_ENTRY"],
      "env": {
        "GOOGLE_PLACES_API_KEY": "$API_KEY",
        "RATE_LIMIT_PER_DAY": "1000"
      }
    }
  }
}
JSON
echo -e "${GREEN}✓ Claude Code config written → .claude/settings.json${RESET}"

# Claude Desktop config
DESKTOP_CONFIG_DIR=""
if [[ "$OSTYPE" == "darwin"* ]]; then
  DESKTOP_CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  DESKTOP_CONFIG_DIR="${APPDATA:-$HOME/AppData/Roaming}/Claude"
fi

if [ -n "$DESKTOP_CONFIG_DIR" ]; then
  DESKTOP_CONFIG="$DESKTOP_CONFIG_DIR/claude_desktop_config.json"
  MCP_BLOCK="{\"command\":\"node\",\"args\":[\"$DIST_ENTRY\"],\"env\":{\"GOOGLE_PLACES_API_KEY\":\"$API_KEY\",\"RATE_LIMIT_PER_DAY\":\"1000\"}}"

  if [ -f "$DESKTOP_CONFIG" ]; then
    # Check if already registered
    if grep -q '"google-maps"' "$DESKTOP_CONFIG" 2>/dev/null; then
      echo -e "${YELLOW}⚠ Claude Desktop config already has 'google-maps' entry — skipping (edit manually if needed).${RESET}"
      echo "  Path: $DESKTOP_CONFIG"
    else
      # Merge into existing config using node
      node - "$DESKTOP_CONFIG" "$MCP_BLOCK" <<'NODEEOF'
const fs = require('fs');
const configPath = process.argv[1];
const newBlock = JSON.parse(process.argv[2]);
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers['google-maps'] = newBlock;
fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
NODEEOF
      echo -e "${GREEN}✓ Claude Desktop config updated → $DESKTOP_CONFIG${RESET}"
    fi
  else
    mkdir -p "$DESKTOP_CONFIG_DIR"
    node - "$DESKTOP_CONFIG" "$MCP_BLOCK" <<'NODEEOF'
const fs = require('fs');
const configPath = process.argv[1];
const newBlock = JSON.parse(process.argv[2]);
const cfg = { mcpServers: { 'google-maps': newBlock } };
fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
NODEEOF
    echo -e "${GREEN}✓ Claude Desktop config created → $DESKTOP_CONFIG${RESET}"
  fi
fi

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}────────────────────────────────────${RESET}"
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo "  Next steps:"
echo "  • Claude Code  → open this folder, run /mcp to confirm the server loaded"
echo "  • Claude Desktop → restart the app — tools will appear automatically"
echo ""
echo "  To rebuild after code changes:"
echo "  ./scripts/restart.sh"
echo ""
