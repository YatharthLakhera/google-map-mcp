import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerReverseGeocodeTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_reverse_geocode",
    "Convert GPS coordinates (latitude/longitude) into a human-readable street address. Use when you have coordinates from another tool's output or a user's shared location and need the actual address.",
    {
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
    },
    async ({ latitude, longitude }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.reverseGeocode(latitude, longitude);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to reverse geocode coordinates" }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
