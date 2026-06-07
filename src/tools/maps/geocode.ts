import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerGeocodeTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_geocode",
    "Convert an address, city name, or landmark into GPS coordinates (latitude/longitude). Use when you need coordinates for a location described in text — for example, to provide a center point for search_nearby or a starting point for maps_directions.",
    {
      address: z.string().describe("Address or place name to convert to coordinates"),
    },
    async ({ address }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.geocode(address);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to geocode address" }],
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
