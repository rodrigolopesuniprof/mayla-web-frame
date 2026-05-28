
-- Update leaderboard view to expose avatar fields
DROP VIEW IF EXISTS public.company_leaderboard;
CREATE VIEW public.company_leaderboard
WITH (security_invoker = true)
AS
WITH ledger_agg AS (
  SELECT pl.user_id,
    sum(pl.points) FILTER (WHERE pl.created_at >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))) AS week_points,
    sum(pl.points) FILTER (WHERE pl.created_at >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))) AS month_points,
    sum(pl.points) FILTER (WHERE pl.created_at >= date_trunc('year', (now() AT TIME ZONE 'America/Sao_Paulo'))) AS year_points
  FROM points_ledger pl
  GROUP BY pl.user_id
)
SELECT p.user_id,
  p.company_id,
  p.full_name,
  p.avatar_url,
  p.avatar_type,
  p.points AS total_points,
  COALESCE(la.week_points, 0::bigint) AS week_points,
  COALESCE(la.month_points, 0::bigint) AS month_points,
  COALESCE(la.year_points, 0::bigint) AS year_points,
  ulp.current_level,
  rank() OVER (PARTITION BY p.company_id ORDER BY p.points DESC) AS rank_total,
  rank() OVER (PARTITION BY p.company_id ORDER BY COALESCE(la.week_points, 0::bigint) DESC) AS rank_week,
  rank() OVER (PARTITION BY p.company_id ORDER BY COALESCE(la.month_points, 0::bigint) DESC) AS rank_month,
  rank() OVER (PARTITION BY p.company_id ORDER BY COALESCE(la.year_points, 0::bigint) DESC) AS rank_year
FROM profiles p
LEFT JOIN ledger_agg la ON la.user_id = p.user_id
LEFT JOIN user_level_progress ulp ON ulp.user_id = p.user_id
WHERE p.company_id IS NOT NULL AND p.company_id = get_user_company_id(auth.uid());

GRANT SELECT ON public.company_leaderboard TO authenticated;

-- RPC: apply DiceBear avatar to a profile and award 50 pts once
CREATE OR REPLACE FUNCTION public.apply_dicebear_avatar(_user_id uuid, _url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _already boolean;
BEGIN
  IF _user_id IS NULL OR _url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  SELECT avatar_points_awarded INTO _already FROM public.profiles WHERE user_id = _user_id;
  IF _already IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  UPDATE public.profiles
  SET avatar_url = _url,
      avatar_type = 'dicebear'
  WHERE user_id = _user_id;

  IF NOT _already THEN
    PERFORM public.award_points(_user_id, 50, 'avatar_dicebear', NULL, 'Avatar criado');
    UPDATE public.profiles SET avatar_points_awarded = true WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'points_awarded', 50);
  END IF;

  RETURN jsonb_build_object('ok', true, 'points_awarded', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_dicebear_avatar(uuid, text) TO anon, authenticated;
