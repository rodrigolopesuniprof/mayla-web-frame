import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { extractCoordinatesFromGoogleMapsUrl } from "@/lib/partner-location-utils";

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
    setLocations((data as Location[]) || []);
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
    const mapsCoordinates = extractCoordinatesFromGoogleMapsUrl(loc.full_address);
    const payload = {
      partner_id: loc.partner_id,
      location_name: loc.location_name,
      full_address: loc.full_address,
      city: loc.city,
      state: loc.state,
      zip_code: loc.zip_code,
      latitude: mapsCoordinates?.latitude ?? loc.latitude,
      longitude: mapsCoordinates?.longitude ?? loc.longitude,
      is_main: loc.is_main,
    };

    if (loc.id) {
      await supabase.from("partner_locations").update(payload).eq("id", loc.id);
    } else {
      const { data } = await supabase.from("partner_locations").insert(payload).select().single();
      if (data) updateRow(idx, "id", data.id);
    }
    toast({ title: "Local salvo" });
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
