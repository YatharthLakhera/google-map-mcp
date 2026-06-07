import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerAirQualityTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_air_quality",
    "Get air quality for a location — AQI index, pollutant concentrations, and health recommendations by demographic group (elderly, children, athletes, pregnant women, etc.). Use when the user asks 'is the air safe', 'should I wear a mask', 'good for outdoor exercise', or is planning travel for someone with respiratory conditions. Coverage: global including Japan. Returns both universal AQI and local index.",
    {
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
      includeHealthRecommendations: z
        .boolean()
        .optional()
        .describe("Include health advice per demographic group (default: true)"),
      includePollutants: z
        .boolean()
        .optional()
        .describe("Include individual pollutant concentrations — PM2.5, PM10, NO2, O3, CO, SO2 (default: false)"),
    },
    async ({ latitude, longitude, includeHealthRecommendations, includePollutants }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.getAirQuality(latitude, longitude, includeHealthRecommendations, includePollutants);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to get air quality data" }],
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
