CREATE OR REPLACE FUNCTION public.backfill_user_levels()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  cnt integer := 0;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles WHERE points > 0 LOOP
    PERFORM public.check_user_level(r.user_id);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;