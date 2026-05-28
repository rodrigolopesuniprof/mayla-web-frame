
CREATE OR REPLACE FUNCTION public.get_public_dashboard(_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid UUID;
  _company RECORD;
  _ranking JSONB;
  _teams JSONB;
  _rewards JSONB;
  _grants JSONB;
  _goals RECORD;
  _week_points INTEGER;
  _month_points INTEGER;
  _tz CONSTANT TEXT := 'America/Sao_Paulo';
BEGIN
  SELECT company_id INTO _cid
    FROM public.public_dashboard_tokens
   WHERE token = _token AND active = true
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;
  IF _cid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  SELECT id, name, logo_url, primary_color INTO _company
    FROM public.companies WHERE id = _cid;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.points DESC NULLS LAST), '[]'::jsonb) INTO _ranking
  FROM (
    SELECT
      CASE
        WHEN p.full_name IS NULL OR length(trim(p.full_name)) = 0 THEN 'Colaborador'
        ELSE split_part(trim(p.full_name), ' ', 1) ||
             CASE WHEN array_length(string_to_array(trim(p.full_name), ' '), 1) > 1
                  THEN ' ' || left(split_part(trim(p.full_name), ' ', array_length(string_to_array(trim(p.full_name), ' '), 1)), 1) || '.'
                  ELSE '' END
      END AS name,
      p.avatar_url,
      COALESCE(p.points, 0) AS points,
      p.level
    FROM public.profiles p
    WHERE p.company_id = _cid
    ORDER BY COALESCE(p.points, 0) DESC NULLS LAST
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'team_name', team_name, 'emoji', emoji, 'members', members, 'points', total_points
    ) ORDER BY total_points DESC), '[]'::jsonb) INTO _teams
  FROM (
    SELECT ct.name AS team_name, ct.emoji,
           count(DISTINCT tm.user_id) AS members,
           COALESCE(sum(p.points), 0) AS total_points
    FROM public.collaborative_teams ct
    LEFT JOIN public.team_members tm ON tm.team_id = ct.id
    LEFT JOIN public.profiles p ON p.user_id = tm.user_id
    WHERE ct.company_id = _cid
    GROUP BY ct.id, ct.name, ct.emoji
  ) tm;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'title', title, 'description', description, 'image_url', image_url,
      'cost_points', cost_points, 'min_level', min_level
    ) ORDER BY created_at DESC), '[]'::jsonb) INTO _rewards
  FROM public.rewards
  WHERE company_id = _cid AND active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now());

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'reward_title', r.title,
      'user_name', CASE WHEN p.full_name IS NULL THEN 'Colaborador'
                        ELSE split_part(trim(p.full_name), ' ', 1) END,
      'granted_at', g.granted_at
    ) ORDER BY g.granted_at DESC), '[]'::jsonb) INTO _grants
  FROM public.reward_grants g
  JOIN public.rewards r ON r.id = g.reward_id
  LEFT JOIN public.profiles p ON p.user_id = g.user_id
  WHERE g.company_id = _cid
  LIMIT 20;

  SELECT * INTO _goals FROM public.get_effective_goals(_cid);

  SELECT COALESCE(sum(pl.points), 0) INTO _week_points
  FROM public.points_ledger pl
  WHERE pl.company_id = _cid
    AND date_trunc('week', (pl.created_at AT TIME ZONE _tz)) = date_trunc('week', (now() AT TIME ZONE _tz));

  SELECT COALESCE(sum(pl.points), 0) INTO _month_points
  FROM public.points_ledger pl
  WHERE pl.company_id = _cid
    AND date_trunc('month', (pl.created_at AT TIME ZONE _tz)) = date_trunc('month', (now() AT TIME ZONE _tz));

  RETURN jsonb_build_object(
    'ok', true,
    'company', jsonb_build_object('name', _company.name, 'logo_url', _company.logo_url, 'primary_color', _company.primary_color),
    'ranking', _ranking,
    'teams', _teams,
    'rewards', _rewards,
    'recent_grants', _grants,
    'goals', jsonb_build_object(
      'weekly_goal', COALESCE(_goals.weekly_goal, 0),
      'monthly_goal', COALESCE(_goals.monthly_goal, 0),
      'yearly_goal', COALESCE(_goals.yearly_goal, 0),
      'week_points', _week_points,
      'month_points', _month_points
    )
  );
END;
$$;
