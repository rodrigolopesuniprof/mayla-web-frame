import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

interface Props {
  onOpenLeagues?: () => void;
  onOpenLeague?: (leagueId: string) => void;
}

export function MyLeagueCard({ onOpenLeagues, onOpenLeague }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [enabled, setEnabled] = useState(false);
  const [league, setLeague] = useState<{ id: string; nome: string; marca_logo_url: string | null } | null>(null);
  const [weekPoints, setWeekPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user || !companyId) { setLoading(false); return; }
      const { data: company } = await supabase
        .from("companies").select("leagues_enabled").eq("id", companyId).maybeSingle();
      const isEnabled = !!(company as any)?.leagues_enabled;
      setEnabled(isEnabled);
      if (!isEnabled) { setLoading(false); return; }

      const { data: mem } = await supabase
        .from("league_members" as any)
        .select("league_id, leagues:league_id (id, nome, marca_logo_url, status)")
        .eq("user_id", user.id).limit(1).maybeSingle();
      const l = (mem as any)?.leagues;
      if (l && l.status === "ativa") {
        setLeague({ id: l.id, nome: l.nome, marca_logo_url: l.marca_logo_url });
        const { data: rank } = await supabase.rpc("league_ranking" as any, { p_league_id: l.id });
        const mine = ((rank || []) as any[]).find((r) => r.user_id === user.id);
        setWeekPoints(mine?.pontos_semana ?? 0);
      }
      setLoading(false);
    })();
  }, [user, companyId]);

  if (loading || !enabled) return null;

  if (!league) {
    return (
      <div
        className="mx-5 mb-5 rounded-[18px] p-4 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform border-2 border-dashed border-accent/40 bg-accent/5"
        onClick={() => onOpenLeagues?.()}
      >
        <div className="shrink-0 flex items-center justify-center text-2xl" style={{ width: 50, height: 50, borderRadius: 14, background: "hsl(var(--accent) / .15)" }}>🏆</div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-foreground mb-0.5">Entre em uma Liga</div>
          <div className="text-sm text-muted-foreground leading-snug">Placar semanal com seus colegas</div>
        </div>
        <span className="text-xl text-muted-foreground">›</span>
      </div>
    );
  }

  return (
    <div
      className="mx-5 mb-5 bg-secondary rounded-[18px] p-4 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform"
      onClick={() => onOpenLeague?.(league.id)}
    >
      {league.marca_logo_url
        ? <img src={league.marca_logo_url} alt="" className="shrink-0 h-[50px] w-[50px] rounded-2xl object-cover" />
        : <div className="shrink-0 flex items-center justify-center text-2xl" style={{ width: 50, height: 50, borderRadius: 14, background: "hsl(var(--accent) / .12)" }}>🏆</div>}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground tracking-[.07em] uppercase mb-0.5">Minha liga</div>
        <div className="font-display text-lg text-foreground font-medium truncate">{league.nome}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{weekPoints ?? 0} pts na semana</div>
      </div>
      <span className="text-xl text-muted-foreground">›</span>
    </div>
  );
}
