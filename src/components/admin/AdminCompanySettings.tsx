import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { CompanyAdminManager } from "./CompanyAdminManager";

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

interface Props {
  company: Company;
  token: string | null;
  onCompanyUpdated: () => void;
}

export function AdminCompanySettings({ company, token, onCompanyUpdated }: Props) {
  const [form, setForm] = useState({
    name: company.name,
    slug: company.slug,
    state: company.state || "ES",
    cnpj: company.cnpj || "",
    cnae: company.cnae || "",
    rppg_url: company.rppg_url || "",
    telemedicine_url: company.telemedicine_url || "",
    hr_contact_email: company.hr_contact_email || "",
    primary_color: company.primary_color,
    accent_color: company.accent_color,
    background_color: company.background_color,
    foreground_color: company.foreground_color,
    secondary_color: company.secondary_color,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    const ext = logoFile.name.split(".").pop();
    const path = `${company.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, logoFile, { upsert: true });
    if (error) { toast({ title: "Erro ao enviar logo", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logo_url = company.logo_url;
      if (logoFile) { const url = await uploadLogo(); if (url) logo_url = url; }

      const { error } = await supabase.from("companies").update({
        name: form.name, slug: form.slug, state: form.state,
        cnpj: form.cnpj || null, cnae: form.cnae || null,
        rppg_url: form.rppg_url || null, telemedicine_url: form.telemedicine_url || null,
        hr_contact_email: form.hr_contact_email || null,
        primary_color: form.primary_color, accent_color: form.accent_color,
        background_color: form.background_color, foreground_color: form.foreground_color,
        secondary_color: form.secondary_color, logo_url,
      }).eq("id", company.id);
      if (error) throw error;
      toast({ title: "Empresa atualizada!" });
      onCompanyUpdated();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const PUBLISHED_DOMAIN = "https://saude.saudecomvc.com.br";

  const copyInviteLink = async () => {
    let currentToken = token;
    if (!currentToken) {
      const { data, error } = await supabase
        .from("company_invite_tokens")
        .insert({ company_id: company.id })
        .select("token")
        .single();
      if (error || !data) {
        toast({ title: "Erro ao gerar token", variant: "destructive" });
        return;
      }
      currentToken = data.token;
      onCompanyUpdated();
    }
    const url = `${PUBLISHED_DOMAIN}/cadastro/${currentToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link de cadastro copiado!", description: url });
  };

  const regenerateToken = async () => {
    if (!confirm("Gerar um novo link? O link anterior será invalidado.")) return;
    await supabase.from("company_invite_tokens").delete().eq("company_id", company.id);
    const { error } = await supabase.from("company_invite_tokens").insert({ company_id: company.id });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Novo link gerado!" });
    onCompanyUpdated();
  };

  const copyDashboardLink = () => {
    const url = `${PUBLISHED_DOMAIN}/painel/${company.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link do painel copiado!", description: url });
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
    <div className="space-y-6">
      {/* Admin da empresa */}
      <CompanyAdminManager companyId={company.id} />

      {/* Links rápidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔗 Links e Acessos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyInviteLink}>📋 Copiar link de cadastro</Button>
            <Button variant="ghost" size="sm" onClick={regenerateToken}>🔄 Regenerar link</Button>
            <Button variant="outline" size="sm" onClick={copyDashboardLink}>📊 Copiar link do painel</Button>
          </div>
          {token && (
            <p className="text-xs text-muted-foreground font-mono bg-secondary rounded-lg px-3 py-2">
              {PUBLISHED_DOMAIN}/cadastro/{token}
            </p>
          )}
          <BinahToggle companyId={company.id} />
          <ProntuarioToggle companyId={company.id} />
        </CardContent>
      </Card>

      {/* Formulário de dados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🏢 Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Razão Social *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} required />
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
              <Input value={form.cnae} onChange={e => setForm({ ...form, cnae: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>URL rPPG</Label>
              <Input value={form.rppg_url} onChange={e => setForm({ ...form, rppg_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>URL Telemedicina</Label>
              <Input value={form.telemedicine_url} onChange={e => setForm({ ...form, telemedicine_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail (agendamento)</Label>
              <Input type="email" value={form.hr_contact_email} onChange={e => setForm({ ...form, hr_contact_email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Logomarca</Label>
              <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
              {company.logo_url && <img src={company.logo_url} alt="Logo atual" className="h-10 mt-1 rounded" />}
            </div>

            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
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

            <div className="md:col-span-2 flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function BinahToggle({ companyId }: { companyId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [limit, setLimit] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useState(() => {
    supabase.from("company_features").select("enabled, config").eq("company_id", companyId).eq("feature_key", "binah_special_measurement").maybeSingle()
      .then(({ data }) => { if (data) { setEnabled(data.enabled ?? false); setLimit((data.config as any)?.monthly_limit ?? 3); } setLoaded(true); });
  });

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
    <div className="flex items-center gap-3 pt-2 border-t border-border">
      <Switch checked={enabled} onCheckedChange={toggle} />
      <span className="text-sm text-muted-foreground">🔬 Binah</span>
      {enabled && (
        <button onClick={() => setShowConfig(!showConfig)} className="text-xs text-accent underline cursor-pointer bg-transparent border-none">{limit}/mês</button>
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

function ProntuarioToggle({ companyId }: { companyId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useState(() => {
    supabase.from("company_features").select("enabled").eq("company_id", companyId).eq("feature_key", "prontuario_conveniado").maybeSingle()
      .then(({ data }) => { if (data) setEnabled(data.enabled ?? false); setLoaded(true); });
  });

  const toggle = async (val: boolean) => {
    setEnabled(val);
    const { error } = await supabase.from("company_features").upsert(
      { company_id: companyId, feature_key: "prontuario_conveniado", enabled: val, config: { system: "meddit" } },
      { onConflict: "company_id,feature_key" }
    );
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setEnabled(!val); }
  };

  if (!loaded) return null;

  return (
    <div className="flex items-center gap-3 pt-2 border-t border-border">
      <Switch checked={enabled} onCheckedChange={toggle} />
      <span className="text-sm text-muted-foreground">🏥 Prontuário Conveniado (Meddit)</span>
    </div>
  );
}
