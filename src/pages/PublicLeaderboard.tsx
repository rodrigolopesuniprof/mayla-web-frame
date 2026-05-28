import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Gift, Users, Target } from "lucide-react";

interface DashboardData {
  ok: boolean;
  reason?: string;
  company?: { name: string; logo_url: string | null; primary_color: string };
  ranking?: { name: string; avatar_url: string | null; points: number; level: string | null }[];
  teams?: { team_name: string; emoji: string | null; members: number; points: number }[];
  rewards?: { id: string; title: string; description: string | null; image_url: string | null; cost_points: number | null; min_level: number | null }[];
  recent_grants?: { reward_title: string; user_name: string; granted_at: string }[];
  goals?: { weekly_goal: number; monthly_goal: number; yearly_goal: number; week_points: number; month_points: number };
}

export default function PublicLeaderboardPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("get_public_dashboard" as any, { _token: token }).then(({ data, error }) => {
      if (error) setData({ ok: false, reason: error.message });
      else setData(data as any);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando painel...</div>;
  }

  if (!data?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-3xl text-foreground mb-2">Painel indisponível</h1>
          <p className="text-muted-foreground">Este link expirou ou foi revogado.</p>
        </div>
      </div>
    );
  }

  const c = data.company!;
  const g = data.goals!;
  const weekPct = g.weekly_goal > 0 ? Math.min(100, Math.round((g.week_points / g.weekly_goal) * 100)) : 0;
  const monthPct = g.monthly_goal > 0 ? Math.min(100, Math.round((g.month_points / g.monthly_goal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as any]: c.primary_color }}>
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
          {c.logo_url && <img src={c.logo_url} alt={c.name} className="w-12 h-12 rounded-xl object-cover" />}
          <div>
            <h1 className="font-display text-2xl font-medium text-foreground">{c.name}</h1>
            <p className="text-sm text-muted-foreground">Painel público de gamificação</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid gap-6 lg:grid-cols-3">
        {/* Goals */}
        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg text-foreground">Meta coletiva</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Semana</span>
                  <span className="font-semibold text-foreground">{g.week_points.toLocaleString("pt-BR")} / {g.weekly_goal.toLocaleString("pt-BR")} pts</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${weekPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Mês</span>
                  <span className="font-semibold text-foreground">{g.month_points.toLocaleString("pt-BR")} / {g.monthly_goal.toLocaleString("pt-BR")} pts</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${monthPct}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg text-foreground">Ranking de colaboradores</h2>
            </div>
            <div className="space-y-2">
              {(data.ranking || []).map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                  <div className="w-6 text-right text-sm font-bold text-muted-foreground">{i + 1}</div>
                  {r.avatar_url
                    ? <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    : <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">{r.name.charAt(0)}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                    {r.level && <div className="text-[11px] text-muted-foreground">{r.level}</div>}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{r.points.toLocaleString("pt-BR")} pts</div>
                </div>
              ))}
              {(data.ranking || []).length === 0 && <p className="text-sm text-muted-foreground">Sem colaboradores ainda.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Teams */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg text-foreground">Times</h2>
            </div>
            <div className="space-y-2">
              {(data.teams || []).map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="text-xl">{t.emoji || "🌟"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{t.team_name}</div>
                    <div className="text-[11px] text-muted-foreground">{t.members} membros</div>
                  </div>
                  <div className="text-sm font-semibold text-foreground">{Number(t.points).toLocaleString("pt-BR")}</div>
                </div>
              ))}
              {(data.teams || []).length === 0 && <p className="text-sm text-muted-foreground">Sem times.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Rewards */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg text-foreground">Prêmios em jogo</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(data.rewards || []).map(r => (
                <div key={r.id} className="border border-border rounded-xl p-3 flex gap-3">
                  <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {r.image_url ? <img src={r.image_url} alt="" className="w-full h-full object-cover" /> : <Gift className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{r.title}</div>
                    {r.description && <div className="text-[11px] text-muted-foreground line-clamp-2">{r.description}</div>}
                    {r.cost_points && <div className="text-[11px] text-primary mt-0.5">{r.cost_points} pts</div>}
                  </div>
                </div>
              ))}
              {(data.rewards || []).length === 0 && <p className="text-sm text-muted-foreground col-span-2">Sem prêmios ativos.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recent grants */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-display text-lg text-foreground mb-4">🎉 Últimos ganhadores</h2>
            <div className="space-y-2">
              {(data.recent_grants || []).map((g, i) => (
                <div key={i} className="text-sm">
                  <div className="text-foreground"><strong>{g.user_name}</strong> ganhou {g.reward_title}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(g.granted_at).toLocaleDateString("pt-BR")}</div>
                </div>
              ))}
              {(data.recent_grants || []).length === 0 && <p className="text-sm text-muted-foreground">Em breve.</p>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
