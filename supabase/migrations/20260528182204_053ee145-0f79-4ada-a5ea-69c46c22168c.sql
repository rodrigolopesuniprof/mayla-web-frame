CREATE OR REPLACE FUNCTION public.trg_sync_user_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avoid recursion: when check_user_level credits bonus and re-updates profiles,
  -- the trigger would fire again. Only act on the top-level update.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.points IS DISTINCT FROM OLD.points THEN
    PERFORM public.check_user_level(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;