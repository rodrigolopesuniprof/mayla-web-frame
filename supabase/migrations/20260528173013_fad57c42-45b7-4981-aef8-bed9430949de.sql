
-- 1. Medications: reminder & start_date
ALTER TABLE public.user_medications
  ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- 2. Profiles: gender_other_text + points_tour_completed
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender_other_text TEXT,
  ADD COLUMN IF NOT EXISTS points_tour_completed BOOLEAN NOT NULL DEFAULT false;

-- 3. Self-assessment questions (admin-editable)
CREATE TABLE IF NOT EXISTS public.self_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  qtype TEXT NOT NULL DEFAULT 'single' CHECK (qtype IN ('single','multi','scale','text')),
  options JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.self_assessment_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.self_assessment_questions TO authenticated;
GRANT ALL ON public.self_assessment_questions TO service_role;

ALTER TABLE public.self_assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active questions"
  ON public.self_assessment_questions FOR SELECT
  USING (active = true OR public.is_company_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins manage questions"
  ON public.self_assessment_questions FOR ALL
  USING (public.is_company_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.is_company_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_sa_questions_updated_at
  BEFORE UPDATE ON public.self_assessment_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Self-assessment responses
CREATE TABLE IF NOT EXISTS public.self_assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.self_assessment_responses TO authenticated;
GRANT ALL ON public.self_assessment_responses TO service_role;

ALTER TABLE public.self_assessment_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own responses"
  ON public.self_assessment_responses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view responses"
  ON public.self_assessment_responses FOR SELECT
  USING (public.is_company_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_sa_responses_updated_at
  BEFORE UPDATE ON public.self_assessment_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Award trigger for self-assessment
CREATE OR REPLACE FUNCTION public.award_self_assessment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_event(NEW.user_id, 'self_assessment', NEW.id, 'Autoavaliação concluída', NEW.company_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_self_assessment
  AFTER INSERT ON public.self_assessment_responses
  FOR EACH ROW EXECUTE FUNCTION public.award_self_assessment_points();

-- 6. Rename event_key health_survey_complete -> self_assessment
UPDATE public.point_rules
SET event_key = 'self_assessment',
    label = 'Autoavaliação concluída',
    description = 'Pontos por completar a autoavaliação inicial',
    emoji = '🩺'
WHERE event_key = 'health_survey_complete';

-- 7. Rename label of support_team_link
UPDATE public.point_rules
SET label = 'Adesão a time',
    description = 'Pontos por aderir a um time colaborativo'
WHERE event_key = 'support_team_link';

-- 8. Update seed function with new event key
CREATE OR REPLACE FUNCTION public.seed_default_point_rules(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    (_company_id, 'support_team_link',    'Adesão a time',               'Pontos por aderir a um time colaborativo', '🤝', 500, NULL, 1),
    (_company_id, 'survey_complete',      'Pesquisa respondida',         'Pontos por responder pesquisa/questionário', '📋', 100, 5, NULL),
    (_company_id, 'medication_adherence', 'Adesão a medicamento',        'Pontos por check-in diário de medicamento', '💊', 100, 7, NULL),
    (_company_id, 'self_assessment',      'Autoavaliação concluída',     'Pontos por completar a autoavaliação inicial', '🩺', 200, NULL, 1)
  ON CONFLICT (company_id, event_key) DO NOTHING;
END;
$function$;

-- 9. Default global self-assessment questions (company_id = NULL)
INSERT INTO public.self_assessment_questions (company_id, sort_order, question, qtype, options) VALUES
  (NULL, 1,  'Como você avalia seu nível de estresse atual?', 'scale', '[{"value":1,"label":"Muito baixo"},{"value":5,"label":"Muito alto"}]'::jsonb),
  (NULL, 2,  'Quantas horas você dorme por noite, em média?', 'single', '["Menos de 5h","5-6h","7-8h","Mais de 8h"]'::jsonb),
  (NULL, 3,  'Com que frequência você pratica atividade física?', 'single', '["Nunca","1-2x por semana","3-4x por semana","5+ por semana"]'::jsonb),
  (NULL, 4,  'Como está sua alimentação?', 'single', '["Ruim","Regular","Boa","Excelente"]'::jsonb),
  (NULL, 5,  'Você fuma?', 'single', '["Não","Ocasionalmente","Diariamente"]'::jsonb),
  (NULL, 6,  'Com que frequência consome bebida alcoólica?', 'single', '["Nunca","Socialmente","Frequentemente","Diariamente"]'::jsonb),
  (NULL, 7,  'Você tem alguma condição de saúde crônica?', 'multi', '["Hipertensão","Diabetes","Colesterol alto","Ansiedade/Depressão","Outras","Nenhuma"]'::jsonb),
  (NULL, 8,  'Como avalia sua saúde mental atualmente?', 'scale', '[{"value":1,"label":"Muito ruim"},{"value":5,"label":"Excelente"}]'::jsonb)
ON CONFLICT DO NOTHING;
