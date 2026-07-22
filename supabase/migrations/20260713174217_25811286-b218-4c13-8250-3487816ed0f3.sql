-- Backfill: ensure every existing profile is a member of its company's default league
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT company_id FROM public.profiles WHERE company_id IS NOT NULL LOOP
    PERFORM public.ensure_default_league(r.company_id);
  END LOOP;
END $$;

-- Safety-net RPC callable from client on mount of default-league screen
CREATE OR REPLACE FUNCTION public.join_my_default_league()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_lid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT company_id INTO v_company FROM public.profiles WHERE user_id = auth.uid();
  IF v_company IS NULL THEN RETURN NULL; END IF;
  v_lid := public.ensure_default_league(v_company);
  RETURN v_lid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_my_default_league() TO authenticated;