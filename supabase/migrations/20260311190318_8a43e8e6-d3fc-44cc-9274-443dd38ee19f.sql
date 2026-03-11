
-- 1. Create companies table (replaces municipalities)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  cnpj text,
  industry text,
  employee_count integer,
  plan_type text DEFAULT 'basic',
  logo_url text,
  hr_contact_email text,
  wellbeing_program_name text DEFAULT 'Programa de Bem-estar',
  telemedicine_url text,
  rppg_url text DEFAULT 'https://rppg.saudecomvc.com.br/login',
  primary_color text NOT NULL DEFAULT '204 67% 32%',
  accent_color text NOT NULL DEFAULT '5 75% 60%',
  background_color text NOT NULL DEFAULT '30 50% 96%',
  foreground_color text NOT NULL DEFAULT '16 30% 13%',
  secondary_color text NOT NULL DEFAULT '30 25% 89%',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create company_locations table (replaces health_units)
CREATE TABLE public.company_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  qr_code text NOT NULL,
  cnes_code text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create support_teams table (replaces esf_teams)
CREATE TABLE public.support_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  qr_code text NOT NULL UNIQUE,
  address text,
  latitude numeric,
  longitude numeric,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. Create company_features table (replaces municipality_features)
CREATE TABLE public.company_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  enabled boolean DEFAULT false,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 5. Add corporate columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS support_team_id uuid REFERENCES public.support_teams(id),
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS job_title text;

-- 6. Add company_id to related tables
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

ALTER TABLE public.specialties
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

ALTER TABLE public.special_measurements
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 7. Helper function: get_user_company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- 8. Trigger: award points when support_team_id linked
CREATE OR REPLACE FUNCTION public.award_support_team_link_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.support_team_id IS NULL AND NEW.support_team_id IS NOT NULL THEN
    NEW.points = OLD.points + 500;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_support_team_link_points
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.award_support_team_link_points();

-- 9. Update handle_new_user to also set company_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cpf, municipality_id, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'cpf',
    CASE 
      WHEN NEW.raw_user_meta_data->>'municipality_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'municipality_id')::uuid 
      ELSE NULL 
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'company_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'company_id')::uuid 
      ELSE NULL 
    END
  );
  RETURN NEW;
END;
$$;

-- 10. RLS for companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view companies" ON public.companies
  FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated can view companies" ON public.companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage companies" ON public.companies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 11. RLS for company_locations
ALTER TABLE public.company_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active locations" ON public.company_locations
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Admins can manage locations" ON public.company_locations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 12. RLS for support_teams
ALTER TABLE public.support_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active support teams" ON public.support_teams
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Admins can manage support teams" ON public.support_teams
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view company support teams" ON public.support_teams
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company_id(auth.uid()));

-- 13. RLS for company_features
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company features" ON public.company_features
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage company features" ON public.company_features
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 14. Updated_at trigger for companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;
