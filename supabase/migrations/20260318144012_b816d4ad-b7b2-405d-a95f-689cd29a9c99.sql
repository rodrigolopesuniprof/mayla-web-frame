
-- 1. user_medications table
CREATE TABLE public.user_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  dosage text,
  frequency text NOT NULL DEFAULT 'daily',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own medications" ON public.user_medications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. medication_logs table
CREATE TABLE public.medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL REFERENCES public.user_medications(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  points_awarded integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own medication logs" ON public.medication_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. consultation_documents table
CREATE TABLE public.consultation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  content text,
  file_url text,
  sent_to_email boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consultation_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage own documents" ON public.consultation_documents
  FOR ALL TO authenticated
  USING (professional_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()))
  WITH CHECK (professional_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own documents" ON public.consultation_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. Enable realtime for report_shares
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_shares;

-- 5. RLS for professionals managing own doctor_availability
CREATE POLICY "Professionals can manage own availability" ON public.doctor_availability
  FOR ALL TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()))
  WITH CHECK (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

-- 6. Trigger to award points on medication log
CREATE OR REPLACE FUNCTION public.award_medication_points()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + NEW.points_awarded
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_medication_log_insert
  AFTER INSERT ON public.medication_logs
  FOR EACH ROW EXECUTE FUNCTION public.award_medication_points();
