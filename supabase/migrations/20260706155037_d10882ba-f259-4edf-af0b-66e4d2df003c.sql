
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS scoring_event_keys text[] NOT NULL DEFAULT '{}'::text[];

CREATE OR REPLACE FUNCTION public.league_ranking(
  p_league_id uuid,
  p_week_id   text DEFAULT to_char(now(),'IYYY"-W"IW')
)
RETURNS TABLE(user_id uuid, pontos_semana int, posicao bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_keys text[];
BEGIN
  SELECT scoring_event_keys INTO v_keys FROM public.leagues WHERE id = p_league_id;

  RETURN QUERY
  WITH scores AS (
    SELECT m.user_id,
           COALESCE(SUM(pl.points) FILTER (
             WHERE to_char(pl.created_at,'IYYY"-W"IW') = p_week_id
               AND (
                 v_keys IS NULL
                 OR array_length(v_keys, 1) IS NULL
                 OR pl.source = ANY (v_keys)
               )
           ),0)::int AS pontos_semana
    FROM public.league_members m
    LEFT JOIN public.points_ledger pl ON pl.user_id = m.user_id
    WHERE m.league_id = p_league_id
    GROUP BY m.user_id
  )
  SELECT s.user_id, s.pontos_semana,
         rank() OVER (ORDER BY s.pontos_semana DESC) AS posicao
  FROM scores s ORDER BY s.pontos_semana DESC;
END;
$$;
