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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("points_tour_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data && (data as any).points_tour_completed === false) {
        // small delay to let other gates render first
        setTimeout(() => setShow(true), 600);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const finish = async () => {
    if (user) {
      await supabase.from("profiles").update({ points_tour_completed: true } as any).eq("user_id", user.id);
    }
    setShow(false);
  };

  const steps: Step[] = [
    {
      emoji: "📋",
      title: "Complete seus dados pessoais",
      body: "Vamos começar com seus dados. Quanto mais completo, melhor a experiência.",
      ctaLabel: "Abrir meu perfil",
      action: () => { onOpenProfile(); finish(); },
    },
    {
      emoji: "🩺",
      title: "Faça sua autoavaliação",
      body: "Responda algumas perguntas sobre sua saúde e ganhe +200 pts de bônus.",
      ctaLabel: "Fazer agora",
      action: () => { onOpenSelfAssessment(); finish(); },
    },
    {
      emoji: "📷",
      title: "Faça uma medição rPPG",
      body: "Em segundos pela câmera você mede seus sinais vitais e ganha +50 pts.",
      ctaLabel: "Medir agora",
      action: () => { onOpenRppg(); finish(); },
    },
    {
      emoji: "🎯",
      title: "Participe de atividades e desafios",
      body: "Acompanhe campanhas, complete missões e desafios para ganhar pontos extras.",
      ctaLabel: "Ver campanhas",
      action: () => { onOpenCampaigns(); finish(); },
    },
    {
      emoji: "🏆",
      title: "Acompanhe sua pontuação no ranking",
      body: "Veja sua posição entre os colegas e suba de nível.",
      ctaLabel: "Ver ranking",
      action: () => { onOpenLeaderboard(); finish(); },
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
            onClick={finish}
            className="text-[11px] text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground"
          >
            Pular tour
          </button>
        </div>

        <div className="text-center py-4">
          <div className="text-5xl mb-3">{s.emoji}</div>
          <h2 className="font-display text-lg font-semibold text-foreground mb-2">{s.title}</h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{s.body}</p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={s.action}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold cursor-pointer"
          >
            {s.ctaLabel}
          </button>
          {!isLast ? (
            <button
              onClick={() => setStep(step + 1)}
              className="w-full h-10 rounded-xl bg-transparent border border-border text-[12px] text-foreground cursor-pointer"
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={finish}
              className="w-full h-10 rounded-xl bg-transparent text-[12px] text-muted-foreground cursor-pointer"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
