export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LocalizedText {
  text: string;
  languageCode: string;
}

export interface AuthorAttribution {
  displayName: string;
  uri: string;
  photoUri: string;
}

export interface Review {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text?: LocalizedText;
  originalText?: LocalizedText;
  authorAttribution: AuthorAttribution;
  publishTime: string;
  googleMapsUri: string;
}

export interface Photo {
  name: string; // "places/PLACE_ID/photos/PHOTO_REF"
  widthPx: number;
  heightPx: number;
  authorAttributions: AuthorAttribution[];
}

export interface OpeningHoursPeriodPoint {
  day: number;
  hour: number;
  minute: number;
}

export interface OpeningHoursPeriod {
  open: OpeningHoursPeriodPoint;
  close?: OpeningHoursPeriodPoint;
}

export interface OpeningHours {
  openNow: boolean;
  periods?: OpeningHoursPeriod[];
  weekdayDescriptions?: string[];
}

export interface PlaceSummary {
  id: string;
  displayName?: LocalizedText;
  formattedAddress?: string;
  location?: LatLng;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  priceLevel?: string;
  googleMapsUri?: string;
}

export interface PlaceDetails extends PlaceSummary {
  regularOpeningHours?: OpeningHours;
  currentOpeningHours?: OpeningHours;
  editorialSummary?: LocalizedText;
  reviews?: Review[];
  photos?: Photo[];
  delivery?: boolean;
  dineIn?: boolean;
  takeout?: boolean;
  reservable?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesCocktails?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  menuForChildren?: boolean;
  goodForGroups?: boolean;
  goodForWatchingSports?: boolean;
  allowsDogs?: boolean;
  utcOffsetMinutes?: number;
  adrFormatAddress?: string;
}

export interface PlacePhotoResult {
  photoName: string;
  url: string;
  widthPx: number;
  heightPx: number;
  attribution?: string;
}

export interface SearchResult {
  places: PlaceSummary[];
}

export interface NearbySearchRequest {
  locationRestriction: {
    circle: {
      center: LatLng;
      radius: number;
    };
  };
  includedTypes?: string[];
  excludedTypes?: string[];
  maxResultCount?: number;
  rankPreference?: "DISTANCE" | "POPULARITY";
  languageCode?: string;
}

export interface TextSearchRequest {
  textQuery: string;
  locationBias?: {
    circle: {
      center: LatLng;
      radius: number;
    };
  };
  locationRestriction?: {
    circle: {
      center: LatLng;
      radius: number;
    };
  };
  maxResultCount?: number;
  minRating?: number;
  openNow?: boolean;
  priceLevels?: string[];
  languageCode?: string;
  rankPreference?: "DISTANCE" | "RELEVANCE";
}
