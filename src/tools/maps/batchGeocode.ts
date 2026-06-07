import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerBatchGeocodeTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_batch_geocode",
    "Geocode multiple addresses in one call — up to 50 addresses, returns coordinates for each. Use when the user provides a list of addresses and needs all their coordinates, e.g. 'geocode these 10 offices' or 'get coordinates for all these restaurants'.",
    {
      addresses: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("List of addresses or landmark names to geocode (max 50)"),
    },
    async ({ addresses }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);

        const results = await Promise.all(
          addresses.map(async (address: string) => {
            try {
              const result = await searcher.geocode(address);
              return { address, ...result };
            } catch (error: any) {
              return { address, success: false, error: error.message };
            }
          })
        );

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ total: addresses.length, succeeded, failed, results }, null, 2),
            },
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
