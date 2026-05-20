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
