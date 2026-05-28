import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { POINTS_TOUR_EVENT, POINTS_TOUR_COMPLETED_EVENT } from "./PointsOnboardingTour";
import {
  FIRST_STEPS_REFRESH_EVENT,
  hasFirstStep,
  markFirstStep,
  type FirstStepKey,
} from "@/lib/first-steps";

type Step = { emoji: string; title: string; manualKey: FirstStepKey };

const STEPS: Step[] = [
  { emoji: "📋", title: "Complete seus dados pessoais", manualKey: "manual:profile" },
  { emoji: "🩺", title: "Faça sua autoavaliação", manualKey: "manual:assessment" },
  { emoji: "📷", title: "Faça uma medição rPPG", manualKey: "manual:rppg" },
  { emoji: "👀", title: "Veja as campanhas disponíveis", manualKey: "manual:campaigns" },
  { emoji: "🏆", title: "Veja sua posição no ranking", manualKey: "manual:ranking" },
];

export function FirstStepsCard() {
  const { user } = useAuth();
  const [done, setDone] = useState<boolean[]>(STEPS.map(() => false));
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const celebratedRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    if (hasFirstStep(user.id, "dismissed")) {
      setDismissed(true);
      setLoaded(true);
      return;
    }
    const [
      { data: profile },
      { data: assess },
      { data: rppg },
      { data: ledger },
    ] = await Promise.all([
      supabase.from("profiles").select("birth_date, biological_sex").eq("user_id", user.id).maybeSingle(),
      supabase.from("self_assessment_responses" as any).select("id").eq("user_id", user.id).limit(1),
      supabase.from("health_measurements").select("id").eq("user_id", user.id).limit(1),
      supabase.from("points_ledger").select("source").eq("user_id", user.id),
    ]);

    const sources = new Set((ledger || []).map((r: any) => r.source));
    const profileComplete =
      !!((profile as any)?.birth_date && (profile as any)?.biological_sex) ||
      hasFirstStep(user.id, "manual:profile");
    const assessmentDone =
      (assess?.length ?? 0) > 0 ||
      sources.has("self_assessment") ||
      hasFirstStep(user.id, "manual:assessment");
    const rppgDone =
      (rppg?.length ?? 0) > 0 ||
      sources.has("rppg_measurement") ||
      sources.has("vitals_measurement") ||
      hasFirstStep(user.id, "manual:rppg");
    const campaignsViewed =
      hasFirstStep(user.id, "campaigns-viewed") ||
      hasFirstStep(user.id, "manual:campaigns") ||
      sources.has("mission_complete") || sources.has("daily_challenge") || sources.has("weekly_checkin");
    const rankingViewed =
      hasFirstStep(user.id, "ranking-viewed") ||
      hasFirstStep(user.id, "manual:ranking") ||
      sources.has("tour_step_ranking");

    setDone([profileComplete, assessmentDone, rppgDone, campaignsViewed, rankingViewed]);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`first-steps-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "points_ledger", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    const onRefresh = () => load();
    window.addEventListener(FIRST_STEPS_REFRESH_EVENT, onRefresh);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(FIRST_STEPS_REFRESH_EVENT, onRefresh);
    };
  }, [user, load]);

  const completedCount = done.filter(Boolean).length;
  const allDone = loaded && completedCount === STEPS.length;

  // Celebrate + dismiss when all done
  useEffect(() => {
    if (!allDone || dismissed || celebratedRef.current || !user) return;
    celebratedRef.current = true;
    setCelebrate(true);
    toast.success("🎉 Parabéns! Você completou os primeiros passos.", {
      description: "Bons ganhos pela frente. Continue cuidando da sua saúde!",
      duration: 5000,
    });
    // Silence the recurring PointsOnboardingTour popup permanently
    supabase
      .from("profiles")
      .update({ points_tour_completed: true, points_tour_dismissed_at: null })
      .eq("user_id", user.id)
      .then(() => {});
    const t = setTimeout(() => {
      markFirstStep(user.id, "dismissed");
      setDismissed(true);
      setCelebrate(false);
    }, 1800);
    return () => clearTimeout(t);
  }, [allDone, dismissed, user]);


  if (!loaded || !user || dismissed) return null;

  const reopenTour = async () => {
    await supabase
      .from("profiles")
      .update({ points_tour_completed: false, points_tour_dismissed_at: null })
      .eq("user_id", user.id);
    window.dispatchEvent(new Event(POINTS_TOUR_EVENT));
  };

  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="mx-5 mb-5 rounded-[18px] p-4 bg-card border border-border relative overflow-hidden">
      {celebrate && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/90 backdrop-blur-sm animate-fade-up">
          <div className="text-center">
            <div className="text-5xl mb-2">🎉✨🎊</div>
            <div className="font-display text-lg font-semibold text-foreground">Parabéns!</div>
            <div className="text-sm text-muted-foreground">Primeiros passos concluídos</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Primeiros passos</div>
          <div className="font-display text-base font-semibold text-foreground">
            {completedCount}/{STEPS.length} concluídos · ganhe pontos de bônus
          </div>
        </div>
        <button
          onClick={reopenTour}
          className="text-xs font-semibold text-primary bg-transparent border-none cursor-pointer hover:underline"
        >
          Continuar →
        </button>
      </div>

      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-3">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 text-sm ${done[i] ? "text-muted-foreground line-through" : "text-foreground"}`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                done[i] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {done[i] ? "✓" : i + 1}
            </span>
            <span className="text-base">{s.emoji}</span>
            <span className="flex-1">{s.title}</span>
            {!done[i] && (
              <button
                onClick={() => markFirstStep(user.id, s.manualKey)}
                className="text-[11px] font-semibold text-primary border border-primary/30 rounded-full px-2.5 py-1 hover:bg-primary/10 transition-colors whitespace-nowrap"
              >
                Já fiz ✓
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
