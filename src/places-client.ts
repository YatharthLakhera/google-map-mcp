import type {
  PlaceSummary,
  PlaceDetails,
  PlacePhotoResult,
  NearbySearchRequest,
  TextSearchRequest,
} from "./types";
import { checkAndIncrementRateLimit } from "./cache/db";

const BASE = "https://places.googleapis.com/v1";

// Field masks — Basic tier (no extra billing beyond base)
const SEARCH_BASIC_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.businessStatus",
  "places.googleMapsUri",
].join(",");

// Advanced tier fields needed for lead-gen filtering
const SEARCH_ADVANCED_FIELDS = [
  ...SEARCH_BASIC_FIELDS.split(","),
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.priceLevel",
  "places.regularOpeningHours",
].join(",");

// Preferred tier — full details including reviews and photos
const DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "websiteUri",
  "nationalPhoneNumber",
  "regularOpeningHours",
  "currentOpeningHours",
  "editorialSummary",
  "reviews",
  "photos",
  "types",
  "primaryType",
  "businessStatus",
  "delivery",
  "dineIn",
  "takeout",
  "reservable",
  "servesBeer",
  "servesWine",
  "servesCocktails",
  "servesLunch",
  "servesDinner",
  "servesBreakfast",
  "servesBrunch",
  "outdoorSeating",
  "liveMusic",
  "menuForChildren",
  "goodForGroups",
  "goodForWatchingSports",
  "allowsDogs",
  "googleMapsUri",
  "utcOffsetMinutes",
  "adrFormatAddress",
].join(",");

async function post<T>(
  endpoint: string,
  apiKey: string,
  fieldMask: string,
  body: unknown
): Promise<T> {
  checkAndIncrementRateLimit();
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(
  path: string,
  apiKey: string,
  fieldMask: string
): Promise<T> {
  checkAndIncrementRateLimit();
  const url = new URL(`${BASE}/${path}`);
  const res = await fetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export async function searchNearby(
  apiKey: string,
  req: NearbySearchRequest,
  includeAdvancedFields = false
): Promise<PlaceSummary[]> {
  const fieldMask = includeAdvancedFields
    ? SEARCH_ADVANCED_FIELDS
    : SEARCH_BASIC_FIELDS;
  const data = await post<{ places?: PlaceSummary[] }>(
    "places:searchNearby",
    apiKey,
    fieldMask,
    req
  );
  return data.places ?? [];
}

export async function searchText(
  apiKey: string,
  req: TextSearchRequest
): Promise<PlaceSummary[]> {
  const data = await post<{ places?: PlaceSummary[] }>(
    "places:searchText",
    apiKey,
    SEARCH_ADVANCED_FIELDS,
    req
  );
  return data.places ?? [];
}

export async function getPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<PlaceDetails> {
  return get<PlaceDetails>(`places/${placeId}`, apiKey, DETAILS_FIELDS);
}

export async function getPhotoUrl(
  apiKey: string,
  photoName: string,
  maxWidthPx = 800,
  maxHeightPx = 800
): Promise<string> {
  checkAndIncrementRateLimit();
  const url = new URL(`${BASE}/${photoName}/media`);
  url.searchParams.set("maxWidthPx", String(maxWidthPx));
  url.searchParams.set("maxHeightPx", String(maxHeightPx));
  url.searchParams.set("skipHttpRedirect", "true");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Photo fetch error ${res.status}`);
  }
  const data = (await res.json()) as { photoUri?: string };
  if (!data.photoUri) throw new Error("No photoUri in response");
  return data.photoUri;
}

export async function getPlacePhotos(
  apiKey: string,
  placeId: string,
  maxPhotos = 5,
  maxWidthPx = 800,
  maxHeightPx = 800
): Promise<PlacePhotoResult[]> {
  // Fetch just the photos field
  const data = await get<{ photos?: Array<{ name: string; widthPx: number; heightPx: number; authorAttributions?: Array<{ displayName: string }> }> }>(
    `places/${placeId}`,
    apiKey,
    "photos"
  );

  const photos = (data.photos ?? []).slice(0, maxPhotos);

  const results = await Promise.allSettled(
    photos.map(async (p) => {
      const url = await getPhotoUrl(apiKey, p.name, maxWidthPx, maxHeightPx);
      return {
        photoName: p.name,
        url,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
        attribution: p.authorAttributions?.[0]?.displayName,
      } satisfies PlacePhotoResult;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<PlacePhotoResult> => r.status === "fulfilled")
    .map((r) => r.value);
}
