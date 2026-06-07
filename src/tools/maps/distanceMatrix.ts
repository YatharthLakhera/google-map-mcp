import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerDistanceMatrixTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_distance_matrix",
    "Calculate travel distances and durations between multiple origins and destinations in a single request. Use for comparing travel options — e.g., 'which hotel is closest to the office?' or batch distance calculations. Supports driving, walking, bicycling, and transit modes.",
    {
      origins: z.array(z.string()).describe("List of origin addresses or coordinates"),
      destinations: z.array(z.string()).describe("List of destination addresses or coordinates"),
      mode: z
        .enum(["driving", "walking", "bicycling", "transit"])
        .default("driving")
        .describe("Travel mode for calculation"),
      departure_time: z
        .string()
        .optional()
        .describe("Departure time in ISO 8601 format (e.g. 2026-03-21T09:00:00Z). Enables traffic-aware estimates."),
    },
    async ({ origins, destinations, mode, departure_time }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.calculateDistanceMatrix(origins, destinations, mode, departure_time);

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to calculate distance matrix" }],
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
