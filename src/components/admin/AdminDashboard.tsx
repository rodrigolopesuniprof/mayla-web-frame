import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Municipality { id: string; name: string; }

interface DashboardData {
  totalCitizens: number;
  linkedCitizens: number;
  surveyCompleted: number;
  withAddress: number;
  totalNotifications: number;
  esfRanking: { id: string; name: string; count: number; surveyDone: number }[];
  // Health metrics
  totalMeasurements: number;
  citizensWithMeasurement: number;
  measurementsByDay: { date: string; count: number }[];
  // Binah metrics
  totalBinahMeasurements: number;
  citizensWithBinah: number;
  binahByMonth: { month: string; count: number }[];
  binahByMunicipality: { name: string; count: number }[];
}

export function AdminDashboard() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMuni, setSelectedMuni] = useState<string>("all");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("municipalities").select("id, name").order("name")
      .then(({ data }) => { if (data) setMunicipalities(data); });
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [selectedMuni]);

  async function loadDashboard() {
    setLoading(true);

    // Profiles query
    let profilesQuery = supabase.from("profiles").select("user_id, municipality_id, esf_team_id, health_survey_completed, endereco");
    if (selectedMuni !== "all") profilesQuery = profilesQuery.eq("municipality_id", selectedMuni);
    const { data: profiles } = await profilesQuery;

    // Notifications query
    let notifsQuery = supabase.from("notifications").select("id", { count: "exact", head: true });
    if (selectedMuni !== "all") notifsQuery = notifsQuery.eq("municipality_id", selectedMuni);
    const { count: notifCount } = await notifsQuery;

    // ESF teams
    let esfQuery = supabase.from("esf_teams").select("id, name, municipality_id");
    if (selectedMuni !== "all") esfQuery = esfQuery.eq("municipality_id", selectedMuni);
    const { data: esfTeams } = await esfQuery;

    // Health measurements (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    let measQuery = supabase.from("health_measurements").select("user_id, measured_at").gte("measured_at", thirtyDaysAgo);
    const { data: measurements } = await measQuery;

    // Binah special measurements (all time)
    let binahQuery = supabase.from("special_measurements").select("user_id, municipality_id, measured_at");
    if (selectedMuni !== "all") binahQuery = binahQuery.eq("municipality_id", selectedMuni);
    const { data: binahMeasurements } = await binahQuery;

    const allProfiles = profiles || [];
    const profileUserIds = new Set(allProfiles.map(p => p.user_id));
    const totalCitizens = allProfiles.length;
    const linkedCitizens = allProfiles.filter(p => p.municipality_id).length;
    const surveyCompleted = allProfiles.filter(p => (p as any).health_survey_completed).length;
    const withAddress = allProfiles.filter(p => (p as any).endereco).length;

    // Health measurements stats
    const allMeasurements = measurements || [];
    const filteredMeasurements = selectedMuni !== "all"
      ? allMeasurements.filter(m => profileUserIds.has(m.user_id))
      : allMeasurements;
    
    const totalMeasurements = filteredMeasurements.length;
    const citizensWithMeasurement = new Set(filteredMeasurements.map(m => m.user_id)).size;

    // Group by day
    const dayMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      dayMap[d] = 0;
    }
    filteredMeasurements.forEach(m => {
      const d = format(new Date(m.measured_at), "yyyy-MM-dd");
      if (dayMap[d] !== undefined) dayMap[d]++;
    });
    const measurementsByDay = Object.entries(dayMap).map(([date, count]) => ({
      date: format(new Date(date), "dd/MM", { locale: ptBR }),
      count,
    }));

    // Binah stats
    const allBinah = binahMeasurements || [];
    const totalBinahMeasurements = allBinah.length;
    const citizensWithBinah = new Set(allBinah.map(b => b.user_id)).size;

    // Group Binah by month (last 6 months)
    const binahMonthMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = format(d, "yyyy-MM");
      binahMonthMap[key] = 0;
    }
    allBinah.forEach(b => {
      const key = format(new Date(b.measured_at), "yyyy-MM");
      if (binahMonthMap[key] !== undefined) binahMonthMap[key]++;
    });
    const binahByMonth = Object.entries(binahMonthMap).map(([month, count]) => ({
      month: format(new Date(month + "-01"), "MMM/yy", { locale: ptBR }),
      count,
    }));

    // Group Binah by municipality
    const binahMuniMap: Record<string, number> = {};
    allBinah.forEach(b => {
      const mid = b.municipality_id || "sem_vinculo";
      binahMuniMap[mid] = (binahMuniMap[mid] || 0) + 1;
    });
    const muniNameMap = new Map(municipalities.map(m => [m.id, m.name]));
    const binahByMunicipality = Object.entries(binahMuniMap)
      .map(([id, count]) => ({ name: muniNameMap.get(id) || "Sem vínculo", count }))
      .sort((a, b) => b.count - a.count);

    // ESF ranking
    const esfCounts: Record<string, { count: number; surveyDone: number }> = {};
    allProfiles.forEach(p => {
      const eid = (p as any).esf_team_id;
      if (eid) {
        if (!esfCounts[eid]) esfCounts[eid] = { count: 0, surveyDone: 0 };
        esfCounts[eid].count++;
        if ((p as any).health_survey_completed) esfCounts[eid].surveyDone++;
      }
    });

    const esfRanking = (esfTeams || [])
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        count: esfCounts[t.id]?.count || 0,
        surveyDone: esfCounts[t.id]?.surveyDone || 0,
      }))
      .sort((a, b) => b.count - a.count);

    setData({
      totalCitizens,
      linkedCitizens,
      surveyCompleted,
      withAddress,
      totalNotifications: notifCount || 0,
      esfRanking,
      totalMeasurements,
      citizensWithMeasurement,
      measurementsByDay,
      totalBinahMeasurements,
      citizensWithBinah,
      binahByMonth,
      binahByMunicipality,
    });
    setLoading(false);
  }

  const chartConfig = {
    count: { label: "Medições", color: "hsl(var(--primary))" },
  };

  const binahChartConfig = {
    count: { label: "Medições Binah", color: "hsl(var(--accent))" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-foreground">📊 Dashboard</h2>
        <Select value={selectedMuni} onValueChange={setSelectedMuni}>
          <SelectTrigger className="w-[220px] h-9 text-sm">
            <SelectValue placeholder="Filtrar município" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os municípios</SelectItem>
            {municipalities.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Carregando dados...</p>
      ) : data && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Cidadãos cadastrados", value: data.totalCitizens, emoji: "👥" },
              { label: "Vinculados ao município", value: data.linkedCitizens, emoji: "🏛️" },
              { label: "Questionário completo", value: data.surveyCompleted, emoji: "📋" },
              { label: "Mensagens enviadas", value: data.totalNotifications, emoji: "📢" },
            ].map(m => (
              <Card key={m.label}>
                <CardContent className="p-5 text-center">
                  <span className="text-2xl mb-2 block">{m.emoji}</span>
                  <div className="font-display text-3xl font-bold text-foreground">{m.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Health measurements section */}
          <Card className="mb-8">
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-medium text-foreground mb-4">❤️ Medições rPPG (últimos 30 dias)</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-foreground">{data.totalMeasurements}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Total de medições</div>
                </div>
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-foreground">{data.citizensWithMeasurement}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Cidadãos que mediram</div>
                </div>
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-primary">
                    {data.totalCitizens > 0 ? Math.round((data.citizensWithMeasurement / data.totalCitizens) * 100) : 0}%
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Taxa de engajamento</div>
                </div>
              </div>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={data.measurementsByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Binah Special Measurements */}
          <Card className="mb-8">
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-medium text-foreground mb-4">🔬 Medições Especiais (Binah)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-foreground">{data.totalBinahMeasurements}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Total de medições</div>
                </div>
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-foreground">{data.citizensWithBinah}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Cidadãos que usaram</div>
                </div>
                <div className="bg-secondary rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-accent">
                    {data.citizensWithBinah > 0 ? (data.totalBinahMeasurements / data.citizensWithBinah).toFixed(1) : 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Média por cidadão</div>
                </div>
              </div>

              {/* Monthly chart */}
              <p className="text-xs font-medium text-muted-foreground mb-2">Uso mensal (últimos 6 meses)</p>
              <ChartContainer config={binahChartConfig} className="h-[180px] w-full mb-6">
                <BarChart data={data.binahByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>

              {/* By municipality */}
              {selectedMuni === "all" && data.binahByMunicipality.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Por município</p>
                  <div className="space-y-2">
                    {data.binahByMunicipality.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-secondary rounded-xl">
                        <span className="text-sm text-foreground">{m.name}</span>
                        <span className="text-sm font-bold text-accent">{m.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>


          <Card className="mb-8">
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-medium text-foreground mb-4">Completude dos dados</h3>
              <div className="space-y-3">
                {[
                  { label: "Com endereço preenchido", value: data.withAddress, total: data.totalCitizens },
                  { label: "Questionário de saúde completo", value: data.surveyCompleted, total: data.totalCitizens },
                  { label: "Vinculados a ESF", value: data.esfRanking.reduce((s, e) => s + e.count, 0), total: data.totalCitizens },
                  { label: "Realizaram medição rPPG", value: data.citizensWithMeasurement, total: data.totalCitizens },
                ].map(item => {
                  const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">{item.value}/{item.total} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ESF Ranking */}
          <Card>
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-medium text-foreground mb-4">🏆 Ranking das ESFs</h3>
              {data.esfRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ESF cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {data.esfRanking.map((esf, i) => (
                    <div key={esf.id} className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
                      <span className="text-lg font-bold text-muted-foreground w-8 text-center">
                        {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}º`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground block truncate">{esf.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {esf.surveyDone}/{esf.count} com questionário completo
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-bold text-primary">{esf.count}</span>
                        <span className="text-[11px] text-muted-foreground block">cidadãos</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
