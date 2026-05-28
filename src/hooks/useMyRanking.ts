import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

export function useMyRanking() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [rankWeek, setRankWeek] = useState<number | null>(null);
  const [rankMonth, setRankMonth] = useState<number | null>(null);
  const [weekPoints, setWeekPoints] = useState<number>(0);
  const [monthPoints, setMonthPoints] = useState<number>(0);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !companyId) { setLoading(false); return; }
    const { data } = await supabase
      .from("company_leaderboard" as any)
      .select("rank_week, rank_month, week_points, month_points, total_points")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();
    const row = data as any;
    setWeekPoints(row?.week_points ?? 0);
    setMonthPoints(row?.month_points ?? 0);
    setTotalPoints(row?.total_points ?? 0);
    // só mostra rank se a pessoa tiver pontuado no período
    setRankWeek(row?.week_points > 0 ? row.rank_week : null);
    setRankMonth(row?.month_points > 0 ? row.rank_month : null);
    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { load(); }, [load]);

  return { rankWeek, rankMonth, weekPoints, monthPoints, totalPoints, loading, reload: load };
}

