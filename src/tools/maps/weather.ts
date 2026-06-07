import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerWeatherTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_weather",
    "Get weather for a location — current conditions, daily forecast (up to 10 days), or hourly forecast (up to 240 hours). Use when the user asks 'what's the weather in Paris', is planning outdoor activities, or needs to pack for a trip. Coverage: most regions supported, but China, Japan, South Korea, Cuba, Iran, North Korea, Syria are unavailable.",
    {
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
      type: z
        .enum(["current", "forecast_daily", "forecast_hourly"])
        .optional()
        .describe("current = right now, forecast_daily = multi-day outlook, forecast_hourly = hour-by-hour"),
      forecastDays: z
        .number()
        .optional()
        .describe("Number of forecast days (1-10, only for forecast_daily, default: 5)"),
      forecastHours: z
        .number()
        .optional()
        .describe("Number of forecast hours (1-240, only for forecast_hourly, default: 24)"),
    },
    async ({ latitude, longitude, type, forecastDays, forecastHours }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.getWeather(latitude, longitude, type || "current", forecastDays, forecastHours);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to get weather data" }],
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
