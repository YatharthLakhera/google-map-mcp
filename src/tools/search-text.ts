import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchText } from "../places-client";

export function registerSearchTextTool(server: McpServer, apiKey: string) {
  server.tool(
    "search_text_places",
    `Search for places using a natural language query (e.g. "best biryani in Hyderabad", "rooftop bars in Mumbai", "tattoo studios near Bandra"). Returns places with rating, review count, website status, and price level. Great for dish-specific restaurant searches and niche business discovery.`,
    {
      query: z.string().describe("Natural language search query"),
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .optional()
        .describe("Bias results toward this latitude"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .optional()
        .describe("Bias results toward this longitude (required if latitude set)"),
      radius: z
        .number()
        .min(1)
        .max(50000)
        .optional()
        .describe("Bias radius in meters around lat/lng"),
      min_rating: z
        .number()
        .min(0)
        .max(5)
        .optional()
        .describe("Minimum rating filter (0.0–5.0)"),
      open_now: z
        .boolean()
        .optional()
        .describe("Only return places currently open"),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(20)
        .describe("Max results to return (max 20)"),
      rank_by: z
        .enum(["RELEVANCE", "DISTANCE"])
        .default("RELEVANCE")
        .describe("Rank by relevance to query or distance"),
      language: z
        .string()
        .default("en")
        .describe("Language code for results"),
    },
    async ({
      query,
      latitude,
      longitude,
      radius,
      min_rating,
      open_now,
      max_results,
      rank_by,
      language,
    }) => {
      try {
        const req: Parameters<typeof searchText>[1] = {
          textQuery: query,
          maxResultCount: max_results,
          languageCode: language,
          rankPreference: rank_by,
        };

        if (min_rating !== undefined) req.minRating = min_rating;
        if (open_now !== undefined) req.openNow = open_now;

        if (latitude !== undefined && longitude !== undefined) {
          req.locationBias = {
            circle: {
              center: { latitude, longitude },
              radius: radius ?? 5000,
            },
          };
        }

        const places = await searchText(apiKey, req);

        if (places.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No places found matching the query.",
              },
            ],
          };
        }

        const results = places.map((p) => ({
          placeId: p.id,
          name: p.displayName?.text ?? "Unknown",
          address: p.formattedAddress,
          location: p.location,
          rating: p.rating,
          reviewCount: p.userRatingCount,
          priceLevel: p.priceLevel,
          hasWebsite: !!p.websiteUri,
          website: p.websiteUri,
          phone: p.nationalPhoneNumber,
          types: p.types,
          primaryType: p.primaryType,
          businessStatus: p.businessStatus,
          isOpenNow: p.regularOpeningHours?.openNow,
          googleMapsUri: p.googleMapsUri,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { query, total: results.length, places: results },
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
