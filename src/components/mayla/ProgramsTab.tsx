import { useCompany } from "@/contexts/CompanyContext";
import { WellbeingPrograms } from "@/components/corporate/WellbeingPrograms";
import { CampaignsList } from "@/components/corporate/CampaignsList";
import { TopBar } from "./TopBar";

export function ProgramsTab() {
  const { companyId, primaryColor } = useCompany();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Programas" />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-8">
        <WellbeingPrograms companyId={companyId || ""} primaryColor={primaryColor} />
        <CampaignsList companyId={companyId || ""} primaryColor={primaryColor} />
      </div>
    </div>
  );
}
