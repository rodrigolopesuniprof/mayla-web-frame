import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { extractCoordinatesFromGoogleMapsUrl, resolveGoogleMapsUrl } from "@/lib/partner-location-utils";

interface Location {
  id?: string;
  partner_id: string;
  location_name: string;
  full_address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  is_main: boolean;
  _google_maps_url?: string;
}

interface Props {
  partnerId: string;
}

export function PartnerLocationsEditor({ partnerId }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, [partnerId]);

  const loadLocations = async () => {
    const { data } = await supabase
      .from("partner_locations")
      .select("*")
      .eq("partner_id", partnerId)
      .order("is_main", { ascending: false });
    setLocations(((data as any[]) || []).map(l => ({ ...l, _google_maps_url: l.google_maps_url || "" })) as Location[]);
    setLoading(false);
  };

  const addRow = () => {
    setLocations(prev => [...prev, {
      partner_id: partnerId,
      location_name: "",
      full_address: "",
      city: "",
      state: "ES",
      zip_code: "",
      latitude: null,
      longitude: null,
      is_main: prev.length === 0,
    }]);
  };

  const updateRow = (idx: number, field: keyof Location, val: unknown) => {
    setLocations(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const saveRow = async (idx: number) => {
    const loc = locations[idx];
    // 1) Try local extraction (long URLs / address). 2) Fall back to server-side resolver for short URLs.
    let mapsCoordinates =
      extractCoordinatesFromGoogleMapsUrl(loc._google_maps_url) ??
      extractCoordinatesFromGoogleMapsUrl(loc.full_address);

    if (!mapsCoordinates && loc._google_maps_url) {
      mapsCoordinates = await resolveGoogleMapsUrl(loc._google_maps_url);
    }
    const payload = {
      partner_id: loc.partner_id,
      location_name: loc.location_name,
      full_address: loc.full_address,
      city: loc.city,
      state: loc.state,
      zip_code: loc.zip_code,
      latitude: mapsCoordinates?.latitude ?? loc.latitude,
      longitude: mapsCoordinates?.longitude ?? loc.longitude,
      google_maps_url: loc._google_maps_url || null,
      is_main: loc.is_main,
    };

    if (mapsCoordinates) {
      // Update local state so user sees the resolved coords
      updateRow(idx, "latitude", mapsCoordinates.latitude);
      updateRow(idx, "longitude", mapsCoordinates.longitude);
    }

    if (loc.id) {
      await supabase.from("partner_locations").update(payload).eq("id", loc.id);
    } else {
      const { data } = await supabase.from("partner_locations").insert(payload).select().single();
      if (data) updateRow(idx, "id", data.id);
    }

    // Also sync coordinates to the partners table if this is the main location
    if (loc.is_main && (payload.latitude != null || payload.longitude != null)) {
      await supabase.from("partners").update({
        latitude: payload.latitude,
        longitude: payload.longitude,
      }).eq("id", loc.partner_id);
    }

    toast({ title: mapsCoordinates ? "Local salvo ✅ Coordenadas extraídas!" : "Local salvo" });
  };

  const deleteRow = async (idx: number) => {
    const loc = locations[idx];
    if (loc.id) await supabase.from("partner_locations").delete().eq("id", loc.id);
    setLocations(prev => prev.filter((_, i) => i !== idx));
    toast({ title: "Local removido" });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando locais...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Locais de atendimento</h4>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>+ Adicionar local</Button>
      </div>
      {locations.length === 0 && <p className="text-xs text-muted-foreground">Nenhum local cadastrado.</p>}
      {locations.map((loc, idx) => (
        <div key={idx} className="border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do local</Label>
              <Input value={loc.location_name} onChange={e => updateRow(idx, "location_name", e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Endereço</Label>
              <Input value={loc.full_address} onChange={e => updateRow(idx, "full_address", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input value={loc.city} onChange={e => updateRow(idx, "city", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">UF</Label>
              <Input value={loc.state} onChange={e => updateRow(idx, "state", e.target.value)} maxLength={2} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <Input value={loc.zip_code} onChange={e => updateRow(idx, "zip_code", e.target.value)} />
            </div>
          </div>
          {/* Google Maps URL field */}
          <div className="space-y-1">
            <Label className="text-xs">🔗 Link do Google Maps (para extrair coordenadas)</Label>
            <div className="flex gap-2">
              <Input
                value={loc._google_maps_url || ""}
                onChange={e => updateRow(idx, "_google_maps_url", e.target.value)}
                onBlur={async () => {
                  const url = loc._google_maps_url;
                  if (!url) return;
                  const coords = await resolveGoogleMapsUrl(url);
                  if (coords) {
                    updateRow(idx, "latitude", coords.latitude);
                    updateRow(idx, "longitude", coords.longitude);
                    toast({ title: "📍 Coordenadas extraídas — clique em Salvar para confirmar" });
                  }
                }}
                placeholder="Cole aqui o link do Google Maps"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const coords = await resolveGoogleMapsUrl(loc._google_maps_url);
                  if (coords) {
                    updateRow(idx, "latitude", coords.latitude);
                    updateRow(idx, "longitude", coords.longitude);
                    toast({ title: "🔄 Coordenadas atualizadas — clique em Salvar" });
                  } else {
                    toast({ title: "Não foi possível extrair coordenadas", variant: "destructive" });
                  }
                }}
              >
                🔄
              </Button>
            </div>
            {loc.latitude != null && loc.longitude != null && (
              <p className="text-[10px] text-muted-foreground">📍 Coordenadas: {loc.latitude}, {loc.longitude}</p>
            )}
            {!loc.latitude && !loc.longitude && (
              <p className="text-[10px] text-orange-500">⚠️ Sem coordenadas — cole um link do Google Maps e salve</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={loc.is_main} onCheckedChange={v => updateRow(idx, "is_main", v)} />
              <span className="text-xs text-muted-foreground">Local principal</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => deleteRow(idx)}>Remover</Button>
              <Button type="button" size="sm" onClick={() => saveRow(idx)}>Salvar</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
