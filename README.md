# Google Maps MCP

A Model Context Protocol (MCP) server that gives Claude Code and Claude Desktop agent-level access to the full Google Maps Platform — place search, geocoding, routing, directions, elevation, timezone, weather, air quality, static map images, and local SEO rank tracking. Built-in SQLite cache avoids burning API credits on repeat queries.

## Tools (25 total)

### Place discovery
| Tool | Description |
|---|---|
| `search_nearby_places` | Find places near a lat/lng by type. Supports POPULARITY / DISTANCE ranking. |
| `search_text_places` | Free-text search e.g. "best biryani in Hyderabad". Returns rated results with address and maps link. |
| `maps_search_places` | Natural language search with location bias, rating filter, open-now, and type filter. |
| `get_place_details` | Full details for a place ID — hours, reviews, price level, amenities, website, phone. Cached 7 days. |
| `get_place_photos` | Fetch photo URLs for a place (up to N). URLs ready for Claude vision analysis. |
| `batch_get_place_details` | Enrich up to 10 place IDs in parallel. Cache-aware — cached results return instantly. |
| `find_low_visibility_businesses` | Lead-gen — finds high-rated businesses with no website. Returns a 0–100 `leadScore`. |

### Geocoding
| Tool | Description |
|---|---|
| `maps_geocode` | Address / landmark → GPS coordinates. |
| `maps_reverse_geocode` | GPS coordinates → street address. |
| `maps_batch_geocode` | Geocode up to 50 addresses in one call. |

### Routing & navigation
| Tool | Description |
|---|---|
| `maps_directions` | Step-by-step directions between two points. Driving, walking, cycling, transit. |
| `maps_distance_matrix` | Travel distances and durations between multiple origins and destinations. |
| `maps_plan_route` | Multi-stop route with waypoint optimization — geocodes stops, finds best order, returns leg-by-leg plan. |
| `maps_search_along_route` | Find places (cafes, gas stations, etc.) along a route ranked by minimal detour. |

### Environmental
| Tool | Description |
|---|---|
| `maps_elevation` | Elevation in metres above sea level for any coordinates. Supports batching. |
| `maps_timezone` | Timezone ID, UTC/DST offsets, and current local time for any coordinates. |
| `maps_weather` | Current conditions, daily forecast (10 days), or hourly forecast (240 hours). |
| `maps_air_quality` | AQI, dominant pollutant, health recommendations by demographic group. |

### Visualization
| Tool | Description |
|---|---|
| `maps_static_map` | Generate a map image with markers and paths — returned inline so Claude can show it in chat. |

### Composite / AI-optimized
| Tool | Description |
|---|---|
| `maps_explore_area` | One-call area overview — searches multiple types, gets details, returns categorized summary. |
| `maps_compare_places` | Side-by-side comparison — search → details → optional distance from user in one call. |
| `maps_local_rank_tracker` | Local SEO grid scan (like LocalFalcon) — tracks a business's search rank across a geographic grid. |

### Cache & rate limiting
| Tool | Description |
|---|---|
| `get_rate_limit_status` | API calls used in the current 24 h window, remaining, and reset time. |
| `get_cache_stats` | Cache hit counts, DB location, and configured TTL. |
| `clear_expired_cache` | Delete cache rows older than the TTL. |

---

## Prerequisites

- **Node.js 18+** — check with `node -v`
- **Google Cloud project** with billing enabled
- **8 Google APIs enabled** and an API key — see **[docs/api-setup.md](docs/api-setup.md)** for the full step-by-step guide

**APIs required:**

| API | Tools |
|---|---|
| Places API (New) | All place search and detail tools |
| Geocoding API | `maps_geocode`, `maps_reverse_geocode`, `maps_batch_geocode`, routing composites |
| Routes API | `maps_directions`, `maps_distance_matrix`, `maps_plan_route`, `maps_search_along_route` |
| Elevation API | `maps_elevation` |
| Time Zone API | `maps_timezone` |
| Maps Static API | `maps_static_map` |
| Air Quality API | `maps_air_quality` |
| Weather API | `maps_weather` |

> All 8 APIs share a single API key. See [docs/api-setup.md](docs/api-setup.md) for how to enable them and configure key restrictions.

---

## Quick start

```bash
git clone https://github.com/your-username/google-map-mcp.git
cd google-map-mcp
npm install
npm run build
cp env.example .env
# Edit .env — set GOOGLE_PLACES_API_KEY=your_key_here
```

Then follow **Connecting to Claude** below.

---

## Connecting to Claude

### Claude Code (project-local)

Add to `.claude/settings.json` in your project root:

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

Run `/mcp` inside Claude Code to confirm the server connected.

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

Restart Claude Desktop after saving.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | *(required)* | Google Cloud API key. `GOOGLE_MAPS_API_KEY` is accepted as an alias. |
| `RATE_LIMIT_PER_DAY` | `1000` | Max Google API calls per 24-hour window. Throws a clear error when exceeded. |
| `CACHE_TTL_SECONDS` | `604800` | Cache TTL — 7 days by default. Set lower for fresher data. |
| `CACHE_DB_PATH` | `~/.google-map-mcp/cache.db` | Override the SQLite cache location. |
| `TRANSPORT` | `stdio` | Set to `sse` to run as an HTTP/SSE server (for Docker / VPS deployments). |
| `PORT` | `3000` | HTTP port when `TRANSPORT=sse`. |
| `MCP_AUTH_TOKEN` | *(none)* | Bearer token for SSE endpoint authentication. |

---

## Rate limiting & caching

The server enforces a **1,000 calls / 24 h** limit by default (set `RATE_LIMIT_PER_DAY` to change it). The counter persists in SQLite across restarts.

- **Cache hits are free** — they don't count against the limit.
- Each HTTP request to Google counts as 1 call.
- When the limit is exceeded the tool returns a clear error message with the reset time.
- Check current usage anytime with `get_rate_limit_status`.

Google Maps Platform gives **$200 free credit / month**. See [docs/api-setup.md](docs/api-setup.md) for per-API billing estimates.

---

## Deploying on a VPS (Docker)

Run the MCP server as a sidecar container on the same internal Docker network as your agent. The agent connects via `http://google-maps-mcp:3000/sse` — nothing is exposed to the internet.

```bash
# 1. Copy and configure
cp env.docker.example .env
# Edit .env — set GOOGLE_PLACES_API_KEY, TRANSPORT=sse

# 2. Start
docker compose up -d
docker compose logs -f   # confirm "SSE server listening on :3000"

# 3. Point your agent at
#    http://google-maps-mcp:3000/sse
```

### Transport modes

| `TRANSPORT` | When to use |
|---|---|
| `stdio` (default) | Local — Claude Code / Claude Desktop spawn it directly |
| `sse` | Docker / VPS — agent connects via HTTP |

---

## Development

```bash
npm run dev              # tsx watch — hot-reload during development
npm run build            # production build via tsup (esbuild, ~100ms)
npm run build:typecheck  # tsc --noEmit type check only
```

> **Do not use `tsc` to emit files** — it OOMs on this project due to deeply recursive MCP SDK generics. `tsup` is the only build tool; `tsc` is type-check only.

---

## Project structure

```
src/
  index.ts                  # MCP server entry — all 25 tools registered here
  places-client.ts          # Raw Places API (New) HTTP client + field mask tiers
  types.ts                  # TypeScript interfaces for API responses
  logger.ts                 # Shared stderr logger
  cache/
    db.ts                   # SQLite cache + rate limiter (better-sqlite3)
  services/
    toolclass.ts            # GoogleMapsTools — geocode, reverse geocode, weather, elevation, etc.
    NewPlacesService.ts     # Places API (New) client via @googlemaps/places
    RoutesService.ts        # Routes API client (directions, distance matrix, waypoint optimization)
    PlacesSearcher.ts       # Facade combining all services + composite tool logic
  tools/
    search-nearby.ts        # search_nearby_places
    search-text.ts          # search_text_places
    get-place-details.ts    # get_place_details
    get-place-photos.ts     # get_place_photos
    find-low-visibility.ts  # find_low_visibility_businesses
    maps/
      geocode.ts            # maps_geocode
      reverseGeocode.ts     # maps_reverse_geocode
      batchGeocode.ts       # maps_batch_geocode
      directions.ts         # maps_directions
      distanceMatrix.ts     # maps_distance_matrix
      planRoute.ts          # maps_plan_route
      searchAlongRoute.ts   # maps_search_along_route
      elevation.ts          # maps_elevation
      timezone.ts           # maps_timezone
      weather.ts            # maps_weather
      airQuality.ts         # maps_air_quality
      staticMap.ts          # maps_static_map
      searchPlaces.ts       # maps_search_places
      exploreArea.ts        # maps_explore_area
      comparePlaces.ts      # maps_compare_places
      localRankTracker.ts   # maps_local_rank_tracker
docs/
  api-setup.md              # Step-by-step Google Cloud API enablement guide
dist/
  index.js                  # compiled output (gitignored)
```

---

## License

MIT
