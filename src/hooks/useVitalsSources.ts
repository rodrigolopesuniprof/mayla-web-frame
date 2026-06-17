import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type VitalsSourceId = "basic_rppg" | "premium_binah" | "premium_shenai";

export const VITALS_FEATURE_KEYS: Record<VitalsSourceId, string> = {
  basic_rppg: "vitals_basic_rppg",
  premium_binah: "vitals_premium_binah",
  premium_shenai: "vitals_premium_shenai",
};

export const VITALS_DEFAULTS: Record<
  VitalsSourceId,
  { displayName: string; description: string; pointsReward: number; emoji: string; gradient: string; shadow: string; monthlyLimit?: number }
> = {
  basic_rppg: {
    displayName: "Medir sinais vitais",
    description: "Câmera · Freq. cardíaca, respiração e estresse",
    pointsReward: 50,
    emoji: "❤️",
    gradient: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
    shadow: "0 12px 36px rgba(232,87,74,.3)",
  },
  premium_binah: {
    displayName: "Avaliação Completa de Saúde",
    description: "Análise completa · PA, hemoglobina, HRV",
    pointsReward: 100,
    monthlyLimit: 3,
    emoji: "🔬",
    gradient: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
    shadow: "0 12px 36px rgba(26,92,138,.3)",
  },
  premium_shenai: {
    displayName: "Análise Avançada de Saúde",
    description: "Análise avançada · Indicadores cardiovasculares e metabólicos",
    pointsReward: 100,
    monthlyLimit: 3,
    emoji: "🩺",
    gradient: "linear-gradient(135deg, hsl(var(--mayla-teal)), hsl(var(--mayla-pref)))",
    shadow: "0 12px 36px rgba(26,92,138,.3)",
  },
};

export interface VitalsSource {
  id: VitalsSourceId;
  featureKey: string;
  enabled: boolean;
  displayName: string;
  description: string;
  emoji: string;
  gradient: string;
  shadow: string;
  pointsReward: number;
  monthlyLimit?: number;
  usedThisMonth?: number;
}

export function useVitalsSources(companyId: string | null | undefined) {
  const { user } = useAuth();
  const [sources, setSources] = useState<VitalsSource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const keys = Object.values(VITALS_FEATURE_KEYS);
    const { data: feats } = await supabase
      .from("company_features")
      .select("feature_key, enabled, config")
      .eq("company_id", companyId)
      .in("feature_key", keys);

    const byKey = new Map(feats?.map((f) => [f.feature_key, f]) ?? []);

    // Count special_measurements this month for the user (covers both premium providers)
    let usedThisMonth = 0;
    if (user) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("special_measurements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("measured_at", monthStart);
      usedThisMonth = count ?? 0;
    }

    const built: VitalsSource[] = (Object.keys(VITALS_FEATURE_KEYS) as VitalsSourceId[]).map((id) => {
      const featureKey = VITALS_FEATURE_KEYS[id];
      const defaults = VITALS_DEFAULTS[id];
      const row = byKey.get(featureKey);
      const cfg = (row?.config as Record<string, any> | null) || {};
      return {
        id,
        featureKey,
        enabled: row?.enabled ?? (id === "basic_rppg"), // basic defaults to enabled
        displayName: cfg.display_name || defaults.displayName,
        description: cfg.description || defaults.description,
        emoji: defaults.emoji,
        gradient: defaults.gradient,
        shadow: defaults.shadow,
        pointsReward: cfg.points_reward ?? defaults.pointsReward,
        monthlyLimit: id === "basic_rppg" ? undefined : (cfg.monthly_limit ?? defaults.monthlyLimit),
        usedThisMonth: id === "basic_rppg" ? undefined : usedThisMonth,
      };
    });

    setSources(built);
    setLoading(false);
  }, [companyId, user]);

  useEffect(() => {
    load();
  }, [load]);

  return { sources, loading, reload: load };
}
