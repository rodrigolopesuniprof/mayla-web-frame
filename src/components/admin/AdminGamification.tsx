import { useState } from "react";
import { AdminPointRules } from "./AdminPointRules";
import { AdminLevels } from "./AdminLevels";
import { AdminRewards } from "./AdminRewards";
import { AdminPublicDashboard } from "./AdminPublicDashboard";

type Tab = "rules" | "levels" | "rewards" | "public";

interface Props { companyId: string }

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "rules", label: "Regras de pontuação", emoji: "⚙️" },
  { id: "levels", label: "Níveis", emoji: "🏅" },
  { id: "rewards", label: "Prêmios", emoji: "🎁" },
  { id: "public", label: "Painel público", emoji: "📺" },
];

export function AdminGamification({ companyId }: Props) {
  const [tab, setTab] = useState<Tab>("rules");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm border-none cursor-pointer transition-colors ${
              tab === t.id
                ? "text-primary border-b-2 border-primary -mb-px font-medium"
                : "text-muted-foreground bg-transparent"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      {tab === "rules" && <AdminPointRules companyId={companyId} />}
      {tab === "levels" && <AdminLevels companyId={companyId} />}
      {tab === "rewards" && <AdminRewards companyId={companyId} />}
      {tab === "public" && <AdminPublicDashboard companyId={companyId} />}
    </div>
  );
}
