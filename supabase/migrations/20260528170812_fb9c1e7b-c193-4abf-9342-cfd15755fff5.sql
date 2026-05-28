
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS cap_per_day integer,
  ADD COLUMN IF NOT EXISTS cap_per_week integer,
  ADD COLUMN IF NOT EXISTS cap_per_month integer,
  ADD COLUMN IF NOT EXISTS cap_lifetime integer,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz;

CREATE OR REPLACE FUNCTION public.award_mission_event(_user_id uuid, _mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _m public.missions%ROWTYPE;
  _used integer;
  _tz constant text := 'America/Sao_Paulo';
BEGIN
  IF _user_id IS NULL OR _mission_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  SELECT * INTO _m FROM public.missions WHERE id = _mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mission_not_found');
  END IF;

  IF NOT _m.active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;

  IF _m.valid_from IS NOT NULL AND now() < _m.valid_from THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
  END IF;
  IF _m.valid_until IS NOT NULL AND now() > _m.valid_until THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF _m.cap_per_day IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = 'mission_complete' AND source_id = _mission_id
       AND (created_at AT TIME ZONE _tz)::date = (now() AT TIME ZONE _tz)::date;
    IF _used >= _m.cap_per_day THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'day');
    END IF;
  END IF;

  IF _m.cap_per_week IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = 'mission_complete' AND source_id = _mission_id
       AND date_trunc('week', (created_at AT TIME ZONE _tz)) = date_trunc('week', (now() AT TIME ZONE _tz));
    IF _used >= _m.cap_per_week THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'week');
    END IF;
  END IF;

  IF _m.cap_per_month IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = 'mission_complete' AND source_id = _mission_id
       AND date_trunc('month', (created_at AT TIME ZONE _tz)) = date_trunc('month', (now() AT TIME ZONE _tz));
    IF _used >= _m.cap_per_month THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'month');
    END IF;
  END IF;

  IF _m.cap_lifetime IS NOT NULL THEN
    SELECT count(*) INTO _used FROM public.points_ledger
     WHERE user_id = _user_id AND source = 'mission_complete' AND source_id = _mission_id;
    IF _used >= _m.cap_lifetime THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cap_reached', 'window', 'lifetime');
    END IF;
  END IF;

  IF COALESCE(_m.points, 0) > 0 THEN
    PERFORM public.award_points(_user_id, _m.points, 'mission_complete', _mission_id, 'Missão: ' || _m.title);
  END IF;

  RETURN jsonb_build_object('ok', true, 'points', _m.points);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_points_on_mission_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM public.award_mission_event(NEW.user_id, NEW.mission_id);
  END IF;
  RETURN NEW;
END;
$$;
