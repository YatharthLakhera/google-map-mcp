# Google Cloud API Setup

Complete guide to creating a Google Cloud project, enabling all required APIs, and configuring your API key for this MCP server.

---

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Give it a name (e.g. `google-maps-mcp`) and click **Create**
4. Make sure the new project is selected in the dropdown before continuing

---

## 2. Enable billing

Some APIs (Routes, Elevation, Static Maps, Weather, Air Quality) require a billing account even within the free tier.

1. In the left sidebar go to **Billing**
2. Click **Link a billing account** and follow the prompts
3. Google gives **$200 free credit per month** — typical MCP usage stays well within this

---

## 3. Enable APIs

Go to **APIs & Services → Library** and search for each API below. Click the result, then click **Enable**.

| API name (search this) | Used by |
|---|---|
| **Places API (New)** | `search_nearby_places`, `search_text_places`, `get_place_details`, `get_place_photos`, `find_low_visibility_businesses`, `maps_search_places`, `maps_explore_area`, `maps_compare_places`, `maps_local_rank_tracker` |
| **Geocoding API** | `maps_geocode`, `maps_reverse_geocode`, `maps_batch_geocode`, `maps_timezone`, `maps_elevation`, `maps_plan_route`, `maps_explore_area` |
| **Routes API** | `maps_directions`, `maps_distance_matrix`, `maps_plan_route`, `maps_search_along_route`, `maps_compare_places` |
| **Elevation API** | `maps_elevation` |
| **Time Zone API** | `maps_timezone` |
| **Maps Static API** | `maps_static_map` |
| **Air Quality API** | `maps_air_quality` |
| **Weather API** | `maps_weather` *(Preview — see note below)* |

> **Weather API note:** The Google Weather API is in Preview. Enable it from the Library the same way. If it doesn't appear, search for `Weather API` in the Library or check [Google Maps Platform docs](https://developers.google.com/maps/documentation/weather) for availability in your region. Coverage excludes: China, Japan, South Korea, Cuba, Iran, North Korea, Syria.

---

## 4. Create an API key

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → API key**
3. Copy the key — you'll use this as `GOOGLE_PLACES_API_KEY` in your `.env` or MCP config

---

## 5. Set API key restrictions (recommended)

Unrestricted keys are a security risk if leaked. Restrict yours to only the APIs this server uses.

1. In **Credentials**, click the pencil icon next to your key
2. Under **API restrictions**, select **Restrict key**
3. In the dropdown, check all 8 APIs listed in step 3
4. Click **Save**

> **Important:** After saving restrictions, allow 1–2 minutes for the change to propagate before testing. Calls made immediately after saving may get a 403 until the restriction is live.

### Application restrictions (optional)

If you're running the server on a known server IP, you can also restrict by **IP address** for an extra layer of protection. Leave this as "None" for local development.

---

## 6. Add the key to your config

### Option A — `.env` file (local dev)

```bash
cp env.example .env
```

Edit `.env`:

```
GOOGLE_PLACES_API_KEY=AIza...your_key_here
```

### Option B — MCP server config (Claude Code / Claude Desktop)

Pass the key directly in the `env` block of your MCP config so it's never written to disk in the project:

```json
{
  "mcpServers": {
    "google-maps": {
      "command": "node",
      "args": ["/absolute/path/to/google-map-mcp/dist/index.js"],
      "env": {
        "GOOGLE_PLACES_API_KEY": "AIza...your_key_here"
      }
    }
  }
}
```

---

## 7. Verify your key

Run this one-liner to confirm each API is accessible (replace `YOUR_KEY`):

```bash
KEY=YOUR_KEY

# Places API (New)
curl -s -o /dev/null -w "Places API (New): %{http_code}\n" \
  -H "X-Goog-Api-Key: $KEY" \
  -H "X-Goog-FieldMask: places.displayName" \
  -H "Content-Type: application/json" \
  -d '{"textQuery":"coffee"}' \
  "https://places.googleapis.com/v1/places:searchText"

# Geocoding API
curl -s -o /dev/null -w "Geocoding API:    %{http_code}\n" \
  "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=$KEY"

# Routes API
curl -s -o /dev/null -w "Routes API:       %{http_code}\n" \
  -H "X-Goog-Api-Key: $KEY" \
  -H "X-Goog-FieldMask: routes.distanceMeters" \
  -H "Content-Type: application/json" \
  -d '{"origin":{"address":"London"},"destination":{"address":"Paris"},"travelMode":"DRIVE"}' \
  "https://routes.googleapis.com/directions/v2:computeRoutes"

# Elevation API
curl -s -o /dev/null -w "Elevation API:    %{http_code}\n" \
  "https://maps.googleapis.com/maps/api/elevation/json?locations=51.5,0&key=$KEY"

# Time Zone API
curl -s -o /dev/null -w "Time Zone API:    %{http_code}\n" \
  "https://maps.googleapis.com/maps/api/timezone/json?location=51.5,0&timestamp=0&key=$KEY"

# Maps Static API
curl -s -o /dev/null -w "Maps Static API:  %{http_code}\n" \
  "https://maps.googleapis.com/maps/api/staticmap?center=London&zoom=10&size=100x100&key=$KEY"

# Air Quality API
curl -s -o /dev/null -w "Air Quality API:  %{http_code}\n" \
  -H "Content-Type: application/json" \
  -d '{"location":{"latitude":51.5,"longitude":0}}' \
  "https://airquality.googleapis.com/v1/currentConditions:lookup?key=$KEY"

# Weather API
curl -s -o /dev/null -w "Weather API:      %{http_code}\n" \
  "https://weather.googleapis.com/v1/currentConditions:lookup?key=$KEY&location.latitude=51.5&location.longitude=0"
```

All lines should print `200`. A `403` means either:
- The API isn't enabled on the project, **or**
- The API key restrictions don't include that API yet (wait 1–2 min after saving)

---

## Billing estimates

At standard Maps Platform pricing with the $200/month free credit:

| API | Free tier calls/month | Price per 1,000 after |
|---|---|---|
| Places API (New) — Nearby Search | 1,000 | $32 |
| Places API (New) — Text Search | 1,000 | $32 |
| Places API (New) — Place Details | 1,000 | $17 |
| Geocoding | 40,000 | $5 |
| Routes — Compute Routes | 10,000 | $10 |
| Routes — Route Matrix | 10,000 | $10 |
| Elevation | 40,000 | $5 |
| Time Zone | 40,000 | $5 |
| Maps Static | 28,000 | $2 |
| Air Quality | 10,000 | $5 |

The server's built-in SQLite cache (7-day TTL) and rate limiter (1,000 calls/day default) keep costs predictable. Adjust `RATE_LIMIT_PER_DAY` in your `.env` to match your comfort level.
