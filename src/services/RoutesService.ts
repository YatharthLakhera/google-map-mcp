import { Logger } from "../logger";

const ROUTES_API_BASE = "https://routes.googleapis.com";

const TRAVEL_MODE_MAP: Record<string, string> = {
  driving: "DRIVE",
  walking: "WALK",
  bicycling: "BICYCLE",
  transit: "TRANSIT",
};

const COMPUTE_ROUTES_FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.description",
  "routes.polyline.encodedPolyline",
  "routes.legs.distanceMeters",
  "routes.legs.duration",
  "routes.legs.startLocation",
  "routes.legs.endLocation",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.polyline",
  "routes.optimizedIntermediateWaypointIndex",
].join(",");

const COMPUTE_ROUTE_MATRIX_FIELD_MASK = "originIndex,destinationIndex,distanceMeters,duration,status,condition";

export function parseDuration(duration: string | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/^(\d+)s$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

export function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0
      ? `${hours} hour${hours > 1 ? "s" : ""} ${mins} min${mins > 1 ? "s" : ""}`
      : `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  const mins = Math.round(seconds / 60);
  return `${mins} min${mins !== 1 ? "s" : ""}`;
}

function toWaypoint(location: string): any {
  const coordMatch = location.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
  if (coordMatch) {
    return {
      location: {
        latLng: {
          latitude: parseFloat(coordMatch[1]),
          longitude: parseFloat(coordMatch[2]),
        },
      },
    };
  }
  return { address: location };
}

export class RoutesService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      "";
    if (!this.apiKey) {
      throw new Error("Google Maps API Key is required");
    }
  }

  async computeRoutes(params: {
    origin: string;
    destination: string;
    mode?: string;
    departureTime?: Date;
    arrivalTime?: Date;
    intermediates?: string[];
    optimizeWaypointOrder?: boolean;
  }): Promise<{
    routes: any[];
    summary: string;
    total_distance: { value: number; text: string };
    total_duration: { value: number; text: string };
    arrival_time: string;
    departure_time: string;
    optimizedIntermediateWaypointIndex?: number[];
  }> {
    const travelMode = TRAVEL_MODE_MAP[params.mode || "driving"] || "DRIVE";

    const requestBody: any = {
      origin: toWaypoint(params.origin),
      destination: toWaypoint(params.destination),
      travelMode,
      computeAlternativeRoutes: false,
    };

    if (travelMode === "DRIVE") {
      requestBody.routingPreference = "TRAFFIC_AWARE";
    }

    if (params.arrivalTime) {
      requestBody.arrivalTime = params.arrivalTime.toISOString();
    } else if (params.departureTime) {
      requestBody.departureTime = params.departureTime.toISOString();
    }

    if (params.intermediates && params.intermediates.length > 0) {
      requestBody.intermediates = params.intermediates.map(toWaypoint);
    }

    if (
      params.optimizeWaypointOrder &&
      params.intermediates &&
      params.intermediates.length > 0 &&
      travelMode !== "TRANSIT"
    ) {
      requestBody.optimizeWaypointOrder = true;
    }

    const response = await fetch(`${ROUTES_API_BASE}/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": COMPUTE_ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as any)?.error?.message || `HTTP ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json() as any;

    if (!data.routes || data.routes.length === 0) {
      const mode = params.mode || "driving";
      if (mode === "transit") {
        throw new Error(
          `No transit route found from "${params.origin}" to "${params.destination}". ` +
            `The Google Routes API does not support transit directions in some regions (notably Japan and India). ` +
            `Try using mode "driving" or "walking" instead.`
        );
      }
      throw new Error(`No route found from "${params.origin}" to "${params.destination}" with mode: ${mode}`);
    }

    const route = data.routes[0];
    const totalDistanceMeters = route.distanceMeters || 0;
    const totalDurationSeconds = parseDuration(route.duration);

    return {
      routes: data.routes,
      summary: route.description || "",
      total_distance: {
        value: totalDistanceMeters,
        text: formatDistance(totalDistanceMeters),
      },
      total_duration: {
        value: totalDurationSeconds,
        text: formatDuration(totalDurationSeconds),
      },
      arrival_time: "",
      departure_time: "",
      ...(route.optimizedIntermediateWaypointIndex
        ? { optimizedIntermediateWaypointIndex: route.optimizedIntermediateWaypointIndex }
        : {}),
    };
  }

  async computeRouteMatrix(params: {
    origins: string[];
    destinations: string[];
    mode?: string;
    departureTime?: Date;
  }): Promise<{
    distances: any[][];
    durations: any[][];
    origin_addresses: string[];
    destination_addresses: string[];
    warning?: string;
  }> {
    const travelMode = TRAVEL_MODE_MAP[params.mode || "driving"] || "DRIVE";

    const requestBody: any = {
      origins: params.origins.map((o) => ({ waypoint: toWaypoint(o) })),
      destinations: params.destinations.map((d) => ({ waypoint: toWaypoint(d) })),
      travelMode,
    };

    if (travelMode === "DRIVE") {
      requestBody.routingPreference = "TRAFFIC_AWARE";
    }

    if (params.departureTime) {
      requestBody.departureTime = params.departureTime.toISOString();
    }

    const response = await fetch(`${ROUTES_API_BASE}/distanceMatrix/v2:computeRouteMatrix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": COMPUTE_ROUTE_MATRIX_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as any)?.error?.message || `HTTP ${response.status}`;
      throw new Error(msg);
    }

    const elements: any[] = await response.json() as any[];

    const rowCount = params.origins.length;
    const colCount = params.destinations.length;
    const distances: any[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(null));
    const durations: any[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(null));

    let routeNotFoundCount = 0;
    for (const element of elements) {
      const i = element.originIndex;
      const j = element.destinationIndex;
      if (i === undefined || j === undefined) continue;
      if (element.condition === "ROUTE_NOT_FOUND") {
        routeNotFoundCount++;
        continue;
      }

      const distMeters = element.distanceMeters || 0;
      const durSeconds = parseDuration(element.duration);

      distances[i][j] = { value: distMeters, text: formatDistance(distMeters) };
      durations[i][j] = { value: durSeconds, text: formatDuration(durSeconds) };
    }

    const totalPairs = rowCount * colCount;

    if (routeNotFoundCount === totalPairs && travelMode === "TRANSIT") {
      throw new Error(
        `No transit routes found for any origin/destination pair. ` +
          `The Google Routes API does not support transit directions in some regions. ` +
          `Try using mode "driving" or "walking" instead.`
      );
    }

    return {
      distances,
      durations,
      origin_addresses: params.origins,
      destination_addresses: params.destinations,
      ...(routeNotFoundCount > 0 && travelMode === "TRANSIT"
        ? {
            warning: `${routeNotFoundCount} of ${totalPairs} pairs returned no transit route. Limited transit coverage in some regions.`,
          }
        : {}),
    };
  }
}
