import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface LevelUpInfo {
  level_number: number;
  name: string;
  emoji: string | null;
  badge_title: string | null;
  bonus_points: number;
}

export function useLevelUpNotifier() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [info, setInfo] = useState<LevelUpInfo | null>(null);
  const lastLevelRef = useRef<number | null>(null);

  // Capture baseline level so we only notify on real transitions
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("user_level_progress" as any)
      .select("current_level")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        lastLevelRef.current = (data as any)?.current_level ?? 1;
      });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`level-up-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_level_progress", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const newLevel = (payload.new as any)?.current_level;
          const prev = lastLevelRef.current ?? 1;
          if (typeof newLevel !== "number" || newLevel <= prev) return;
          lastLevelRef.current = newLevel;

          // Fetch level metadata
          const { data: levels } = await supabase.rpc("get_effective_levels" as any, { _company_id: companyId });
          const reached = (levels as any[] | null)?.find((l) => l.level_number === newLevel);
          if (!reached) {
            toast.success(`🎉 Você subiu para o nível ${newLevel}!`);
            return;
          }
          setInfo({
            level_number: reached.level_number,
            name: reached.name,
            emoji: reached.emoji,
            badge_title: reached.badge_title,
            bonus_points: reached.bonus_points ?? 0,
          });
          toast.success(`🎉 Novo nível: ${reached.emoji ?? ""} ${reached.name}!`);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, companyId]);

  return { info, dismiss: () => setInfo(null) };
}
