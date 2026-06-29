
-- 1) Triggers ESF e equipe de apoio: também rodar em INSERT
CREATE OR REPLACE FUNCTION public.award_esf_link_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.esf_team_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.esf_team_id IS NULL AND NEW.esf_team_id IS NOT NULL) THEN
    PERFORM public.award_event(NEW.user_id, 'esf_link', NULL, 'Bônus por vínculo de equipe ESF', NEW.company_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_support_team_link_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.support_team_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.support_team_id IS NULL AND NEW.support_team_id IS NOT NULL) THEN
    PERFORM public.award_event(NEW.user_id, 'support_team_link', NULL, 'Bônus por vínculo de equipe de apoio', NEW.company_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_esf_link_points ON public.profiles;
CREATE TRIGGER trg_award_esf_link_points
AFTER INSERT OR UPDATE OF esf_team_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.award_esf_link_points();

DROP TRIGGER IF EXISTS trg_award_support_team_link_points ON public.profiles;
CREATE TRIGGER trg_award_support_team_link_points
AFTER INSERT OR UPDATE OF support_team_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.award_support_team_link_points();

-- 2) Backfill: 1 ponto de weekly_checkin por (user, semana) já realizada,
-- respeitando o cap_per_week=1 (cada semana credita apenas 1 evento por usuário)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (user_id, week_start)
      user_id, company_id, week_start
    FROM public.wellbeing_checkins
    ORDER BY user_id, week_start, created_at
  LOOP
    -- Só credita se ainda não existir registro de weekly_checkin nesta semana
    IF NOT EXISTS (
      SELECT 1 FROM public.points_ledger
      WHERE user_id = r.user_id
        AND source = 'weekly_checkin'
        AND date_trunc('week', (created_at AT TIME ZONE 'America/Sao_Paulo'))
          = date_trunc('week', (r.week_start::timestamp AT TIME ZONE 'America/Sao_Paulo'))
    ) THEN
      PERFORM public.award_event(r.user_id, 'weekly_checkin', NULL,
        'Check-in semanal (backfill)', r.company_id);
    END IF;
  END LOOP;
END $$;
