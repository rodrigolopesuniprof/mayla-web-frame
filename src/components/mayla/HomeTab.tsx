import { useState, useEffect } from "react";
import type { TabId } from "@/lib/mayla-config";
import { BrandBadge, Avatar } from "./MaylaIcons";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { QuestionnaireRunner } from "./QuestionnaireRunner";
import { HealthMagazineCarousel } from "./HealthMagazineCarousel";

export function HomeTab({ setTab, onOpenTelemedicine, onOpenAppointment, onOpenEsfLink, onOpenVideoCall, onOpenOnDemand, onOpenConsultationOnline, onOpenAssistant, onOpenArticle, onOpenAllArticles }: {
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
}) {
  const { isDefault } = useCompany();
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profilePoints, setProfilePoints] = useState(0);

  // Questionnaire state
  const [latestQuestionnaire, setLatestQuestionnaire] = useState<{ id: string; title: string } | null>(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, points").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setProfileName(data.full_name);
        setProfilePoints(data.points);
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

  useEffect(() => {
    if (!user) return;
    supabase.from("health_scores").select("score_general").eq("user_id", user.id).order("generated_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) setHealthScore(data.score_general);
    });
    supabase.from("health_measurements").select("heart_rate, measured_at").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) setLastMeasurement(data);
    });
  }, [user]);

  // News card (latest notification)
  const [latestNews, setLatestNews] = useState<NewsItem | null>(null);
  const [showNewsDialog, setShowNewsDialog] = useState(false);
  useEffect(() => {
    supabase.from("notifications")
      .select("id, title, body, emoji, color, external_url, created_at")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLatestNews(data as NewsItem);
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
          <div className="shrink-0 flex items-center justify-center text-2xl relative z-[1]" style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(255,255,255,.18)" }}>👩‍⚕️</div>
          <div className="flex-1 relative z-[1]">
            <div className="text-[15px] font-semibold text-primary-foreground mb-0.5">Mayla, sua enfermeira digital</div>
            <div className="text-sm leading-snug" style={{ color: "rgba(255,255,255,.75)" }}>Tire dúvidas sobre seus dados de saúde</div>
          </div>
          <span style={{ fontSize: 20, color: "rgba(255,255,255,.5)" }} className="relative z-[1]">›</span>
        </div>
      )}

      {/* Avisos & Novidades Card */}
      {latestNews && (
        <div
          className="mx-5 mb-5 bg-secondary rounded-[18px] p-4 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform"
          onClick={() => setShowNewsDialog(true)}
        >
          <div
            className="shrink-0 flex items-center justify-center text-2xl relative"
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: latestNews.color ? `hsl(${latestNews.color} / .15)` : "hsl(var(--accent) / .12)",
            }}
          >
            {latestNews.emoji || "📢"}
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
              style={{ background: "hsl(var(--destructive))", animation: "pulse 1.6s ease-in-out infinite" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-accent mb-0.5">Avisos & Novidades</div>
            <div className="text-[15px] font-semibold text-foreground truncate">{latestNews.title}</div>
            {latestNews.body && (
              <div className="text-xs text-muted-foreground leading-snug line-clamp-1">{latestNews.body}</div>
            )}
          </div>
          <span className="text-xl text-muted-foreground">›</span>
        </div>
      )}

      <Dialog open={showNewsDialog} onOpenChange={setShowNewsDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{latestNews?.emoji || "📢"}</span>
              <span>{latestNews?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {latestNews?.body && <p className="text-base text-muted-foreground">{latestNews.body}</p>}
          {latestNews?.external_url && (
            <button
              onClick={() => window.open(latestNews.external_url!, "_blank", "noopener")}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-accent-foreground"
              style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
            >
              Abrir →
            </button>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Health Magazine Carousel — destaque visual da Home */}
      {onOpenArticle && <HealthMagazineCarousel onOpenArticle={onOpenArticle} />}
    </div>
  );
}
