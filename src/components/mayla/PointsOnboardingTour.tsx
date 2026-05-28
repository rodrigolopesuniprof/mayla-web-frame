import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Step = {
  emoji: string;
  title: string;
  body: string;
  ctaLabel: string;
  action: () => void;
};

interface Props {
  onOpenProfile: () => void;
  onOpenSelfAssessment: () => void;
  onOpenRppg: () => void;
  onOpenCampaigns: () => void;
  onOpenLeaderboard: () => void;
}

/**
 * Trigger the tour from anywhere via:
 *   window.dispatchEvent(new CustomEvent("open-points-tour"))
 */
export const POINTS_TOUR_EVENT = "open-points-tour";
export const POINTS_TOUR_PROGRESS_EVENT = "points-tour-progress";

export function PointsOnboardingTour({
  onOpenProfile,
  onOpenSelfAssessment,
  onOpenRppg,
  onOpenCampaigns,
  onOpenLeaderboard,
}: Props) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  // Initial load: decide whether to auto-open
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("points_tour_completed,points_tour_dismissed_at,points_tour_current_step")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const p: any = data;
      const completed = !!p.points_tour_completed;
      const dismissedAt: string | null = p.points_tour_dismissed_at;
      const currentStep: number = Number(p.points_tour_current_step || 0);

      // Always broadcast progress so the home card knows what to show
      window.dispatchEvent(new CustomEvent(POINTS_TOUR_PROGRESS_EVENT, {
        detail: { completed, currentStep, total: 5 },
      }));

      if (completed) return;

      let shouldOpen = false;
      if (!dismissedAt) {
        // never opened or never dismissed → open
        shouldOpen = true;
      } else {
        // re-open once per day until completed
        const dismissed = new Date(dismissedAt);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (dismissed < todayStart) shouldOpen = true;
      }
      if (shouldOpen) {
        setStep(Math.min(currentStep, 4));
        setTimeout(() => setShow(true), 600);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Listen for manual open requests
  useEffect(() => {
    if (!user) return;
    const handler = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("points_tour_current_step,points_tour_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      const p: any = data || {};
      const startStep = p.points_tour_completed ? 0 : Math.min(Number(p.points_tour_current_step || 0), 4);
      setStep(startStep);
      setShow(true);
    };
    window.addEventListener(POINTS_TOUR_EVENT, handler);
    return () => window.removeEventListener(POINTS_TOUR_EVENT, handler);
  }, [user]);

  const persistProgress = async (nextStep: number, opts: { completed?: boolean; dismissed?: boolean }) => {
    if (!user) return;
    const payload: any = { points_tour_current_step: nextStep };
    if (opts.completed) {
      payload.points_tour_completed = true;
      payload.points_tour_dismissed_at = null;
    } else if (opts.dismissed) {
      payload.points_tour_dismissed_at = new Date().toISOString();
    }
    await supabase.from("profiles").update(payload).eq("user_id", user.id);
    window.dispatchEvent(new CustomEvent(POINTS_TOUR_PROGRESS_EVENT, {
      detail: { completed: !!opts.completed, currentStep: nextStep, total: 5 },
    }));
  };

  const dismiss = async () => {
    await persistProgress(step, { dismissed: true });
    setShow(false);
  };

  const complete = async () => {
    await persistProgress(5, { completed: true });
    setShow(false);
  };

  const runAction = async (action: () => void, idx: number) => {
    // Save progress (next step) so reopening continues forward, but don't mark complete
    const nextStep = idx + 1;
    if (nextStep >= 5) {
      await persistProgress(5, { completed: true });
    } else {
      await persistProgress(nextStep, { dismissed: true });
    }
    setShow(false);
    action();
  };

  const steps: Step[] = [
    {
      emoji: "📋",
      title: "Complete seus dados pessoais",
      body: "Vamos começar com seus dados. Quanto mais completo, melhor a experiência.",
      ctaLabel: "Abrir meu perfil",
      action: onOpenProfile,
    },
    {
      emoji: "🩺",
      title: "Faça sua autoavaliação",
      body: "Responda algumas perguntas sobre sua saúde e ganhe +200 pts de bônus.",
      ctaLabel: "Fazer agora",
      action: onOpenSelfAssessment,
    },
    {
      emoji: "📷",
      title: "Faça uma medição rPPG",
      body: "Em segundos pela câmera você mede seus sinais vitais e ganha +50 pts.",
      ctaLabel: "Medir agora",
      action: onOpenRppg,
    },
    {
      emoji: "🎯",
      title: "Participe de atividades e desafios",
      body: "Acompanhe campanhas, complete missões e desafios para ganhar pontos extras.",
      ctaLabel: "Ver campanhas",
      action: onOpenCampaigns,
    },
    {
      emoji: "🏆",
      title: "Acompanhe sua pontuação no ranking",
      body: "Veja sua posição entre os colegas e suba de nível.",
      ctaLabel: "Ver ranking",
      action: onOpenLeaderboard,
    },
  ];

  if (!show) return null;
  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl animate-fade-up">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-4 bg-border"}`}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="text-[11px] text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground"
          >
            Fechar
          </button>
        </div>

        <div className="text-center py-4">
          <div className="text-5xl mb-3">{s.emoji}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Passo {step + 1} de {steps.length}
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground mb-2">{s.title}</h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{s.body}</p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={() => runAction(s.action, step)}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold cursor-pointer"
          >
            {s.ctaLabel}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 h-10 rounded-xl bg-transparent border border-border text-[12px] text-foreground cursor-pointer"
              >
                ← Anterior
              </button>
            )}
            {!isLast ? (
              <button
                onClick={async () => { await persistProgress(step + 1, {}); setStep(step + 1); }}
                className="flex-1 h-10 rounded-xl bg-transparent border border-border text-[12px] text-foreground cursor-pointer"
              >
                Próximo →
              </button>
            ) : (
              <button
                onClick={complete}
                className="flex-1 h-10 rounded-xl bg-accent/15 text-accent text-[12px] font-semibold cursor-pointer"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
