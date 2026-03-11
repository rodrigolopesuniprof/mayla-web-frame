import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface WellbeingSummary {
  week_start: string;
  total_checkins: number;
  unique_participants: number;
  avg_stress: number;
  avg_sleep: number;
  avg_workload: number;
  avg_mood: number;
  wellbeing_index: number;
}

interface Props {
  companyId: string;
  primaryColor?: string;
  totalEmployees: number;
}

export function AggregatedDashboard({ companyId, primaryColor, totalEmployees }: Props) {
  const [wellbeing, setWellbeing] = useState<WellbeingSummary[]>([]);
  const [campaignStats, setCampaignStats] = useState<{ total: number; participants: number; completed: number }>({ total: 0, participants: 0, completed: 0 });
  const [programStats, setProgramStats] = useState<{ total: number; participants: number }>({ total: 0, participants: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const [wellbeingRes, campaignsRes, programsRes] = await Promise.all([
      supabase.rpc("get_company_wellbeing_summary", { _company_id: companyId }),
      supabase
        .from("campaign_participants")
        .select("campaign_id, completed_at, campaigns!inner(company_id)")
        .eq("campaigns.company_id", companyId),
      supabase
        .from("wellbeing_programs")
        .select("id")
        .eq("company_id", companyId)
        .eq("active", true),
    ]);

    setWellbeing((wellbeingRes.data as WellbeingSummary[]) || []);

    const campData = campaignsRes.data || [];
    const uniqueCampaigns = new Set(campData.map((c: any) => c.campaign_id));
    setCampaignStats({
      total: uniqueCampaigns.size,
      participants: campData.length,
      completed: campData.filter((c: any) => c.completed_at).length,
    });

    setProgramStats({
      total: programsRes.data?.length || 0,
      participants: 0,
    });

    setLoading(false);
  };

  const latest = wellbeing[0];
  const previous = wellbeing[1];

  const trendIcon = (current: number | undefined, prev: number | undefined, invert = false) => {
    if (!current || !prev) return "";
    const diff = current - prev;
    if (Math.abs(diff) < 0.1) return "→";
    const up = diff > 0;
    return invert ? (up ? "📈" : "📉") : (up ? "📈" : "📉");
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando indicadores...</p>;

  const engagementRate = latest && totalEmployees > 0
    ? Math.round((latest.unique_participants / totalEmployees) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-foreground">📊 Indicadores Agregados</h3>
      <p className="text-xs text-muted-foreground -mt-4">Dados anonimizados — sem identificação individual</p>

      {/* Wellbeing Index Card */}
      <Card className="border-2" style={primaryColor ? { borderColor: `hsl(${primaryColor} / 0.3)` } : undefined}>
        <CardContent className="p-5 text-center">
          <p className="text-sm text-muted-foreground mb-1">Índice de Bem-estar</p>
          <div className="text-4xl font-bold" style={primaryColor ? { color: `hsl(${primaryColor})` } : undefined}>
            {latest ? `${latest.wellbeing_index}/5` : "—"}
          </div>
          {previous && (
            <p className="text-xs text-muted-foreground mt-1">
              Semana anterior: {previous.wellbeing_index}/5
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Engajamento", value: `${engagementRate}%`, emoji: "📈", sub: `${latest?.unique_participants || 0}/${totalEmployees} participaram` },
          { label: "Humor médio", value: latest ? `${latest.avg_mood}/5` : "—", emoji: "😊", sub: trendIcon(latest?.avg_mood, previous?.avg_mood) },
          { label: "Estresse médio", value: latest ? `${latest.avg_stress}/5` : "—", emoji: "🧠", sub: trendIcon(latest?.avg_stress, previous?.avg_stress, true) },
          { label: "Sono médio", value: latest ? `${latest.avg_sleep}/5` : "—", emoji: "😴", sub: trendIcon(latest?.avg_sleep, previous?.avg_sleep) },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 text-center">
              <span className="text-xl block">{kpi.emoji}</span>
              <div className="text-2xl font-bold text-foreground mt-1">{kpi.value}</div>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              {kpi.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trends */}
      {wellbeing.length > 1 && (
        <Card>
          <CardContent className="p-5">
            <h4 className="font-semibold text-foreground mb-3">📈 Tendência Semanal</h4>
            <div className="space-y-2">
              {wellbeing.slice(0, 8).map(w => {
                const weekLabel = new Date(w.week_start).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                const pct = (w.wellbeing_index / 5) * 100;
                return (
                  <div key={w.week_start} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{weekLabel}</span>
                    <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: `hsl(${primaryColor || "204 67% 32%"})` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-8 text-right">{w.wellbeing_index}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Programs & Campaigns Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <span className="text-xl block">🌿</span>
            <div className="text-2xl font-bold text-foreground mt-1">{programStats.total}</div>
            <p className="text-[11px] text-muted-foreground">Programas ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <span className="text-xl block">🏆</span>
            <div className="text-2xl font-bold text-foreground mt-1">{campaignStats.participants}</div>
            <p className="text-[11px] text-muted-foreground">Participações em campanhas</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        🔒 Todos os dados são agregados e anonimizados. Nenhuma informação individual é exibida.
      </p>
    </div>
  );
}
