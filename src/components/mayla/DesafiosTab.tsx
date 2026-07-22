import { useState } from "react";
import { LeaguesPanel } from "./leagues/LeaguesPanel";
import { LeagueDetailPanel } from "./leagues/LeagueDetailPanel";

type View = { view: "leagues" } | { view: "league-detail"; leagueId: string };

export function DesafiosTab() {
  const [sub, setSub] = useState<View>({ view: "leagues" });

  if (sub.view === "league-detail") {
    return (
      <LeagueDetailPanel
        leagueId={sub.leagueId}
        onBack={() => setSub({ view: "leagues" })}
        onLeft={() => setSub({ view: "leagues" })}
      />
    );
  }

  return (
    <LeaguesPanel
      onBack={() => {}}
      onOpen={(leagueId) => setSub({ view: "league-detail", leagueId })}
    />
  );
}
