import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";

import { registerSearchNearbyTool } from "./tools/search-nearby";
import { registerSearchTextTool } from "./tools/search-text";
import { registerGetPlaceDetailsTool } from "./tools/get-place-details";
import { registerGetPlacePhotosTool } from "./tools/get-place-photos";
import { registerFindLowVisibilityTool } from "./tools/find-low-visibility";
import { getCacheStats, clearExpiredCache, getRateLimitStatus } from "./cache/db";

dotenv.config();

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "GOOGLE_PLACES_API_KEY environment variable is required\n"
  );
  process.exit(1);
}

const server = new McpServer({
  name: "google-maps-mcp",
  version: "1.0.0",
});

// Core place discovery tools
registerSearchNearbyTool(server, apiKey);
registerSearchTextTool(server, apiKey);
registerGetPlaceDetailsTool(server, apiKey);
registerGetPlacePhotosTool(server, apiKey);
registerFindLowVisibilityTool(server, apiKey);

// Rate limit status tool
server.tool(
  "get_rate_limit_status",
  "Check how many Google Places API calls have been made in the current 24-hour window, how many remain, and when the window resets. The limit is configurable via the RATE_LIMIT_PER_DAY env var (default 1000).",
  {},
  async () => {
    const status = getRateLimitStatus();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }
);

// Cache management tools
server.tool(
  "get_cache_stats",
  "Get SQLite cache statistics — how many places are cached, DB location, and TTL. Useful for understanding API credit usage.",
  {},
  async () => {
    const stats = getCacheStats();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "clear_expired_cache",
  "Remove expired cache entries from the SQLite database. Entries older than the configured TTL (default 7 days) are deleted.",
  {},
  async () => {
    const result = clearExpiredCache();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              message: "Expired cache entries removed",
              ...result,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "batch_get_place_details",
  "Fetch details for multiple place IDs in parallel. Respects the cache — already-cached places are returned instantly without API calls. Useful after a search to enrich multiple results at once.",
  {
    place_ids: z
      .array(z.string())
      .min(1)
      .max(10)
      .describe("List of place IDs to fetch (max 10)"),
    force_refresh: z
      .boolean()
      .default(false)
      .describe("Bypass cache for all IDs"),
  },
  async ({ place_ids, force_refresh }) => {
    const { getPlaceDetails } = await import("./places-client");
    const { getCachedDetails, setCachedDetails } = await import("./cache/db");

    const results = await Promise.allSettled(
      place_ids.map(async (id) => {
        if (!force_refresh) {
          const cached = getCachedDetails(id);
          if (cached) return { placeId: id, source: "cache", data: cached };
        }
        const details = await getPlaceDetails(apiKey!, id);
        setCachedDetails(id, details);
        return { placeId: id, source: "api", data: details };
      })
    );

    const output = results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { placeId: place_ids[i], error: r.reason?.message ?? "Unknown error" }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ total: output.length, results: output }, null, 2),
        },
      ],
    };
  }
);

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
