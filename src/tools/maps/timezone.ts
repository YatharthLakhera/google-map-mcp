import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerTimezoneTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_timezone",
    "Get the timezone and current local time for a location. Use when the user asks 'what time is it in Tokyo', needs to coordinate a meeting across timezones, or is planning travel across timezone boundaries. Returns timezone ID, UTC/DST offsets, and computed local time.",
    {
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
      timestamp: z
        .number()
        .optional()
        .describe("Unix timestamp in milliseconds to query timezone at a specific moment (defaults to now)"),
    },
    async ({ latitude, longitude, timestamp }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.getTimezone(latitude, longitude, timestamp);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to get timezone data" }],
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
