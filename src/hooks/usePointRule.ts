import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PointRule {
  event_key: string;
  label: string;
  points: number;
  cap_per_day: number | null;
  cap_per_week: number | null;
  cap_per_month: number | null;
  cap_lifetime: number | null;
  active: boolean;
}

/**
 * Returns the company-specific point rule for a given event_key.
 * Useful to surface "+X pts" labels on CTAs throughout the app.
 */
export function usePointRule(eventKey: string): { rule: PointRule | null; loading: boolean } {
  const { user } = useAuth();
  const [rule, setRule] = useState<PointRule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const cid = (profile as any)?.company_id;
      if (!cid) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("point_rules" as any)
        .select("event_key,label,points,cap_per_day,cap_per_week,cap_per_month,cap_lifetime,active")
        .eq("company_id", cid)
        .eq("event_key", eventKey)
        .maybeSingle();
      if (!cancelled) {
        setRule((data as any) || null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, eventKey]);

  return { rule, loading };
}
