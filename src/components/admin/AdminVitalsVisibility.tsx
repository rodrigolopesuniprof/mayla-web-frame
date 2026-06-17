import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { categoryLabel } from "@/hooks/useVisibleIndicators";

interface Row {
  key: string;
  label: string;
  unit: string | null;
  category: string;
  description: string | null;
  providers: string[];
  default_visible_to_user: boolean;
  visible_to_user: boolean;
  sort_order: number;
}

export function AdminVitalsVisibility() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [catRes, visRes] = await Promise.all([
      supabase.from("vitals_indicators_catalog" as any).select("*").order("sort_order"),
      supabase.from("user_visible_indicators" as any).select("indicator_key, visible_to_user"),
    ]);
    const map = new Map<string, boolean>();
    (visRes.data as any[] | null)?.forEach((r) => map.set(r.indicator_key, r.visible_to_user));
    setRows(((catRes.data as any[]) || []).map((c) => ({
      key: c.key,
      label: c.label,
      unit: c.unit,
      category: c.category,
      description: c.description,
      providers: c.providers || [],
      default_visible_to_user: c.default_visible_to_user,
      sort_order: c.sort_order,
      visible_to_user: map.has(c.key) ? !!map.get(c.key) : !!c.default_visible_to_user,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setVisibility = async (key: string, visible: boolean) => {
    setSaving(key);
    const { error } = await supabase
      .from("user_visible_indicators" as any)
      .upsert({ indicator_key: key, visible_to_user: visible, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: "indicator_key" });
    setSaving(null);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, visible_to_user: visible } : r)));
  };

  const bulkSet = async (visible: boolean) => {
    const payload = rows.map((r) => ({ indicator_key: r.key, visible_to_user: visible, updated_by: user?.id, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("user_visible_indicators" as any).upsert(payload, { onConflict: "indicator_key" });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: visible ? "Todos visíveis" : "Todos ocultos" });
    load();
  };

  const restoreDefaults = async () => {
    const payload = rows.map((r) => ({ indicator_key: r.key, visible_to_user: r.default_visible_to_user, updated_by: user?.id, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("user_visible_indicators" as any).upsert(payload, { onConflict: "indicator_key" });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Padrão restaurado" });
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando indicadores...</p>;

  const groups: Record<string, Row[]> = {};
  for (const r of rows) (groups[r.category] = groups[r.category] || []).push(r);
  const totalVisible = rows.filter((r) => r.visible_to_user).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl text-foreground">Indicadores visíveis ao usuário</h2>
          <p className="text-sm text-muted-foreground">
            Controle global do super admin · {totalVisible} de {rows.length} visíveis · admin do cliente sempre vê tudo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => bulkSet(true)}>Mostrar todos</Button>
          <Button size="sm" variant="outline" onClick={() => bulkSet(false)}>Ocultar todos</Button>
          <Button size="sm" variant="outline" onClick={restoreDefaults}>Restaurar padrão</Button>
        </div>
      </div>

      {Object.entries(groups).map(([cat, list]) => (
        <Card key={cat}>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">{categoryLabel(cat)}</h3>
            <div className="space-y-1">
              {list.map((r) => (
                <div key={r.key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/60">
                  <div className="min-w-0 pr-4">
                    <div className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
                      {r.label}
                      {r.unit && <span className="text-xs text-muted-foreground font-normal">({r.unit})</span>}
                      <div className="flex gap-1">
                        {r.providers.map((p) => (
                          <span key={p} className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p}</span>
                        ))}
                      </div>
                    </div>
                    {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    <div className="text-[10px] font-mono text-muted-foreground/60">{r.key}</div>
                  </div>
                  <Switch
                    checked={r.visible_to_user}
                    disabled={saving === r.key}
                    onCheckedChange={(v) => setVisibility(r.key, v)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
