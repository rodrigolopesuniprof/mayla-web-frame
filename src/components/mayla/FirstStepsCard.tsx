import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { POINTS_TOUR_EVENT } from "./PointsOnboardingTour";
import { FIRST_STEPS_REFRESH_EVENT, hasFirstStep } from "@/lib/first-steps";

const STEPS = [
  { emoji: "📋", title: "Complete seus dados pessoais" },
  { emoji: "🩺", title: "Faça sua autoavaliação" },
  { emoji: "📷", title: "Faça uma medição rPPG" },
  { emoji: "👀", title: "Veja as campanhas disponíveis" },
  { emoji: "🏆", title: "Veja sua posição no ranking" },
];

export function FirstStepsCard() {
  const { user } = useAuth();
  const [done, setDone] = useState<boolean[]>(STEPS.map(() => false));
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
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
    const profileComplete = !!((profile as any)?.birth_date && (profile as any)?.biological_sex);
    const assessmentDone = (assess?.length ?? 0) > 0 || sources.has("self_assessment");
    const rppgDone = (rppg?.length ?? 0) > 0 || sources.has("rppg_measurement") || sources.has("vitals_measurement");
    const campaignsViewed =
      hasFirstStep(user.id, "campaigns-viewed") ||
      sources.has("mission_complete") || sources.has("daily_challenge") || sources.has("weekly_checkin");
    const rankingViewed = hasFirstStep(user.id, "ranking-viewed") || sources.has("tour_step_ranking");

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

  if (!loaded || !user) return null;
  const completedCount = done.filter(Boolean).length;
  if (completedCount === STEPS.length) return null;

  const reopenTour = async () => {
    await supabase
      .from("profiles")
      .update({ points_tour_completed: false, points_tour_dismissed_at: null })
      .eq("user_id", user.id);
    window.dispatchEvent(new Event(POINTS_TOUR_EVENT));
  };

  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="mx-5 mb-5 rounded-[18px] p-4 bg-card border border-border">
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
          </li>
        ))}
      </ul>
    </div>
  );
}
