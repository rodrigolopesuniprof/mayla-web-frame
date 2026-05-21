import L from "leaflet";

/* ─── Types ─── */
export type PartnerType = "doctor" | "clinic" | "gym" | "laboratory" | "pharmacy" | "other";
export type SortMode = "nearest" | "price" | "name";
export type ConsultModeFilter = "all" | "online" | "presencial";

export interface Partner {
  id: string;
  partner_type: PartnerType;
  name: string;
  email: string | null;
  phone: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  full_address: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  specialty: string | null;
  consultation_price: number | null;
  consultation_type: string | null;
  opening_hours: any;
  services_offered: any;
  contact_link: string | null;
  booking_link: string | null;
  scheduling_link: string | null;
  online_consultation_enabled: boolean | null;
  crm: string | null;
  crm_state: string | null;
  // computed
  distance?: number;
  display_lat?: number;
  display_lng?: number;
  // future hooks
  avg_rating?: number;
  review_count?: number;
  has_promotion?: boolean;
  accepts_coupons?: boolean;
}

export interface PartnerLocation {
  id: string;
  partner_id: string;
  location_name: string | null;
  full_address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  is_main: boolean | null;
}

export interface PartnerFilters {
  category: PartnerType | "all";
  sort: SortMode;
  consultMode: ConsultModeFilter;
  specialty: string;
  city: string;
}

/* ─── Constants ─── */
export const CATEGORIES: { id: PartnerType | "all"; label: string; emoji: string }[] = [
  { id: "all", label: "Todos", emoji: "📍" },
  { id: "doctor", label: "Médicos", emoji: "🩺" },
  { id: "clinic", label: "Clínicas", emoji: "🏥" },
  { id: "gym", label: "Academias", emoji: "🏋️" },
  { id: "laboratory", label: "Labs", emoji: "🔬" },
  { id: "pharmacy", label: "Farmácias", emoji: "💊" },
  { id: "other", label: "Outros", emoji: "🤝" },
];

export const MARKER_COLORS: Record<PartnerType, string> = {
  doctor: "#3b82f6",
  clinic: "#10b981",
  gym: "#f59e0b",
  laboratory: "#8b5cf6",
  pharmacy: "#ef4444",
  other: "#64748b",
};

export const MARKER_EMOJIS: Record<PartnerType, string> = {
  doctor: "🩺",
  clinic: "🏥",
  gym: "🏋️",
  laboratory: "🔬",
  pharmacy: "💊",
  other: "🤝",
};

export const TYPE_LABELS: Record<PartnerType, string> = {
  doctor: "Médico",
  clinic: "Clínica",
  gym: "Academia",
  laboratory: "Laboratório",
  pharmacy: "Farmácia",
  other: "Outro",
};

export const DEFAULT_RADIUS_KM = 25;
export const DEFAULT_CENTER: [number, number] = [-20.315, -40.312];

/* ─── Haversine ─── */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/* ─── Leaflet icons ─── */
export function createPartnerIcon(type: PartnerType, selected: boolean) {
  const color = MARKER_COLORS[type];
  const size = selected ? 40 : 30;
  const emoji = MARKER_EMOJIS[type];
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid white;
      display:flex;align-items:center;justify-content:center;
      font-size:${size * 0.45}px;box-shadow:0 2px 8px rgba(0,0,0,.3);
      ${selected ? "transform:scale(1.2);z-index:999;" : ""}
    ">${emoji}</div>`,
  });
}

export const userLocationIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,.3);"></div>`,
});

/* ─── Enrichment ─── */
export function enrichPartners(
  partners: Partner[],
  locations: PartnerLocation[],
  userPos: [number, number],
  radiusKm = DEFAULT_RADIUS_KM
): Partner[] {
  return partners
    .map((p) => {
      const pLocs = locations.filter((l) => l.partner_id === p.id && l.latitude != null && l.longitude != null);
      let bestLat = p.latitude;
      let bestLng = p.longitude;
      let bestDist = Infinity;

      if (pLocs.length > 0) {
        for (const loc of pLocs) {
          const d = haversine(userPos[0], userPos[1], loc.latitude!, loc.longitude!);
          if (d < bestDist) {
            bestDist = d;
            bestLat = loc.latitude;
            bestLng = loc.longitude;
          }
        }
      } else if (bestLat != null && bestLng != null) {
        bestDist = haversine(userPos[0], userPos[1], bestLat, bestLng);
      }

      return { ...p, display_lat: bestLat ?? undefined, display_lng: bestLng ?? undefined, distance: bestDist };
    })
    .filter((p) => p.display_lat != null && p.display_lng != null && p.distance <= radiusKm);
}

/* ─── Filtering & Sorting ─── */
export function applyFilters(partners: Partner[], filters: PartnerFilters): Partner[] {
  let list = [...partners];

  if (filters.category !== "all") {
    list = list.filter((p) => p.partner_type === filters.category);
  }

  if (filters.consultMode === "online") {
    list = list.filter((p) => p.online_consultation_enabled);
  } else if (filters.consultMode === "presencial") {
    list = list.filter((p) => !p.online_consultation_enabled || p.consultation_type === "presencial" || p.consultation_type === "both");
  }

  if (filters.specialty) {
    const q = filters.specialty.toLowerCase();
    list = list.filter((p) => p.specialty?.toLowerCase().includes(q));
  }

  if (filters.city) {
    const q = filters.city.toLowerCase();
    list = list.filter((p) => p.city?.toLowerCase().includes(q));
  }

  switch (filters.sort) {
    case "nearest":
      list.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
      break;
    case "price":
      list.sort((a, b) => (a.consultation_price ?? 9999) - (b.consultation_price ?? 9999));
      break;
    case "name":
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return list;
}

/* ─── Future-ready hooks (structural placeholders) ─── */

/** Placeholder: will connect to a ratings table/view */
export interface PartnerRating {
  partner_id: string;
  avg_rating: number;
  review_count: number;
}

/** Placeholder: will connect to promotions/coupons tables */
export interface PartnerPromotion {
  partner_id: string;
  title: string;
  discount_percent: number;
  valid_until: string;
}

/** Placeholder: referral tracking */
export interface PartnerReferral {
  from_user_id: string;
  to_partner_id: string;
  reward_points: number;
}

/** Placeholder: health recommendation based on location + profile */
export interface HealthRecommendation {
  partner_id: string;
  reason: string;
  priority: number;
}
