import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { WellbeingPrograms } from "@/components/corporate/WellbeingPrograms";
import { CampaignsList } from "@/components/corporate/CampaignsList";
import { TopBar } from "./TopBar";
import { MissionsTab } from "./MissionsTab";
import type { TabId } from "@/lib/mayla-config";

type SubView = "overview" | "missions";

interface Props {
  onNavigate?: (tab: TabId) => void;
}

export function CampanhasTab({ onNavigate }: Props) {
  const { companyId, primaryColor } = useCompany();
  const [subView, setSubView] = useState<SubView>("overview");

  if (subView === "missions") {
    return <MissionsTab onBack={() => setSubView("overview")} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Campanhas" />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        <button
          onClick={() => setSubView("missions")}
          className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left"
        >
          <span className="text-3xl">🎯</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Minhas Missões</div>
            <div className="text-sm text-muted-foreground">Veja e complete suas missões ativas</div>
          </div>
          <span className="text-muted-foreground text-lg">›</span>
        </button>

        <WellbeingPrograms companyId={companyId || ""} primaryColor={primaryColor} onNavigate={onNavigate} />
        <CampaignsList companyId={companyId || ""} primaryColor={primaryColor} />
      </div>
    </div>
  );
}
