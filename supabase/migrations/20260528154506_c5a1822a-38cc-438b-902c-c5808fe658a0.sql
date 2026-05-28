
-- ============== point_rules ==============
CREATE TABLE public.point_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  cap_per_day INTEGER,
  cap_per_week INTEGER,
  cap_per_month INTEGER,
  cap_lifetime INTEGER,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, event_key)
);
CREATE INDEX idx_point_rules_company ON public.point_rules(company_id);

GRANT SELECT ON public.point_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.point_rules TO authenticated;
GRANT ALL ON public.point_rules TO service_role;

ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own company rules" ON public.point_rules
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin write rules" ON public.point_rules
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())));

CREATE TRIGGER trg_point_rules_updated_at BEFORE UPDATE ON public.point_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== rewards ==============
CREATE TABLE public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cost_points INTEGER,
  min_level INTEGER,
  stock INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rewards_company ON public.rewards(company_id);

GRANT SELECT ON public.rewards TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read company rewards" ON public.rewards
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin write rewards" ON public.rewards
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())));

CREATE TRIGGER trg_rewards_updated_at BEFORE UPDATE ON public.rewards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== reward_grants ==============
CREATE TABLE public.reward_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_email_at TIMESTAMPTZ,
  notified_whatsapp_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reward_grants_company ON public.reward_grants(company_id);
CREATE INDEX idx_reward_grants_user ON public.reward_grants(user_id);

GRANT SELECT ON public.reward_grants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reward_grants TO authenticated;
GRANT ALL ON public.reward_grants TO service_role;

ALTER TABLE public.reward_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own grants and admins all" ON public.reward_grants
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())));

CREATE POLICY "admin manage grants" ON public.reward_grants
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())));

-- ============== public_dashboard_tokens ==============
CREATE TABLE public.public_dashboard_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pdt_company ON public.public_dashboard_tokens(company_id);

GRANT SELECT ON public.public_dashboard_tokens TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.public_dashboard_tokens TO authenticated;
GRANT ALL ON public.public_dashboard_tokens TO service_role;

ALTER TABLE public.public_dashboard_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage tokens" ON public.public_dashboard_tokens
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())));

-- ============== seed defaults for existing companies + on create ==============
CREATE OR REPLACE FUNCTION public.seed_default_point_rules(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.point_rules (company_id, event_key, label, description, emoji, points, cap_per_week, cap_lifetime)
  VALUES
    (_company_id, 'avatar_dicebear',      'Personalizar avatar',         'Pontos por criar/atualizar avatar', '🧑‍🎨', 150, NULL, 1),
    (_company_id, 'rppg_measurement',     'Medição rPPG',                'Pontos por concluir medição rápida', '📷', 50,  5,    NULL),
    (_company_id, 'vitals_measurement',   'Medição Vitals completa',     'Pontos por medição especial (PA, hemoglobina, HRV)', '❤️', 100, 3,    NULL),
    (_company_id, 'weekly_checkin',       'Check-in semanal',            'Pontos por responder o check-in da semana', '📝', 50, 1, NULL),
    (_company_id, 'mission_complete',     'Missão concluída',            'Pontos base de missão (a missão pode adicionar)', '🎯', 0, NULL, NULL),
    (_company_id, 'daily_challenge',      'Desafio do dia',              'Pontos por completar desafio diário', '⚡', 0, 7, NULL),
    (_company_id, 'esf_link',             'Vínculo de equipe ESF',       'Pontos por vincular-se à equipe ESF', '🏥', 500, NULL, 1),
    (_company_id, 'support_team_link',    'Vínculo de equipe de apoio',  'Pontos por vincular-se à equipe de apoio', '🤝', 500, NULL, 1),
    (_company_id, 'survey_complete',      'Pesquisa respondida',         'Pontos por responder pesquisa/questionário', '📋', 100, 5, NULL),
    (_company_id, 'medication_adherence', 'Adesão a medicamento',        'Pontos por check-in diário de medicamento', '💊', 100, 7, NULL),
    (_company_id, 'health_survey_complete','Questionário de saúde',      'Pontos por completar questionário inicial de saúde', '🩺', 200, NULL, 1)
  ON CONFLICT (company_id, event_key) DO NOTHING;
END;
$$;

INSERT INTO public.point_rules (company_id, event_key, label, description, emoji, points, cap_per_week, cap_lifetime)
SELECT c.id, x.event_key, x.label, x.description, x.emoji, x.points, x.cap_per_week, x.cap_lifetime
FROM public.companies c
CROSS JOIN (VALUES
  ('avatar_dicebear','Personalizar avatar','Pontos por criar/atualizar avatar','🧑‍🎨',150,NULL::int,1),
  ('rppg_measurement','Medição rPPG','Pontos por concluir medição rápida','📷',50,5,NULL),
  ('vitals_measurement','Medição Vitals completa','Pontos por medição especial (PA, hemoglobina, HRV)','❤️',100,3,NULL),
  ('weekly_checkin','Check-in semanal','Pontos por responder o check-in da semana','📝',50,1,NULL),
  ('mission_complete','Missão concluída','Pontos base de missão (a missão pode adicionar)','🎯',0,NULL,NULL),
  ('daily_challenge','Desafio do dia','Pontos por completar desafio diário','⚡',0,7,NULL),
  ('esf_link','Vínculo de equipe ESF','Pontos por vincular-se à equipe ESF','🏥',500,NULL,1),
  ('support_team_link','Vínculo de equipe de apoio','Pontos por vincular-se à equipe de apoio','🤝',500,NULL,1),
  ('survey_complete','Pesquisa respondida','Pontos por responder pesquisa/questionário','📋',100,5,NULL),
  ('medication_adherence','Adesão a medicamento','Pontos por check-in diário de medicamento','💊',100,7,NULL),
  ('health_survey_complete','Questionário de saúde','Pontos por completar questionário inicial de saúde','🩺',200,NULL,1)
) AS x(event_key,label,description,emoji,points,cap_per_week,cap_lifetime)
ON CONFLICT (company_id, event_key) DO NOTHING;

-- Trigger: seed on company creation
CREATE OR REPLACE FUNCTION public.seed_point_rules_on_company_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_point_rules(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_point_rules_on_company
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_point_rules_on_company_create();

-- ============== award_event ==============
CREATE OR REPLACE FUNCTION public.award_event(
  _user_id UUID,
  _event_key TEXT,
  _source_id UUID DEFAULT NULL,
  _description TEXT DEFAULT NULL,
  _company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid UUID;
  _rule public.point_rules%ROWTYPE;
  _used INTEGER;
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
    RETURN jsonb_build_object('ok', false, 'reason', 'rule_not_found');
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

  IF _rule.points > 0 THEN
    PERFORM public.award_points(_user_id, _rule.points, _event_key, _source_id, COALESCE(_description, _rule.label));
  END IF;

  RETURN jsonb_build_object('ok', true, 'points', _rule.points, 'event_key', _event_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_event(uuid, text, uuid, text, uuid) TO authenticated;

-- ============== get_public_dashboard ==============
CREATE OR REPLACE FUNCTION public.get_public_dashboard(_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid UUID;
  _company RECORD;
  _ranking JSONB;
  _teams JSONB;
  _rewards JSONB;
  _grants JSONB;
  _goals RECORD;
  _week_points INTEGER;
  _month_points INTEGER;
  _tz CONSTANT TEXT := 'America/Sao_Paulo';
BEGIN
  SELECT company_id INTO _cid
    FROM public.public_dashboard_tokens
   WHERE token = _token AND active = true
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;
  IF _cid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  SELECT id, name, logo_url, primary_color INTO _company
    FROM public.companies WHERE id = _cid;

  -- ranking top 50 (anonimizado: primeiro nome + inicial do sobrenome)
  SELECT COALESCE(jsonb_agg(t ORDER BY t.points DESC NULLS LAST), '[]'::jsonb) INTO _ranking
  FROM (
    SELECT
      CASE
        WHEN p.full_name IS NULL OR length(trim(p.full_name)) = 0 THEN 'Colaborador'
        ELSE split_part(trim(p.full_name), ' ', 1) ||
             CASE WHEN array_length(string_to_array(trim(p.full_name), ' '), 1) > 1
                  THEN ' ' || left(split_part(trim(p.full_name), ' ', array_length(string_to_array(trim(p.full_name), ' '), 1)), 1) || '.'
                  ELSE '' END
      END AS name,
      p.avatar_url,
      COALESCE(p.points, 0) AS points,
      p.level
    FROM public.profiles p
    WHERE p.company_id = _cid
    ORDER BY COALESCE(p.points, 0) DESC NULLS LAST
    LIMIT 50
  ) t;

  -- ranking de times
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'team_name', team_name, 'emoji', emoji, 'members', members, 'points', total_points
    ) ORDER BY total_points DESC), '[]'::jsonb) INTO _teams
  FROM (
    SELECT ct.name AS team_name, ct.emoji, count(p.user_id) AS members, COALESCE(sum(p.points), 0) AS total_points
    FROM public.collaborative_teams ct
    LEFT JOIN public.profiles p ON p.team_id = ct.id
    WHERE ct.company_id = _cid
    GROUP BY ct.id, ct.name, ct.emoji
  ) tm;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'title', title, 'description', description, 'image_url', image_url,
      'cost_points', cost_points, 'min_level', min_level
    ) ORDER BY created_at DESC), '[]'::jsonb) INTO _rewards
  FROM public.rewards
  WHERE company_id = _cid AND active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now());

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'reward_title', r.title, 'reward_emoji', '🎁',
      'user_name', CASE WHEN p.full_name IS NULL THEN 'Colaborador'
                        ELSE split_part(trim(p.full_name), ' ', 1) END,
      'granted_at', g.granted_at
    ) ORDER BY g.granted_at DESC), '[]'::jsonb) INTO _grants
  FROM public.reward_grants g
  JOIN public.rewards r ON r.id = g.reward_id
  LEFT JOIN public.profiles p ON p.user_id = g.user_id
  WHERE g.company_id = _cid
  LIMIT 20;

  SELECT * INTO _goals FROM public.get_effective_goals(_cid);

  SELECT COALESCE(sum(pl.points), 0) INTO _week_points
  FROM public.points_ledger pl
  WHERE pl.company_id = _cid
    AND date_trunc('week', (pl.created_at AT TIME ZONE _tz)) = date_trunc('week', (now() AT TIME ZONE _tz));

  SELECT COALESCE(sum(pl.points), 0) INTO _month_points
  FROM public.points_ledger pl
  WHERE pl.company_id = _cid
    AND date_trunc('month', (pl.created_at AT TIME ZONE _tz)) = date_trunc('month', (now() AT TIME ZONE _tz));

  RETURN jsonb_build_object(
    'ok', true,
    'company', jsonb_build_object(
      'name', _company.name,
      'logo_url', _company.logo_url,
      'primary_color', _company.primary_color
    ),
    'ranking', _ranking,
    'teams', _teams,
    'rewards', _rewards,
    'recent_grants', _grants,
    'goals', jsonb_build_object(
      'weekly_goal', COALESCE(_goals.weekly_goal, 0),
      'monthly_goal', COALESCE(_goals.monthly_goal, 0),
      'yearly_goal', COALESCE(_goals.yearly_goal, 0),
      'week_points', _week_points,
      'month_points', _month_points
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_dashboard(uuid) TO anon, authenticated;
