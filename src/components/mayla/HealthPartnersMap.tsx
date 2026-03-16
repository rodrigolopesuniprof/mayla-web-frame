import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "./TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── types ─── */
type PartnerType = "doctor" | "clinic" | "gym" | "laboratory" | "pharmacy";
type SortMode = "nearest" | "price";

interface Partner {
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
}

interface PartnerLocation {
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

/* ─── constants ─── */
const CATEGORIES: { id: PartnerType | "all"; label: string; emoji: string }[] = [
  { id: "all", label: "Todos", emoji: "📍" },
  { id: "doctor", label: "Médicos", emoji: "🩺" },
  { id: "clinic", label: "Clínicas", emoji: "🏥" },
  { id: "gym", label: "Academias", emoji: "🏋️" },
  { id: "laboratory", label: "Labs", emoji: "🔬" },
  { id: "pharmacy", label: "Farmácias", emoji: "💊" },
];

const MARKER_COLORS: Record<PartnerType, string> = {
  doctor: "#3b82f6",
  clinic: "#10b981",
  gym: "#f59e0b",
  laboratory: "#8b5cf6",
  pharmacy: "#ef4444",
};

const MARKER_EMOJIS: Record<PartnerType, string> = {
  doctor: "🩺",
  clinic: "🏥",
  gym: "🏋️",
  laboratory: "🔬",
  pharmacy: "💊",
};

const TYPE_LABELS: Record<PartnerType, string> = {
  doctor: "Médico",
  clinic: "Clínica",
  gym: "Academia",
  laboratory: "Laboratório",
  pharmacy: "Farmácia",
};

const DEFAULT_RADIUS_KM = 10;
const DEFAULT_CENTER: [number, number] = [-20.315, -40.312]; // Vitória-ES

function createIcon(type: PartnerType, selected: boolean) {
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
      ${selected ? 'transform:scale(1.2);z-index:999;' : ''}
    ">${emoji}</div>`,
  });
}

const userIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,.3);"></div>`,
});

/* ─── distance helper ─── */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/* ─── map recenter component ─── */
function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom]);
  return null;
}

/* ─── main component ─── */
interface Props {
  onBack: () => void;
}

export function HealthPartnersMap({ onBack }: Props) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [locations, setLocations] = useState<PartnerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<PartnerType | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("nearest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailPartner, setDetailPartner] = useState<Partner | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        () => { setGeoError(true); setUserPos(DEFAULT_CENTER); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGeoError(true);
      setUserPos(DEFAULT_CENTER);
    }
  }, []);

  // Fetch partners + locations
  useEffect(() => {
    const load = async () => {
      const [{ data: pData }, { data: lData }] = await Promise.all([
        supabase.from("partners").select("*").eq("active", true).eq("approval_status", "approved"),
        supabase.from("partner_locations").select("*"),
      ]);
      setPartners((pData as Partner[]) || []);
      setLocations((lData as PartnerLocation[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  // Compute display coordinates + distance
  const enrichedPartners = useMemo(() => {
    if (!userPos) return [];
    return partners.map((p) => {
      // Find closest location or use partner's own coords
      const pLocs = locations.filter((l) => l.partner_id === p.id && l.latitude && l.longitude);
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
      } else if (bestLat && bestLng) {
        bestDist = haversine(userPos[0], userPos[1], bestLat, bestLng);
      }

      return { ...p, display_lat: bestLat ?? undefined, display_lng: bestLng ?? undefined, distance: bestDist };
    }).filter((p) => p.display_lat && p.display_lng && p.distance <= DEFAULT_RADIUS_KM);
  }, [partners, locations, userPos]);

  // Apply filters + sort
  const filtered = useMemo(() => {
    let list = categoryFilter === "all" ? enrichedPartners : enrichedPartners.filter((p) => p.partner_type === categoryFilter);
    if (sortMode === "nearest") list = [...list].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    else if (sortMode === "price") list = [...list].sort((a, b) => (a.consultation_price ?? 999) - (b.consultation_price ?? 999));
    return list;
  }, [enrichedPartners, categoryFilter, sortMode]);

  const mapCenter: [number, number] = userPos || DEFAULT_CENTER;

  const handlePinClick = useCallback((id: string) => {
    setSelectedId(id);
    // Scroll list card into view
    setTimeout(() => {
      const el = document.getElementById(`partner-card-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }, []);

  const handleCardClick = useCallback((p: Partner) => {
    setSelectedId(p.id);
  }, []);

  // Detail view
  if (detailPartner) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={detailPartner.name} onBack={() => setDetailPartner(null)} />
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {detailPartner.logo_url && (
            <img src={detailPartner.logo_url} alt={detailPartner.name} className="w-full h-48 object-cover rounded-2xl" />
          )}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{MARKER_EMOJIS[detailPartner.partner_type]}</span>
            <Badge variant="secondary">{TYPE_LABELS[detailPartner.partner_type]}</Badge>
            {detailPartner.specialty && <Badge variant="outline">{detailPartner.specialty}</Badge>}
          </div>

          <h2 className="font-display text-xl font-bold text-foreground">{detailPartner.name}</h2>

          {detailPartner.crm && (
            <p className="text-sm text-muted-foreground">CRM: {detailPartner.crm}/{detailPartner.crm_state}</p>
          )}

          {detailPartner.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{detailPartner.description}</p>
          )}

          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            {detailPartner.full_address && (
              <div className="flex items-start gap-2">
                <span>📍</span>
                <span className="text-sm text-foreground">{detailPartner.full_address}</span>
              </div>
            )}
            {detailPartner.city && (
              <div className="flex items-start gap-2">
                <span>🏙️</span>
                <span className="text-sm text-foreground">{detailPartner.city} - {detailPartner.state}</span>
              </div>
            )}
            {detailPartner.phone && (
              <div className="flex items-start gap-2">
                <span>📞</span>
                <span className="text-sm text-foreground">{detailPartner.phone}</span>
              </div>
            )}
            {detailPartner.email && (
              <div className="flex items-start gap-2">
                <span>✉️</span>
                <span className="text-sm text-foreground">{detailPartner.email}</span>
              </div>
            )}
            {detailPartner.consultation_price != null && (
              <div className="flex items-start gap-2">
                <span>💰</span>
                <span className="text-sm font-semibold text-foreground">R$ {detailPartner.consultation_price.toFixed(2)}</span>
              </div>
            )}
            {detailPartner.distance != null && detailPartner.distance < Infinity && (
              <div className="flex items-start gap-2">
                <span>📏</span>
                <span className="text-sm text-muted-foreground">{formatDistance(detailPartner.distance)}</span>
              </div>
            )}
          </div>

          {/* Services */}
          {detailPartner.services_offered && (detailPartner.services_offered as string[]).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Serviços</h4>
              <div className="flex flex-wrap gap-2">
                {(detailPartner.services_offered as string[]).map((s, i) => (
                  <Badge key={i} variant="outline">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {detailPartner.contact_link && (
              <Button className="w-full" onClick={() => window.open(detailPartner.contact_link!, "_blank")}>
                📞 Entrar em contato
              </Button>
            )}
            {detailPartner.phone && !detailPartner.contact_link && (
              <Button className="w-full" onClick={() => window.open(`tel:${detailPartner.phone}`, "_self")}>
                📞 Ligar
              </Button>
            )}
            {(detailPartner.booking_link || detailPartner.scheduling_link) && (
              <Button variant="outline" className="w-full" onClick={() => window.open(detailPartner.booking_link || detailPartner.scheduling_link!, "_blank")}>
                📅 Agendar
              </Button>
            )}
            {detailPartner.display_lat && detailPartner.display_lng && (
              <Button variant="outline" className="w-full" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${detailPartner.display_lat},${detailPartner.display_lng}`, "_blank")}>
                🗺️ Abrir rota
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Parceiros de Saúde" onBack={onBack} />

      {/* Category filters */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto shrink-0 border-b border-border">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-none cursor-pointer whitespace-nowrap transition-colors ${
              categoryFilter === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <span>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="px-4 py-2 flex gap-2 shrink-0">
        <button
          onClick={() => setSortMode("nearest")}
          className={`text-xs px-2.5 py-1 rounded-md border-none cursor-pointer ${sortMode === "nearest" ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground bg-transparent"}`}
        >
          Mais próximo
        </button>
        <button
          onClick={() => setSortMode("price")}
          className={`text-xs px-2.5 py-1 rounded-md border-none cursor-pointer ${sortMode === "price" ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground bg-transparent"}`}
        >
          Menor preço
        </button>
      </div>

      {/* Map */}
      <div className="h-[45vh] min-h-[250px] shrink-0 relative">
        {loading || !userPos ? (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary">
            <p className="text-sm text-muted-foreground">{loading ? "Carregando parceiros..." : "Obtendo localização..."}</p>
          </div>
        ) : (
          <MapContainer center={mapCenter} zoom={13} className="h-full w-full" zoomControl={false} attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <RecenterMap center={mapCenter} zoom={13} />
            {/* User marker */}
            <Marker position={userPos} icon={userIcon}>
              <Popup>Você está aqui</Popup>
            </Marker>
            {/* Partner markers */}
            {filtered.map((p) => (
              <Marker
                key={p.id}
                position={[p.display_lat!, p.display_lng!]}
                icon={createIcon(p.partner_type, selectedId === p.id)}
                eventHandlers={{ click: () => handlePinClick(p.id) }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>{p.name}</strong><br />
                    {TYPE_LABELS[p.partner_type]}
                    {p.distance != null && <><br />{formatDistance(p.distance)}</>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
        {geoError && (
          <div className="absolute top-2 left-2 right-2 bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-lg z-[1000]">
            ⚠️ Não foi possível obter sua localização. Mostrando região padrão.
          </div>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!loading && filtered.length === 0 && (
          <div className="py-8 text-center">
            <span className="text-4xl">🔍</span>
            <p className="text-sm text-muted-foreground mt-2">Nenhum parceiro encontrado na região.</p>
          </div>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            id={`partner-card-${p.id}`}
            onClick={() => handleCardClick(p)}
            className={`w-full text-left rounded-xl p-3 border cursor-pointer transition-all ${
              selectedId === p.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ background: `${MARKER_COLORS[p.partner_type]}20` }}
              >
                {MARKER_EMOJIS[p.partner_type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{TYPE_LABELS[p.partner_type]}</span>
                </div>
                {p.specialty && <div className="text-xs text-muted-foreground">{p.specialty}</div>}
                <div className="flex items-center gap-3 mt-1">
                  {p.distance != null && p.distance < Infinity && (
                    <span className="text-xs text-muted-foreground">📏 {formatDistance(p.distance)}</span>
                  )}
                  {p.consultation_price != null && (
                    <span className="text-xs font-semibold text-foreground">R$ {p.consultation_price.toFixed(0)}</span>
                  )}
                  {p.online_consultation_enabled && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Online</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={(e) => { e.stopPropagation(); setDetailPartner(p); }}
              >
                Ver →
              </Button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
