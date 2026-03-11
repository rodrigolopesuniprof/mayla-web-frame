import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface EsfTeam {
  id: string;
  municipality_id: string;
  cnes_code: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  qr_code: string;
  active: boolean;
  created_at: string;
}

interface Municipality {
  id: string;
  name: string;
  codigo_ibge: number | null;
}

export function AdminESF() {
  const [teams, setTeams] = useState<EsfTeam[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMuni, setSelectedMuni] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [citizenCounts, setCitizenCounts] = useState<Record<string, number>>({});
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", cnes_code: "", address: "" });
  const [savingManual, setSavingManual] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [muniRes, teamsRes] = await Promise.all([
      supabase.from("municipalities").select("id, name, codigo_ibge").order("name"),
      selectedMuni
        ? supabase.from("esf_teams").select("*").eq("municipality_id", selectedMuni).order("name")
        : supabase.from("esf_teams").select("*").order("name"),
    ]);
    if (muniRes.data) setMunicipalities(muniRes.data);
    if (teamsRes.data) setTeams(teamsRes.data as EsfTeam[]);

    // Count citizens per ESF
    if (teamsRes.data && teamsRes.data.length > 0) {
      const ids = teamsRes.data.map((t: any) => t.id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("esf_team_id")
        .in("esf_team_id", ids);
      if (profiles) {
        const counts: Record<string, number> = {};
        profiles.forEach((p: any) => {
          if (p.esf_team_id) counts[p.esf_team_id] = (counts[p.esf_team_id] || 0) + 1;
        });
        setCitizenCounts(counts);
      }
    }
    setLoading(false);
  }, [selectedMuni]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleImportCNES = async () => {
    if (!selectedMuni) {
      toast.error("Selecione um município primeiro");
      return;
    }
    const muni = municipalities.find(m => m.id === selectedMuni);
    if (!muni?.codigo_ibge) {
      toast.error("Município sem código IBGE configurado");
      return;
    }

    setImporting(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      // Fetch all pages
      let allEstabs: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const url = `https://${projectId}.supabase.co/functions/v1/cnes-proxy?codigo_municipio=${muni.codigo_ibge}&status=1&limit=${limit}&offset=${offset}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
        });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        const items = data.estabelecimentos || [];
        allEstabs = allEstabs.concat(items);
        hasMore = items.length === limit;
        offset += limit;
      }

      // Filter ESF-type establishments (tipo 15=UBS, 72=UBS, 50=UBS Fluvial, 70=NASF)
      // Also filter by name containing "SAUDE DA FAMILIA", "ESF", "PSF", "ESTRATEGIA"
      const esfEstabs = allEstabs.filter((e: any) => {
        const name = ((e.nome_fantasia || "") + " " + (e.nome_razao_social || "")).toUpperCase();
        return (
          name.includes("SAUDE DA FAMILIA") ||
          name.includes("ESTRATEGIA") ||
          name.includes(" ESF ") ||
          name.includes(" PSF ") ||
          name.startsWith("ESF ") ||
          name.startsWith("PSF ") ||
          name.includes("EQUIPE DE SAUDE") ||
          [15, 72, 50].includes(e.codigo_tipo_unidade)
        );
      });

      if (esfEstabs.length === 0) {
        toast.info(`Nenhuma ESF encontrada entre ${allEstabs.length} estabelecimentos`);
        setImporting(false);
        return;
      }

      // Upsert into esf_teams
      let created = 0;
      let updated = 0;
      for (const e of esfEstabs) {
        const cnesCode = String(e.codigo_cnes);
        const qrCode = `ESF_${cnesCode}`;
        const name = e.nome_fantasia || e.nome_razao_social || `CNES ${cnesCode}`;
        const address = [e.endereco_estabelecimento, e.numero_estabelecimento, e.bairro_estabelecimento]
          .filter(Boolean).join(", ");

        const { data: existing } = await supabase
          .from("esf_teams")
          .select("id")
          .eq("cnes_code", cnesCode)
          .eq("municipality_id", selectedMuni)
          .maybeSingle();

        if (existing) {
          await supabase.from("esf_teams").update({
            name, address,
            latitude: e.latitude_estabelecimento_decimo_grau,
            longitude: e.longitude_estabelecimento_decimo_grau,
          }).eq("id", existing.id);
          updated++;
        } else {
          await supabase.from("esf_teams").insert({
            municipality_id: selectedMuni,
            cnes_code: cnesCode,
            name, address, qr_code: qrCode,
            latitude: e.latitude_estabelecimento_decimo_grau,
            longitude: e.longitude_estabelecimento_decimo_grau,
          });
          created++;
        }
      }

      toast.success(`Importação concluída: ${created} novas, ${updated} atualizadas (de ${esfEstabs.length} ESFs)`);
      loadData();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setImporting(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("esf_teams").update({ active: !active }).eq("id", id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta ESF?")) return;
    await supabase.from("esf_teams").delete().eq("id", id);
    toast.success("ESF excluída");
    loadData();
  };

  const filtered = teams.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.cnes_code.includes(q) || (t.address || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl text-foreground">Equipes de Saúde da Família</h2>
        <div className="flex gap-2 items-center">
          <Select value={selectedMuni} onValueChange={setSelectedMuni}>
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Selecione município" />
            </SelectTrigger>
            <SelectContent>
              {municipalities.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} {m.codigo_ibge ? `(${m.codigo_ibge})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleImportCNES} disabled={importing || !selectedMuni}>
            {importing ? "Importando..." : "🔄 Importar do CNES"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowManualForm(!showManualForm); setManualForm({ name: "", cnes_code: "", address: "" }); }} disabled={!selectedMuni}>
            ➕ Cadastrar manual
          </Button>
        </div>
      </div>

      {/* Manual ESF Form */}
      {showManualForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">Cadastrar ESF manualmente</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedMuni || !manualForm.name.trim()) return;
                setSavingManual(true);
                const cnesCode = manualForm.cnes_code.trim() || `MAN_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                const qrCode = manualForm.cnes_code.trim() ? `ESF_${manualForm.cnes_code.trim()}` : `ESF_MAN_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                const { error } = await supabase.from("esf_teams").insert({
                  municipality_id: selectedMuni,
                  cnes_code: cnesCode,
                  name: manualForm.name.trim(),
                  address: manualForm.address.trim() || null,
                  qr_code: qrCode,
                });
                if (error) {
                  toast.error(`Erro: ${error.message}`);
                } else {
                  toast.success("ESF cadastrada com sucesso!");
                  setShowManualForm(false);
                  setManualForm({ name: "", cnes_code: "", address: "" });
                  loadData();
                }
                setSavingManual(false);
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              <Input
                placeholder="Nome da ESF *"
                value={manualForm.name}
                onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                required
              />
              <Input
                placeholder="Código CNES (opcional)"
                value={manualForm.cnes_code}
                onChange={e => setManualForm({ ...manualForm, cnes_code: e.target.value })}
              />
              <Input
                placeholder="Endereço (opcional)"
                value={manualForm.address}
                onChange={e => setManualForm({ ...manualForm, address: e.target.value })}
              />
              <div className="md:col-span-3 flex gap-2">
                <Button type="submit" size="sm" disabled={savingManual}>
                  {savingManual ? "Salvando..." : "Salvar ESF"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Buscar por nome, CNES ou endereço..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground self-center">
          {filtered.length} ESF{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-8 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {selectedMuni
                ? "Nenhuma ESF encontrada. Clique em 'Importar do CNES' para buscar automaticamente."
                : "Selecione um município para ver as ESFs."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(t => (
            <Card key={t.id} className={`${!t.active ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                    🏥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-foreground">{t.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">
                        CNES {t.cnes_code}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {t.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    {t.address && (
                      <p className="text-xs text-muted-foreground mb-1">📍 {t.address}</p>
                    )}
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>👥 {citizenCounts[t.id] || 0} cidadãos vinculados</span>
                      <span className="font-mono text-[10px] bg-secondary px-2 py-0.5 rounded">
                        QR: {t.qr_code}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(t.id, t.active)}>
                      {t.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(t.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
