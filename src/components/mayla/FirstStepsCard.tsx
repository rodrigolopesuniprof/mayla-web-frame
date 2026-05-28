import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { POINTS_TOUR_EVENT } from "./PointsOnboardingTour";

const STEPS: { emoji: string; title: string; sources: string[] }[] = [
  { emoji: "📋", title: "Complete seus dados pessoais", sources: ["profile_complete"] },
  { emoji: "🩺", title: "Faça sua autoavaliação", sources: ["self_assessment"] },
  { emoji: "📷", title: "Faça uma medição rPPG", sources: ["rppg_measurement", "vitals_measurement"] },
  { emoji: "🎯", title: "Participe de uma campanha ou missão", sources: ["mission_complete", "daily_challenge", "weekly_checkin"] },
  { emoji: "🏆", title: "Veja sua posição no ranking", sources: ["tour_step_ranking"] },
];

export function FirstStepsCard() {
  const { user } = useAuth();
  const [done, setDone] = useState<boolean[]>(STEPS.map(() => false));
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("points_ledger")
      .select("source")
      .eq("user_id", user.id);
    const sources = new Set((data || []).map((r: any) => r.source));
    setDone(STEPS.map((s) => s.sources.some((src) => sources.has(src))));
    setLoaded(true);
  };

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
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!loaded || !user) return null;
  const completedCount = done.filter(Boolean).length;
  if (completedCount === STEPS.length) return null;

  const reopenTour = async () => {
    // Reset completed flag so the popup tour re-opens at the next pending step
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
