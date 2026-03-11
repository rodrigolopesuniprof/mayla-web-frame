import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

interface Municipality {
  id: string;
  name: string;
  state: string;
  slug: string;
  logo_url: string | null;
  secretaria: string;
  rppg_url: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  secondary_color: string;
  codigo_ibge: number | null;
}

export function AdminMunicipalities() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [editing, setEditing] = useState<Municipality | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    state: "ES",
    slug: "",
    secretaria: "Secretaria Municipal de Saúde",
    rppg_url: "https://rppg.saudecomvc.com.br/login",
    primary_color: "204 67% 32%",
    accent_color: "5 75% 60%",
    background_color: "30 50% 96%",
    foreground_color: "16 30% 13%",
    secondary_color: "30 25% 89%",
    codigo_ibge: "",
    telemedicine_url: "",
    ubs_email: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("municipalities").select("*").order("name");
    if (data) setMunicipalities(data as Municipality[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({
      name: "", state: "ES", slug: "",
      secretaria: "Secretaria Municipal de Saúde",
      rppg_url: "https://rppg.saudecomvc.com.br/login",
      primary_color: "204 67% 32%", accent_color: "5 75% 60%",
      background_color: "30 50% 96%", foreground_color: "16 30% 13%",
      secondary_color: "30 25% 89%", codigo_ibge: "",
      telemedicine_url: "", ubs_email: "",
    });
    setLogoFile(null);
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (m: Municipality) => {
    setEditing(m);
    setForm({
      name: m.name, state: m.state, slug: m.slug,
      secretaria: m.secretaria, rppg_url: m.rppg_url || "",
      primary_color: m.primary_color, accent_color: m.accent_color,
      background_color: m.background_color, foreground_color: m.foreground_color,
      secondary_color: m.secondary_color, codigo_ibge: m.codigo_ibge?.toString() || "",
      telemedicine_url: (m as any).telemedicine_url || "", ubs_email: (m as any).ubs_email || "",
    });
    setLogoFile(null);
    setShowForm(true);
  };

  const uploadLogo = async (municipalityId: string): Promise<string | null> => {
    if (!logoFile) return null;
    const ext = logoFile.name.split(".").pop();
    const path = `${municipalityId}/logo.${ext}`;
    
    const { error } = await supabase.storage
      .from("municipality-logos")
      .upload(path, logoFile, { upsert: true });

    if (error) {
      toast({ title: "Erro ao enviar logo", description: error.message, variant: "destructive" });
      return null;
    }

    const { data } = supabase.storage.from("municipality-logos").getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = {
        ...form,
        codigo_ibge: form.codigo_ibge ? parseInt(form.codigo_ibge) : null,
      };

      if (editing) {
        // Update
        let logo_url = editing.logo_url;
        if (logoFile) {
          const url = await uploadLogo(editing.id);
          if (url) logo_url = url;
        }
        const { error } = await supabase
          .from("municipalities")
          .update({ ...formData, logo_url })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Município atualizado!" });
      } else {
        // Insert
        const { data, error } = await supabase
          .from("municipalities")
          .insert(formData)
          .select("id")
          .single();
        if (error) throw error;
        if (logoFile && data) {
          const url = await uploadLogo(data.id);
          if (url) {
            await supabase.from("municipalities").update({ logo_url: url }).eq("id", data.id);
          }
        }
        toast({ title: "Município criado!" });
      }
      resetForm();
      load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este município?")) return;
    const { error } = await supabase.from("municipalities").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Município removido" });
      load();
    }
  };

  const hslToHex = (hsl: string) => {
    try {
      const [h, sStr, lStr] = hsl.split(" ");
      const s = parseFloat(sStr) / 100;
      const l = parseFloat(lStr) / 100;
      const hue = parseFloat(h);
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + hue / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    } catch {
      return "#888888";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-foreground">Municípios ({municipalities.length})</h2>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            + Novo Município
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              {editing ? "Editar Município" : "Novo Município"}
              <Button variant="ghost" size="sm" onClick={resetForm}>✕</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Prefeitura de..." required />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="nome-da-cidade" required />
              </div>
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Código IBGE</Label>
                <Input type="number" value={form.codigo_ibge} onChange={(e) => setForm({ ...form, codigo_ibge: e.target.value })} placeholder="320100" />
              </div>
              <div className="space-y-2">
                <Label>Secretaria</Label>
                <Input value={form.secretaria} onChange={(e) => setForm({ ...form, secretaria: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>URL rPPG</Label>
                <Input value={form.rppg_url} onChange={(e) => setForm({ ...form, rppg_url: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>URL Telemedicina</Label>
                <Input value={form.telemedicine_url} onChange={(e) => setForm({ ...form, telemedicine_url: e.target.value })} placeholder="https://telemedicina.exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>E-mail UBS (agendamento)</Label>
                <Input type="email" value={form.ubs_email} onChange={(e) => setForm({ ...form, ubs_email: e.target.value })} placeholder="agendamento@ubs.gov.br" />
              </div>
              <div className="space-y-2">
                <Label>Logomarca</Label>
                <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                {editing?.logo_url && (
                  <img src={editing.logo_url} alt="Logo atual" className="h-10 mt-1 rounded" />
                )}
              </div>

              {/* Colors */}
              <div className="md:col-span-2 lg:col-span-3 border-t border-border pt-4 mt-2">
                <p className="text-sm font-semibold text-foreground mb-3">🎨 Cores (HSL)</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { key: "primary_color", label: "Primária" },
                    { key: "accent_color", label: "Destaque" },
                    { key: "background_color", label: "Fundo" },
                    { key: "foreground_color", label: "Texto" },
                    { key: "secondary_color", label: "Secundária" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs flex items-center gap-2">
                        <span
                          className="inline-block w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: hslToHex(form[key as keyof typeof form]) }}
                        />
                        {label}
                      </Label>
                      <Input
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        placeholder="H S% L%"
                        className="text-xs font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3 flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar município"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="grid gap-3">
        {municipalities.map((m) => (
          <Card key={m.id} className="overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              {/* Logo */}
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-primary-foreground"
                style={{
                  background: m.logo_url
                    ? `url(${m.logo_url}) center/cover`
                    : `linear-gradient(135deg, hsl(${m.primary_color}), hsl(${m.primary_color} / 0.7))`,
                }}
              >
                {!m.logo_url && m.name.charAt(0)}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.state} · /{m.slug} · {m.secretaria}</div>
              </div>

              {/* Color swatches */}
              <div className="hidden md:flex items-center gap-1">
                {[m.primary_color, m.accent_color, m.background_color, m.secondary_color].map((c, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 rounded-full border border-border"
                    style={{ backgroundColor: `hsl(${c})` }}
                    title={c}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 flex-wrap">
                <BinahToggle municipalityId={m.id} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/cidade/${m.slug}`;
                    navigator.clipboard.writeText(url);
                    toast({ title: "Link copiado!", description: url });
                  }}
                >
                  📋 Link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/painel/${m.slug}`;
                    navigator.clipboard.writeText(url);
                    toast({ title: "Link do painel copiado!", description: url });
                  }}
                >
                  📊 Painel
                </Button>
                <Button variant="outline" size="sm" onClick={() => startEdit(m)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(m.id)}>Remover</Button>
              </div>
            </div>
          </Card>
        ))}
        {municipalities.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhum município cadastrado.</p>
        )}
      </div>
    </div>
  );
}

// Inline Binah toggle per municipality
function BinahToggle({ municipalityId }: { municipalityId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [limit, setLimit] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    supabase
      .from("municipality_features")
      .select("enabled, config")
      .eq("municipality_id", municipalityId)
      .eq("feature_key", "binah_special_measurement")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEnabled(data.enabled ?? false);
          setLimit((data.config as any)?.monthly_limit ?? 3);
        }
        setLoaded(true);
      });
  }, [municipalityId]);

  const toggle = async (val: boolean) => {
    setEnabled(val);
    const { error } = await supabase
      .from("municipality_features")
      .upsert(
        {
          municipality_id: municipalityId,
          feature_key: "binah_special_measurement",
          enabled: val,
          config: { monthly_limit: limit },
        },
        { onConflict: "municipality_id,feature_key" }
      );
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setEnabled(!val);
    }
  };

  const saveLimit = async () => {
    await supabase
      .from("municipality_features")
      .upsert(
        {
          municipality_id: municipalityId,
          feature_key: "binah_special_measurement",
          enabled,
          config: { monthly_limit: limit },
        },
        { onConflict: "municipality_id,feature_key" }
      );
    toast({ title: "Limite atualizado" });
    setShowConfig(false);
  };

  if (!loaded) return null;

  return (
    <div className="flex items-center gap-2">
      <Switch checked={enabled} onCheckedChange={toggle} />
      <span className="text-[11px] text-muted-foreground">🔬 Binah</span>
      {enabled && (
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-[10px] text-accent underline"
        >
          {limit}/mês
        </button>
      )}
      {showConfig && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 1)}
            className="w-16 h-7 text-xs"
            min={1}
            max={99}
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveLimit}>
            OK
          </Button>
        </div>
      )}
    </div>
  );
}
