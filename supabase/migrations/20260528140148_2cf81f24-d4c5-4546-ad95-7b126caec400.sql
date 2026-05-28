
-- 1. Recreate company_leaderboard view with week_points and year_points
DROP VIEW IF EXISTS public.company_leaderboard;

CREATE VIEW public.company_leaderboard AS
WITH ledger_agg AS (
  SELECT
    pl.user_id,
    SUM(pl.points) FILTER (
      WHERE pl.created_at >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))
    )::bigint AS week_points,
    SUM(pl.points) FILTER (
      WHERE pl.created_at >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))
    )::bigint AS month_points,
    SUM(pl.points) FILTER (
      WHERE pl.created_at >= date_trunc('year', (now() AT TIME ZONE 'America/Sao_Paulo'))
    )::bigint AS year_points
  FROM public.points_ledger pl
  GROUP BY pl.user_id
)
SELECT
  p.user_id,
  p.company_id,
  p.full_name,
  p.points AS total_points,
  COALESCE(la.week_points, 0)::bigint AS week_points,
  COALESCE(la.month_points, 0)::bigint AS month_points,
  COALESCE(la.year_points, 0)::bigint AS year_points,
  ulp.current_level,
  rank() OVER (PARTITION BY p.company_id ORDER BY p.points DESC) AS rank_total,
  rank() OVER (PARTITION BY p.company_id ORDER BY COALESCE(la.week_points, 0) DESC) AS rank_week,
  rank() OVER (PARTITION BY p.company_id ORDER BY COALESCE(la.month_points, 0) DESC) AS rank_month,
  rank() OVER (PARTITION BY p.company_id ORDER BY COALESCE(la.year_points, 0) DESC) AS rank_year
FROM public.profiles p
LEFT JOIN ledger_agg la ON la.user_id = p.user_id
LEFT JOIN public.user_level_progress ulp ON ulp.user_id = p.user_id
WHERE p.company_id IS NOT NULL
  AND p.company_id = public.get_user_company_id(auth.uid());

GRANT SELECT ON public.company_leaderboard TO authenticated;

-- 2. Goals table
CREATE TABLE public.company_point_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE,
  weekly_goal integer NOT NULL DEFAULT 200,
  monthly_goal integer NOT NULL DEFAULT 800,
  yearly_goal integer NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_point_goals TO authenticated;
GRANT ALL ON public.company_point_goals TO service_role;

ALTER TABLE public.company_point_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read goals"
  ON public.company_point_goals
  FOR SELECT
  TO authenticated
  USING (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins manage goals"
  ON public.company_point_goals
  FOR ALL
  TO authenticated
  USING (public.is_company_admin(auth.uid()))
  WITH CHECK (public.is_company_admin(auth.uid()));

-- Seed global defaults
INSERT INTO public.company_point_goals (company_id, weekly_goal, monthly_goal, yearly_goal)
VALUES (NULL, 200, 800, 10000);

-- Trigger updated_at
CREATE TRIGGER update_company_point_goals_updated_at
  BEFORE UPDATE ON public.company_point_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. get_effective_goals function
CREATE OR REPLACE FUNCTION public.get_effective_goals(_company_id uuid)
RETURNS TABLE(weekly_goal integer, monthly_goal integer, yearly_goal integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT g.weekly_goal, g.monthly_goal, g.yearly_goal
  FROM public.company_point_goals g
  WHERE g.company_id = _company_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT g.weekly_goal, g.monthly_goal, g.yearly_goal
    FROM public.company_point_goals g
    WHERE g.company_id IS NULL
    LIMIT 1;
  END IF;
END;
$$;
