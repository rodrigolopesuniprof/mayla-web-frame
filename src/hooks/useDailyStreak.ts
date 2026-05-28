import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Counts consecutive days the user has completed a daily challenge,
 * in America/Sao_Paulo timezone. If today isn't done yet, streak counts
 * from yesterday backward (still preserving momentum).
 */
function spDateString(d: Date) {
  // YYYY-MM-DD in America/Sao_Paulo
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return spDateString(dt);
}

export function useDailyStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("daily_challenge_completions" as any)
      .select("assignment_id, daily_challenge_assignments:assignment_id ( assigned_date )")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(120);

    const dates = new Set<string>();
    for (const row of (data as any[]) || []) {
      const d = row?.daily_challenge_assignments?.assigned_date;
      if (d) dates.add(d);
    }

    const today = spDateString(new Date());
    let cursor = dates.has(today) ? today : addDays(today, -1);
    let count = 0;
    while (dates.has(cursor)) {
      count++;
      cursor = addDays(cursor, -1);
    }

    setStreak(count);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { streak, loading, reload: load };
}
