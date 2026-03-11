import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AggregatedDashboard } from "@/components/corporate/AggregatedDashboard";
import { WellbeingPrograms } from "@/components/corporate/WellbeingPrograms";
import { CampaignsList } from "@/components/corporate/CampaignsList";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  wellbeing_program_name: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
}

interface DashboardData {
  totalEmployees: number;
  linkedEmployees: number;
  surveyCompleted: number;
  withAddress: number;
  withTeam: number;
  totalNotifications: number;
  totalAppointments: number;
  teamRanking: { id: string; name: string; count: number; surveyDone: number }[];
}

type Screen = "login" | "dashboard";

export default function CompanyDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [screen, setScreen] = useState<Screen>("login");
  const [company, setCompany] = useState<Company | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    const loadCompany = async () => {
      // Try companies first, then municipalities
      let found: any = null;
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name, slug, logo_url, wellbeing_program_name, primary_color, accent_color, background_color, foreground_color")
        .eq("slug", slug)
        .maybeSingle();

      if (companyData) {
        found = companyData;
      } else {
        const { data: muniData } = await supabase
          .from("municipalities")
          .select("id, name, slug, logo_url, secretaria, primary_color, accent_color, background_color, foreground_color")
          .eq("slug", slug)
          .maybeSingle();
        if (muniData) {
          found = { ...muniData, wellbeing_program_name: muniData.secretaria };
        }
      }

      if (found) setCompany(found as Company);
      setLoading(false);
    };
    loadCompany();
  }, [slug]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) validateAccess(session.user.id);
    });
  }, [company]);

  const validateAccess = async (userId: string) => {
    if (!company) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const corporateRoles = ["admin", "manager", "company_admin", "hr_manager", "wellbeing_manager"];
    const hasAccess = roles?.some(r => corporateRoles.includes(r.role)) || false;

    if (!hasAccess) {
      setError("Acesso negado. Você não tem permissão de gestor.");
      return;
    }

    const isAdmin = roles?.some(r => r.role === "admin") || false;

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, municipality_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile?.company_id !== company.id && profile?.municipality_id !== company.id) {
        setError("Acesso negado. Você não está vinculado a esta empresa.");
        return;
      }
    }

    setScreen("dashboard");
    loadDashboard();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("E-mail ou senha inválidos.");
      setLoginLoading(false);
      return;
    }

    await validateAccess(authData.user.id);
    setLoginLoading(false);
  };

  const loadDashboard = useCallback(async () => {
    if (!company) return;

    const [profilesRes, notifsRes, teamsRes, appointmentsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, company_id, municipality_id, support_team_id, esf_team_id, health_survey_completed, endereco")
        .or(`company_id.eq.${company.id},municipality_id.eq.${company.id}`),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .or(`company_id.eq.${company.id},municipality_id.eq.${company.id}`),
      supabase
        .from("support_teams")
        .select("id, name")
        .eq("company_id", company.id),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .or(`company_id.eq.${company.id},municipality_id.eq.${company.id}`),
    ]);

    const profiles = profilesRes.data || [];
    const teams = teamsRes.data || [];

    const teamCounts: Record<string, { count: number; surveyDone: number }> = {};
    profiles.forEach((p: any) => {
      const tid = p.support_team_id || p.esf_team_id;
      if (tid) {
        if (!teamCounts[tid]) teamCounts[tid] = { count: 0, surveyDone: 0 };
        teamCounts[tid].count++;
        if (p.health_survey_completed) teamCounts[tid].surveyDone++;
      }
    });

    const teamRanking = teams
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        count: teamCounts[t.id]?.count || 0,
        surveyDone: teamCounts[t.id]?.surveyDone || 0,
      }))
      .sort((a, b) => b.count - a.count);

    setData({
      totalEmployees: profiles.length,
      linkedEmployees: profiles.filter((p: any) => p.company_id || p.municipality_id).length,
      surveyCompleted: profiles.filter((p: any) => p.health_survey_completed).length,
      withAddress: profiles.filter((p: any) => p.endereco).length,
      withTeam: profiles.filter((p: any) => p.support_team_id || p.esf_team_id).length,
      totalNotifications: notifsRes.count || 0,
      totalAppointments: appointmentsRes.count || 0,
      teamRanking,
    });
  }, [company]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setScreen("login");
    setData(null);
    setEmail("");
    setPassword("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Empresa não encontrada</h1>
          <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const primaryHsl = company.primary_color;
  const bgHsl = company.background_color;

  if (screen === "login") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4" style={{ backgroundColor: `hsl(${bgHsl})` }}>
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="h-16 mx-auto mb-4 object-contain" />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: `hsl(${primaryHsl})` }}
                >
                  {company.name.charAt(0)}
                </div>
              )}
              <h1 className="text-xl font-bold text-foreground">{company.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{company.wellbeing_program_name}</p>
              <p className="text-xs text-muted-foreground mt-3">Painel de acompanhamento</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="gestor@empresa.com.br" required />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loginLoading} style={{ backgroundColor: `hsl(${primaryHsl})` }}>
                {loginLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: `hsl(${bgHsl})` }}>
      <header className="p-4 text-white" style={{ backgroundColor: `hsl(${primaryHsl})` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="h-10 object-contain brightness-0 invert" />
            ) : (
              <span className="text-xl font-bold">{company.name.charAt(0)}</span>
            )}
            <div>
              <h1 className="font-bold text-lg">{company.name}</h1>
              <p className="text-xs opacity-80">{company.wellbeing_program_name} — Painel de Acompanhamento</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={handleLogout}>Sair</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {!data ? (
          <p className="text-muted-foreground text-center py-12">Carregando dados...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Colaboradores cadastrados", value: data.totalEmployees, emoji: "👥" },
                { label: "Vinculados a equipes", value: data.withTeam, emoji: "👥" },
                { label: "Questionário completo", value: data.surveyCompleted, emoji: "📋" },
                { label: "Agendamentos", value: data.totalAppointments, emoji: "📅" },
              ].map(m => (
                <Card key={m.label}>
                  <CardContent className="p-5 text-center">
                    <span className="text-2xl mb-2 block">{m.emoji}</span>
                    <div className="text-3xl font-bold text-foreground">{m.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mb-8">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4">Completude dos dados</h3>
                <div className="space-y-3">
                  {[
                    { label: "Com endereço preenchido", value: data.withAddress, total: data.totalEmployees },
                    { label: "Questionário de saúde completo", value: data.surveyCompleted, total: data.totalEmployees },
                    { label: "Vinculados a equipes", value: data.withTeam, total: data.totalEmployees },
                  ].map(item => {
                    const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">{item.value}/{item.total} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: `hsl(${primaryHsl})` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4">🏆 Ranking das Equipes</h3>
                {data.teamRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma equipe cadastrada.</p>
                ) : (
                  <div className="space-y-2">
                    {data.teamRanking.map((team, i) => (
                      <div key={team.id} className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
                        <span className="text-lg font-bold text-muted-foreground w-8 text-center">
                          {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}º`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-foreground block truncate">{team.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {team.surveyDone}/{team.count} com questionário completo
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-bold" style={{ color: `hsl(${primaryHsl})` }}>{team.count}</span>
                          <span className="text-[11px] text-muted-foreground block">colaboradores</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground mt-8">
              📢 {data.totalNotifications} mensagens enviadas · Dados atualizados em tempo real
            </p>
          </>
        )}
      </main>
    </div>
  );
}
