import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Step = {
  emoji: string;
  title: string;
  body: string;
  ctaLabel: string;
  action: () => void;
  /** points_ledger.source values that mark this step as done */
  completionSources: string[];
};

interface Props {
  onOpenProfile: () => void;
  onOpenSelfAssessment: () => void;
  onOpenRppg: () => void;
  onOpenCampaigns: () => void;
  onOpenLeaderboard: () => void;
}

export const POINTS_TOUR_EVENT = "open-points-tour";
export const POINTS_TOUR_COMPLETED_EVENT = "points-tour-completed";
const IDLE_REOPEN_MS = 5 * 60 * 1000;

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
  const stepRef = useRef(0);
  const completedRef = useRef(false);

  const steps: Step[] = [
    {
      emoji: "📋",
      title: "Complete seus dados pessoais",
      body: "Vamos começar com seus dados. Quanto mais completo, melhor a experiência.",
      ctaLabel: "Abrir meu perfil",
      action: onOpenProfile,
      completionSources: ["profile_complete"],
    },
    {
      emoji: "🩺",
      title: "Faça sua autoavaliação",
      body: "Responda algumas perguntas sobre sua saúde e ganhe pontos de bônus.",
      ctaLabel: "Fazer agora",
      action: onOpenSelfAssessment,
      completionSources: ["self_assessment"],
    },
    {
      emoji: "📷",
      title: "Faça uma medição rPPG",
      body: "Em segundos pela câmera você mede seus sinais vitais e ganha pontos.",
      ctaLabel: "Medir agora",
      action: onOpenRppg,
      completionSources: ["rppg_measurement", "vitals_measurement"],
    },
    {
      emoji: "🎯",
      title: "Participe de atividades e desafios",
      body: "Acompanhe campanhas, complete missões e desafios para ganhar pontos extras.",
      ctaLabel: "Ver campanhas",
      action: onOpenCampaigns,
      completionSources: ["mission_complete", "daily_challenge", "weekly_checkin"],
    },
    {
      emoji: "🏆",
      title: "Acompanhe sua pontuação no ranking",
      body: "Veja sua posição entre os colegas e suba de nível.",
      ctaLabel: "Ver ranking",
      action: onOpenLeaderboard,
      completionSources: ["tour_step_ranking"], // user clicking CTA marks it done
    },
  ];

  // Sync helper: load DB state and decide if popup should open
  const loadAndMaybeOpen = async (force = false) => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("points_tour_completed,points_tour_current_step")
      .eq("user_id", user.id)
      .maybeSingle();
    const p: any = data || {};
    const completed = !!p.points_tour_completed;
    const currentStep = Math.min(Number(p.points_tour_current_step || 0), steps.length - 1);
    completedRef.current = completed;
    stepRef.current = currentStep;
    setStep(currentStep);
    if (completed) {
      setShow(false);
      return;
    }
    if (force || !completed) {
      setTimeout(() => setShow(true), force ? 0 : 600);
    }
  };

  // Initial open + listen for manual triggers
  useEffect(() => {
    if (!user) return;
    loadAndMaybeOpen(false);
    const handler = () => loadAndMaybeOpen(true);
    const completedHandler = () => {
      completedRef.current = true;
      setShow(false);
    };
    window.addEventListener(POINTS_TOUR_EVENT, handler);
    window.addEventListener(POINTS_TOUR_COMPLETED_EVENT, completedHandler);
    return () => {
      window.removeEventListener(POINTS_TOUR_EVENT, handler);
      window.removeEventListener(POINTS_TOUR_COMPLETED_EVENT, completedHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Idle re-open every 5 minutes if still incomplete
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (!completedRef.current && !show) {
        loadAndMaybeOpen(true);
      }
    }, IDLE_REOPEN_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, show]);

  // Realtime: listen for new points and advance tour when a step source matches
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`points-tour-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "points_ledger", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const row: any = payload.new || {};
          const source: string = row.source || "";
          const points: number = Number(row.points || 0);

          // Always celebrate
          if (points > 0) {
            toast.success(`🎉 +${points} pontos!`, {
              description: row.description || "Continue assim, você está mandando bem!",
              duration: 4500,
              position: "top-center",
            });
          }

          if (completedRef.current) return;

          // Does this point award match the current tour step?
          const current = steps[stepRef.current];
          if (current && current.completionSources.includes(source)) {
            await advanceStep(`+${points} pts · ${current.title}`);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  };

  const advanceStep = async (justEarned: string) => {
    const next = stepRef.current + 1;
    if (next >= steps.length) {
      completedRef.current = true;
      stepRef.current = steps.length;
      await persistProgress(steps.length, { completed: true });
      toast.success("🏆 Você concluiu o tour de pontuação!", {
        description: "Continue explorando o app para ganhar ainda mais pontos.",
        duration: 5000,
        position: "top-center",
      });
      setShow(false);
      return;
    }
    stepRef.current = next;
    setStep(next);
    await persistProgress(next, {});
    toast(`✅ Etapa concluída · vamos para a próxima!`, {
      description: justEarned,
      duration: 4000,
      position: "top-center",
    });
    // Reopen popup at next step
    setTimeout(() => setShow(true), 1200);
  };

  const dismiss = async () => {
    await persistProgress(stepRef.current, { dismissed: true });
    setShow(false);
  };

  const goToCurrentTask = () => {
    const s = steps[stepRef.current];
    setShow(false);
    s?.action();
  };

  const skipCurrentStep = async () => {
    // Manually advance without earning points (rare escape hatch)
    const next = stepRef.current + 1;
    if (next >= steps.length) {
      completedRef.current = true;
      await persistProgress(steps.length, { completed: true });
      setShow(false);
      return;
    }
    stepRef.current = next;
    setStep(next);
    await persistProgress(next, {});
  };

  if (!show) return null;
  const s = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

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
            onClick={() => {
              if (isLast) {
                // Last step: clicking opens leaderboard AND completes tour
                setShow(false);
                s.action();
                completedRef.current = true;
                persistProgress(steps.length, { completed: true });
              } else {
                goToCurrentTask();
              }
            }}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold cursor-pointer"
          >
            {s.ctaLabel}
          </button>
          <button
            onClick={skipCurrentStep}
            className="w-full h-9 rounded-xl bg-transparent text-[11px] text-muted-foreground cursor-pointer"
          >
            Pular esta etapa
          </button>
        </div>
      </div>
    </div>
  );
}
