-- Missões completadas
CREATE OR REPLACE FUNCTION public.add_points_on_mission_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mission_points integer;
  _company_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT points INTO _mission_points FROM public.missions WHERE id = NEW.mission_id;
    _mission_points := COALESCE(_mission_points, 0);

    UPDATE public.profiles
    SET points = points + _mission_points
    WHERE user_id = NEW.user_id
    RETURNING company_id INTO _company_id;

    IF _mission_points > 0 THEN
      INSERT INTO public.points_ledger (user_id, company_id, points, source, source_id, description)
      VALUES (NEW.user_id, _company_id, _mission_points, 'mission', NEW.mission_id, 'Missão completada');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Adesão a medicamentos
CREATE OR REPLACE FUNCTION public.award_medication_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _company_id uuid;
BEGIN
  UPDATE public.profiles
  SET points = points + NEW.points_awarded
  WHERE user_id = NEW.user_id
  RETURNING company_id INTO _company_id;

  IF NEW.points_awarded > 0 THEN
    INSERT INTO public.points_ledger (user_id, company_id, points, source, source_id, description)
    VALUES (NEW.user_id, _company_id, NEW.points_awarded, 'medication', NEW.id, 'Adesão a medicamento');
  END IF;
  RETURN NEW;
END;
$function$;

-- Bônus por vínculo ESF (BEFORE UPDATE em profiles)
CREATE OR REPLACE FUNCTION public.award_esf_link_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.esf_team_id IS NULL AND NEW.esf_team_id IS NOT NULL THEN
    NEW.points = OLD.points + 500;
    INSERT INTO public.points_ledger (user_id, company_id, points, source, description)
    VALUES (NEW.user_id, NEW.company_id, 500, 'team_link', 'Bônus por vínculo de equipe ESF');
  END IF;
  RETURN NEW;
END;
$function$;

-- Bônus por vínculo de equipe de apoio (BEFORE UPDATE em profiles)
CREATE OR REPLACE FUNCTION public.award_support_team_link_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.support_team_id IS NULL AND NEW.support_team_id IS NOT NULL THEN
    NEW.points = OLD.points + 500;
    INSERT INTO public.points_ledger (user_id, company_id, points, source, description)
    VALUES (NEW.user_id, NEW.company_id, 500, 'team_link', 'Bônus por vínculo de equipe de apoio');
  END IF;
  RETURN NEW;
END;
$function$;