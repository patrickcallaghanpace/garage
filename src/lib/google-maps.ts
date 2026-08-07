import "server-only";
import { env, isGoogleMapsConfigured } from "@/lib/env";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SwissAddress {
  street: string;
  postalCode: string;
  locality: string;
  canton: string;
}

export class GoogleMapsNotConfiguredError extends Error {
  constructor() {
    super(
      "GOOGLE_MAPS_API_KEY is not set — geocoding and drive-time lookups are unavailable. See docs/SETUP.md."
    );
    this.name = "GoogleMapsNotConfiguredError";
  }
}

function assertConfigured() {
  if (!isGoogleMapsConfigured) {
    throw new GoogleMapsNotConfiguredError();
  }
}

function formatAddress(address: SwissAddress): string {
  return `${address.street}, ${address.postalCode} ${address.locality}, ${address.canton}, Switzerland`;
}

/**
 * Geocodes a Swiss address via the Google Geocoding API.
 * Returns null (rather than throwing) when the address can't be resolved so
 * callers can flag it to the client/admin instead of crashing.
 */
export async function geocodeAddress(address: SwissAddress): Promise<LatLng | null> {
  assertConfigured();

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", formatAddress(address));
  url.searchParams.set("region", "ch");
  url.searchParams.set("components", "country:CH");
  url.searchParams.set("key", env.googleMapsApiKey!);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding API request failed with status ${res.status}`);
  }

  const data = await res.json();

  if (data.status === "ZERO_RESULTS" || data.status === "NOT_FOUND") {
    return null;
  }
  if (data.status !== "OK") {
    throw new Error(`Geocoding API error: ${data.status} ${data.error_message ?? ""}`.trim());
  }

  const location = data.results?.[0]?.geometry?.location;
  if (!location) return null;

  return { lat: location.lat, lng: location.lng };
}

/**
 * Raw Distance Matrix lookup: drive time in minutes for every
 * origin x destination pair, "driving" mode, typical (non-realtime) traffic
 * — appropriate since bookings are made hours to weeks in advance.
 * Returns null for any pair Google can't route (e.g. no road link).
 */
export async function getDriveTimeMinutesMatrix(
  origins: LatLng[],
  destinations: LatLng[]
): Promise<(number | null)[][]> {
  assertConfigured();

  if (origins.length === 0 || destinations.length === 0) return [];

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origins.map((o) => `${o.lat},${o.lng}`).join("|"));
  url.searchParams.set(
    "destinations",
    destinations.map((d) => `${d.lat},${d.lng}`).join("|")
  );
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "metric");
  url.searchParams.set("region", "ch");
  url.searchParams.set("key", env.googleMapsApiKey!);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Distance Matrix API request failed with status ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== "OK") {
    throw new Error(
      `Distance Matrix API error: ${data.status} ${data.error_message ?? ""}`.trim()
    );
  }

  return (data.rows ?? []).map((row: { elements: { status: string; duration?: { value: number } }[] }) =>
    row.elements.map((el) => {
      if (el.status !== "OK" || !el.duration) return null;
      return Math.round(el.duration.value / 60);
    })
  );
}

/** Drive time in minutes from each of `origins` to a single `destination`. */
export async function getDriveTimesToPoint(
  origins: LatLng[],
  destination: LatLng
): Promise<(number | null)[]> {
  const matrix = await getDriveTimeMinutesMatrix(origins, [destination]);
  return matrix.map((row) => row[0] ?? null);
}

/** Drive time in minutes from a single `origin` to each of `destinations`. */
export async function getDriveTimesFromPoint(
  origin: LatLng,
  destinations: LatLng[]
): Promise<(number | null)[]> {
  const matrix = await getDriveTimeMinutesMatrix([origin], destinations);
  return matrix[0] ?? destinations.map(() => null);
}
