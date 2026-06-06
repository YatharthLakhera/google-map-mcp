import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlacePhotos } from "../places-client";
import { getCachedPhotos, setCachedPhotos } from "../cache/db";

export function registerGetPlacePhotosTool(server: McpServer, apiKey: string) {
  server.tool(
    "get_place_photos",
    `Get photo URLs for a place. Returns direct image URLs that can be loaded in a browser or analyzed with vision. Useful for assessing the ambiance, food quality, and overall premium feel of a place. Results are cached to minimize API credits.`,
    {
      place_id: z.string().describe("Google Place ID"),
      max_photos: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(5)
        .describe("Number of photos to retrieve (max 10)"),
      max_width: z
        .number()
        .int()
        .min(100)
        .max(4800)
        .default(1200)
        .describe("Max width in pixels for each photo"),
      max_height: z
        .number()
        .int()
        .min(100)
        .max(4800)
        .default(1200)
        .describe("Max height in pixels for each photo"),
      force_refresh: z
        .boolean()
        .default(false)
        .describe("Bypass cache and fetch fresh photos"),
    },
    async ({ place_id, max_photos, max_width, max_height, force_refresh }) => {
      try {
        if (!force_refresh) {
          const cached = getCachedPhotos(place_id);
          if (cached) {
            const sliced = (cached as unknown[]).slice(0, max_photos);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { source: "cache", placeId: place_id, photos: sliced },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        const photos = await getPlacePhotos(
          apiKey,
          place_id,
          max_photos,
          max_width,
          max_height
        );

        // Cache the full set (up to 10) regardless of how many were requested
        setCachedPhotos(place_id, photos);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  source: "api",
                  placeId: place_id,
                  photos: photos.map((p) => ({
                    url: p.url,
                    widthPx: p.widthPx,
                    heightPx: p.heightPx,
                    attribution: p.attribution,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
