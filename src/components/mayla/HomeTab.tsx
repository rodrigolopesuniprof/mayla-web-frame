import { useState, useEffect } from "react";
import type { TabId } from "@/lib/mayla-config";
import { BrandBadge, Avatar } from "./MaylaIcons";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { QuestionnaireRunner } from "./QuestionnaireRunner";
import { HealthMagazineCarousel } from "./HealthMagazineCarousel";
import { GamificationStatusCard } from "./GamificationStatusCard";
import { MedicationReminderCard } from "./MedicationReminderCard";
import { POINTS_TOUR_EVENT, POINTS_TOUR_PROGRESS_EVENT } from "./PointsOnboardingTour";

export function HomeTab({ setTab, onOpenTelemedicine, onOpenAppointment, onOpenEsfLink, onOpenVideoCall, onOpenOnDemand, onOpenConsultationOnline, onOpenAssistant, onOpenArticle, onOpenAllArticles, onOpenLeaderboard }: {
  setTab: (id: TabId) => void;
  onOpenTelemedicine: () => void;
  onOpenAppointment: () => void;
  onOpenEsfLink: () => void;
  onOpenVideoCall: (consultation: { id: string; professionalName: string; professionalType: string; specialty: string }) => void;
  onOpenOnDemand: () => void;
  onOpenConsultationOnline?: () => void;
  onOpenAssistant?: () => void;
  onOpenArticle?: (id: string) => void;
  onOpenAllArticles?: () => void;
  onOpenLeaderboard?: () => void;
}) {
  const { isDefault } = useCompany();
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profilePoints, setProfilePoints] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarType, setAvatarType] = useState<string | null>(null);

  // Questionnaire state
  const [latestQuestionnaire, setLatestQuestionnaire] = useState<{ id: string; title: string } | null>(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, points, avatar_url, avatar_type").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setProfileName(data.full_name);
        setProfilePoints(data.points);
        setAvatarUrl((data as any).avatar_url || null);
        setAvatarType((data as any).avatar_type || null);
      }
    });
    fetchLatestQuestionnaire();
  }, [user]);

  const fetchLatestQuestionnaire = async () => {
    if (!user) return;

    const [{ data: questionnaires }, { data: missions }] = await Promise.all([
      supabase.from("questionnaires").select("id, title").order("created_at", { ascending: false }),
      supabase.from("missions").select("questionnaire_id").not("questionnaire_id", "is", null),
    ]);

    const linkedIds = new Set((missions || []).map((m: any) => m.questionnaire_id).filter(Boolean));
    const q = (questionnaires || []).find((x: any) => !linkedIds.has(x.id));

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

  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<{ heart_rate: number | null; measured_at: string } | null>(null);

  // Tour progress for the always-visible "Como ganhar pontos" chip / continue card
  const [tourProgress, setTourProgress] = useState<{ completed: boolean; currentStep: number; total: number }>({
    completed: false, currentStep: 0, total: 5,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("points_tour_completed,points_tour_current_step")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTourProgress({
            completed: !!(data as any).points_tour_completed,
            currentStep: Number((data as any).points_tour_current_step || 0),
            total: 5,
          });
        }
      });
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { completed: boolean; currentStep: number; total: number };
      if (detail) setTourProgress(detail);
    };
    window.addEventListener(POINTS_TOUR_PROGRESS_EVENT, handler);
    return () => window.removeEventListener(POINTS_TOUR_PROGRESS_EVENT, handler);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("health_scores").select("score_general").eq("user_id", user.id).order("generated_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) setHealthScore(data.score_general);
    });
    supabase.from("health_measurements").select("heart_rate, measured_at").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) setLastMeasurement(data);
    });
  }, [user]);

  const openTour = () => window.dispatchEvent(new CustomEvent(POINTS_TOUR_EVENT));

  const stepLabels = ["Dados pessoais", "Autoavaliação", "Medição rPPG", "Atividades e desafios", "Ranking"];




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
        <div className="relative z-[1] flex items-center gap-2">
          <button
            onClick={openTour}
            aria-label="Como ganhar pontos"
            className="h-9 px-3 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-semibold cursor-pointer hover:bg-accent/25 transition-colors flex items-center gap-1.5"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">{tourProgress.completed ? "Como ganhar pontos" : "Ganhe pontos"}</span>
          </button>
          <Avatar initials={firstName.slice(0, 2).toUpperCase()} avatarUrl={avatarUrl} avatarType={avatarType} />
        </div>
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

      {/* Continue points tour */}
      {!tourProgress.completed && (
        <button
          onClick={openTour}
          className="mx-5 mb-5 rounded-[18px] px-4 py-3 flex items-center gap-3 border border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10 cursor-pointer hover:from-accent/15 hover:to-primary/15 transition-colors w-[calc(100%-2.5rem)] text-left"
        >
          <div className="shrink-0 flex items-center justify-center text-xl" style={{ width: 42, height: 42, borderRadius: 12, background: "hsl(var(--accent) / .18)" }}>🎯</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-foreground">
              {tourProgress.currentStep === 0 ? "Conheça como ganhar pontos" : "Continue conhecendo o app"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Passo {Math.min(tourProgress.currentStep + 1, tourProgress.total)} de {tourProgress.total} · {stepLabels[Math.min(tourProgress.currentStep, stepLabels.length - 1)]}
            </div>
          </div>
          <span className="text-accent text-[12px] font-semibold whitespace-nowrap">{tourProgress.currentStep === 0 ? "Começar →" : "Retomar →"}</span>
        </button>
      )}



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
      </div>

      <MedicationReminderCard />

      <GamificationStatusCard
        onOpenLeaderboard={onOpenLeaderboard}
        onOpenChallenges={() => setTab("campanhas")}
      />

      {/* Assistente Digital de Saúde Card */}
      {onOpenAssistant && (
        <div
          className="mx-5 mb-5 rounded-[18px] p-4 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
          onClick={onOpenAssistant}
        >
          <div className="absolute rounded-full" style={{ top: -20, right: -10, width: 80, height: 80, background: "rgba(255,255,255,.10)" }} />
          <div className="shrink-0 flex items-center justify-center text-2xl relative z-[1]" style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(255,255,255,.18)" }}>👩‍⚕️</div>
          <div className="flex-1 relative z-[1]">
            <div className="text-[15px] font-semibold text-primary-foreground mb-0.5">Mayla, sua assistente de saúde e bem-estar</div>
            <div className="text-sm leading-snug" style={{ color: "rgba(255,255,255,.75)" }}>Tire dúvidas sobre seus dados de saúde</div>
          </div>
          <span style={{ fontSize: 20, color: "rgba(255,255,255,.5)" }} className="relative z-[1]">›</span>
        </div>
      )}



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
            <div className="text-[15px] font-semibold text-foreground mb-0.5">Preencher pesquisa</div>
            <div className="text-sm text-muted-foreground leading-snug">{latestQuestionnaire.title}</div>
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

      {/* Saúde com Você — destaque visual da Home */}
      {onOpenArticle && <HealthMagazineCarousel onOpenArticle={onOpenArticle} onOpenAll={onOpenAllArticles} />}
    </div>
  );
}
