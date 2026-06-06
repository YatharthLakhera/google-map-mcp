# Google Maps MCP

A Model Context Protocol (MCP) server wrapping the **Google Places API (New, v1)**. Gives Claude Code and Claude Desktop agent-level access to place search, full place details, photos, and a business lead-gen tool — with a built-in SQLite cache to avoid burning API credits on repeat queries.

## Use cases

- Find high-rated restaurants / cafes / attractions near any coordinate
- Search for restaurants serving a specific dish by keyword
- Lead generation — surface businesses with no website and high ratings
- Batch-enrich a list of place IDs with full details + photos in one call

---

## Prerequisites

- **Node.js 18+** — check with `node -v`
- **npm 8+**
- A **Google Cloud project** with billing enabled
- **Places API (New)** enabled — search for `Places API (New)` in [Google Cloud Console → APIs & Services](https://console.cloud.google.com/apis/library). This is a separate entry from the legacy "Places API".

---

## Quick start

```bash
git clone https://github.com/your-username/google-map-mcp.git
cd google-map-mcp
./scripts/setup.sh
```

The setup script handles everything: dependency installation, build, and config generation for Claude Code and Claude Desktop.

---

## Manual setup

```bash
npm install
npm run build

# Copy and fill in your API key
cp env.example .env
# Edit .env — set GOOGLE_PLACES_API_KEY=your_key_here
```

Then follow the **Connecting** section below.

---

## Connecting to Claude

### Claude Code (project-local)

Edit `.claude/settings.json` in this repo root. Replace `YOUR_API_KEY_HERE`:

```json
{
  "mcpServers": {
    "google-maps": {
      "command": "node",
      "args": ["/absolute/path/to/google-map-mcp/dist/index.js"],
      "env": {
        "GOOGLE_PLACES_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

The server is active whenever you open this folder in Claude Code. Run `/mcp` inside Claude Code to confirm it connected.

### Claude Desktop (global)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "google-maps": {
      "command": "node",
      "args": ["/absolute/path/to/google-map-mcp/dist/index.js"],
      "env": {
        "GOOGLE_PLACES_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Desktop after saving. The tools will be available in every conversation.

---

## Available tools

| Tool | Description |
|------|-------------|
| `search_nearby_places` | Find places near a lat/lng within a radius. Supports type filters and POPULARITY / DISTANCE ranking. |
| `search_text_places` | Free-text search e.g. "best biryani in Hyderabad". Returns rated results with address and maps link. |
| `get_place_details` | Full details for a place ID — opening hours, reviews, price level, amenities, website, phone. Cached for 7 days. |
| `get_place_photos` | Fetch photo URLs for a place (up to N photos). URLs are ready for Claude vision analysis. |
| `find_low_visibility_businesses` | Lead-gen tool — finds businesses with high ratings but low online presence (no website). Returns a 0–100 `leadScore`. |
| `batch_get_place_details` | Enrich up to 10 place IDs in parallel. Cache-aware — cached results return instantly. |
| `get_rate_limit_status` | See how many API calls have been used in the current 24 h window, how many remain, and when the window resets. |
| `get_cache_stats` | Cache hit counts, DB location, and configured TTL. |
| `clear_expired_cache` | Delete cache rows older than the TTL. |

---

## Configuration

All options are set via environment variables in the MCP server config (or a `.env` file for local `npm start`).

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_PLACES_API_KEY` | *(required)* | Google Cloud API key with Places API (New) enabled |
| `RATE_LIMIT_PER_DAY` | `1000` | Max Google API calls per 24-hour window. Throws a clear error when exceeded. |
| `CACHE_TTL_SECONDS` | `604800` | Cache TTL — 7 days by default. Set lower for fresher data. |
| `CACHE_DB_PATH` | `~/.google-map-mcp/cache.db` | Override the SQLite cache location. |

---

## Rate limiting

The server enforces a **1 000 calls / 24 h** limit by default (configurable via `RATE_LIMIT_PER_DAY`). The counter is stored in SQLite so it survives server restarts within the same 24-hour window.

- Cache hits are **free** — they don't count against the limit.
- Each HTTP request to Google counts as 1 call. `get_place_photos` with 5 photos = 6 calls (1 for the list + 5 photo URLs).
- When the limit is exceeded the tool returns a clear error with the reset time.
- Check current usage anytime with `get_rate_limit_status`.

Google Maps Platform gives **$200 free credit / month**. At default field-mask tiers, 1 000 calls ≈ $32–40, well inside the free tier for typical usage.

---

## Caching

Place details and photos are cached in SQLite at `~/.google-map-mcp/cache.db` (outside the repo, never committed). The default TTL is 7 days — identical queries within that window hit the cache and cost nothing.

---

## Development

```bash
npm run dev          # tsx watch — hot-reload during development
npm run build        # production build via tsup (esbuild, ~500ms)
npm run build:typecheck  # tsc --noEmit type check only
./scripts/restart.sh # rebuild + instructions for reconnecting Claude
```

> **Do not use `tsc` to emit files** — it OOMs on this project due to deeply recursive MCP SDK generics. `tsup` is the only build tool; `tsc` is type-check only.

---

## Project structure

```
src/
  index.ts              # MCP server entry — all tools registered here
  places-client.ts      # Google Places API HTTP calls + field mask tiers
  types.ts              # TypeScript interfaces for API responses
  cache/db.ts           # SQLite cache + rate limiter (better-sqlite3)
  tools/
    search-nearby.ts
    search-text.ts
    get-place-details.ts
    get-place-photos.ts
    find-low-visibility.ts
scripts/
  setup.sh              # 1-click setup
  restart.sh            # rebuild + reconnect instructions
dist/
  index.js              # compiled output (gitignored)
```

---

## License

MIT
