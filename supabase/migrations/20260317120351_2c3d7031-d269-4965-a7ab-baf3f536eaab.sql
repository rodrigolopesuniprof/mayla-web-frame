
-- Enum types
CREATE TYPE public.consultation_flow_type AS ENUM ('scheduled', 'on_demand');
CREATE TYPE public.consultation_professional_type AS ENUM ('doctor', 'nurse');
CREATE TYPE public.consultation_status AS ENUM (
  'pending', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'
);

-- Consultations table
CREATE TABLE public.consultations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  professional_id uuid NOT NULL REFERENCES public.partners(id),
  professional_type consultation_professional_type NOT NULL DEFAULT 'doctor',
  specialty text,
  consultation_mode text NOT NULL DEFAULT 'online',
  consultation_flow_type consultation_flow_type NOT NULL DEFAULT 'scheduled',
  status consultation_status NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  jitsi_room_name text GENERATED ALWAYS AS ('mayla-consulta-' || id::text) STORED,
  join_window_starts_at timestamptz,
  call_duration_seconds integer,
  queue_position integer,
  triage_notes text,
  municipality_id uuid REFERENCES public.municipalities(id),
  company_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- RLS: users see own consultations
CREATE POLICY "Users can view own consultations"
  ON public.consultations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consultations"
  ON public.consultations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consultations"
  ON public.consultations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: admins full access
CREATE POLICY "Admins can manage consultations"
  ON public.consultations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER trg_consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Professional online status table
CREATE TABLE public.professional_online_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE UNIQUE,
  online_now boolean NOT NULL DEFAULT false,
  accepts_on_demand boolean NOT NULL DEFAULT false,
  max_parallel_waiting integer NOT NULL DEFAULT 3,
  estimated_response_minutes integer NOT NULL DEFAULT 15,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_online_status ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated can view online professionals
CREATE POLICY "Authenticated can view online status"
  ON public.professional_online_status FOR SELECT TO authenticated
  USING (true);

-- RLS: admins full access
CREATE POLICY "Admins can manage online status"
  ON public.professional_online_status FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_professional_online_status_updated_at
  BEFORE UPDATE ON public.professional_online_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for consultations (for queue updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
