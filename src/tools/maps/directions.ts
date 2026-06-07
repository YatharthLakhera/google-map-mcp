import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerDirectionsTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_directions",
    "Get step-by-step navigation directions between two points with route details. Use when the user asks 'how do I get from A to B?' and needs the route summary, total distance, estimated travel time, or turn-by-turn instructions. Supports departure/arrival times and multiple travel modes.",
    {
      origin: z.string().describe("Starting point address or coordinates"),
      destination: z.string().describe("Destination address or coordinates"),
      mode: z
        .enum(["driving", "walking", "bicycling", "transit"])
        .default("driving")
        .describe("Travel mode for directions"),
      departure_time: z.string().optional().describe("Departure time (ISO 8601 format, e.g. 2026-03-21T09:00:00Z)"),
      arrival_time: z.string().optional().describe("Arrival time (ISO 8601 format)"),
    },
    async ({ origin, destination, mode, departure_time, arrival_time }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.getDirections(origin, destination, mode, departure_time, arrival_time);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to get directions" }],
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
