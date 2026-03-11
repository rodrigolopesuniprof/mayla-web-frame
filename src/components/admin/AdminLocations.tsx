import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface HealthUnit {
  id: string;
  name: string;
  cnes_code: string | null;
  qr_code: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  municipality_id: string | null;
  active: boolean;
}

interface Validation {
  id: string;
  user_id: string;
  validation_type: string;
  photo_url: string | null;
  status: string;
  created_at: string;
  health_unit_id: string | null;
  user_mission_id: string;
}

export function AdminLocations() {
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"units" | "validations">("units");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", cnes_code: "", qr_code: "", latitude: "", longitude: "", address: "", municipality_id: "" });
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [unitsRes, validationsRes, munRes] = await Promise.all([
      supabase.from("health_units").select("*").order("name"),
      supabase.from("mission_validations").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("municipalities").select("id, name"),
    ]);
    setUnits((unitsRes.data as any) || []);
    setValidations((validationsRes.data as any) || []);
    setMunicipalities(munRes.data || []);
    setLoading(false);
  };

  const handleSaveUnit = async () => {
    if (!form.name || !form.qr_code) {
      toast({ title: "Preencha nome e QR Code", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name,
      cnes_code: form.cnes_code || null,
      qr_code: form.qr_code,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      address: form.address || null,
      municipality_id: form.municipality_id || null,
    };
    const { error } = await supabase.from("health_units").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Unidade cadastrada!" });
      setShowForm(false);
      setForm({ name: "", cnes_code: "", qr_code: "", latitude: "", longitude: "", address: "", municipality_id: "" });
      fetchAll();
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm("Excluir esta unidade?")) return;
    await supabase.from("health_units").delete().eq("id", id);
    fetchAll();
  };

  const handleValidation = async (v: Validation, approve: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("mission_validations").update({
      status: approve ? "approved" : "rejected",
      validated_by: user.id,
      validated_at: new Date().toISOString(),
    } as any).eq("id", v.id);

    if (approve) {
      await supabase.from("user_missions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      } as any).eq("id", v.user_mission_id);
    } else {
      await supabase.from("user_missions").update({
        status: "pending",
      } as any).eq("id", v.user_mission_id);
    }

    toast({ title: approve ? "Validação aprovada ✅" : "Validação rejeitada ❌" });
    fetchAll();
  };

  if (loading) return <p className="text-muted-foreground text-sm">Carregando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h2 className="font-display text-xl font-medium text-foreground">Unidades de Saúde</h2>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setTab("units")} className={`px-3 py-1.5 rounded-lg text-sm font-medium border-none cursor-pointer ${tab === "units" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            🏥 Unidades ({units.length})
          </button>
          <button onClick={() => setTab("validations")} className={`px-3 py-1.5 rounded-lg text-sm font-medium border-none cursor-pointer ${tab === "validations" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            📋 Validações ({validations.length})
          </button>
        </div>
      </div>

      {tab === "units" && (
        <>
          <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm">
            {showForm ? "Cancelar" : "+ Nova unidade"}
          </Button>

          {showForm && (
            <div className="bg-card rounded-xl border border-border p-4 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="UBS Centro" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">QR Code (fixo) *</Label>
                <Input value={form.qr_code} onChange={(e) => setForm({ ...form, qr_code: e.target.value })} placeholder="UBS_CENTRO_01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CNES</Label>
                <Input value={form.cnes_code} onChange={(e) => setForm({ ...form, cnes_code: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Latitude</Label>
                <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-20.123" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Longitude</Label>
                <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-41.456" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Município</Label>
                <select
                  value={form.municipality_id}
                  onChange={(e) => setForm({ ...form, municipality_id: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleSaveUnit} disabled={saving} className="w-full">
                  {saving ? "Salvando..." : "Cadastrar"}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {units.map((u) => (
              <div key={u.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                <span className="text-xl">🏥</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{u.name}</div>
                  <div className="text-xs text-muted-foreground">
                    QR: <code className="bg-secondary px-1 rounded">{u.qr_code}</code>
                    {u.cnes_code && <> · CNES: {u.cnes_code}</>}
                    {u.address && <> · {u.address}</>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteUnit(u.id)} className="text-destructive">
                  🗑️
                </Button>
              </div>
            ))}
            {units.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma unidade cadastrada</p>}
          </div>
        </>
      )}

      {tab === "validations" && (
        <div className="space-y-3">
          {validations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma validação pendente 🎉</p>
          ) : (
            validations.map((v) => (
              <div key={v.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  {v.photo_url && (
                    <img src={v.photo_url} alt="Comprovante" className="w-20 h-20 rounded-lg object-cover border border-border" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground mb-1">
                      {v.validation_type === "photo_proof" ? "📷 Comprovante fotográfico" : "📱 QR Code"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Enviado em {new Date(v.created_at).toLocaleDateString("pt-BR")} às {new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-xs text-muted-foreground">Usuário: {v.user_id.slice(0, 8)}...</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleValidation(v, true)} className="bg-green-600 hover:bg-green-700 text-white">
                      ✅ Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleValidation(v, false)}>
                      ❌ Rejeitar
                    </Button>
                  </div>
                </div>
                {v.photo_url && (
                  <a href={v.photo_url} target="_blank" rel="noreferrer" className="text-xs text-primary mt-2 inline-block">
                    Ver foto em tamanho completo →
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
