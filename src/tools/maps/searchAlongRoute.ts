import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerSearchAlongRouteTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_search_along_route",
    "Search for places along a route between two points — restaurants, cafes, gas stations, etc. ranked by minimal detour time. Use for trip planning to find meals, rest stops, or attractions between landmarks without backtracking. Internally computes the route, then searches along it. Essential for building itineraries where stops should feel 'on the way' rather than 'detour to'.",
    {
      textQuery: z
        .string()
        .describe("What to search for along the route (e.g. 'restaurant', 'coffee shop', 'temple')"),
      origin: z.string().describe("Route start point — address or landmark name"),
      destination: z.string().describe("Route end point — address or landmark name"),
      mode: z
        .enum(["driving", "walking", "bicycling", "transit"])
        .optional()
        .describe("Travel mode for the route (default: walking)"),
      maxResults: z.number().optional().describe("Max results to return (default: 5, max: 20)"),
    },
    async ({ textQuery, origin, destination, mode, maxResults }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.searchAlongRoute({ textQuery, origin, destination, mode, maxResults });

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to search along route" }],
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
