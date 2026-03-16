import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "./TopBar";
import { PartnerFilterBar } from "./PartnerFilterBar";
import { PartnerCard } from "./PartnerCard";
import { PartnerDetail } from "./PartnerDetail";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Partner,
  type PartnerLocation,
  type PartnerFilters,
  DEFAULT_CENTER,
  enrichPartners,
  applyFilters,
} from "@/lib/partner-helpers";

const LazyMapContent = lazy(() => import("./HealthPartnersMapLazy"));

/* ─── Main Component ─── */
interface Props {
  onBack: () => void;
}

export function HealthPartnersMap({ onBack }: Props) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
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

  // Geolocation
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

  // Enrich with distance
  const enriched = useMemo(() => {
    if (!userPos) return [];
    return enrichPartners(partners, locations, userPos);
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

      {/* Map */}
      <div className="h-[40vh] min-h-[220px] shrink-0 relative">
        {loading || !userPos ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <p className="text-xs text-muted-foreground">{loading ? "Carregando parceiros..." : "Obtendo localização..."}</p>
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
        {geoError && (
          <div className="absolute top-2 left-2 right-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs px-3 py-1.5 rounded-lg z-[1000]">
            ⚠️ Não foi possível obter sua localização. Mostrando região padrão.
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
