import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchNearby } from "../places-client";

export function registerSearchNearbyTool(server: McpServer, apiKey: string) {
  server.tool(
    "search_nearby_places",
    `Search for places near a geographic coordinate. Returns a list of places with basic info including placeId, name, address, rating, and type. Use the returned placeId with get_place_details for full information.`,
    {
      latitude: z.number().min(-90).max(90).describe("Center latitude"),
      longitude: z.number().min(-180).max(180).describe("Center longitude"),
      radius: z
        .number()
        .min(1)
        .max(50000)
        .default(1000)
        .describe("Search radius in meters (max 50000)"),
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Place types to include e.g. ['restaurant', 'cafe', 'bar']. See Google Place Types for full list."
        ),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(20)
        .describe("Max results to return (max 20)"),
      rank_by: z
        .enum(["POPULARITY", "DISTANCE"])
        .default("POPULARITY")
        .describe("Rank by popularity or distance from center"),
      language: z
        .string()
        .default("en")
        .describe("Language code for results e.g. 'en', 'fr'"),
    },
    async ({ latitude, longitude, radius, types, max_results, rank_by, language }) => {
      try {
        const places = await searchNearby(
          apiKey,
          {
            locationRestriction: {
              circle: { center: { latitude, longitude }, radius },
            },
            includedTypes: types,
            maxResultCount: max_results,
            rankPreference: rank_by,
            languageCode: language,
          },
          false
        );

        if (places.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No places found matching the criteria.",
              },
            ],
          };
        }

        const results = places.map((p) => ({
          placeId: p.id,
          name: p.displayName?.text ?? "Unknown",
          address: p.formattedAddress,
          location: p.location,
          types: p.types,
          primaryType: p.primaryType,
          businessStatus: p.businessStatus,
          googleMapsUri: p.googleMapsUri,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ total: results.length, places: results }, null, 2),
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
