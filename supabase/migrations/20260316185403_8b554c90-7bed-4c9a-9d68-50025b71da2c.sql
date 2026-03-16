
-- Create questionnaires table
CREATE TABLE public.questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage questionnaires" ON public.questionnaires
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view questionnaires" ON public.questionnaires
  FOR SELECT TO authenticated
  USING (true);

-- Create questionnaire_questions table
CREATE TABLE public.questionnaire_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid REFERENCES public.questionnaires(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  question_text text NOT NULL,
  options jsonb DEFAULT '[{"emoji":"😢","label":"Muito ruim"},{"emoji":"😕","label":"Ruim"},{"emoji":"😐","label":"Regular"},{"emoji":"🙂","label":"Bom"},{"emoji":"😄","label":"Muito bom"}]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage questions" ON public.questionnaire_questions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view questions" ON public.questionnaire_questions
  FOR SELECT TO authenticated
  USING (true);

-- Create questionnaire_responses table
CREATE TABLE public.questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid REFERENCES public.questionnaires(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  user_mission_id uuid REFERENCES public.user_missions(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all responses" ON public.questionnaire_responses
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own responses" ON public.questionnaire_responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own responses" ON public.questionnaire_responses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Add questionnaire_id to missions
ALTER TABLE public.missions ADD COLUMN questionnaire_id uuid REFERENCES public.questionnaires(id);
