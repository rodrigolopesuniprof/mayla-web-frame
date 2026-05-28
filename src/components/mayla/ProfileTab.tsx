import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FavoriteDoctors } from "./FavoriteDoctors";
import { TopBar } from "./TopBar";
import { Avatar } from "./MaylaIcons";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Profile {
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  birth_date: string | null;
  points: number;
  level: string;
  esf_team_id: string | null;
}

interface EsfInfo {
  name: string;
  address: string | null;
}

interface HealthProfile {
  biological_sex: string | null;
  birth_date: string | null;
  is_pregnant: string | null;
  prenatal_started: boolean | null;
  has_hypertension: boolean | null;
  has_diabetes: boolean | null;
  lives_with_infant: boolean | null;
  is_bolsa_familia: boolean | null;
  last_acs_visit: boolean | null;
  last_dental_visit: string | null;
  prenatal_dental_done: boolean | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  numero: string | null;
  complemento: string | null;
  peso: number | null;
  altura: number | null;
  has_bedridden_at_home: boolean | null;
  has_pregnant_at_home: boolean | null;
  has_child_under_5: boolean | null;
  has_child_under_12: boolean | null;
}

type SubView = null | "dados" | "autoavaliacao" | "medicoes" | "consultas" | "medicamentos" | "exames" | "notificacoes" | "configuracoes" | "meutime" | "meus_medicos";

export function ProfileTab() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [esfInfo, setEsfInfo] = useState<EsfInfo | null>(null);
  const [subView, setSubView] = useState<SubView>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, cpf, phone, birth_date, points, level, esf_team_id, avatar_url, avatar_type")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile(data as Profile);
        if ((data as any).esf_team_id) {
          const { data: esf } = await supabase
            .from("esf_teams")
            .select("name, address")
            .eq("id", (data as any).esf_team_id)
            .single();
          if (esf) setEsfInfo(esf as EsfInfo);
        }
      }
      setLoadingProfile(false);
    };
    fetchProfile();
  }, [user]);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  if (subView) {
    return (
      <div className="animate-fade-up flex-1 overflow-y-auto pb-4">
        <div className="px-[22px] py-[14px] flex items-center gap-3 border-b border-border">
          <button
            onClick={() => setSubView(null)}
            className="text-sm text-primary bg-transparent border-none cursor-pointer"
          >
            ← Voltar
          </button>
        </div>
        <div className="px-[22px] pt-4">
          {subView === "dados" && <MeusDados profile={profile} userId={user?.id} onUpdate={setProfile} />}
          {subView === "autoavaliacao" && <AutoAvaliacao userId={user?.id} />}
          {subView === "medicoes" && <HistoricoMedicoes userId={user?.id} />}
          {subView === "consultas" && <ConsultasAgendadas userId={user?.id} />}
          {subView === "meutime" && <MeuTime userId={user?.id} />}
          {subView === "meus_medicos" && <FavoriteDoctors onBack={() => setSubView(null)} />}
          {subView === "medicamentos" && <Medicamentos userId={user?.id} />}
          {subView === "configuracoes" && <Configuracoes userId={user?.id} userEmail={user?.email} />}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto pb-4">
      <TopBar />

      <div className="flex flex-col items-center pt-8 pb-4">
        <Avatar initials={initials} size={72} />
        <h2 className="font-display text-xl font-medium text-foreground mt-3">{displayName}</h2>
        <p className="text-[13px] text-muted-foreground mt-1">{user?.email}</p>
        {!loadingProfile && profile && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm">⭐</span>
            <span className="text-xs font-semibold text-foreground">{profile.points.toLocaleString()} pontos</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
              {profile.level}
            </span>
          </div>
        )}
        {esfInfo && (
          <div className="mt-2 px-4 py-3 bg-primary/10 rounded-xl flex items-center gap-3">
            <span className="text-xl">🏥</span>
            <div>
              <span className="text-xs font-semibold text-foreground block">{esfInfo.name}</span>
              {esfInfo.address && <span className="text-[10px] text-muted-foreground">{esfInfo.address}</span>}
            </div>
          </div>
        )}
        {!esfInfo && !loadingProfile && (
          <p className="text-[11px] text-muted-foreground text-center mt-1">Não vinculado a nenhum Time</p>
        )}
      </div>

      <div className="px-[22px] flex flex-col gap-2.5">
        {([
          { key: "dados" as SubView, emoji: "📋", label: "Meus dados" },
          { key: "autoavaliacao" as SubView, emoji: "🩺", label: "Auto avaliação" },
          { key: "medicoes" as SubView, emoji: "📊", label: "Histórico de medições" },
          { key: "relatorio" as any, emoji: "📈", label: "Relatório de saúde", navigate: true },
          { key: "consultas" as SubView, emoji: "📅", label: "Consultas agendadas" },
          { key: "meus_medicos" as SubView, emoji: "👨‍⚕️", label: "Meus Médicos" },
          { key: "meutime" as SubView, emoji: "👥", label: "Meu Time" },
          { key: "medicamentos" as SubView, emoji: "💊", label: "Medicamentos" },
          { key: "configuracoes" as SubView, emoji: "⚙️", label: "Configurações" },
        ]).map((item) => (
          <button
            key={item.key}
            onClick={() => (item as any).navigate ? navigate("/relatorio") : setSubView(item.key as SubView)}
            className="bg-card rounded-2xl p-4 border border-border flex items-center gap-3 cursor-pointer text-left w-full hover:border-accent/30 transition-colors"
          >
            <span className="text-xl">{item.emoji}</span>
            <span className="text-[14px] font-medium text-foreground flex-1">{item.label}</span>
            <span className="text-muted-foreground">›</span>
          </button>
        ))}

        <button
          onClick={signOut}
          className="bg-destructive/10 rounded-2xl p-4 border border-destructive/20 flex items-center gap-3 cursor-pointer text-left w-full hover:bg-destructive/20 transition-colors mt-2"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[14px] font-medium text-destructive flex-1">Sair da conta</span>
        </button>
      </div>
    </div>
  );
}

// Sub-views

function AutoAvaliacao({ userId }: { userId?: string }) {
  const [health, setHealth] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<HealthProfile | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("biological_sex, birth_date, is_pregnant, prenatal_started, has_hypertension, has_diabetes, lives_with_infant, is_bolsa_familia, last_acs_visit, last_dental_visit, prenatal_dental_done, cep, endereco, bairro, cidade, estado, numero, complemento, peso, altura, has_bedridden_at_home, has_pregnant_at_home, has_child_under_5, has_child_under_12")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setHealth(data as any);
          setForm(data as any);
        }
        setLoading(false);
      });
  }, [userId]);

  const handleSave = async () => {
    if (!userId || !form) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        biological_sex: form.biological_sex,
        is_pregnant: form.is_pregnant,
        prenatal_started: form.prenatal_started,
        has_hypertension: form.has_hypertension,
        has_diabetes: form.has_diabetes,
        lives_with_infant: form.lives_with_infant,
        is_bolsa_familia: form.is_bolsa_familia,
        last_acs_visit: form.last_acs_visit,
        last_dental_visit: form.last_dental_visit,
        prenatal_dental_done: form.prenatal_dental_done,
        cep: form.cep,
        endereco: form.endereco,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        numero: form.numero,
        complemento: form.complemento,
        peso: form.peso,
        altura: form.altura,
        has_bedridden_at_home: form.has_bedridden_at_home,
        has_pregnant_at_home: form.has_pregnant_at_home,
        has_child_under_5: form.has_child_under_5,
        has_child_under_12: form.has_child_under_12,
      } as any)
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setHealth(form);
      setEditing(false);
      toast({ title: "Auto avaliação atualizada!" });
    }
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!health) return (
    <div className="flex flex-col items-center py-16 gap-3">
      <span className="text-4xl">🩺</span>
      <p className="text-sm text-muted-foreground">Questionário não preenchido ainda.</p>
    </div>
  );

  const sexLabel = health.biological_sex === "male" ? "Masculino" : health.biological_sex === "female" ? "Feminino" : "—";
  const pregnantLabel = health.is_pregnant === "yes" ? "Sim" : health.is_pregnant === "no" ? "Não" : health.is_pregnant === "unsure" ? "Não tenho certeza" : "—";
  const dentalLabel = health.last_dental_visit === "less_6m" ? "Menos de 6 meses" : health.last_dental_visit === "more_6m" ? "Mais de 6 meses" : health.last_dental_visit === "never" ? "Nunca" : "—";
  const addressLine = [health.endereco, health.numero, health.complemento, health.bairro].filter(Boolean).join(", ");
  const cityLine = [health.cidade, health.estado].filter(Boolean).join(" - ");

  const InfoRow = ({ label, value, editField }: { label: string; value: string; editField?: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {editing && editField ? editField : <span className="text-[13px] font-medium text-foreground text-right max-w-[55%]">{value}</span>}
    </div>
  );

  const ToggleField = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex gap-2">
      <button onClick={() => onChange(true)} className={`text-xs px-3 py-1 rounded-full border cursor-pointer ${checked ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-muted-foreground"}`}>Sim</button>
      <button onClick={() => onChange(false)} className={`text-xs px-3 py-1 rounded-full border cursor-pointer ${!checked ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-muted-foreground"}`}>Não</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-medium text-foreground">Auto avaliação</h3>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => { setForm(health); setEditing(true); }}>Editar</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        )}
      </div>

      {/* Health data */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase mb-2">Saúde</p>
        <InfoRow label="Sexo biológico" value={sexLabel}
          editField={
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form!, biological_sex: "male" })} className={`text-xs px-3 py-1 rounded-full border cursor-pointer ${form?.biological_sex === "male" ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-muted-foreground"}`}>Masculino</button>
              <button onClick={() => setForm({ ...form!, biological_sex: "female" })} className={`text-xs px-3 py-1 rounded-full border cursor-pointer ${form?.biological_sex === "female" ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-muted-foreground"}`}>Feminino</button>
            </div>
          }
        />
        <InfoRow label="Gravidez" value={pregnantLabel}
          editField={
            <div className="flex gap-1.5">
              {["yes", "no", "unsure"].map(v => (
                <button key={v} onClick={() => setForm({ ...form!, is_pregnant: v })} className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${form?.is_pregnant === v ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-muted-foreground"}`}>
                  {v === "yes" ? "Sim" : v === "no" ? "Não" : "Incerto"}
                </button>
              ))}
            </div>
          }
        />
        <InfoRow label="Hipertensão" value={health.has_hypertension ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.has_hypertension ?? false} onChange={(v) => setForm({ ...form!, has_hypertension: v })} />}
        />
        <InfoRow label="Diabetes" value={health.has_diabetes ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.has_diabetes ?? false} onChange={(v) => setForm({ ...form!, has_diabetes: v })} />}
        />
        <InfoRow label="Peso" value={health.peso ? `${health.peso} kg` : "—"}
          editField={<Input type="number" className="w-20 h-8 text-xs" value={form?.peso ?? ""} onChange={(e) => setForm({ ...form!, peso: e.target.value ? Number(e.target.value) : null })} />}
        />
        <InfoRow label="Altura" value={health.altura ? `${health.altura} cm` : "—"}
          editField={<Input type="number" className="w-20 h-8 text-xs" value={form?.altura ?? ""} onChange={(e) => setForm({ ...form!, altura: e.target.value ? Number(e.target.value) : null })} />}
        />
        <InfoRow label="Última ida ao dentista" value={dentalLabel}
          editField={
            <div className="flex gap-1.5">
              {[{ v: "less_6m", l: "< 6m" }, { v: "more_6m", l: "> 6m" }, { v: "never", l: "Nunca" }].map(({ v, l }) => (
                <button key={v} onClick={() => setForm({ ...form!, last_dental_visit: v })} className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${form?.last_dental_visit === v ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          }
        />
      </div>

      {/* Address */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase mb-2">Endereço</p>
        <InfoRow label="CEP" value={health.cep || "—"} />
        <InfoRow label="Endereço" value={addressLine || "—"} />
        <InfoRow label="Cidade" value={cityLine || "—"} />
      </div>

      {/* Family */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase mb-2">Família</p>
        <InfoRow label="Mora com criança < 1 ano" value={health.lives_with_infant ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.lives_with_infant ?? false} onChange={(v) => setForm({ ...form!, lives_with_infant: v })} />}
        />
        <InfoRow label="Criança < 5 anos em casa" value={health.has_child_under_5 ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.has_child_under_5 ?? false} onChange={(v) => setForm({ ...form!, has_child_under_5: v })} />}
        />
        <InfoRow label="Filho < 12 anos (vacinas)" value={health.has_child_under_12 ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.has_child_under_12 ?? false} onChange={(v) => setForm({ ...form!, has_child_under_12: v })} />}
        />
        <InfoRow label="Acamado em casa" value={health.has_bedridden_at_home ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.has_bedridden_at_home ?? false} onChange={(v) => setForm({ ...form!, has_bedridden_at_home: v })} />}
        />
        <InfoRow label="Grávida em casa" value={health.has_pregnant_at_home ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.has_pregnant_at_home ?? false} onChange={(v) => setForm({ ...form!, has_pregnant_at_home: v })} />}
        />
        <InfoRow label="Bolsa Família" value={health.is_bolsa_familia ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.is_bolsa_familia ?? false} onChange={(v) => setForm({ ...form!, is_bolsa_familia: v })} />}
        />
        <InfoRow label="Visita ACS recente" value={health.last_acs_visit ? "Sim" : "Não"}
          editField={<ToggleField checked={form?.last_acs_visit ?? false} onChange={(v) => setForm({ ...form!, last_acs_visit: v })} />}
        />
      </div>

    </div>
  );
}

function MeusDados({ profile, userId, onUpdate }: { profile: Profile | null; userId?: string; onUpdate: (p: Profile) => void }) {
  const [name, setName] = useState(profile?.full_name || "");
  const [cpf, setCpf] = useState(profile?.cpf || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, cpf, phone, birth_date: birthDate || null })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      onUpdate({ ...profile!, full_name: name, cpf, phone, birth_date: birthDate || null });
      toast({ title: "Dados atualizados!" });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-medium text-foreground">Meus dados</h3>
      <div className="space-y-2">
        <Label>Nome completo</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>CPF</Label>
        <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
      </div>
      <div className="space-y-2">
        <Label>Data de nascimento</Label>
        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </div>
      <Button onClick={handleSave} disabled={saving} className="mt-2">
        {saving ? "Salvando..." : "Salvar alterações"}
      </Button>
    </div>
  );
}

function HistoricoMedicoes({ userId }: { userId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchAll = async () => {
      // Fetch from health_measurements
      const { data: hm } = await supabase
        .from("health_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(20);

      // Fetch from special_measurements
      const { data: sm } = await supabase
        .from("special_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Merge & deduplicate by mapping special_measurements to same format
      const hmItems = (hm || []).map((m: any) => ({
        id: m.id,
        date: m.measured_at,
        type: m.measurement_type,
        heart_rate: m.heart_rate,
        spo2: m.spo2,
        blood_pressure_sys: m.blood_pressure_sys,
        blood_pressure_dia: m.blood_pressure_dia,
        respiratory_rate: m.respiratory_rate,
        stress_level: m.stress_level,
        source: "health_measurements",
      }));

      const smItems = (sm || []).map((s: any) => {
        const d = s.measurement_data || {};
        return {
          id: s.id,
          date: s.created_at,
          type: s.source || "vitals_premium",
          heart_rate: d.heart_rate ? Math.round(d.heart_rate) : null,
          spo2: d.spo2 ?? null,
          blood_pressure_sys: d.blood_pressure_sys ? Math.round(d.blood_pressure_sys) : null,
          blood_pressure_dia: d.blood_pressure_dia ? Math.round(d.blood_pressure_dia) : null,
          respiratory_rate: d.respiratory_rate ? Math.round(d.respiratory_rate) : null,
          stress_level: d.stress_level != null ? Math.round(d.stress_level) : null,
          source: "special_measurements",
        };
      });

      // Combine, sort by date desc, remove duplicates (same timestamp + type)
      const all = [...hmItems, ...smItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      // Deduplicate: if a health_measurement and special_measurement have same heart_rate within 2 min, keep only one
      const seen = new Set<string>();
      const deduped = all.filter((item) => {
        const key = `${Math.round(new Date(item.date).getTime() / 120000)}_${item.heart_rate}`;
        if (item.source === "special_measurements" && seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setItems(deduped);
      setLoading(false);
    };

    fetchAll();
  }, [userId]);

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (items.length === 0) return (
    <div className="flex flex-col items-center py-16 gap-3">
      <span className="text-4xl">📊</span>
      <p className="text-sm text-muted-foreground">Nenhuma medição registrada ainda.</p>
    </div>
  );

  const typeLabels: Record<string, string> = {
    rppg: "rPPG",
    vitals_premium: "Medição Especial",
    vitals_demo: "Medição Demo",
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-medium text-foreground">Histórico de medições</h3>
      {items.map((m) => (
        <div key={m.id} className="bg-card rounded-2xl p-3.5 border border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-semibold text-foreground">{typeLabels[m.type] || m.type}</span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(m.date).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {m.heart_rate && <span>❤️ {m.heart_rate} bpm</span>}
            {m.spo2 && <span>🫁 {m.spo2}%</span>}
            {m.blood_pressure_sys && <span>🩸 {m.blood_pressure_sys}/{m.blood_pressure_dia}</span>}
            {m.respiratory_rate && <span>💨 {m.respiratory_rate} rpm</span>}
            {m.stress_level != null && <span>😰 Estresse: {m.stress_level}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConsultasAgendadas({ userId }: { userId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("appointments")
      .select("*")
      .eq("user_id", userId)
      .order("appointment_date", { ascending: true })
      .then(({ data }) => {
        setItems(data || []);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (items.length === 0) return (
    <div className="flex flex-col items-center py-16 gap-3">
      <span className="text-4xl">📅</span>
      <p className="text-sm text-muted-foreground">Nenhuma consulta agendada.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-medium text-foreground">Consultas agendadas</h3>
      {items.map((a) => (
        <div key={a.id} className="bg-card rounded-2xl p-3.5 border border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-semibold text-foreground">{a.specialty}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === "scheduled" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {a.status === "scheduled" ? "Agendada" : a.status}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            📅 {new Date(a.appointment_date).toLocaleDateString("pt-BR")} às {new Date(a.appointment_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          {a.doctor_name && <div className="text-[11px] text-muted-foreground">👨‍⚕️ {a.doctor_name}</div>}
          {a.clinic_name && <div className="text-[11px] text-muted-foreground">🏥 {a.clinic_name}</div>}
        </div>
      ))}
    </div>
  );
}

// Meu Time sub-view
function MeuTime({ userId }: { userId?: string }) {
  const [myTeam, setMyTeam] = useState<{ id: string; name: string; emoji: string | null; is_default: boolean | null } | null>(null);
  const [members, setMembers] = useState<{ user_id: string; full_name: string | null; points: number }[]>([]);
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string; emoji: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🏃");

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);

    // Get user's team
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id, collaborative_teams(id, name, emoji, is_default, company_id)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (membership && (membership as any).collaborative_teams) {
      const t = (membership as any).collaborative_teams;
      setMyTeam(t);

      // Get team members with points
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", t.id);

      if (teamMembers) {
        const userIds = teamMembers.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, points")
          .in("user_id", userIds)
          .order("points", { ascending: false });
        setMembers((profiles || []) as any);
      }

      // Available teams from same company
      const { data: teams } = await supabase
        .from("collaborative_teams")
        .select("id, name, emoji")
        .eq("company_id", t.company_id)
        .order("name");
      setAvailableTeams((teams || []) as any);
    } else {
      // Fetch available teams via profile company
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
      if (profile?.company_id) {
        const { data: teams } = await supabase.from("collaborative_teams").select("id, name, emoji").eq("company_id", profile.company_id).order("name");
        setAvailableTeams((teams || []) as any);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [userId]);

  const handleJoin = async (teamId: string) => {
    if (!userId) return;
    await supabase.from("team_members").delete().eq("user_id", userId);
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Time atualizado! 🎉" });
      fetchData();
    }
  };

  const handleCreate = async () => {
    if (!userId || !newName.trim()) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
    if (!profile?.company_id) return;
    const { data, error } = await supabase.from("collaborative_teams").insert({
      company_id: profile.company_id,
      name: newName.trim(),
      emoji: newEmoji || "🏃",
      created_by: userId,
    }).select("id").single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      await handleJoin(data.id);
      setNewName("");
      setShowCreate(false);
    }
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-5">
      <h3 className="font-display text-lg font-medium text-foreground">Meu Time</h3>

      {myTeam ? (
        <>
          <div className="bg-accent/10 rounded-2xl p-4 border border-accent/20 flex items-center gap-3">
            <span className="text-3xl">{myTeam.emoji}</span>
            <div>
              <div className="text-base font-semibold text-foreground">{myTeam.name}</div>
              <div className="text-xs text-muted-foreground">{members.length} membro{members.length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {members.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase mb-2">Ranking do time</p>
              <div className="space-y-2">
                {members.map((m, i) => (
                  <div key={m.user_id} className="bg-secondary rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6 text-center">{i + 1}º</span>
                    <span className="text-sm font-medium text-foreground flex-1">{m.full_name || "Usuário"}</span>
                    <span className="text-xs font-semibold text-accent">⭐ {m.points.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-6">
          <span className="text-4xl block mb-2">👥</span>
          <p className="text-sm text-muted-foreground">Você ainda não está em nenhum time.</p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase mb-2">Times disponíveis</p>
        <div className="space-y-2">
          {availableTeams.map((team) => (
            <div key={team.id} className="bg-secondary rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => handleJoin(team.id)}>
              <span className="text-xl">{team.emoji}</span>
              <span className="text-sm font-medium text-foreground flex-1">{team.name}</span>
              {myTeam?.id === team.id ? <span className="text-xs text-accent font-semibold">Atual</span> : <span className="text-xs text-primary font-medium">Entrar</span>}
            </div>
          ))}
        </div>
      </div>

      {!showCreate ? (
        <Button variant="outline" className="w-full" onClick={() => setShowCreate(true)}>✨ Criar novo time</Button>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do time" />
          <div className="flex gap-2 flex-wrap">
            {["🏃", "💪", "🧘", "🚴", "⚡", "🌟", "🎯", "🔥"].map((e) => (
              <button key={e} onClick={() => setNewEmoji(e)} className={`text-2xl p-2 rounded-xl cursor-pointer transition-colors ${newEmoji === e ? "bg-accent/20 ring-2 ring-accent" : "bg-secondary"}`}>{e}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Medicamentos sub-view
function Medicamentos({ userId }: { userId?: string }) {
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", dosage: "", frequency: "daily" });
  const [saving, setSaving] = useState(false);

  const frequencyLabels: Record<string, string> = {
    daily: "1x ao dia",
    "12h": "A cada 12h",
    "8h": "A cada 8h",
    weekly: "Semanal",
  };

  const fetchMeds = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("user_medications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setMeds(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMeds(); }, [userId]);

  const handleAdd = async () => {
    if (!userId || !form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("user_medications").insert({
      user_id: userId,
      name: form.name.trim(),
      dosage: form.dosage.trim() || null,
      frequency: form.frequency,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } else {
      setForm({ name: "", dosage: "", frequency: "daily" });
      setShowAdd(false);
      toast({ title: "Medicamento adicionado!" });
      fetchMeds();
    }
  };

  const toggleActive = async (med: any) => {
    await supabase.from("user_medications").update({ active: !med.active } as any).eq("id", med.id);
    fetchMeds();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este medicamento?")) return;
    await supabase.from("user_medications").delete().eq("id", id);
    fetchMeds();
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-medium text-foreground">Medicamentos</h3>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancelar" : "+ Adicionar"}
        </Button>
      </div>

      {showAdd && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do medicamento</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Losartana" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dosagem</Label>
            <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="Ex: 50mg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frequência</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(frequencyLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setForm({ ...form, frequency: key })}
                  className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                    form.frequency === key ? "bg-accent/20 border-accent text-accent" : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving || !form.name.trim()} className="w-full">
            {saving ? "Salvando..." : "Adicionar medicamento"}
          </Button>
        </div>
      )}

      {meds.length === 0 && !showAdd && (
        <div className="flex flex-col items-center py-12 gap-3">
          <span className="text-4xl">💊</span>
          <p className="text-sm text-muted-foreground">Nenhum medicamento cadastrado.</p>
          <p className="text-[11px] text-muted-foreground text-center">Adicione seus medicamentos para receber lembretes diários e acumular pontos.</p>
        </div>
      )}

      {meds.map((med) => (
        <div key={med.id} className={`bg-card rounded-2xl p-4 border transition-colors ${med.active ? "border-border" : "border-border/50 opacity-60"}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-foreground truncate">{med.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {med.dosage && `${med.dosage} · `}{frequencyLabels[med.frequency] || med.frequency}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(med)}
                className={`text-[10px] px-2.5 py-1 rounded-full border cursor-pointer ${
                  med.active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {med.active ? "Ativo" : "Inativo"}
              </button>
              <button onClick={() => handleDelete(med.id)} className="text-destructive text-[11px] bg-transparent border-none cursor-pointer">✕</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Configurações sub-view
function Configuracoes({ userId, userEmail }: { userId?: string; userEmail?: string }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data) {
        setName((data as any).full_name || "");
        setAvatarUrl((data as any).avatar_url || null);
      }
    });
  }, [userId]);

  const handleSaveName = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nome atualizado!" });
    }
  };

  const handleAvatarUpload = async () => {
    if (!userId || !avatarFile) return;
    setSaving(true);
    const ext = avatarFile.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("validation-photos").upload(path, avatarFile, { upsert: true });
    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const { data } = supabase.storage.from("validation-photos").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: url } as any).eq("user_id", userId);
    setAvatarUrl(url);
    setAvatarFile(null);
    setSaving(false);
    toast({ title: "Foto atualizada!" });
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-medium text-foreground">Configurações</h3>

      {/* Avatar */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase">Foto de perfil</p>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl">👤</div>
          )}
          <div className="flex-1 space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="text-xs w-full"
            />
            {avatarFile && (
              <Button size="sm" onClick={handleAvatarUpload} disabled={saving}>
                {saving ? "Enviando..." : "Salvar foto"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase">Nome</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="sm" onClick={handleSaveName} disabled={saving}>
          {saving ? "Salvando..." : "Salvar nome"}
        </Button>
      </div>

      {/* Change password directly */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-[.1em] uppercase">Alterar senha</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
        </div>
        <Button size="sm" onClick={handleChangePassword} disabled={savingPassword}>
          {savingPassword ? "Salvando..." : "🔑 Alterar senha"}
        </Button>
      </div>
    </div>
  );
}
