import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlaceDetails } from "../places-client";
import { getCachedDetails, setCachedDetails } from "../cache/db";

export function registerGetPlaceDetailsTool(server: McpServer, apiKey: string) {
  server.tool(
    "get_place_details",
    `Get comprehensive details for a place by its placeId. Returns full info: rating, reviews (up to 5), opening hours, website, phone, price level, cuisine flags (dine-in/delivery/takeout), amenities, Google Maps link, and photo references. Results are cached for 7 days to minimize API credits.`,
    {
      place_id: z.string().describe("Google Place ID (from search results)"),
      force_refresh: z
        .boolean()
        .default(false)
        .describe("Bypass cache and fetch fresh data from the API"),
    },
    async ({ place_id, force_refresh }) => {
      try {
        if (!force_refresh) {
          const cached = getCachedDetails(place_id);
          if (cached) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { source: "cache", ...formatDetails(cached) },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        const details = await getPlaceDetails(apiKey, place_id);
        setCachedDetails(place_id, details);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { source: "api", ...formatDetails(details) },
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

function formatDetails(raw: unknown): unknown {
  const d = raw as Record<string, unknown>;

  const reviews = Array.isArray(d.reviews)
    ? d.reviews.map((r: Record<string, unknown>) => ({
        author: (r.authorAttribution as Record<string, unknown>)?.displayName,
        rating: r.rating,
        time: r.relativePublishTimeDescription,
        text: (r.text as Record<string, unknown>)?.text,
        publishTime: r.publishTime,
        googleMapsUri: r.googleMapsUri,
      }))
    : [];

  const photos = Array.isArray(d.photos)
    ? d.photos.map((p: Record<string, unknown>) => ({
        photoName: p.name,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
        attribution: (
          p.authorAttributions as Array<Record<string, unknown>>
        )?.[0]?.displayName,
      }))
    : [];

  return {
    placeId: d.id,
    name: (d.displayName as Record<string, unknown>)?.text,
    address: d.formattedAddress,
    location: d.location,
    rating: d.rating,
    reviewCount: d.userRatingCount,
    priceLevel: d.priceLevel,
    website: d.websiteUri,
    phone: d.nationalPhoneNumber,
    businessStatus: d.businessStatus,
    types: d.types,
    primaryType: d.primaryType,
    editorialSummary: (d.editorialSummary as Record<string, unknown>)?.text,
    googleMapsUri: d.googleMapsUri,
    openingHours: {
      isOpenNow: (d.currentOpeningHours as Record<string, unknown>)?.openNow ??
        (d.regularOpeningHours as Record<string, unknown>)?.openNow,
      weekdayDescriptions: (
        d.regularOpeningHours as Record<string, unknown>
      )?.weekdayDescriptions,
    },
    service: {
      dineIn: d.dineIn,
      delivery: d.delivery,
      takeout: d.takeout,
      reservable: d.reservable,
    },
    food: {
      servesBreakfast: d.servesBreakfast,
      servesBrunch: d.servesBrunch,
      servesLunch: d.servesLunch,
      servesDinner: d.servesDinner,
      servesBeer: d.servesBeer,
      servesWine: d.servesWine,
      servesCocktails: d.servesCocktails,
    },
    ambiance: {
      outdoorSeating: d.outdoorSeating,
      liveMusic: d.liveMusic,
      goodForGroups: d.goodForGroups,
      allowsDogs: d.allowsDogs,
      goodForWatchingSports: d.goodForWatchingSports,
    },
    reviews,
    photos,
  };
}
