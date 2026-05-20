import { supabase } from "@/integrations/supabase/client";

export interface MapsCoordinates {
  latitude: number;
  longitude: number;
}

export interface PartnerLocationSeed {
  name: string;
  full_address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  _google_maps_url?: string;
}

function isValidCoordinatePair(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function extractCoordinatesFromGoogleMapsUrl(input?: string | null): MapsCoordinates | null {
  if (!input) return null;

  const value = input.trim();
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]destination=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && isValidCoordinatePair(latitude, longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

/** Detects shortened Google Maps URLs (maps.app.goo.gl, goo.gl/maps) that need server-side resolution. */
export function isShortGoogleMapsUrl(input?: string | null): boolean {
  if (!input) return false;
  return /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input.trim());
}

/** Resolves a (possibly shortened) Google Maps URL via edge function and returns coords if found. */
export async function resolveGoogleMapsUrl(input?: string | null): Promise<MapsCoordinates | null> {
  if (!input) return null;
  // Already extractable locally
  const local = extractCoordinatesFromGoogleMapsUrl(input);
  if (local) return local;
  try {
    const { data, error } = await supabase.functions.invoke("resolve-maps-url", {
      body: { url: input.trim() },
    });
    if (error) return null;
    const coords = (data as { coordinates?: MapsCoordinates | null })?.coordinates;
    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude) && isValidCoordinatePair(coords.latitude, coords.longitude)) {
      return coords;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolvePartnerCoordinates(data: Pick<PartnerLocationSeed, "latitude" | "longitude" | "_google_maps_url">): MapsCoordinates | null {
  const fromLink = extractCoordinatesFromGoogleMapsUrl(data._google_maps_url);
  if (fromLink) return fromLink;

  if (typeof data.latitude === "number" && typeof data.longitude === "number" && isValidCoordinatePair(data.latitude, data.longitude)) {
    return { latitude: data.latitude, longitude: data.longitude };
  }

  return null;
}

export function buildPrimaryPartnerLocation(partnerId: string, data: PartnerLocationSeed) {
  const coordinates = resolvePartnerCoordinates(data);

  return {
    partner_id: partnerId,
    location_name: data.name || "Local principal",
    full_address: data.full_address || "",
    city: data.city || "",
    state: data.state || "",
    zip_code: data.zip_code || "",
    latitude: coordinates?.latitude ?? data.latitude ?? null,
    longitude: coordinates?.longitude ?? data.longitude ?? null,
    google_maps_url: data._google_maps_url || null,
    is_main: true,
  };
}

/** Async variant: resolves short Google Maps URLs server-side before building the row. */
export async function buildPrimaryPartnerLocationAsync(partnerId: string, data: PartnerLocationSeed) {
  const base = buildPrimaryPartnerLocation(partnerId, data);
  if (base.latitude != null && base.longitude != null) return base;
  if (data._google_maps_url) {
    const resolved = await resolveGoogleMapsUrl(data._google_maps_url);
    if (resolved) {
      return { ...base, latitude: resolved.latitude, longitude: resolved.longitude };
    }
  }
  return base;
}
