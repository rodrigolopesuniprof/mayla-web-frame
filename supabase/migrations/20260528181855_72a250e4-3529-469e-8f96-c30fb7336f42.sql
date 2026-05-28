CREATE OR REPLACE FUNCTION public.trg_sync_user_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.points IS DISTINCT FROM OLD.points THEN
    PERFORM public.check_user_level(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_level ON public.profiles;
CREATE TRIGGER profiles_sync_level
AFTER INSERT OR UPDATE OF points ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_user_level();