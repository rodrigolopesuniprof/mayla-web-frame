
-- Table for linking Mayla users to external EMR professionals
CREATE TABLE public.prontuario_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  external_system text NOT NULL DEFAULT 'meddit',
  external_professional_id text NOT NULL,
  external_professional_name text,
  external_patient_id text,
  external_clinic_name text,
  report_token uuid NOT NULL DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_system, external_professional_id)
);

-- Enable RLS
ALTER TABLE public.prontuario_connections ENABLE ROW LEVEL SECURITY;

-- Users can manage their own connections
CREATE POLICY "Users can view own connections"
  ON public.prontuario_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own connections"
  ON public.prontuario_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON public.prontuario_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON public.prontuario_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage prontuario connections"
  ON public.prontuario_connections FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anon can SELECT by token (for prontuario-verify edge function)
CREATE POLICY "Anon can verify by token"
  ON public.prontuario_connections FOR SELECT
  TO anon
  USING (active = true);

-- Timestamp trigger
CREATE TRIGGER update_prontuario_connections_updated_at
  BEFORE UPDATE ON public.prontuario_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
