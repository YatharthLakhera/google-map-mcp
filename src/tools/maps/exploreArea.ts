import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerExploreAreaTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_explore_area",
    "Explore what's around a location in one call — searches multiple place types, gets details for the top results, and returns a categorized summary. Use when the user asks 'what's around here', 'explore the area near my hotel', or needs a quick overview of a neighborhood. Replaces the manual chain of geocode → search_nearby → place_details. After results, call maps_static_map to visualize.",
    {
      location: z.string().describe("Address or landmark to explore around"),
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Place types to search (default: restaurant, cafe, attraction). Examples: hotel, bar, park, museum"
        ),
      radius: z.number().optional().describe("Search radius in meters (default: 1000)"),
      topN: z.number().optional().describe("Number of top results per type to get details for (default: 3)"),
    },
    async ({ location, types, radius, topN }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.exploreArea({ location, types, radius, topN });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error exploring area: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
