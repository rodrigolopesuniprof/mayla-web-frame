import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export type LeaderboardPeriod = "week" | "month" | "year" | "total";

export interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  avatar_type: string | null;
  total_points: number;
  week_points: number;
  month_points: number;
  year_points: number;
  current_level: number | null;
  rank_total: number;
  rank_week: number;
  rank_month: number;
  rank_year: number;
}

export interface Goals {
  weekly_goal: number;
  monthly_goal: number;
  yearly_goal: number;
}

export function pointsFor(r: LeaderboardRow, period: LeaderboardPeriod) {
  switch (period) {
    case "week": return r.week_points;
    case "month": return r.month_points;
    case "year": return r.year_points;
    default: return r.total_points;
  }
}

export function rankFor(r: LeaderboardRow, period: LeaderboardPeriod) {
  switch (period) {
    case "week": return r.rank_week;
    case "month": return r.rank_month;
    case "year": return r.rank_year;
    default: return r.rank_total;
  }
}

export function goalFor(g: Goals | null, period: LeaderboardPeriod): number | null {
  if (!g) return null;
  if (period === "week") return g.weekly_goal;
  if (period === "month") return g.monthly_goal;
  if (period === "year") return g.yearly_goal;
  return null;
}

export function useLeaderboard(period: LeaderboardPeriod, limit = 50) {
  const { companyId } = useCompany();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const orderCol =
      period === "week" ? "week_points" :
      period === "month" ? "month_points" :
      period === "year" ? "year_points" : "total_points";

    const [{ data: rowsData }, { data: goalsData }] = await Promise.all([
      supabase
        .from("company_leaderboard" as any)
        .select("user_id, full_name, total_points, week_points, month_points, year_points, current_level, rank_total, rank_week, rank_month, rank_year")
        .eq("company_id", companyId)
        .order(orderCol, { ascending: false })
        .limit(limit),
      supabase.rpc("get_effective_goals" as any, { _company_id: companyId }),
    ]);

    setRows(((rowsData as unknown) as LeaderboardRow[]) || []);
    const g = Array.isArray(goalsData) && goalsData.length > 0 ? (goalsData[0] as Goals) : null;
    setGoals(g);
    setLoading(false);
  }, [companyId, period, limit]);

  useEffect(() => { load(); }, [load]);

  return { rows, goals, loading, reload: load };
}
