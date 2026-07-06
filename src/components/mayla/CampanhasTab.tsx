import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { WellbeingPrograms } from "@/components/corporate/WellbeingPrograms";
import { CampaignsList } from "@/components/corporate/CampaignsList";
import { TopBar } from "./TopBar";
import { MissionsTab } from "./MissionsTab";
import { LeaguesPanel } from "./leagues/LeaguesPanel";
import { LeagueDetailPanel } from "./leagues/LeagueDetailPanel";
import { markFirstStep } from "@/lib/first-steps";
import { MAYLA_LEAGUE_ID } from "./leagues/constants";

import type { TabId } from "@/lib/mayla-config";

export type CampanhasView =
  | { view: "overview" }
  | { view: "missions" }
  | { view: "leagues" }
  | { view: "league-detail"; leagueId: string };

interface Props {
  onNavigate?: (tab: TabId) => void;
  onOpenLeaderboard?: () => void;
  initialView?: CampanhasView;
  onViewConsumed?: () => void;
}

export function CampanhasTab({ onNavigate, initialView, onViewConsumed }: Props) {
  const { companyId, primaryColor } = useCompany();
  const { user } = useAuth();
  const [subView, setSubView] = useState<CampanhasView>({ view: "overview" });
  const [leaguesEnabled, setLeaguesEnabled] = useState(false);
  const [weekPos, setWeekPos] = useState<number | null>(null);
  const [weekPts, setWeekPts] = useState<number>(0);
  const [weekGoal, setWeekGoal] = useState<number>(200);

  useEffect(() => {
    if (user?.id) markFirstStep(user.id, "campaigns-viewed");
  }, [user?.id]);

  useEffect(() => {
    if (!companyId || !user) return;
    supabase.from("companies").select("leagues_enabled").eq("id", companyId).maybeSingle()
      .then(({ data }) => setLeaguesEnabled(!!(data as any)?.leagues_enabled));

    // faixa de estado
    supabase.rpc("mayla_ranking" as any, { p_company_id: companyId }).then(({ data }) => {
      const rows = (data || []) as Array<{ user_id: string; pontos_semana: number; posicao: number }>;
      const mine = rows.find((r) => r.user_id === user.id);
      if (mine) { setWeekPos(Number(mine.posicao)); setWeekPts(mine.pontos_semana); }
    });
    supabase.rpc("get_effective_goals" as any, { _company_id: companyId }).then(({ data }) => {
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      if (row?.weekly_goal) setWeekGoal(row.weekly_goal);
    });
  }, [companyId, user]);

  useEffect(() => {
    if (initialView) {
      setSubView(initialView);
      onViewConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView]);

  if (subView.view === "missions") {
    return <MissionsTab onBack={() => setSubView({ view: "overview" })} />;
  }

  if (subView.view === "leagues") {
    return (
      <LeaguesPanel
        onBack={() => setSubView({ view: "overview" })}
        onOpen={(leagueId) => setSubView({ view: "league-detail", leagueId })}
      />
    );
  }

  if (subView.view === "league-detail") {
    return (
      <LeagueDetailPanel
        leagueId={subView.leagueId}
        onBack={() => setSubView({ view: "leagues" })}
        onLeft={() => setSubView({ view: "leagues" })}
      />
    );
  }

  const goalPct = Math.min(100, Math.round((weekPts / Math.max(1, weekGoal)) * 100));
  const posLabel = weekPos ? `${weekPos}º` : "—";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Desafios" />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Faixa de estado — Liga Mayla */}
        <button
          onClick={() => setSubView({ view: "league-detail", leagueId: MAYLA_LEAGUE_ID })}
          className="w-full rounded-2xl p-4 border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card text-left"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sua semana</div>
              <div className="text-[15px] font-semibold text-foreground">Liga Mayla · {posLabel}</div>
            </div>
            <span className="text-3xl">🏆</span>
          </div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-muted-foreground">Meta da semana</span>
            <span className="text-xs font-medium text-foreground">{weekPts} / {weekGoal} pts</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${goalPct}%` }} />
          </div>
        </button>

        <button
          onClick={() => setSubView({ view: "missions" })}
          className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left"
        >
          <span className="text-3xl">🎯</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Minhas missões</div>
            <div className="text-sm text-muted-foreground">Veja e complete suas missões ativas</div>
          </div>
          <span className="text-muted-foreground text-lg">›</span>
        </button>

        {leaguesEnabled && (
          <button
            onClick={() => setSubView({ view: "leagues" })}
            className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left"
          >
            <span className="text-3xl">🥇</span>
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-foreground">Minhas ligas</div>
              <div className="text-sm text-muted-foreground">Compita com colegas e amigos</div>
            </div>
            <span className="text-muted-foreground text-lg">›</span>
          </button>
        )}

        <WellbeingPrograms companyId={companyId || ""} primaryColor={primaryColor} onNavigate={onNavigate} />
        <CampaignsList companyId={companyId || ""} primaryColor={primaryColor} />
      </div>
    </div>
  );
}
