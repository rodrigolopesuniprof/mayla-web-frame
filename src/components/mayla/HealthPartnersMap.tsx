import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "./TopBar";
import { PartnerFilterBar } from "./PartnerFilterBar";
import { PartnerCard } from "./PartnerCard";
import { PartnerDetail } from "./PartnerDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  type Partner,
  type PartnerLocation,
  type PartnerFilters,
  DEFAULT_CENTER,
  enrichPartners,
  applyFilters,
} from "@/lib/partner-helpers";

const LazyMapContent = lazy(() => import("./HealthPartnersMapLazy"));

type GeoState = "idle" | "requesting" | "granted" | "denied";

/* ─── Main Component ─── */
interface Props {
  onBack: () => void;
}

export function HealthPartnersMap({ onBack }: Props) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [locations, setLocations] = useState<PartnerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailPartner, setDetailPartner] = useState<Partner | null>(null);
  const [filters, setFilters] = useState<PartnerFilters>({
    category: "all",
    sort: "nearest",
    consultMode: "all",
    specialty: "",
    city: "",
  });

  // Request geolocation
  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoState("denied");
      setUserPos(DEFAULT_CENTER);
      return;
    }

    setGeoState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoState("granted");
      },
      () => {
        setGeoState("denied");
        setUserPos(DEFAULT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Auto-request on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

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

  // Enrich with distance — wide radius (200km) so partners across regions still appear
  const enriched = useMemo(() => {
    if (!userPos) return [];
    return enrichPartners(partners, locations, userPos, 200);
  }, [partners, locations, userPos]);

  // Extract unique specialties & cities for filter dropdowns
  const specialties = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((p) => p.specialty && set.add(p.specialty));
    return Array.from(set).sort();
  }, [enriched]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((p) => p.city && set.add(p.city));
    return Array.from(set).sort();
  }, [enriched]);

  // Apply filters
  const filtered = useMemo(() => applyFilters(enriched, filters), [enriched, filters]);

  const mapCenter: [number, number] = userPos || DEFAULT_CENTER;

  const handlePinClick = useCallback((id: string) => {
    setSelectedId(id);
    setTimeout(() => {
      document.getElementById(`partner-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }, []);

  // Detail view
  if (detailPartner) {
    return <PartnerDetail partner={detailPartner} onBack={() => setDetailPartner(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Parceiros de Saúde" onBack={onBack} />

      {/* Filters */}
      <PartnerFilterBar
        filters={filters}
        onChange={setFilters}
        specialties={specialties}
        cities={cities}
        resultCount={filtered.length}
      />

      {/* Location permission prompt */}
      {geoState === "idle" && (
        <div className="px-4 py-6 flex flex-col items-center gap-3 bg-secondary/50">
          <span className="text-3xl">📍</span>
          <p className="text-sm text-center text-muted-foreground">
            Para encontrar parceiros de saúde próximos a você, precisamos acessar sua localização.
          </p>
          <Button onClick={requestLocation} size="sm">
            Permitir localização
          </Button>
        </div>
      )}

      {/* Map */}
      <div className="h-[40vh] min-h-[220px] shrink-0 relative">
        {loading || !userPos ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <p className="text-xs text-muted-foreground">
              {geoState === "requesting" ? "Obtendo sua localização..." : "Carregando parceiros..."}
            </p>
          </div>
        ) : (
          <Suspense fallback={
            <div className="h-full w-full flex items-center justify-center bg-secondary">
              <p className="text-xs text-muted-foreground">Carregando mapa...</p>
            </div>
          }>
            <LazyMapContent
              center={mapCenter}
              userPos={userPos}
              partners={filtered}
              selectedId={selectedId}
              onPinClick={handlePinClick}
            />
          </Suspense>
        )}
        {geoState === "denied" && (
          <div className="absolute top-2 left-2 right-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs px-3 py-1.5 rounded-lg z-[1000] flex items-center justify-between">
            <span>⚠️ Localização indisponível. Mostrando região padrão.</span>
            <button onClick={requestLocation} className="underline ml-2 font-medium">Tentar novamente</button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-3">
            <span className="text-4xl">🔍</span>
            <p className="text-sm text-muted-foreground text-center">Nenhum parceiro encontrado.</p>
            <p className="text-xs text-muted-foreground text-center">Tente ajustar os filtros ou ampliar a região.</p>
          </div>
        )}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}
        {filtered.map((p) => (
          <PartnerCard
            key={p.id}
            partner={p}
            selected={selectedId === p.id}
            onSelect={(pp) => setSelectedId(pp.id)}
            onDetail={(pp) => setDetailPartner(pp)}
          />
        ))}
      </div>
    </div>
  );
}
