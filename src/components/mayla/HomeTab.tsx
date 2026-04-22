import { useState, useEffect } from "react";
import type { TabId } from "@/lib/mayla-config";
import { BrandBadge, Avatar } from "./MaylaIcons";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { QuestionnaireRunner } from "./QuestionnaireRunner";
import { useCompanyFeature } from "@/hooks/useCompanyFeature";
import { HealthMagazineCarousel } from "./HealthMagazineCarousel";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  emoji: string;
  color: string;
  external_url: string | null;
  scope: string;
}

interface TeamInfo {
  id: string;
  name: string;
  emoji: string | null;
  is_default: boolean | null;
}

export function HomeTab({ setTab, onOpenTelemedicine, onOpenAppointment, onOpenEsfLink, onOpenVideoCall, onOpenOnDemand, onOpenConsultationOnline, onOpenAssistant, onOpenArticle }: {
  setTab: (id: TabId) => void;
  onOpenTelemedicine: () => void;
  onOpenAppointment: () => void;
  onOpenEsfLink: () => void;
  onOpenVideoCall: (consultation: { id: string; professionalName: string; professionalType: string; specialty: string }) => void;
  onOpenOnDemand: () => void;
  onOpenConsultationOnline?: () => void;
  onOpenAssistant?: () => void;
  onOpenArticle?: (id: string) => void;
}) {
  const { isDefault, companyId } = useCompany();
  const { enabled: consultaEnabled } = useCompanyFeature("consulta_servico");
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<NotificationItem | null>(null);
  const [profilePoints, setProfilePoints] = useState(0);
  const [profileLevel, setProfileLevel] = useState("Colaborador");

  // Questionnaire state
  const [latestQuestionnaire, setLatestQuestionnaire] = useState<{ id: string; title: string } | null>(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // Team state
  const [myTeam, setMyTeam] = useState<TeamInfo | null>(null);
  const [availableTeams, setAvailableTeams] = useState<TeamInfo[]>([]);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [teamDialogMode, setTeamDialogMode] = useState<"list" | "create">("list");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("🏃");

  // Direct consultation navigation (no intermediate dialog)


  useEffect(() => {
    if (!user) return;

    // Profile data
    supabase.from("profiles").select("full_name, points, level, esf_team_id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setProfileName(data.full_name);
        setProfilePoints(data.points);
        setProfileLevel(data.level);
      }
    });

    // Notifications
    supabase.from("notifications").select("id, title, body, emoji, color, external_url, scope").order("priority", { ascending: false }).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setAlerts(data);
    });

    // Fetch user's team
    fetchMyTeam();

    // Fetch latest questionnaire from admin "Pesquisas"
    fetchLatestQuestionnaire();
  }, [user]);


  const fetchLatestQuestionnaire = async () => {
    if (!user) return;

    const [{ data: questionnaires }, { data: missions }] = await Promise.all([
      supabase
        .from("questionnaires")
        .select("id, title")
        .order("created_at", { ascending: false }),
      supabase
        .from("missions")
        .select("questionnaire_id")
        .not("questionnaire_id", "is", null),
    ]);

    const linkedQuestionnaireIds = new Set(
      (missions || [])
        .map((mission: any) => mission.questionnaire_id)
        .filter(Boolean)
    );

    const q = (questionnaires || []).find(
      (questionnaire: any) => !linkedQuestionnaireIds.has(questionnaire.id)
    );

    if (q) {
      setLatestQuestionnaire({ id: q.id, title: q.title });
      const { data: resp } = await supabase
        .from("questionnaire_responses")
        .select("id")
        .eq("questionnaire_id", q.id)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setAlreadyAnswered(!!resp);
      return;
    }

    setLatestQuestionnaire(null);
    setAlreadyAnswered(false);
    setShowQuestionnaire(false);
  };

  const fetchMyTeam = async () => {
    if (!user) return;
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id, collaborative_teams(id, name, emoji, is_default)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership && (membership as any).collaborative_teams) {
      const t = (membership as any).collaborative_teams;
      setMyTeam({ id: t.id, name: t.name, emoji: t.emoji, is_default: t.is_default });
    } else {
      setMyTeam(null);
    }
  };

  const fetchAvailableTeams = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("collaborative_teams")
      .select("id, name, emoji, is_default")
      .eq("company_id", companyId)
      .order("name");
    setAvailableTeams((data || []) as TeamInfo[]);
  };

  const handleOpenTeamDialog = () => {
    setTeamDialogMode("list");
    fetchAvailableTeams();
    setShowTeamDialog(true);
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!user) return;
    // Leave current team first
    await supabase.from("team_members").delete().eq("user_id", user.id);
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: user.id });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Time atualizado! 🎉" });
      fetchMyTeam();
      setShowTeamDialog(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!user || !companyId || !newTeamName.trim()) return;
    const { data, error } = await supabase.from("collaborative_teams").insert({
      company_id: companyId,
      name: newTeamName.trim(),
      emoji: newTeamEmoji || "🏃",
      created_by: user.id,
    }).select("id").single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      await handleJoinTeam(data.id);
      setNewTeamName("");
      setNewTeamEmoji("🏃");
    }
  };

  const handleOpenConsultas = () => {
    if (onOpenConsultationOnline) onOpenConsultationOnline();
  };


  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<{ heart_rate: number | null; measured_at: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    // Fetch latest health score
    supabase
      .from("health_scores")
      .select("score_general")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setHealthScore(data.score_general);
      });
    // Fetch latest measurement
    supabase
      .from("health_measurements")
      .select("heart_rate, measured_at")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLastMeasurement(data);
      });
  }, [user]);

  const fullName = profileName || user?.user_metadata?.full_name || "Colaborador";
  const firstName = fullName.split(" ")[0];
  const displayScore = healthScore ?? 0;

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "ontem";
    return `há ${days} dias`;
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Muito bem! 💪";
    if (s >= 60) return "Bom 👍";
    if (s >= 40) return "Atenção ⚠️";
    return "Cuidado 🔴";
  };

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto pb-4">
      {/* Header */}
      <div className="px-5 py-4 pb-3 flex items-center justify-between border-b border-border relative overflow-hidden">
        <div
          className="absolute animate-morph"
          style={{
            top: -50, right: -50, width: 160, height: 160,
            background: "radial-gradient(circle at 40% 40%, hsl(var(--mayla-pref-lt)), hsl(var(--mayla-pref)))",
            borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
            opacity: 0.09, zIndex: 0
          }} />
        <div className="relative z-[1]"><BrandBadge height={38} /></div>
        <Avatar />
      </div>

      {/* Greeting */}
      <div className="px-5 pt-5 pb-4">
        <p className="font-display text-3xl font-medium text-foreground leading-[1.25]">
          Olá, <em className="italic text-accent">{firstName}</em> 👋
        </p>
        <p className="text-sm text-muted-foreground mt-1.5">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Municipality linking warning */}
      {isDefault &&
        <div className="mx-5 mb-5 rounded-[18px] px-5 py-4 flex items-center gap-4 border-2 border-dashed border-accent/40 bg-accent/5">
          <div className="shrink-0 flex items-center justify-center text-2xl" style={{ width: 50, height: 50, borderRadius: 14, background: "hsl(var(--accent) / .15)" }}>⚠️</div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground mb-0.5">Vincule-se à sua empresa</div>
            <div className="text-sm text-muted-foreground leading-snug">Preencha seu perfil ou conecte-se à sua equipe de apoio para ser vinculado automaticamente.</div>
          </div>
          <span className="text-sm text-accent font-semibold cursor-pointer whitespace-nowrap" onClick={onOpenEsfLink}>Vincular →</span>
        </div>
      }

      {/* Health Score Card */}
      <div className="mx-5 mb-5 bg-secondary rounded-[18px] overflow-hidden">
        <div className="p-4 flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
            <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--mayla-sand))" strokeWidth="5" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--mayla-green))" strokeWidth="5" strokeDasharray={`${2 * Math.PI * 22}`} strokeDashoffset={`${2 * Math.PI * 22 * (1 - displayScore / 100)}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-display text-base font-bold text-foreground">{displayScore}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground tracking-[.07em] uppercase mb-0.5">Saúde hoje</div>
            <div className="font-display text-lg text-foreground font-medium">{getScoreLabel(displayScore)}</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {lastMeasurement
                ? `${getTimeAgo(lastMeasurement.measured_at)}${lastMeasurement.heart_rate ? ` · ${lastMeasurement.heart_rate} bpm` : ""}`
                : "Nenhuma medição ainda"}
            </div>
          </div>
          <button onClick={() => setTab("bemestar")} className="border-none rounded-xl px-4 py-2.5 text-accent-foreground text-sm font-semibold cursor-pointer" style={{ background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))" }}>
            Medir →
          </button>
        </div>
        <div className="border-t border-foreground/10 px-5 py-3 flex items-center gap-2">
          <span className="text-base">⭐</span>
          <span className="text-sm font-semibold text-secondary-foreground">{profilePoints.toLocaleString()} pontos</span>
          
          <span className="ml-auto text-sm text-accent font-medium cursor-pointer" onClick={() => setTab("campanhas")}>Ver missões →</span>
        </div>
      </div>

      {/* Assistente Digital de Saúde Card */}
      {onOpenAssistant && (
        <div
          className="mx-5 mb-5 rounded-[18px] p-4 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
          onClick={onOpenAssistant}
        >
          <div className="absolute rounded-full" style={{ top: -20, right: -10, width: 80, height: 80, background: "rgba(255,255,255,.10)" }} />
          <div className="shrink-0 flex items-center justify-center text-2xl relative z-[1]" style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(255,255,255,.18)" }}>✨</div>
          <div className="flex-1 relative z-[1]">
            <div className="text-[15px] font-semibold text-primary-foreground mb-0.5">Assistente Mayla</div>
            <div className="text-sm leading-snug" style={{ color: "rgba(255,255,255,.75)" }}>Tire dúvidas sobre seus dados de saúde</div>
          </div>
          <span style={{ fontSize: 20, color: "rgba(255,255,255,.5)" }} className="relative z-[1]">›</span>
        </div>
      )}

      <div className="mx-5 mb-5 bg-secondary rounded-[18px] p-4 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform" onClick={handleOpenTeamDialog}>
        <div className="shrink-0 flex items-center justify-center text-2xl" style={{ width: 50, height: 50, borderRadius: 14, background: "hsl(var(--accent) / .12)" }}>
          {myTeam?.emoji || "👥"}
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-foreground mb-0.5">
            {myTeam ? myTeam.name : "Entrar em um time"}
          </div>
          <div className="text-sm text-muted-foreground leading-snug">
            {myTeam ? (myTeam.is_default ? "Time padrão da empresa" : "Time colaborativo") : "Crie ou entre em um time para competir"}
          </div>
        </div>
        <span className="text-xl text-muted-foreground">›</span>
      </div>

      {/* Questionnaire Card */}
      {latestQuestionnaire && !alreadyAnswered && !showQuestionnaire && (
        <div
          className="mx-5 mb-5 bg-secondary rounded-[18px] p-4 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform"
          onClick={() => setShowQuestionnaire(true)}
        >
          <div className="shrink-0 flex items-center justify-center text-2xl" style={{ width: 50, height: 50, borderRadius: 14, background: "hsl(var(--accent) / .12)" }}>
            📋
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground mb-0.5">
              Preencher pesquisa
            </div>
            <div className="text-sm text-muted-foreground leading-snug">
              {latestQuestionnaire.title}
            </div>
          </div>
          <span className="text-xl text-muted-foreground">›</span>
        </div>
      )}

      {/* Questionnaire Runner (inline full-screen) */}
      {showQuestionnaire && latestQuestionnaire && (
        <div className="fixed inset-0 z-50 bg-background">
          <QuestionnaireRunner
            questionnaireId={latestQuestionnaire.id}
            questionnaireTitle={latestQuestionnaire.title}
            onClose={() => setShowQuestionnaire(false)}
            onComplete={() => {
              setShowQuestionnaire(false);
              setAlreadyAnswered(true);
            }}
          />
        </div>
      )}


      {consultaEnabled && (
        <div className="mx-5 mb-5">
          <div
            className="rounded-[18px] p-5 cursor-pointer active:scale-[.97] transition-transform"
            style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
            onClick={handleOpenConsultas}
          >
            <span className="text-3xl block mb-2">🩺</span>
            <span className="text-[15px] font-semibold text-primary-foreground block">Realizar Consulta</span>
            <span className="text-sm block mt-0.5" style={{ color: "rgba(255,255,255,.65)" }}>Online ou presencial</span>
          </div>
        </div>
      )}


      {/* rPPG CTA */}
      <div
        className="mx-5 mb-5 rounded-[18px] px-5 py-4 flex items-center gap-4 relative overflow-hidden cursor-pointer"
        style={{ background: "linear-gradient(135deg, hsl(var(--mayla-ink)), #3D2820)" }}
        onClick={() => setTab("bemestar")}
      >
        <div className="absolute rounded-full" style={{ top: -20, right: -20, width: 90, height: 90, background: "rgba(255,255,255,.04)" }} />
        <div className="shrink-0 flex items-center justify-center text-2xl" style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))" }}>📷</div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-primary-foreground mb-0.5">Fazer medição de hoje</div>
          <div className="text-sm leading-snug" style={{ color: "rgba(255,255,255,.55)" }}>30 segundos · câmera rPPG · ganhe +50 pts</div>
        </div>
        <span style={{ fontSize: 20, color: "rgba(255,255,255,.4)" }}>›</span>
      </div>



      {/* Health Magazine Carousel */}
      {onOpenArticle && <HealthMagazineCarousel onOpenArticle={onOpenArticle} />}

      {/* Alerts */}
      {alerts.length > 0 &&
        <div className="px-5">
          <p className="text-xs font-medium text-muted-foreground tracking-[.1em] uppercase mb-3.5">Informações importantes</p>
          <div className="flex flex-col gap-2.5">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-secondary rounded-2xl p-4 flex items-start gap-3 cursor-pointer active:opacity-80 transition-opacity" style={{ borderLeft: `3px solid hsl(${alert.color})` }} onClick={() => setSelectedAlert(alert)}>
                <span className="text-xl shrink-0 mt-0.5">{alert.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[15px] font-semibold text-foreground">{alert.title}</span>
                    <span className="text-[10px] font-semibold rounded-md px-2 py-px tracking-[.06em] uppercase" style={{ color: `hsl(${alert.color})`, background: `hsl(${alert.color} / .1)` }}>
                      {alert.scope === "company" ? "Empresa" : alert.scope === "municipal" ? "Município" : "Você"}
                    </span>
                  </div>
                  {alert.body && <div className="text-sm text-muted-foreground leading-snug">{alert.body}</div>}
                </div>
                <span className="text-xl text-muted-foreground mt-0.5">›</span>
              </div>
            ))}
          </div>
        </div>
      }

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedAlert?.emoji}</span>
              <span>{selectedAlert?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedAlert?.body && <p className="text-base text-muted-foreground">{selectedAlert.body}</p>}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold rounded-md px-2 py-0.5 tracking-[.06em] uppercase" style={{ color: selectedAlert ? `hsl(${selectedAlert.color})` : undefined, background: selectedAlert ? `hsl(${selectedAlert.color} / .1)` : undefined }}>
              {selectedAlert?.scope === "company" ? "Empresa" : selectedAlert?.scope === "municipal" ? "Município" : "Você"}
            </span>
          </div>
          {selectedAlert?.external_url && <a href={selectedAlert.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-base font-medium text-accent hover:underline">Abrir link externo →</a>}
        </DialogContent>
      </Dialog>

      {/* Team Dialog */}
      <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">👥</span>
              <span>Times Colaborativos</span>
            </DialogTitle>
          </DialogHeader>

          {teamDialogMode === "list" ? (
            <div className="space-y-3">
              {myTeam && (
                <div className="bg-accent/10 rounded-2xl p-4 border border-accent/20">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Seu time atual</div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{myTeam.emoji}</span>
                    <span className="text-base font-semibold text-foreground">{myTeam.name}</span>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground uppercase tracking-wider">Times disponíveis</div>
              {availableTeams.map((team) => (
                <div key={team.id} className="bg-secondary rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => handleJoinTeam(team.id)}>
                  <span className="text-xl">{team.emoji}</span>
                  <span className="text-sm font-medium text-foreground flex-1">{team.name}</span>
                  {myTeam?.id === team.id && <span className="text-xs text-accent font-semibold">Atual</span>}
                  {myTeam?.id !== team.id && <span className="text-xs text-primary font-medium">Entrar</span>}
                </div>
              ))}

              <Button variant="outline" className="w-full" onClick={() => setTeamDialogMode("create")}>
                ✨ Criar novo time
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do time</label>
                <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Ex: Runners, Wellness Squad..." />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Emoji</label>
                <div className="flex gap-2 flex-wrap">
                  {["🏃", "💪", "🧘", "🚴", "⚡", "🌟", "🎯", "🔥"].map((e) => (
                    <button key={e} onClick={() => setNewTeamEmoji(e)} className={`text-2xl p-2 rounded-xl cursor-pointer transition-colors ${newTeamEmoji === e ? "bg-accent/20 ring-2 ring-accent" : "bg-secondary"}`}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setTeamDialogMode("list")}>Voltar</Button>
                <Button className="flex-1" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Criar time</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
