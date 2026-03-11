import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { WellbeingCheckin } from "@/components/corporate/WellbeingCheckin";
import { TopBar } from "./TopBar";

interface CheckinHistory {
  id: string;
  week_start: string;
  mood: number;
  stress_level: number;
  sleep_quality: number;
  workload: number;
}

const MOOD_EMOJI = ["", "😞", "😕", "😐", "🙂", "😊"];

export function WellbeingTab() {
  const { user } = useAuth();
  const { companyId, primaryColor } = useCompany();
  const [history, setHistory] = useState<CheckinHistory[]>([]);

  const loadHistory = () => {
    if (!user) return;
    supabase
      .from("wellbeing_checkins")
      .select("id, week_start, mood, stress_level, sleep_quality, workload")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(8)
      .then(({ data }) => setHistory((data as CheckinHistory[]) || []));
  };

  useEffect(() => { loadHistory(); }, [user]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Bem-estar" />
      <div className="flex-1 overflow-y-auto px-[22px] py-5 space-y-6">
        {companyId && (
          <WellbeingCheckin
            companyId={companyId}
            primaryColor={primaryColor}
            onComplete={loadHistory}
          />
        )}

        {history.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">📅 Histórico</h3>
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="bg-secondary rounded-2xl p-3 flex items-center gap-3">
                  <span className="text-2xl">{MOOD_EMOJI[h.mood] || "😐"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      Semana de {new Date(h.week_start).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Humor {h.mood}/5 · Estresse {h.stress_level}/5 · Sono {h.sleep_quality}/5
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
