import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerElevationTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_elevation",
    "Get elevation (meters above sea level) for geographic coordinates. Use when the user asks 'how high is this place', 'is this area flood-prone', or needs altitude for hiking/cycling route profiles. Also useful for real estate risk assessment — low elevation near water suggests flood risk.",
    {
      locations: z
        .array(
          z.object({
            latitude: z.number().describe("Latitude coordinate"),
            longitude: z.number().describe("Longitude coordinate"),
          })
        )
        .describe("List of locations to get elevation data for"),
    },
    async ({ locations }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.getElevation(locations);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to get elevation data" }],
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
