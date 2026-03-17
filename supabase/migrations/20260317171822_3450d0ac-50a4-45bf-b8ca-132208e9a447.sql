
-- Add missing columns to health_measurements
ALTER TABLE public.health_measurements 
  ADD COLUMN IF NOT EXISTS hrv integer,
  ADD COLUMN IF NOT EXISTS glucose_estimated numeric,
  ADD COLUMN IF NOT EXISTS fatigue_score integer,
  ADD COLUMN IF NOT EXISTS sleep_duration_min integer,
  ADD COLUMN IF NOT EXISTS sleep_quality_score integer,
  ADD COLUMN IF NOT EXISTS steps integer,
  ADD COLUMN IF NOT EXISTS active_minutes integer;

-- health_scores table
CREATE TABLE public.health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  score_general integer NOT NULL DEFAULT 0,
  score_physiological integer NOT NULL DEFAULT 0,
  score_emotional integer NOT NULL DEFAULT 0,
  score_lifestyle integer NOT NULL DEFAULT 0,
  recommendation_level integer NOT NULL DEFAULT 1,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores" ON public.health_scores
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores" ON public.health_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all scores" ON public.health_scores
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- health_alerts table
CREATE TABLE public.health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  metric text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  description text NOT NULL,
  detail text,
  days_triggered integer DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);

ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON public.health_alerts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts" ON public.health_alerts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all alerts" ON public.health_alerts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- report_shares table
CREATE TABLE public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  professional_id uuid,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accessed_at timestamptz
);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own shares" ON public.report_shares
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own shares" ON public.report_shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Anon can read shares by token" ON public.report_shares
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update accessed_at" ON public.report_shares
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- clinical_notes table
CREATE TABLE public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  professional_id uuid,
  consultation_id uuid,
  conditions_active jsonb DEFAULT '[]'::jsonb,
  medications jsonb DEFAULT '[]'::jsonb,
  note_text text,
  referrals jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage clinical notes" ON public.clinical_notes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can insert clinical notes" ON public.clinical_notes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can view clinical notes" ON public.clinical_notes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update clinical notes" ON public.clinical_notes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
