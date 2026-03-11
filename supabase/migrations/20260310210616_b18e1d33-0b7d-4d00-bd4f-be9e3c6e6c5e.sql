
CREATE OR REPLACE FUNCTION public.add_points_on_mission_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.profiles
    SET points = points + COALESCE((SELECT points FROM public.missions WHERE id = NEW.mission_id), 0)
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_points
AFTER UPDATE ON public.user_missions
FOR EACH ROW EXECUTE FUNCTION public.add_points_on_mission_complete();
