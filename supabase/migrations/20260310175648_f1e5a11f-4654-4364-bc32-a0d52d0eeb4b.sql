
-- Add validation_type to missions
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS validation_type text DEFAULT 'self_report';
-- Values: 'self_report', 'qr_code', 'photo_proof'

-- Health units table (UBS with QR codes and coordinates)
CREATE TABLE IF NOT EXISTS public.health_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnes_code text,
  qr_code text NOT NULL UNIQUE,
  latitude numeric,
  longitude numeric,
  address text,
  municipality_id uuid REFERENCES public.municipalities(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.health_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active health units"
  ON public.health_units FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage health units"
  ON public.health_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mission validations table (QR scans and photo proofs)
CREATE TABLE IF NOT EXISTS public.mission_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  validation_type text NOT NULL,
  health_unit_id uuid REFERENCES public.health_units(id),
  photo_url text,
  validated_by uuid,
  validated_at timestamptz,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.mission_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own validations"
  ON public.mission_validations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own validations"
  ON public.mission_validations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all validations"
  ON public.mission_validations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for validation photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('validation-photos', 'validation-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload validation photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'validation-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view validation photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'validation-photos');

CREATE POLICY "Admins can delete validation photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'validation-photos' AND public.has_role(auth.uid(), 'admin'));
