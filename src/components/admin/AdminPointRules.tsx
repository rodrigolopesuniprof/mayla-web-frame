import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Rule {
  id: string;
  event_key: string;
  label: string;
  description: string | null;
  emoji: string | null;
  points: number;
  active: boolean;
  cap_per_day: number | null;
  cap_per_week: number | null;
  cap_per_month: number | null;
  cap_lifetime: number | null;
  valid_from: string | null;
  valid_until: string | null;
}

interface Props { companyId: string }

const ONBOARDING_KEYS = [
  "profile_complete",
  "self_assessment",
  "rppg_measurement",
  "daily_challenge",
  "weekly_checkin",
] as const;

const numOrNull = (v: string) => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function AdminPointRules({ companyId }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("point_rules" as any)
      .select("*")
      .eq("company_id", companyId)
      .neq("event_key", "mission_complete")
      .order("label");
    setRules((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);


  const update = (id: string, patch: Partial<Rule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const save = async (r: Rule) => {
    setSaving(r.id);
    const { error } = await supabase
      .from("point_rules" as any)
      .update({
        points: r.points, active: r.active,
        cap_per_day: r.cap_per_day, cap_per_week: r.cap_per_week,
        cap_per_month: r.cap_per_month, cap_lifetime: r.cap_lifetime,
        valid_from: r.valid_from, valid_until: r.valid_until,
        label: r.label, description: r.description, emoji: r.emoji,
      })
      .eq("id", r.id);
    setSaving(null);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Regra salva" });
  };

  const restoreDefaults = async () => {
    if (!confirm("Restaurar regras padrão? Apenas eventos faltantes serão recriados; valores existentes não mudam.")) return;
    const { error } = await supabase.rpc("seed_default_point_rules" as any, { _company_id: companyId });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Padrões aplicados" });
    load();
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cada evento abaixo concede pontos quando o colaborador o realiza. Defina pontos, limites por janela de tempo e validade.
          Limite em branco = sem limite. Validade em branco = permanente.
        </p>
        <Button variant="outline" size="sm" onClick={restoreDefaults}>Restaurar padrões</Button>
      </div>

      <div className="grid gap-3">
        {rules.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{r.emoji || "•"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-foreground">{r.label}</div>
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{r.event_key}</code>
                  </div>
                  {r.description && <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{r.active ? "Ativo" : "Inativo"}</span>
                  <Switch checked={r.active} onCheckedChange={(v) => update(r.id, { active: v })} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                <div>
                  <label className="text-[11px] text-muted-foreground">Pontos</label>
                  <Input type="number" min={0} value={r.points} onChange={e => update(r.id, { points: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Máx/dia</label>
                  <Input type="number" min={0} value={r.cap_per_day ?? ""} placeholder="∞" onChange={e => update(r.id, { cap_per_day: numOrNull(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Máx/semana</label>
                  <Input type="number" min={0} value={r.cap_per_week ?? ""} placeholder="∞" onChange={e => update(r.id, { cap_per_week: numOrNull(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Máx/mês</label>
                  <Input type="number" min={0} value={r.cap_per_month ?? ""} placeholder="∞" onChange={e => update(r.id, { cap_per_month: numOrNull(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Máx total (lifetime)</label>
                  <Input type="number" min={0} value={r.cap_lifetime ?? ""} placeholder="∞" onChange={e => update(r.id, { cap_lifetime: numOrNull(e.target.value) })} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" disabled={saving === r.id} onClick={() => save(r)}>{saving === r.id ? "Salvando..." : "Salvar"}</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Válido a partir de</label>
                  <Input type="datetime-local" value={r.valid_from ? r.valid_from.slice(0, 16) : ""} onChange={e => update(r.id, { valid_from: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Válido até</label>
                  <Input type="datetime-local" value={r.valid_until ? r.valid_until.slice(0, 16) : ""} onChange={e => update(r.id, { valid_until: e.target.value || null })} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
