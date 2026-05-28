DROP VIEW IF EXISTS public.company_leaderboard;

CREATE VIEW public.company_leaderboard AS
SELECT
  p.user_id,
  p.company_id,
  p.full_name,
  p.points AS total_points,
  COALESCE((SELECT SUM(pl.points) FROM public.points_ledger pl
            WHERE pl.user_id = p.user_id
              AND pl.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')), 0) AS month_points,
  ulp.current_level,
  RANK() OVER (PARTITION BY p.company_id ORDER BY p.points DESC) AS rank_total,
  RANK() OVER (PARTITION BY p.company_id ORDER BY COALESCE((
    SELECT SUM(pl.points) FROM public.points_ledger pl
    WHERE pl.user_id = p.user_id
      AND pl.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')), 0) DESC) AS rank_month
FROM public.profiles p
LEFT JOIN public.user_level_progress ulp ON ulp.user_id = p.user_id
WHERE p.company_id IS NOT NULL
  AND p.company_id = public.get_user_company_id(auth.uid());

GRANT SELECT ON public.company_leaderboard TO authenticated;