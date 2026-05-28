import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Company { id: string; name: string; }

interface Stats {
  employees: number;
  surveyed: number;
  withTeam: number;
  programs: number;
  campaigns: number;
  checkins: number;
  appointments: number;
  notifications: number;
}

export function AdminCorporateDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("companies").select("id, name").order("name").then(({ data }) => {
      setCompanies((data as Company[]) || []);
    });
  }, []);

  useEffect(() => { loadStats(); }, [selectedCompany]);

  const loadStats = async () => {
    setLoading(true);
    const companyFilter = selectedCompany !== "all" ? selectedCompany : null;

    let profilesQ = supabase.from("profiles").select("user_id, health_survey_completed, support_team_id, esf_team_id, company_id").not("company_id", "is", null);
    let programsQ = supabase.from("wellbeing_programs").select("id", { count: "exact", head: true });
    let campaignsQ = supabase.from("campaigns").select("id", { count: "exact", head: true });
    let checkinsQ = supabase.from("wellbeing_checkins").select("id", { count: "exact", head: true });
    let appointmentsQ = supabase.from("appointments").select("id", { count: "exact", head: true }).not("company_id", "is", null);
    let notificationsQ = supabase.from("notifications").select("id", { count: "exact", head: true }).not("company_id", "is", null);

    if (companyFilter) {
      profilesQ = profilesQ.eq("company_id", companyFilter);
      programsQ = programsQ.eq("company_id", companyFilter);
      campaignsQ = campaignsQ.eq("company_id", companyFilter);
      checkinsQ = checkinsQ.eq("company_id", companyFilter);
      appointmentsQ = appointmentsQ.eq("company_id", companyFilter);
      notificationsQ = notificationsQ.eq("company_id", companyFilter);
    }

    const [profilesRes, programsRes, campaignsRes, checkinsRes, appointmentsRes, notificationsRes] = await Promise.all([
      profilesQ, programsQ, campaignsQ, checkinsQ, appointmentsQ, notificationsQ,
    ]);

    const profiles = profilesRes.data || [];
    setStats({
      employees: profiles.length,
      surveyed: profiles.filter((p: any) => p.health_survey_completed).length,
      withTeam: profiles.filter((p: any) => p.support_team_id || p.esf_team_id).length,
      programs: programsRes.count || 0,
      campaigns: campaignsRes.count || 0,
      checkins: checkinsRes.count || 0,
      appointments: appointmentsRes.count || 0,
      notifications: notificationsRes.count || 0,
    });
    setLoading(false);
  };

  const kpis = stats ? [
    { label: "Colaboradores", value: stats.employees, emoji: "👥" },
    { label: "Questionário completo", value: stats.surveyed, emoji: "📋" },
    { label: "Em equipes", value: stats.withTeam, emoji: "👥" },
    { label: "Programas", value: stats.programs, emoji: "🌿" },
    { label: "Desafios", value: stats.campaigns, emoji: "🏆" },
    { label: "Check-ins", value: stats.checkins, emoji: "💚" },
    { label: "Agendamentos", value: stats.appointments, emoji: "📅" },
    { label: "Notificações", value: stats.notifications, emoji: "📢" },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">📊 Dashboard Corporativo</h2>
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(k => (
            <Card key={k.label}>
              <CardContent className="p-5 text-center">
                <span className="text-2xl block mb-2">{k.emoji}</span>
                <div className="text-3xl font-bold text-foreground">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats && stats.employees > 0 && (
        <Card className="mt-6">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Completude</h3>
            <div className="space-y-3">
              {[
                { label: "Questionário de saúde", value: stats.surveyed, total: stats.employees },
                { label: "Vinculados a equipes", value: stats.withTeam, total: stats.employees },
              ].map(item => {
                const pct = Math.round((item.value / item.total) * 100);
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
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
      )}
    </div>
  );
}
