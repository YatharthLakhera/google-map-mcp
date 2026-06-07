import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerSearchPlacesTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_search_places",
    "Search for places using a free-text query like 'sushi restaurants in Tokyo' or 'best coffee shops near Central Park'. More flexible than search_nearby_places — supports natural language queries, optional location bias, rating filters, and open-now filtering. Use when the user describes what they're looking for in words rather than by type and coordinates.",
    {
      query: z
        .string()
        .describe("Text search query (e.g., 'Italian restaurants in Manhattan', 'hotels near Taipei 101')"),
      locationBias: z
        .object({
          latitude: z.number().describe("Latitude to bias results toward"),
          longitude: z.number().describe("Longitude to bias results toward"),
          radius: z.number().optional().describe("Bias radius in meters (default: 5000)"),
        })
        .optional()
        .describe("Optional location to bias results toward"),
      openNow: z.boolean().optional().describe("Only return places that are currently open"),
      minRating: z.number().optional().describe("Minimum rating filter (1.0 - 5.0)"),
      includedType: z.string().optional().describe("Filter by place type (e.g., restaurant, cafe, hotel)"),
    },
    async ({ query, locationBias, openNow, minRating, includedType }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.searchText({ query, locationBias, openNow, minRating, includedType });

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to search places" }],
            isError: true,
          };
        }

        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ total: result.data!.length, places: result.data }, null, 2) },
          ],
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
