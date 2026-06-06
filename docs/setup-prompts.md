# Agent Setup Prompts

Copy one of the prompts below and paste it directly into your AI agent. The agent will handle the setup and prompt you for anything it needs from you (API key, network names, etc.).

---

## Claude Code (local setup)

Use this if you want the MCP server running on your local machine, connected to Claude Code or Claude Desktop.

Paste into Claude Code:

```
I want to set up the Google Maps MCP server from https://github.com/YatharthLakhera/google-map-mcp on this machine so I can use it in Claude Code and Claude Desktop.

Please do the following:
1. Clone the repo into a sensible location if it isn't already cloned
2. Run ./scripts/setup.sh — it will install dependencies, build the project, and write the config files. When it asks for an API key, pause and tell me what I need to do to get one if I don't have one yet (I need "Places API (New)" enabled in Google Cloud Console — not the legacy "Places API")
3. Once the setup script finishes, confirm Claude Code picked up the MCP server by checking .claude/settings.json and telling me what the node command path is
4. Run the e2e smoke test with: node scripts/test-e2e.js
5. Tell me the results and whether anything needs fixing
6. If Claude Desktop is installed, tell me whether the config was added there too and how to verify it's working

At any step where you need something from me (API key, confirmation, etc.), stop and ask clearly before continuing.
```

---

## Hermes on a VPS (Docker setup)

Use this if you have Hermes running in Docker on a VPS (e.g. Hostinger) and want the MCP server running as a sidecar container on the same internal network.

Paste into Hermes:

```
I want you to set up a Google Maps MCP server on this VPS and connect it to yourself.

Repo: https://github.com/YatharthLakhera/google-map-mcp

Steps:

1. Clone the repo into a sensible location (e.g. /opt/google-map-mcp)

2. Copy env.docker.example to .env and fill in:
   - GOOGLE_PLACES_API_KEY = (pause here and ask me for this — do not proceed without it)
   - MCP_AUTH_TOKEN = generate a secure random token with: openssl rand -hex 32
     Save this value — you will need it for your MCP config and I will need it too
   - HERMES_NETWORK = the name of the Docker network you are currently running on
     Find it with: docker inspect <your-container-name> | grep -i network
     or: docker network ls
   - HERMES_NETWORK_EXTERNAL = true

3. Run: docker compose up -d --build

4. Confirm it started: docker compose logs google-maps-mcp
   You should see: "SSE server listening on :3000"
   If you see an error, diagnose and fix it before continuing.

5. Add the MCP server to your own MCP config:
   - URL: http://google-maps-mcp:3000/sse
   - Auth header: Authorization: Bearer <the MCP_AUTH_TOKEN from step 2>

6. Reload your MCP connections and confirm these 9 tools are available:
   search_nearby_places, search_text_places, get_place_details, get_place_photos,
   find_low_visibility_businesses, batch_get_place_details, get_rate_limit_status,
   get_cache_stats, clear_expired_cache

7. Run a smoke test: call search_text_places with query "coffee shops in New Delhi"
   and max_results 3 — verify you get results back with placeIds

8. Report back with:
   - The MCP_AUTH_TOKEN you generated (so I can store it securely)
   - The Docker network name you attached to
   - Whether the smoke test passed

The container is configured with restart: unless-stopped so it will recover
automatically on crash or VPS reboot. The SQLite cache is stored in a Docker
volume and persists across restarts.

Pause at step 2 to ask me for the Google Places API key before doing anything else.
```

---

## What the agent will ask you for

Regardless of which prompt you use, have these ready:

| Item | How to get it |
|------|--------------|
| Google Places API key | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create credentials → API key. Then enable **Places API (New)** under APIs & Services → Library (search for "Places API (New)" — it's separate from the legacy one) |
| Billing account on Google Cloud | Required for Places API (New). Google gives $200/month free credit — well above typical usage |

For the Hermes/VPS setup only:

| Item | How to get it |
|------|--------------|
| Docker network name | The agent will find it automatically via `docker inspect` |
| MCP auth token | The agent generates it with `openssl rand -hex 32` — you just need to store it |
