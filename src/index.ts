import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import http from "http";
import crypto from "crypto";
import dotenv from "dotenv";

import { registerSearchNearbyTool } from "./tools/search-nearby";
import { registerSearchTextTool } from "./tools/search-text";
import { registerGetPlaceDetailsTool } from "./tools/get-place-details";
import { registerGetPlacePhotosTool } from "./tools/get-place-photos";
import { registerFindLowVisibilityTool } from "./tools/find-low-visibility";
import { getCacheStats, clearExpiredCache, getRateLimitStatus } from "./cache/db";

// New enriched tools from mcp-google-map
import { registerGeocodeTool } from "./tools/maps/geocode";
import { registerReverseGeocodeTool } from "./tools/maps/reverseGeocode";
import { registerDirectionsTool } from "./tools/maps/directions";
import { registerDistanceMatrixTool } from "./tools/maps/distanceMatrix";
import { registerElevationTool } from "./tools/maps/elevation";
import { registerSearchPlacesTool } from "./tools/maps/searchPlaces";
import { registerTimezoneTool } from "./tools/maps/timezone";
import { registerWeatherTool } from "./tools/maps/weather";
import { registerAirQualityTool } from "./tools/maps/airQuality";
import { registerStaticMapTool } from "./tools/maps/staticMap";
import { registerBatchGeocodeTool } from "./tools/maps/batchGeocode";
import { registerSearchAlongRouteTool } from "./tools/maps/searchAlongRoute";
import { registerExploreAreaTool } from "./tools/maps/exploreArea";
import { registerPlanRouteTool } from "./tools/maps/planRoute";
import { registerComparePlacesTool } from "./tools/maps/comparePlaces";
import { registerLocalRankTrackerTool } from "./tools/maps/localRankTracker";

dotenv.config();

const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY) environment variable is required\n"
  );
  process.exit(1);
}

const server = new McpServer({
  name: "google-maps-mcp",
  version: "1.0.0",
});

// Core place discovery tools (Places API New — raw fetch)
registerSearchNearbyTool(server, apiKey);
registerSearchTextTool(server, apiKey);
registerGetPlaceDetailsTool(server, apiKey);
registerGetPlacePhotosTool(server, apiKey);
registerFindLowVisibilityTool(server, apiKey);

// Enriched tools: geocoding, routing, environmental, composite
registerGeocodeTool(server, apiKey);
registerReverseGeocodeTool(server, apiKey);
registerDirectionsTool(server, apiKey);
registerDistanceMatrixTool(server, apiKey);
registerElevationTool(server, apiKey);
registerSearchPlacesTool(server, apiKey);
registerTimezoneTool(server, apiKey);
registerWeatherTool(server, apiKey);
registerAirQualityTool(server, apiKey);
registerStaticMapTool(server, apiKey);
registerBatchGeocodeTool(server, apiKey);
registerSearchAlongRouteTool(server, apiKey);
registerExploreAreaTool(server, apiKey);
registerPlanRouteTool(server, apiKey);
registerComparePlacesTool(server, apiKey);
registerLocalRankTrackerTool(server, apiKey);

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
  const mode = process.env.TRANSPORT ?? "stdio";

  if (mode === "sse") {
    const PORT = parseInt(process.env.PORT ?? "3000", 10);
    const authToken = process.env.MCP_AUTH_TOKEN ?? "";
    const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB

    if (!authToken) {
      process.stderr.write(
        "WARNING: MCP_AUTH_TOKEN is not set — SSE endpoint is unauthenticated. Set it in env to secure the server.\n"
      );
    }

    function isAuthorized(req: http.IncomingMessage): boolean {
      if (!authToken) return true;
      const header = req.headers["authorization"] ?? "";
      const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (provided.length !== authToken.length) return false;
      return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(authToken));
    }

    // Map of sessionId → active transport so we can route POST messages correctly
    const sessions = new Map<string, SSEServerTransport>();

    const httpServer = http.createServer(async (req, res) => {
      if (!isAuthorized(req)) {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Unauthorized");
        return;
      }

      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

      if (req.method === "GET" && url.pathname === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        sessions.set(transport.sessionId, transport);
        req.on("close", () => sessions.delete(transport.sessionId));
        await server.connect(transport);

      } else if (req.method === "POST" && url.pathname === "/message") {
        const sessionId = url.searchParams.get("sessionId") ?? "";
        const transport = sessions.get(sessionId);
        if (!transport) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Session not found");
          return;
        }

        // Read body with a hard 4 MB cap to prevent DoS
        let size = 0;
        const chunks: Buffer[] = [];
        let aborted = false;

        req.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            aborted = true;
            req.destroy();
            res.writeHead(413, { "Content-Type": "text/plain" });
            res.end("Request body too large");
            return;
          }
          chunks.push(chunk);
        });

        req.on("end", async () => {
          if (aborted) return;
          try {
            const parsedBody = JSON.parse(Buffer.concat(chunks).toString());
            await transport.handlePostMessage(req, res, parsedBody);
          } catch {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Invalid JSON");
          }
        });

      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    httpServer.listen(PORT, () => {
      process.stderr.write(`google-maps-mcp SSE server listening on :${PORT}\n`);
    });

  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
})();
