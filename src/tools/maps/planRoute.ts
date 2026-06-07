import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerPlanRouteTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_plan_route",
    "Plan an optimized multi-stop route in one call — geocodes all stops, uses Routes API waypoint optimization to find the most efficient visit order, and returns directions for each leg. Use when the user says 'visit these 5 places efficiently', 'plan a route through A, B, C', or needs a multi-stop itinerary. Replaces the manual chain of geocode → distance-matrix → directions. After results, call maps_static_map to visualize.",
    {
      stops: z.array(z.string()).min(2).describe("List of addresses or landmarks to visit (minimum 2)"),
      mode: z
        .enum(["driving", "walking", "bicycling", "transit"])
        .optional()
        .describe("Travel mode (default: driving)"),
      optimize: z
        .boolean()
        .optional()
        .describe(
          "Auto-optimize visit order via Routes API waypoint optimization (default: true). Set false to keep original order. Not available for transit mode."
        ),
      departure_time: z
        .string()
        .optional()
        .describe("Departure time in ISO 8601 format (e.g. 2026-03-21T09:00:00Z). Enables traffic-aware routing."),
    },
    async ({ stops, mode, optimize, departure_time }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.planRoute({ stops, mode, optimize, departure_time });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error planning route: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
