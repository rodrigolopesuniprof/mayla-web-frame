
-- 1) award_event passa a aceitar override de pontos (missões/desafios definem valor próprio)
CREATE OR REPLACE FUNCTION public.award_event(
  _user_id uuid,
  _event_key text,
  _source_id uuid DEFAULT NULL::uuid,
  _description text DEFAULT NULL::text,
  _company_id uuid DEFAULT NULL::uuid,
  _override_points integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _cid UUID;
  _rule public.point_rules%ROWTYPE;
  _used INTEGER;
  _points_to_award INTEGER;
  _tz CONSTANT TEXT := 'America/Sao_Paulo';
BEGIN
  IF _user_id IS NULL OR _event_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  _cid := COALESCE(_company_id, public.get_user_company_id(_user_id));
  IF _cid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_company');
  END IF;

  SELECT * INTO _rule FROM public.point_rules
   WHERE company_id = _cid AND event_key = _event_key
   LIMIT 1;

  IF NOT FOUND THEN
    -- auto-seed default rules for legacy companies
    PERFORM public.seed_default_point_rules(_cid);
    SELECT * INTO _rule FROM public.point_rules
     WHERE company_id = _cid AND event_key = _event_key
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'rule_not_found');
    END IF;
  END IF;

  IF NOT _rule.active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;

  IF _rule.valid_from IS NOT NULL AND now() < _rule.valid_from THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
  END IF;
  IF _rule.valid_until IS NOT NULL AND now() > _rule.valid_until THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF _rule.cap_per_day IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = _event_key
       AND (created_at AT TIME ZONE _tz)::date = (now() AT TIME ZONE _tz)::date;
    IF _used >= _rule.cap_per_day THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'day', 'cap', _rule.cap_per_day, 'used', _used);
    END IF;
  END IF;

  IF _rule.cap_per_week IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = _event_key
       AND date_trunc('week', (created_at AT TIME ZONE _tz)) = date_trunc('week', (now() AT TIME ZONE _tz));
    IF _used >= _rule.cap_per_week THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'week', 'cap', _rule.cap_per_week, 'used', _used);
    END IF;
  END IF;

  IF _rule.cap_per_month IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = _event_key
       AND date_trunc('month', (created_at AT TIME ZONE _tz)) = date_trunc('month', (now() AT TIME ZONE _tz));
    IF _used >= _rule.cap_per_month THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'month', 'cap', _rule.cap_per_month, 'used', _used);
    END IF;
  END IF;

  IF _rule.cap_lifetime IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = _event_key;
    IF _used >= _rule.cap_lifetime THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'lifetime', 'cap', _rule.cap_lifetime, 'used', _used);
    END IF;
  END IF;

  _points_to_award := COALESCE(_override_points, _rule.points);

  IF _points_to_award > 0 THEN
    PERFORM public.award_points(_user_id, _points_to_award, _event_key, _source_id, COALESCE(_description, _rule.label));
  END IF;

  RETURN jsonb_build_object('ok', true, 'points', _points_to_award, 'event_key', _event_key);
END;
$function$;

-- 2) Missão concluída — usa pontos da missão como override
CREATE OR REPLACE FUNCTION public.add_points_on_mission_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mission_points integer;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT points INTO _mission_points FROM public.missions WHERE id = NEW.mission_id;
    PERFORM public.award_event(
      NEW.user_id,
      'mission_complete',
      NEW.mission_id,
      'Missão completada',
      NULL,
      COALESCE(_mission_points, 0)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Desafio diário — usa pontos do desafio como override
CREATE OR REPLACE FUNCTION public.complete_daily_challenge(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _points integer;
  _challenge_id uuid;
  _inserted boolean := false;
  _award jsonb;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT a.company_id, dc.points, dc.id INTO _company_id, _points, _challenge_id
  FROM public.daily_challenge_assignments a
  JOIN public.daily_challenges dc ON dc.id = a.challenge_id
  WHERE a.id = _assignment_id;
  IF _challenge_id IS NULL THEN RAISE EXCEPTION 'assignment not found'; END IF;
  IF _company_id IS DISTINCT FROM get_user_company_id(_user_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.daily_challenge_completions (user_id, assignment_id, company_id, points_awarded)
  VALUES (_user_id, _assignment_id, _company_id, _points)
  ON CONFLICT (user_id, assignment_id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted THEN
    _award := public.award_event(_user_id, 'daily_challenge', _challenge_id, 'Desafio do dia concluído', _company_id, COALESCE(_points, 0));
  END IF;
  RETURN jsonb_build_object('points', _points, 'challenge_id', _challenge_id, 'awarded', _inserted, 'award', _award);
END;
$function$;

-- 4) Adesão a medicamento — delega para award_event
CREATE OR REPLACE FUNCTION public.award_medication_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.points_awarded > 0 THEN
    PERFORM public.award_event(NEW.user_id, 'medication_adherence', NEW.id, 'Adesão a medicamento');
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) Vínculo ESF — delega para award_event (sem mexer em NEW.points, evita duplo crédito)
CREATE OR REPLACE FUNCTION public.award_esf_link_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.esf_team_id IS NULL AND NEW.esf_team_id IS NOT NULL THEN
    PERFORM public.award_event(NEW.user_id, 'esf_link', NULL, 'Bônus por vínculo de equipe ESF', NEW.company_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 6) Vínculo equipe de apoio — delega para award_event
CREATE OR REPLACE FUNCTION public.award_support_team_link_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.support_team_id IS NULL AND NEW.support_team_id IS NOT NULL THEN
    PERFORM public.award_event(NEW.user_id, 'support_team_link', NULL, 'Bônus por vínculo de equipe de apoio', NEW.company_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 7) Garantir que toda empresa existente tem as regras seedadas
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_default_point_rules(r.id);
  END LOOP;
END $$;
