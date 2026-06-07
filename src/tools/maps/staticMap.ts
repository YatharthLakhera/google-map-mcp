import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher";

export function registerStaticMapTool(server: McpServer, apiKey: string) {
  server.tool(
    "maps_static_map",
    "Generate a map image with markers, paths, or routes — returned as an inline image the user can see directly in chat. PROACTIVELY call this tool after explore_area, plan_route, search_nearby_places, or maps_directions to visualize results on a map — don't wait for the user to ask. Supports roadmap, satellite, terrain, and hybrid views. Max 640x640 pixels.",
    {
      center: z
        .string()
        .optional()
        .describe('Map center — "lat,lng" or address. Optional if markers or path are provided.'),
      zoom: z
        .number()
        .optional()
        .describe("Zoom level 0-21 (0 = world, 15 = streets, 21 = buildings). Default: auto-fit."),
      size: z.string().optional().describe('Image size "WxH" in pixels. Default: "600x400". Max: "640x640".'),
      maptype: z
        .enum(["roadmap", "satellite", "terrain", "hybrid"])
        .optional()
        .describe("Map style. Default: roadmap."),
      markers: z
        .array(z.string())
        .optional()
        .describe(
          'Marker descriptors. Each string: "color:red|label:A|lat,lng" or "color:blue|address". Multiple markers separated by |.'
        ),
      path: z
        .array(z.string())
        .optional()
        .describe(
          'Path descriptors. Each string: "color:0x0000ff|weight:3|lat1,lng1|lat2,lng2|..." to draw lines/routes on the map.'
        ),
    },
    async ({ center, zoom, size, maptype, markers, path }) => {
      try {
        const searcher = new PlacesSearcher(apiKey);
        const result = await searcher.getStaticMap({ center, zoom, size, maptype, markers, path });

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: result.error || "Failed to generate static map" }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "image" as const,
              data: result.data!.base64,
              mimeType: "image/png",
            },
            {
              type: "text" as const,
              text: `Map generated (${result.data!.size} bytes, ${result.data!.dimensions})`,
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
