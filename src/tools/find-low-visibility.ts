import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchNearby, searchText } from "../places-client";
import type { PlaceSummary } from "../types";

export function registerFindLowVisibilityTool(
  server: McpServer,
  apiKey: string
) {
  server.tool(
    "find_low_visibility_businesses",
    `Find businesses with strong real-world quality signals (high rating, genuine reviews) but low digital visibility (no website, low online presence). Ideal for lead generation — these are businesses that could benefit from digital marketing services. Filters on: no/missing website, rating threshold, review count range, and optionally open now.`,
    {
      latitude: z.number().min(-90).max(90).describe("Search center latitude"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Search center longitude"),
      radius: z
        .number()
        .min(1)
        .max(50000)
        .default(2000)
        .describe("Search radius in meters"),
      keyword: z
        .string()
        .optional()
        .describe(
          "Optional keyword/niche e.g. 'tattoo studio', 'yoga', 'auto repair'. When provided, uses text search."
        ),
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Place types to search (used for nearby search when no keyword). E.g. ['restaurant', 'beauty_salon']"
        ),
      min_rating: z
        .number()
        .min(0)
        .max(5)
        .default(4.0)
        .describe("Minimum rating (businesses below this are excluded)"),
      min_reviews: z
        .number()
        .int()
        .min(0)
        .default(5)
        .describe("Minimum review count (filters out places with no real track record)"),
      max_reviews: z
        .number()
        .int()
        .optional()
        .describe(
          "Maximum review count. Set this to filter out already well-known businesses (e.g. 200 keeps hidden gems)"
        ),
      require_no_website: z
        .boolean()
        .default(true)
        .describe("Only return businesses with no website listed on Google Maps"),
      open_now: z
        .boolean()
        .optional()
        .describe("Only return currently open businesses"),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(20)
        .describe("Max results to search (filtering may reduce actual count)"),
      language: z
        .string()
        .default("en")
        .describe("Language code for results"),
    },
    async ({
      latitude,
      longitude,
      radius,
      keyword,
      types,
      min_rating,
      min_reviews,
      max_reviews,
      require_no_website,
      open_now,
      max_results,
      language,
    }) => {
      try {
        let places: PlaceSummary[];

        if (keyword) {
          const locationStr = `near ${latitude},${longitude}`;
          places = await searchText(apiKey, {
            textQuery: `${keyword} ${locationStr}`,
            locationBias: {
              circle: {
                center: { latitude, longitude },
                radius,
              },
            },
            maxResultCount: max_results,
            openNow: open_now,
            languageCode: language,
          });
        } else {
          places = await searchNearby(
            apiKey,
            {
              locationRestriction: {
                circle: { center: { latitude, longitude }, radius },
              },
              includedTypes: types,
              maxResultCount: max_results,
              rankPreference: "POPULARITY",
              languageCode: language,
            },
            true // include advanced fields (websiteUri, rating, etc.)
          );
        }

        // Apply filters
        const filtered = places.filter((p) => {
          if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return false;
          if (min_rating && (p.rating ?? 0) < min_rating) return false;
          if ((p.userRatingCount ?? 0) < min_reviews) return false;
          if (max_reviews !== undefined && (p.userRatingCount ?? 0) > max_reviews) return false;
          if (require_no_website && p.websiteUri) return false;
          return true;
        });

        // Sort by rating desc, then review count desc
        filtered.sort((a, b) => {
          const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
          if (ratingDiff !== 0) return ratingDiff;
          return (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0);
        });

        if (filtered.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: [
                  "No low-visibility businesses found matching criteria.",
                  `Searched ${places.length} places, all were filtered out.`,
                  "Try: lower min_rating, increase radius, remove require_no_website, or adjust review count range.",
                ].join("\n"),
              },
            ],
          };
        }

        const results = filtered.map((p) => ({
          placeId: p.id,
          name: p.displayName?.text ?? "Unknown",
          address: p.formattedAddress,
          location: p.location,
          rating: p.rating,
          reviewCount: p.userRatingCount,
          hasWebsite: !!p.websiteUri,
          website: p.websiteUri ?? null,
          phone: p.nationalPhoneNumber ?? null,
          priceLevel: p.priceLevel,
          types: p.types,
          primaryType: p.primaryType,
          googleMapsUri: p.googleMapsUri,
          leadScore: computeLeadScore(p),
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  searchedTotal: places.length,
                  filteredTotal: filtered.length,
                  criteria: {
                    minRating: min_rating,
                    minReviews: min_reviews,
                    maxReviews: max_reviews ?? "no limit",
                    requireNoWebsite: require_no_website,
                  },
                  businesses: results,
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

// Higher = better lead (good rating, real review volume, no website)
function computeLeadScore(p: PlaceSummary): number {
  const rating = p.rating ?? 0;
  const reviews = p.userRatingCount ?? 0;
  const noWebsite = !p.websiteUri ? 1 : 0;

  // Normalize review count: sweet spot is 20–200 (real but not famous)
  const reviewScore = Math.min(reviews / 100, 1) * 0.3;
  const ratingScore = ((rating - 3) / 2) * 0.5; // 0 at 3.0, 0.5 at 5.0
  const visibilityScore = noWebsite * 0.2;

  return Math.round((reviewScore + ratingScore + visibilityScore) * 100);
}
