import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { CompanyUsersModal } from "./CompanyUsersModal";

interface Company {
  id: string;
  name: string;
  slug: string;
  state: string;
  cnpj: string | null;
  cnae: string | null;
  rppg_url: string | null;
  telemedicine_url: string | null;
  hr_contact_email: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  secondary_color: string;
}

interface InviteToken {
  company_id: string;
  token: string;
}

export function AdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Company | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [usersModal, setUsersModal] = useState<{ companyId: string; companyName: string } | null>(null);

  const [form, setForm] = useState({
    name: "", slug: "", state: "ES", cnpj: "", cnae: "",
    rppg_url: "https://rppg.saudecomvc.com.br/login",
    telemedicine_url: "", hr_contact_email: "",
    primary_color: "204 67% 32%", accent_color: "5 75% 60%",
    background_color: "30 50% 96%", foreground_color: "16 30% 13%",
    secondary_color: "30 25% 89%",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [companiesRes, tokensRes] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("company_invite_tokens").select("company_id, token").eq("active", true),
    ]);
    if (companiesRes.data) setCompanies(companiesRes.data as unknown as Company[]);
    if (tokensRes.data) {
      const map: Record<string, string> = {};
      (tokensRes.data as InviteToken[]).forEach(t => { map[t.company_id] = t.token; });
      setTokens(map);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({
      name: "", slug: "", state: "ES", cnpj: "", cnae: "",
      rppg_url: "https://rppg.saudecomvc.com.br/login",
      telemedicine_url: "", hr_contact_email: "",
      primary_color: "204 67% 32%", accent_color: "5 75% 60%",
      background_color: "30 50% 96%", foreground_color: "16 30% 13%",
      secondary_color: "30 25% 89%",
    });
    setLogoFile(null);
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (c: Company) => {
    setEditing(c);
    setForm({
      name: c.name, slug: c.slug, state: c.state || "ES",
      cnpj: c.cnpj || "", cnae: c.cnae || "",
      rppg_url: c.rppg_url || "", telemedicine_url: c.telemedicine_url || "",
      hr_contact_email: c.hr_contact_email || "",
      primary_color: c.primary_color, accent_color: c.accent_color,
      background_color: c.background_color, foreground_color: c.foreground_color,
      secondary_color: c.secondary_color,
    });
    setLogoFile(null);
    setShowForm(true);
  };

  const uploadLogo = async (companyId: string): Promise<string | null> => {
    if (!logoFile) return null;
    const ext = logoFile.name.split(".").pop();
    const path = `${companyId}/logo.${ext}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, logoFile, { upsert: true });
    if (error) { toast({ title: "Erro ao enviar logo", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData: any = {
        name: form.name, slug: form.slug, state: form.state,
        cnpj: form.cnpj || null, cnae: form.cnae || null,
        rppg_url: form.rppg_url || null, telemedicine_url: form.telemedicine_url || null,
        hr_contact_email: form.hr_contact_email || null,
        primary_color: form.primary_color, accent_color: form.accent_color,
        background_color: form.background_color, foreground_color: form.foreground_color,
        secondary_color: form.secondary_color,
      };

      if (editing) {
        let logo_url = editing.logo_url;
        if (logoFile) { const url = await uploadLogo(editing.id); if (url) logo_url = url; }
        const { error } = await supabase.from("companies").update({ ...formData, logo_url }).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Empresa atualizada!" });
      } else {
        const { data, error } = await supabase.from("companies").insert(formData).select("id").single();
        if (error) throw error;
        if (logoFile && data) {
          const url = await uploadLogo(data.id);
          if (url) await supabase.from("companies").update({ logo_url: url }).eq("id", data.id);
        }
        toast({ title: "Empresa criada!" });
      }
      resetForm();
      load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta empresa?")) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Empresa removida" }); load(); }
  };

  const copyInviteLink = (companyId: string) => {
    const token = tokens[companyId];
    if (!token) { toast({ title: "Token não encontrado", description: "Recarregue a página.", variant: "destructive" }); return; }
    const url = `${window.location.origin}/cadastro/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link de cadastro copiado!", description: url });
  };

  const regenerateToken = async (companyId: string) => {
    if (!confirm("Gerar um novo link? O link anterior será desativado.")) return;
    await supabase.from("company_invite_tokens").update({ active: false }).eq("company_id", companyId).eq("active", true);
    const { error } = await supabase.from("company_invite_tokens").insert({ company_id: companyId, active: true });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Novo link gerado!" });
    load();
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
    } catch { return "#888888"; }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-foreground">Empresas ({companies.length})</h2>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>+ Nova Empresa</Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              {editing ? "Editar Empresa" : "Nova Empresa"}
              <Button variant="ghost" size="sm" onClick={resetForm}>✕</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Empresa Ltda." required />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="nome-da-empresa" required />
              </div>
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label>CNAE</Label>
                <Input value={form.cnae} onChange={e => setForm({ ...form, cnae: e.target.value })} placeholder="Atividade econômica" />
              </div>
              <div className="space-y-2">
                <Label>URL rPPG</Label>
                <Input value={form.rppg_url} onChange={e => setForm({ ...form, rppg_url: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>URL Telemedicina</Label>
                <Input value={form.telemedicine_url} onChange={e => setForm({ ...form, telemedicine_url: e.target.value })} placeholder="https://telemedicina.exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>E-mail (agendamento)</Label>
                <Input type="email" value={form.hr_contact_email} onChange={e => setForm({ ...form, hr_contact_email: e.target.value })} placeholder="contato@empresa.com.br" />
              </div>
              <div className="space-y-2">
                <Label>Logomarca</Label>
                <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                {editing?.logo_url && <img src={editing.logo_url} alt="Logo atual" className="h-10 mt-1 rounded" />}
              </div>

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
                        <span className="inline-block w-4 h-4 rounded-full border border-border" style={{ backgroundColor: hslToHex(form[key as keyof typeof form]) }} />
                        {label}
                      </Label>
                      <Input value={form[key as keyof typeof form]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder="H S% L%" className="text-xs font-mono" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3 flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar empresa"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {companies.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-primary-foreground"
                style={{
                  background: c.logo_url
                    ? `url(${c.logo_url}) center/cover`
                    : `linear-gradient(135deg, hsl(${c.primary_color}), hsl(${c.primary_color} / 0.7))`,
                }}
              >
                {!c.logo_url && c.name.charAt(0)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.state || "ES"} · /{c.slug}
                  {c.cnpj && ` · CNPJ: ${c.cnpj}`}
                </div>
              </div>

              <div className="hidden md:flex items-center gap-1">
                {[c.primary_color, c.accent_color, c.background_color, c.secondary_color].map((color, i) => (
                  <span key={i} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: `hsl(${color})` }} title={color} />
                ))}
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <BinahToggle companyId={c.id} />
                <Button variant="ghost" size="sm" onClick={() => copyInviteLink(c.id)}>🔗 Cadastro</Button>
                <Button variant="ghost" size="sm" onClick={() => regenerateToken(c.id)} title="Regenerar link">🔄</Button>
                <Button variant="ghost" size="sm" onClick={() => setUsersModal({ companyId: c.id, companyName: c.name })}>👥 Usuários</Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  const url = `${window.location.origin}/painel/${c.slug}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: "Link do painel copiado!", description: url });
                }}>📊 Painel</Button>
                <Button variant="outline" size="sm" onClick={() => startEdit(c)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>Remover</Button>
              </div>
            </div>
          </Card>
        ))}
        {companies.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhuma empresa cadastrada.</p>
        )}
      </div>

      {usersModal && (
        <CompanyUsersModal
          companyId={usersModal.companyId}
          companyName={usersModal.companyName}
          open={!!usersModal}
          onClose={() => setUsersModal(null)}
        />
      )}
    </div>
  );
}

function BinahToggle({ companyId }: { companyId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [limit, setLimit] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    supabase.from("company_features").select("enabled, config").eq("company_id", companyId).eq("feature_key", "binah_special_measurement").maybeSingle()
      .then(({ data }) => { if (data) { setEnabled(data.enabled ?? false); setLimit((data.config as any)?.monthly_limit ?? 3); } setLoaded(true); });
  }, [companyId]);

  const toggle = async (val: boolean) => {
    setEnabled(val);
    const { error } = await supabase.from("company_features").upsert({ company_id: companyId, feature_key: "binah_special_measurement", enabled: val, config: { monthly_limit: limit } }, { onConflict: "company_id,feature_key" });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setEnabled(!val); }
  };

  const saveLimit = async () => {
    await supabase.from("company_features").upsert({ company_id: companyId, feature_key: "binah_special_measurement", enabled, config: { monthly_limit: limit } }, { onConflict: "company_id,feature_key" });
    toast({ title: "Limite atualizado" }); setShowConfig(false);
  };

  if (!loaded) return null;

  return (
    <div className="flex items-center gap-2">
      <Switch checked={enabled} onCheckedChange={toggle} />
      <span className="text-[11px] text-muted-foreground">🔬 Binah</span>
      {enabled && (
        <button onClick={() => setShowConfig(!showConfig)} className="text-[10px] text-accent underline">{limit}/mês</button>
      )}
      {showConfig && (
        <div className="flex items-center gap-1">
          <Input type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 1)} className="w-16 h-7 text-xs" min={1} max={99} />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveLimit}>OK</Button>
        </div>
      )}
    </div>
  );
}
