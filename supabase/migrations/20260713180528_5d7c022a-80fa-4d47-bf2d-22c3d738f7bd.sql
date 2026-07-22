CREATE OR REPLACE FUNCTION public.get_league_members_public(p_league_id uuid)
RETURNS TABLE(user_id uuid, first_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id,
    CASE
      WHEN p.full_name IS NULL OR length(trim(p.full_name)) = 0 THEN 'Colaborador'
      ELSE split_part(trim(p.full_name), ' ', 1)
    END AS first_name,
    p.avatar_url
  FROM public.league_members lm
  JOIN public.profiles p ON p.user_id = lm.user_id
  WHERE lm.league_id = p_league_id
    AND public.is_league_member(p_league_id, auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_league_members_public(uuid) TO authenticated;