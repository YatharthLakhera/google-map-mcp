import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerComparePlacesTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_compare_places",
    "Compare multiple places side-by-side in one call — searches by query, gets details for each result, and optionally calculates distance from your location. Use when the user asks 'which restaurant should I pick', 'compare these hotels', or needs a decision table. Replaces the manual chain of search-places → place-details → distance-matrix.",
    {
      query: z.string().describe("Search query (e.g., 'ramen near Shibuya', 'hotels in Taipei')"),
      userLocation: z
        .object({
          latitude: z.number().describe("Your latitude"),
          longitude: z.number().describe("Your longitude"),
        })
        .optional()
        .describe("Your current location — if provided, adds distance and drive time to each result"),
      limit: z.number().optional().describe("Max places to compare (default: 5)"),
    },
    async ({ query, userLocation, limit }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.comparePlaces({ query, userLocation, limit });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error comparing places: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
