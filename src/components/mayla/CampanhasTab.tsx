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

export function CampanhasTab({ onNavigate, onOpenLeaderboard, initialView, onViewConsumed }: Props) {
  const { companyId, primaryColor } = useCompany();
  const { user } = useAuth();
  const [subView, setSubView] = useState<CampanhasView>({ view: "overview" });
  const [leaguesEnabled, setLeaguesEnabled] = useState(false);

  useEffect(() => {
    if (user?.id) markFirstStep(user.id, "campaigns-viewed");
  }, [user?.id]);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("leagues_enabled").eq("id", companyId).maybeSingle()
      .then(({ data }) => setLeaguesEnabled(!!(data as any)?.leagues_enabled));
  }, [companyId]);

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Desafios" />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        <button
          onClick={() => onOpenLeaderboard?.()}
          className="w-full rounded-2xl p-4 border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card flex items-center gap-4 cursor-pointer text-left"
        >
          <span className="text-3xl">🏆</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Ranking </div>
            <div className="text-sm text-muted-foreground">Veja sua posição desta semana</div>
          </div>
          <span className="text-muted-foreground text-lg">›</span>
        </button>

        <button
          onClick={() => setSubView({ view: "missions" })}
          className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left"
        >
          <span className="text-3xl">🎯</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Minhas Missões</div>
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
              <div className="text-[15px] font-semibold text-foreground">Minhas Ligas</div>
              <div className="text-sm text-muted-foreground">Compita em ligas com seus colegas</div>
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
