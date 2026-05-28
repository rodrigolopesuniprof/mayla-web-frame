import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

export interface DailyChallenge {
  assignmentId: string;
  challengeId: string;
  title: string;
  description: string | null;
  emoji: string;
  points: number;
  validationType: string;
  completed: boolean;
}

export interface EffectiveLevel {
  level_number: number;
  name: string;
  emoji: string;
  min_points: number;
  bonus_points: number;
  badge_title: string | null;
}

export interface LevelProgress {
  current_level: number;
  current: EffectiveLevel | null;
  next: EffectiveLevel | null;
  points: number;
  badges: any[];
}

export function useGamification() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [levels, setLevels] = useState<EffectiveLevel[]>([]);
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const targetCompany = companyId;

    // Ensure today's challenge assignment exists, then fetch full info
    let assignmentId: string | null = null;
    if (targetCompany) {
      const { data: ensure } = await supabase.rpc("ensure_daily_challenge" as any, { _company_id: targetCompany });
      assignmentId = (ensure as string) || null;
    }

    if (assignmentId) {
      const [{ data: asg }, { data: completion }] = await Promise.all([
        supabase
          .from("daily_challenge_assignments" as any)
          .select("id, challenge_id, daily_challenges:challenge_id (id, title, description, emoji, points, validation_type)")
          .eq("id", assignmentId)
          .maybeSingle(),
        supabase
          .from("daily_challenge_completions" as any)
          .select("id")
          .eq("assignment_id", assignmentId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const dc = (asg as any)?.daily_challenges;
      if (dc) {
        setChallenge({
          assignmentId,
          challengeId: dc.id,
          title: dc.title,
          description: dc.description,
          emoji: dc.emoji || "🎯",
          points: dc.points,
          validationType: dc.validation_type,
          completed: !!completion,
        });
      } else {
        setChallenge(null);
      }
    } else {
      setChallenge(null);
    }

    // Levels (effective scale for company)
    const { data: lvls } = await supabase.rpc("get_effective_levels" as any, { _company_id: targetCompany });
    const lvlList = (lvls as EffectiveLevel[]) || [];
    setLevels(lvlList);

    // Profile + progress
    const [{ data: prof }, { data: prog }] = await Promise.all([
      supabase.from("profiles").select("points").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_level_progress" as any).select("current_level, badges").eq("user_id", user.id).maybeSingle(),
    ]);

    const points = (prof as any)?.points ?? 0;
    const currentLevelNum = (prog as any)?.current_level ?? 1;
    const current = lvlList.find((l) => l.level_number === currentLevelNum) || lvlList[0] || null;
    const next = lvlList.find((l) => l.level_number > currentLevelNum) || null;

    setProgress({
      current_level: currentLevelNum,
      current,
      next,
      points,
      badges: (prog as any)?.badges || [],
    });

    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { load(); }, [load]);

  const completeChallenge = useCallback(async () => {
    if (!challenge || challenge.completed) return null;
    const { data, error } = await supabase.rpc("complete_daily_challenge" as any, { _assignment_id: challenge.assignmentId });
    if (error) throw error;
    await load();
    return data;
  }, [challenge, load]);

  return { challenge, levels, progress, loading, reload: load, completeChallenge };
}
