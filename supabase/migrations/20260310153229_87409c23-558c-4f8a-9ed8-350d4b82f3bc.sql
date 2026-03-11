
-- Add health survey fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS biological_sex text,
  ADD COLUMN IF NOT EXISTS is_pregnant text,
  ADD COLUMN IF NOT EXISTS prenatal_started boolean,
  ADD COLUMN IF NOT EXISTS has_hypertension boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_diabetes boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lives_with_infant boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bolsa_familia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_dental_visit text,
  ADD COLUMN IF NOT EXISTS prenatal_dental_done boolean,
  ADD COLUMN IF NOT EXISTS last_acs_visit boolean,
  ADD COLUMN IF NOT EXISTS health_survey_completed boolean DEFAULT false;

-- Missions table (static definitions)
CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL,
  title text NOT NULL,
  description text,
  emoji text DEFAULT '🎯',
  points integer DEFAULT 0,
  frequency text DEFAULT 'monthly',
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Everyone can read active missions
CREATE POLICY "Anyone can view active missions"
  ON public.missions FOR SELECT TO authenticated
  USING (active = true);

-- Admins can manage missions
CREATE POLICY "Admins can manage missions"
  ON public.missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User missions table (per-user tracking)
CREATE TABLE public.user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending',
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- Users can view their own missions
CREATE POLICY "Users can view own missions"
  ON public.user_missions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own missions
CREATE POLICY "Users can update own missions"
  ON public.user_missions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own missions
CREATE POLICY "Users can insert own missions"
  ON public.user_missions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all user missions
CREATE POLICY "Admins can manage user missions"
  ON public.user_missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
