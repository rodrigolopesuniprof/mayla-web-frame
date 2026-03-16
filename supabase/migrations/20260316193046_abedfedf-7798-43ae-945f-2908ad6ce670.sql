
-- Enums
CREATE TYPE public.partner_type AS ENUM ('doctor','clinic','gym','laboratory','pharmacy');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','blocked');

-- Main partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_type public.partner_type NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  description text,
  city text,
  state text DEFAULT 'ES',
  full_address text,
  zip_code text,
  latitude numeric,
  longitude numeric,
  active boolean DEFAULT false,
  approval_status public.approval_status DEFAULT 'pending',
  logo_url text,
  opening_hours jsonb DEFAULT '{}',
  services_offered jsonb DEFAULT '[]',
  accepted_payments jsonb DEFAULT '[]',
  contact_link text,
  -- Doctor-specific
  crm text,
  crm_state text,
  specialty text,
  sub_specialty text,
  consultation_type text,
  consultation_price numeric,
  notification_email text,
  online_consultation_enabled boolean DEFAULT false,
  -- Clinic
  specialties_offered jsonb,
  booking_link text,
  service_mode text,
  -- Gym
  wellness_activities jsonb,
  is_partner_gym boolean DEFAULT false,
  -- Laboratory
  exam_types jsonb,
  collection_methods jsonb,
  appointment_only boolean DEFAULT false,
  scheduling_link text,
  -- Pharmacy
  delivery_available boolean DEFAULT false,
  service_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partner locations
CREATE TABLE public.partner_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  location_name text,
  full_address text,
  city text,
  state text,
  zip_code text,
  latitude numeric,
  longitude numeric,
  is_main boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Doctor availability
CREATE TABLE public.doctor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  weekday integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  consultation_mode text DEFAULT 'both',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Doctor-Clinic links
CREATE TABLE public.partner_doctor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  clinic_id uuid REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(doctor_id, clinic_id)
);

-- Trigger for updated_at on partners
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_doctor_links ENABLE ROW LEVEL SECURITY;

-- Partners RLS
CREATE POLICY "Admins can manage partners" ON public.partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view approved partners" ON public.partners FOR SELECT TO authenticated
  USING (active = true AND approval_status = 'approved');

CREATE POLICY "Anon can self-register partners" ON public.partners FOR INSERT TO anon
  WITH CHECK (approval_status = 'pending' AND active = false);

-- Partner locations RLS
CREATE POLICY "Admins can manage partner locations" ON public.partner_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view partner locations" ON public.partner_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND p.active = true AND p.approval_status = 'approved'));

-- Doctor availability RLS
CREATE POLICY "Admins can manage doctor availability" ON public.doctor_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view doctor availability" ON public.doctor_availability FOR SELECT TO authenticated
  USING (is_active = true AND EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND p.active = true AND p.approval_status = 'approved'));

-- Partner doctor links RLS
CREATE POLICY "Admins can manage partner doctor links" ON public.partner_doctor_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view partner doctor links" ON public.partner_doctor_links FOR SELECT TO authenticated
  USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view partner logos" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'partner-logos');

CREATE POLICY "Admins can upload partner logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anon can upload partner logos" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'partner-logos');

CREATE POLICY "Admins can delete partner logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'partner-logos' AND public.has_role(auth.uid(), 'admin'));
