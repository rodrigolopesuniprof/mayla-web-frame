
-- 1. POINTS LEDGER
CREATE TABLE public.points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  points integer NOT NULL,
  source text NOT NULL DEFAULT 'other',
  source_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_points_ledger_user ON public.points_ledger(user_id, created_at DESC);
CREATE INDEX idx_points_ledger_company_created ON public.points_ledger(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.points_ledger TO authenticated;
GRANT ALL ON public.points_ledger TO service_role;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ledger" ON public.points_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all ledger" ON public.points_ledger FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view company ledger" ON public.points_ledger FOR SELECT TO authenticated USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert own ledger" ON public.points_ledger FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 2. LEVELS
CREATE TABLE public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  level_number integer NOT NULL,
  name text NOT NULL,
  emoji text DEFAULT '⭐',
  min_points integer NOT NULL,
  bonus_points integer NOT NULL DEFAULT 0,
  badge_title text,
  unlock_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, level_number)
);
CREATE INDEX idx_levels_company ON public.levels(company_id, level_number);
GRANT SELECT ON public.levels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.levels TO authenticated;
GRANT ALL ON public.levels TO service_role;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads levels" ON public.levels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage all levels" ON public.levels FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins manage own levels" ON public.levels FOR ALL TO authenticated USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid())) WITH CHECK (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

INSERT INTO public.levels (company_id, level_number, name, emoji, min_points, bonus_points, badge_title) VALUES
  (NULL, 1, 'Iniciante', '🌱', 0,    0,   'Primeiros Passos'),
  (NULL, 2, 'Engajado',  '💪', 500,  50,  'Engajado'),
  (NULL, 3, 'Atleta',    '🏃', 1500, 100, 'Atleta'),
  (NULL, 4, 'Campeão',   '🏆', 3500, 200, 'Campeão'),
  (NULL, 5, 'Lendário',  '👑', 7500, 500, 'Lendário da Saúde');

-- 3. USER LEVEL PROGRESS
CREATE TABLE public.user_level_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_id uuid,
  current_level integer NOT NULL DEFAULT 1,
  reached_at timestamptz NOT NULL DEFAULT now(),
  total_bonus_paid integer NOT NULL DEFAULT 0,
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ulp_company ON public.user_level_progress(company_id);
GRANT SELECT, INSERT, UPDATE ON public.user_level_progress TO authenticated;
GRANT ALL ON public.user_level_progress TO service_role;
ALTER TABLE public.user_level_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own progress" ON public.user_level_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON public.user_level_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all progress" ON public.user_level_progress FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view company progress" ON public.user_level_progress FOR SELECT TO authenticated USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- 4. DAILY CHALLENGES
CREATE TABLE public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  emoji text DEFAULT '🎯',
  points integer NOT NULL DEFAULT 50,
  validation_type text NOT NULL DEFAULT 'self_report',
  validation_config jsonb DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_challenges_company ON public.daily_challenges(company_id, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_challenges TO authenticated;
GRANT ALL ON public.daily_challenges TO service_role;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees read active company challenges" ON public.daily_challenges FOR SELECT TO authenticated USING (active = true AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Admins manage all challenges" ON public.daily_challenges FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins manage own challenges" ON public.daily_challenges FOR ALL TO authenticated USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid())) WITH CHECK (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

CREATE TRIGGER trg_daily_challenges_updated_at
BEFORE UPDATE ON public.daily_challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. DAILY CHALLENGE ASSIGNMENTS
CREATE TABLE public.daily_challenge_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  assigned_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, assigned_date)
);
CREATE INDEX idx_dca_company_date ON public.daily_challenge_assignments(company_id, assigned_date DESC);
GRANT SELECT ON public.daily_challenge_assignments TO authenticated;
GRANT ALL ON public.daily_challenge_assignments TO service_role;
ALTER TABLE public.daily_challenge_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees read company assignments" ON public.daily_challenge_assignments FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Admins manage assignments" ON public.daily_challenge_assignments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins manage own assignments" ON public.daily_challenge_assignments FOR ALL TO authenticated USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid())) WITH CHECK (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- 6. DAILY CHALLENGE COMPLETIONS
CREATE TABLE public.daily_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES public.daily_challenge_assignments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, assignment_id)
);
CREATE INDEX idx_dcc_user ON public.daily_challenge_completions(user_id, completed_at DESC);
CREATE INDEX idx_dcc_company ON public.daily_challenge_completions(company_id, completed_at DESC);
GRANT SELECT, INSERT ON public.daily_challenge_completions TO authenticated;
GRANT ALL ON public.daily_challenge_completions TO service_role;
ALTER TABLE public.daily_challenge_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own completions" ON public.daily_challenge_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own completions" ON public.daily_challenge_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all completions" ON public.daily_challenge_completions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view company completions" ON public.daily_challenge_completions FOR SELECT TO authenticated USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- 7. FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_effective_levels(_company_id uuid)
RETURNS TABLE (level_number integer, name text, emoji text, min_points integer, bonus_points integer, badge_title text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _has_custom boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.levels WHERE company_id = _company_id) INTO _has_custom;
  IF _has_custom THEN
    RETURN QUERY SELECT l.level_number, l.name, l.emoji, l.min_points, l.bonus_points, l.badge_title
                 FROM public.levels l WHERE l.company_id = _company_id ORDER BY l.level_number;
  ELSE
    RETURN QUERY SELECT l.level_number, l.name, l.emoji, l.min_points, l.bonus_points, l.badge_title
                 FROM public.levels l WHERE l.company_id IS NULL ORDER BY l.level_number;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_effective_levels(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_user_level(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _company_id uuid;
  _points integer;
  _current_level integer;
  _target record;
  _final record;
BEGIN
  SELECT company_id, points INTO _company_id, _points FROM public.profiles WHERE user_id = _user_id;

  INSERT INTO public.user_level_progress (user_id, company_id, current_level)
  VALUES (_user_id, _company_id, 1)
  ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

  SELECT current_level INTO _current_level FROM public.user_level_progress WHERE user_id = _user_id;

  FOR _target IN
    SELECT * FROM public.get_effective_levels(_company_id)
    WHERE level_number > _current_level AND min_points <= _points
    ORDER BY level_number ASC
  LOOP
    IF _target.bonus_points > 0 THEN
      UPDATE public.profiles SET points = points + _target.bonus_points WHERE user_id = _user_id;
      INSERT INTO public.points_ledger (user_id, company_id, points, source, description)
      VALUES (_user_id, _company_id, _target.bonus_points, 'level_bonus',
              'Bônus por atingir nível ' || _target.level_number || ' — ' || _target.name);
    END IF;

    UPDATE public.user_level_progress
    SET current_level = _target.level_number,
        reached_at = now(),
        updated_at = now(),
        total_bonus_paid = total_bonus_paid + _target.bonus_points,
        badges = badges || jsonb_build_object(
          'level', _target.level_number, 'name', _target.name, 'emoji', _target.emoji,
          'title', _target.badge_title, 'earned_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'))
    WHERE user_id = _user_id;
  END LOOP;

  SELECT * INTO _final FROM public.get_effective_levels(_company_id)
  WHERE min_points <= (SELECT points FROM public.profiles WHERE user_id = _user_id)
  ORDER BY level_number DESC LIMIT 1;
  IF _final.name IS NOT NULL THEN
    UPDATE public.profiles SET level = _final.name WHERE user_id = _user_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_user_level(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_points_to_profile(_user_id uuid, _points integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _company_id uuid;
BEGIN
  UPDATE public.profiles SET points = points + _points WHERE user_id = _user_id RETURNING company_id INTO _company_id;
  INSERT INTO public.points_ledger (user_id, company_id, points, source) VALUES (_user_id, _company_id, _points, 'other');
  PERFORM public.check_user_level(_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _points integer, _source text, _source_id uuid DEFAULT NULL, _description text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _company_id uuid;
BEGIN
  UPDATE public.profiles SET points = points + _points WHERE user_id = _user_id RETURNING company_id INTO _company_id;
  INSERT INTO public.points_ledger (user_id, company_id, points, source, source_id, description)
  VALUES (_user_id, _company_id, _points, _source, _source_id, _description);
  PERFORM public.check_user_level(_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_daily_challenge(_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _assignment_id uuid;
  _challenge_id uuid;
  _pool_size integer;
  _idx integer;
BEGIN
  SELECT id INTO _assignment_id FROM public.daily_challenge_assignments
   WHERE company_id = _company_id AND assigned_date = _today;
  IF _assignment_id IS NOT NULL THEN RETURN _assignment_id; END IF;

  SELECT count(*) INTO _pool_size FROM public.daily_challenges
   WHERE company_id = _company_id AND active = true;
  IF _pool_size = 0 THEN RETURN NULL; END IF;

  _idx := (EXTRACT(EPOCH FROM _today)::bigint / 86400)::integer % _pool_size;

  SELECT id INTO _challenge_id FROM public.daily_challenges
   WHERE company_id = _company_id AND active = true
   ORDER BY sort_order ASC, created_at ASC OFFSET _idx LIMIT 1;

  INSERT INTO public.daily_challenge_assignments (company_id, challenge_id, assigned_date)
  VALUES (_company_id, _challenge_id, _today)
  ON CONFLICT (company_id, assigned_date) DO UPDATE SET challenge_id = EXCLUDED.challenge_id
  RETURNING id INTO _assignment_id;
  RETURN _assignment_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_daily_challenge(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_daily_challenge(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
  _points integer;
  _challenge_id uuid;
  _inserted boolean := false;
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
    PERFORM public.award_points(_user_id, _points, 'daily_challenge', _challenge_id, 'Desafio do dia concluído');
  END IF;
  RETURN jsonb_build_object('points', _points, 'challenge_id', _challenge_id, 'awarded', _inserted);
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_daily_challenge(uuid) TO authenticated;

-- 8. VIEW: company_leaderboard
CREATE OR REPLACE VIEW public.company_leaderboard
WITH (security_invoker = true) AS
SELECT
  p.user_id,
  p.company_id,
  p.full_name,
  p.points AS total_points,
  COALESCE((SELECT SUM(pl.points) FROM public.points_ledger pl
            WHERE pl.user_id = p.user_id
              AND pl.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')), 0) AS month_points,
  ulp.current_level,
  RANK() OVER (PARTITION BY p.company_id ORDER BY p.points DESC) AS rank_total,
  RANK() OVER (PARTITION BY p.company_id ORDER BY COALESCE((
    SELECT SUM(pl.points) FROM public.points_ledger pl
    WHERE pl.user_id = p.user_id
      AND pl.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')), 0) DESC) AS rank_month
FROM public.profiles p
LEFT JOIN public.user_level_progress ulp ON ulp.user_id = p.user_id
WHERE p.company_id IS NOT NULL;

GRANT SELECT ON public.company_leaderboard TO authenticated;
