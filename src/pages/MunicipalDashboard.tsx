import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface Municipality {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  secretaria: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
}

interface DashboardData {
  totalCitizens: number;
  linkedCitizens: number;
  surveyCompleted: number;
  withAddress: number;
  withEsf: number;
  totalNotifications: number;
  totalAppointments: number;
  esfRanking: { id: string; name: string; count: number; surveyDone: number }[];
}

type Screen = "login" | "dashboard";

export default function MunicipalDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [screen, setScreen] = useState<Screen>("login");
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Load municipality by slug
  useEffect(() => {
    if (!slug) return;
    supabase
      .from("municipalities")
      .select("id, name, slug, logo_url, secretaria, primary_color, accent_color, background_color, foreground_color")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMunicipality(data as Municipality);
        setLoading(false);
      });
  }, [slug]);

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) validateAccess(session.user.id);
    });
  }, [municipality]);

  const validateAccess = async (userId: string) => {
    if (!municipality) return;

    // Check manager role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isManager = roles?.some(r => r.role === "manager") || false;
    const isAdmin = roles?.some(r => r.role === "admin") || false;

    if (!isManager && !isAdmin) {
      setError("Acesso negado. Você não tem permissão de gestor.");
      return;
    }

    // Check municipality match (admins can access any)
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("municipality_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile?.municipality_id !== municipality.id) {
        setError("Acesso negado. Você não está vinculado a este município.");
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

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("E-mail ou senha inválidos.");
      setLoginLoading(false);
      return;
    }

    await validateAccess(authData.user.id);
    setLoginLoading(false);
  };

  const loadDashboard = useCallback(async () => {
    if (!municipality) return;

    const [profilesRes, notifsRes, esfRes, appointmentsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, municipality_id, esf_team_id, health_survey_completed, endereco")
        .eq("municipality_id", municipality.id),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("municipality_id", municipality.id),
      supabase
        .from("esf_teams")
        .select("id, name")
        .eq("municipality_id", municipality.id),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("municipality_id", municipality.id),
    ]);

    const profiles = profilesRes.data || [];
    const esfTeams = esfRes.data || [];

    const esfCounts: Record<string, { count: number; surveyDone: number }> = {};
    profiles.forEach((p: any) => {
      if (p.esf_team_id) {
        if (!esfCounts[p.esf_team_id]) esfCounts[p.esf_team_id] = { count: 0, surveyDone: 0 };
        esfCounts[p.esf_team_id].count++;
        if (p.health_survey_completed) esfCounts[p.esf_team_id].surveyDone++;
      }
    });

    const esfRanking = esfTeams
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        count: esfCounts[t.id]?.count || 0,
        surveyDone: esfCounts[t.id]?.surveyDone || 0,
      }))
      .sort((a, b) => b.count - a.count);

    setData({
      totalCitizens: profiles.length,
      linkedCitizens: profiles.filter((p: any) => p.municipality_id).length,
      surveyCompleted: profiles.filter((p: any) => p.health_survey_completed).length,
      withAddress: profiles.filter((p: any) => p.endereco).length,
      withEsf: profiles.filter((p: any) => p.esf_team_id).length,
      totalNotifications: notifsRes.count || 0,
      totalAppointments: appointmentsRes.count || 0,
      esfRanking,
    });
  }, [municipality]);

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

  if (!municipality) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Município não encontrado</h1>
          <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const primaryHsl = municipality.primary_color;
  const bgHsl = municipality.background_color;

  // LOGIN SCREEN
  if (screen === "login") {
    return (
      <div
        className="flex items-center justify-center min-h-screen p-4"
        style={{ backgroundColor: `hsl(${bgHsl})` }}
      >
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              {municipality.logo_url ? (
                <img
                  src={municipality.logo_url}
                  alt={municipality.name}
                  className="h-16 mx-auto mb-4 object-contain"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: `hsl(${primaryHsl})` }}
                >
                  {municipality.name.charAt(0)}
                </div>
              )}
              <h1 className="text-xl font-bold text-foreground">{municipality.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{municipality.secretaria}</p>
              <p className="text-xs text-muted-foreground mt-3">Painel de acompanhamento</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="gestor@municipio.gov.br"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loginLoading}
                style={{ backgroundColor: `hsl(${primaryHsl})` }}
              >
                {loginLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // DASHBOARD SCREEN
  return (
    <div className="min-h-screen" style={{ backgroundColor: `hsl(${bgHsl})` }}>
      {/* Header */}
      <header
        className="p-4 text-white"
        style={{ backgroundColor: `hsl(${primaryHsl})` }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {municipality.logo_url ? (
              <img src={municipality.logo_url} alt="" className="h-10 object-contain brightness-0 invert" />
            ) : (
              <span className="text-xl font-bold">{municipality.name.charAt(0)}</span>
            )}
            <div>
              <h1 className="font-bold text-lg">{municipality.name}</h1>
              <p className="text-xs opacity-80">{municipality.secretaria} — Painel de Acompanhamento</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {!data ? (
          <p className="text-muted-foreground text-center py-12">Carregando dados...</p>
        ) : (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Cidadãos cadastrados", value: data.totalCitizens, emoji: "👥" },
                { label: "Vinculados a ESF", value: data.withEsf, emoji: "🏥" },
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

            {/* Completeness */}
            <Card className="mb-8">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4">Completude dos dados</h3>
                <div className="space-y-3">
                  {[
                    { label: "Com endereço preenchido", value: data.withAddress, total: data.totalCitizens },
                    { label: "Questionário de saúde completo", value: data.surveyCompleted, total: data.totalCitizens },
                    { label: "Vinculados a ESF", value: data.withEsf, total: data.totalCitizens },
                  ].map(item => {
                    const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-foreground">{item.label}</span>
                          <span className="text-muted-foreground">{item.value}/{item.total} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: `hsl(${primaryHsl})` }}
                          />
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
                <h3 className="text-lg font-semibold text-foreground mb-4">🏆 Ranking das ESFs</h3>
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
                          <span className="text-lg font-bold" style={{ color: `hsl(${primaryHsl})` }}>
                            {esf.count}
                          </span>
                          <span className="text-[11px] text-muted-foreground block">cidadãos</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Footer info */}
            <p className="text-center text-xs text-muted-foreground mt-8">
              📢 {data.totalNotifications} mensagens enviadas · Dados atualizados em tempo real
            </p>
          </>
        )}
      </main>
    </div>
  );
}
