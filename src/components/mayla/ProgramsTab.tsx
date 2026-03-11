import { useCompany } from "@/contexts/CompanyContext";
import { WellbeingPrograms } from "@/components/corporate/WellbeingPrograms";
import { CampaignsList } from "@/components/corporate/CampaignsList";
import { TopBar } from "./TopBar";

export function ProgramsTab() {
  const { companyId, primaryColor } = useCompany();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Programas" />
      <div className="flex-1 overflow-y-auto px-[22px] py-5 space-y-8">
        {companyId ? (
          <>
            <WellbeingPrograms companyId={companyId} primaryColor={primaryColor} />
            <CampaignsList companyId={companyId} primaryColor={primaryColor} />
          </>
        ) : (
          <div className="text-center py-12">
            <span className="text-3xl block mb-2">🌿</span>
            <p className="text-sm text-muted-foreground">Vincule-se a uma empresa para ver os programas disponíveis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
