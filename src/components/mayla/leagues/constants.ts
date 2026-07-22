import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Backward-compat sentinel used by older callers; resolved to the real default league.
export const MAYLA_LEAGUE_ID = "__mayla__";
export const isMaylaLeague = (id: string) => id === MAYLA_LEAGUE_ID;

export interface DefaultLeague {
  id: string;
  nome: string;
  marca_logo_url: string | null;
  conversations_enabled: boolean;
  owner_id: string;
}

/** Loads (and if needed provisions) the company's white-label default league. */
export function useDefaultLeague(companyId: string | null | undefined) {
  const [league, setLeague] = useState<DefaultLeague | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLeague(null); setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // Ensure the row exists (idempotent).
      await supabase.rpc("ensure_default_league" as any, { _company_id: companyId });
      const { data } = await supabase.from("leagues" as any)
        .select("id, nome, marca_logo_url, conversations_enabled, owner_id")
        .eq("company_id", companyId).eq("is_default", true).maybeSingle();
      if (!cancelled) {
        setLeague((data as any) || null);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [companyId]);

  const reload = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("leagues" as any)
      .select("id, nome, marca_logo_url, conversations_enabled, owner_id")
      .eq("company_id", companyId).eq("is_default", true).maybeSingle();
    setLeague((data as any) || null);
  };

  return { league, loading, reload };
}
