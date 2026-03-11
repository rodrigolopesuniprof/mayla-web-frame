import { useState, useEffect, useRef, useCallback } from "react";
import { TopBar } from "./TopBar";
import { useMunicipality } from "@/contexts/MunicipalityContext";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Estabelecimento {
  codigo_cnes: number;
  nome_fantasia: string;
  nome_razao_social: string;
  endereco_estabelecimento: string;
  numero_estabelecimento: string;
  bairro_estabelecimento: string;
  numero_telefone_estabelecimento: string | null;
  latitude_estabelecimento_decimo_grau: number | null;
  longitude_estabelecimento_decimo_grau: number | null;
  codigo_tipo_unidade: number;
  estabelecimento_faz_atendimento_ambulatorial_sus: string;
  estabelecimento_possui_centro_cirurgico: number | null;
  estabelecimento_possui_centro_obstetrico: number | null;
  estabelecimento_possui_atendimento_hospitalar: number | null;
  estabelecimento_possui_servico_apoio: number | null;
  descricao_turno_atendimento: string | null;
  distance?: number;
}

type FilterType = "todos" | "sus" | "ubs" | "hospital" | "farmacia";

const TIPO_LABELS: Record<number, string> = {
  1: "Hospital", 2: "Hospital", 4: "Policlínica", 5: "Hospital",
  7: "Hospital", 15: "UBS", 20: "Pronto Socorro", 21: "Consultório",
  22: "Consultório", 36: "Clínica", 39: "UPA", 40: "Lab. de Saúde Pública",
  42: "Hospital/Dia", 43: "Farmácia", 50: "UBS Fluvial",
  61: "CAPS", 62: "Hospital Filantrópico", 64: "SAMU",
  67: "Lab. Análises", 68: "Policlínica", 69: "CEO",
  70: "NASF", 71: "Farmácia Popular", 72: "UBS", 73: "Telessaúde",
  74: "Polo Academia da Saúde", 76: "Oficina Ortopédica",
  77: "Serviço de Atenção Domiciliar", 79: "Centro de Parto Normal",
  80: "Lab. Prótese", 81: "SAMU", 83: "Polo de Prevenção",
  84: "Central Abastecimento", 85: "Centro de Imunobiológico",
};

const FILTER_OPTIONS: { id: FilterType; label: string; emoji: string }[] = [
  { id: "todos", label: "Todos", emoji: "🏥" },
  { id: "sus", label: "SUS", emoji: "💊" },
  { id: "ubs", label: "UBS", emoji: "🏠" },
  { id: "hospital", label: "Hospitais", emoji: "🏨" },
  { id: "farmacia", label: "Farmácias", emoji: "💊" },
];

function getTipoLabel(codigo: number): string {
  return TIPO_LABELS[codigo] || `Tipo ${codigo}`;
}

function getEmoji(codigo: number): string {
  if ([1, 2, 5, 7, 42, 62].includes(codigo)) return "🏨";
  if ([15, 50, 72].includes(codigo)) return "🏠";
  if ([43, 71].includes(codigo)) return "💊";
  if ([20, 39].includes(codigo)) return "🚑";
  if ([61].includes(codigo)) return "🧠";
  if ([64, 81].includes(codigo)) return "🚑";
  if ([40, 67].includes(codigo)) return "🧪";
  if ([69].includes(codigo)) return "🦷";
  return "🏥";
}

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesFilter(e: Estabelecimento, filter: FilterType): boolean {
  if (filter === "todos") return true;
  if (filter === "sus") return e.estabelecimento_faz_atendimento_ambulatorial_sus === "SIM";
  if (filter === "ubs") return [15, 50, 72].includes(e.codigo_tipo_unidade);
  if (filter === "hospital") return [1, 2, 5, 7, 20, 39, 42, 62].includes(e.codigo_tipo_unidade);
  if (filter === "farmacia") return [43, 71].includes(e.codigo_tipo_unidade);
  return true;
}

export function ServicesTab({ onOpenTelemedicine, onOpenAppointment }: { onOpenTelemedicine: () => void; onOpenAppointment: () => void }) {
  const { municipality } = useMunicipality();
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("todos");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [selected, setSelected] = useState<Estabelecimento | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        },
        () => {/* silently fail */ }
      );
    }
  }, []);

  // Fetch CNES data
  useEffect(() => {
    if (!municipality) return;

    const fetchCNES = async () => {
      setLoading(true);
      setError(null);

      // Get codigo_ibge from municipality
      const { data: muniData } = await supabase
        .from("municipalities")
        .select("codigo_ibge")
        .eq("id", municipality.id)
        .single();

      if (!muniData?.codigo_ibge) {
        setError("Código IBGE não configurado para este município");
        setLoading(false);
        return;
      }

      try {
        const res = await supabase.functions.invoke("cnes-proxy", {
          body: null,
          headers: {},
        });

        // Use fetch directly with query params
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        const url = `https://${projectId}.supabase.co/functions/v1/cnes-proxy?codigo_municipio=${muniData.codigo_ibge}&status=1&limit=100`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
          },
        });

        if (!response.ok) throw new Error(`Erro ${response.status}`);

        const data = await response.json();
        let items: Estabelecimento[] = data.estabelecimentos || [];

        // Calculate distances if we have user location
        if (userLat !== null && userLng !== null) {
          items = items.map((e) => ({
            ...e,
            distance:
              e.latitude_estabelecimento_decimo_grau && e.longitude_estabelecimento_decimo_grau
                ? calcDistance(userLat, userLng, e.latitude_estabelecimento_decimo_grau, e.longitude_estabelecimento_decimo_grau)
                : 999,
          }));
          items.sort((a, b) => (a.distance || 999) - (b.distance || 999));
        }

        setEstabelecimentos(items);
      } catch (err: any) {
        setError(err.message || "Erro ao buscar estabelecimentos");
      }
      setLoading(false);
    };

    fetchCNES();
  }, [municipality, userLat, userLng]);

  const filtered = estabelecimentos.filter((e) => matchesFilter(e, filter));

  // Initialize/update map
  useEffect(() => {
    if (!showMap || !mapRef.current || filtered.length === 0) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(mapInstanceRef.current);
      L.control.zoom({ position: "bottomright" }).addTo(mapInstanceRef.current);
      markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    // Clear existing markers
    markersRef.current?.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    // Add user marker
    if (userLat !== null && userLng !== null) {
      const userIcon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:hsl(var(--mayla-rose));border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: "",
      });
      L.marker([userLat, userLng], { icon: userIcon })
        .bindPopup("📍 Você está aqui")
        .addTo(markersRef.current!);
      bounds.push([userLat, userLng]);
    }

    // Add establishment markers
    filtered.forEach((e) => {
      if (!e.latitude_estabelecimento_decimo_grau || !e.longitude_estabelecimento_decimo_grau) return;

      const emoji = getEmoji(e.codigo_tipo_unidade);
      const icon = L.divIcon({
        html: `<div style="font-size:20px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))">${emoji}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: "",
      });

      const marker = L.marker(
        [e.latitude_estabelecimento_decimo_grau, e.longitude_estabelecimento_decimo_grau],
        { icon }
      );

      marker.bindPopup(
        `<div style="font-size:12px;max-width:200px">
          <strong>${e.nome_fantasia || e.nome_razao_social}</strong><br/>
          <span style="color:#666">${getTipoLabel(e.codigo_tipo_unidade)}</span><br/>
          ${e.endereco_estabelecimento}, ${e.numero_estabelecimento}<br/>
          ${e.distance !== undefined ? `📏 ${e.distance.toFixed(1)} km` : ""}
        </div>`
      );

      marker.on("click", () => setSelected(e));
      marker.addTo(markersRef.current!);
      bounds.push([e.latitude_estabelecimento_decimo_grau, e.longitude_estabelecimento_decimo_grau]);
    });

    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [30, 30], maxZoom: 14 });
    }

    return () => {};
  }, [filtered, showMap, userLat, userLng]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = null;
      }
    };
  }, []);

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto flex flex-col">
      <TopBar />
      {/* Telemedicina & Agendamento */}
      <div className="px-[22px] pt-4 grid grid-cols-2 gap-3">
        <button
          onClick={onOpenTelemedicine}
          className="flex items-center gap-2.5 p-3 rounded-2xl border border-border bg-card cursor-pointer hover:border-primary/30 transition-colors text-left"
        >
          <span className="text-xl">📹</span>
          <div>
            <span className="text-[12px] font-semibold text-foreground block">Telemedicina</span>
            <span className="text-[10px] text-muted-foreground">Consulta online</span>
          </div>
        </button>
        <button
          onClick={onOpenAppointment}
          className="flex items-center gap-2.5 p-3 rounded-2xl border border-border bg-card cursor-pointer hover:border-primary/30 transition-colors text-left"
        >
          <span className="text-xl">📋</span>
          <div>
            <span className="text-[12px] font-semibold text-foreground block">Agendar Consulta</span>
            <span className="text-[10px] text-muted-foreground">Presencial</span>
          </div>
        </button>
      </div>
      <div className="px-[22px] pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-display text-xl font-medium text-foreground">Rede de Saúde</h2>
            <p className="text-[11px] text-muted-foreground">
              {loading ? "Buscando..." : `${filtered.length} estabelecimentos`}
              {!loading && filter !== "todos" && ` · filtro: ${FILTER_OPTIONS.find((f) => f.id === filter)?.label}`}
            </p>
          </div>
          <button
            onClick={() => setShowMap(!showMap)}
            className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground border-none cursor-pointer"
          >
            {showMap ? "📋 Lista" : "🗺️ Mapa"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full border-none cursor-pointer font-medium transition-colors ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-[22px] mb-3 bg-destructive/10 text-destructive text-xs p-3 rounded-xl">{error}</div>
      )}

      {/* Map */}
      {showMap && (
        <div
          ref={mapRef}
          className="mx-[22px] mb-3 rounded-2xl overflow-hidden border border-border"
          style={{ height: 220, minHeight: 220 }}
        />
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-[22px] pb-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-secondary rounded-2xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum estabelecimento encontrado com este filtro.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((e) => (
              <div
                key={e.codigo_cnes}
                onClick={() => setSelected(selected?.codigo_cnes === e.codigo_cnes ? null : e)}
                className={`bg-card rounded-2xl p-3.5 border cursor-pointer transition-all ${
                  selected?.codigo_cnes === e.codigo_cnes
                    ? "border-primary shadow-sm"
                    : "border-border hover:border-accent/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{getEmoji(e.codigo_tipo_unidade)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">
                      {e.nome_fantasia || e.nome_razao_social}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {getTipoLabel(e.codigo_tipo_unidade)}
                      {e.estabelecimento_faz_atendimento_ambulatorial_sus === "SIM" && (
                        <span className="ml-1.5 text-[9px] px-1.5 py-px rounded bg-primary/10 text-primary font-semibold">
                          SUS
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {e.endereco_estabelecimento}, {e.numero_estabelecimento} · {e.bairro_estabelecimento}
                    </div>
                  </div>
                  {e.distance !== undefined && e.distance < 900 && (
                    <span className="text-[11px] text-accent font-semibold shrink-0">
                      {e.distance < 1 ? `${Math.round(e.distance * 1000)}m` : `${e.distance.toFixed(1)}km`}
                    </span>
                  )}
                </div>

                {/* Expanded details */}
                {selected?.codigo_cnes === e.codigo_cnes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {e.numero_telefone_estabelecimento && (
                        <div>
                          <span className="text-muted-foreground">📞 </span>
                          <a href={`tel:${e.numero_telefone_estabelecimento}`} className="text-primary">
                            {e.numero_telefone_estabelecimento}
                          </a>
                        </div>
                      )}
                      {e.descricao_turno_atendimento && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">🕐 </span>
                          <span className="text-foreground">{e.descricao_turno_atendimento.toLowerCase()}</span>
                        </div>
                      )}
                      <div className="col-span-2 flex flex-wrap gap-1.5 mt-1">
                        {e.estabelecimento_possui_atendimento_hospitalar === 1 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">🏥 Internação</span>
                        )}
                        {e.estabelecimento_possui_centro_cirurgico === 1 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">🔪 Cirurgia</span>
                        )}
                        {e.estabelecimento_possui_centro_obstetrico === 1 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">🤰 Obstetrícia</span>
                        )}
                        {e.estabelecimento_possui_servico_apoio === 1 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">🧪 Apoio</span>
                        )}
                      </div>
                    </div>
                    {e.latitude_estabelecimento_decimo_grau && e.longitude_estabelecimento_decimo_grau && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitude_estabelecimento_decimo_grau},${e.longitude_estabelecimento_decimo_grau}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary-foreground py-2 rounded-xl no-underline"
                        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" }}
                      >
                        🗺️ Abrir no Google Maps
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
