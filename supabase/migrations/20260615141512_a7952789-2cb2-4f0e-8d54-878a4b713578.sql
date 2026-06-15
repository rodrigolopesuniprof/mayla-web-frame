-- 1. company_features: remover SELECT permissivo, escopar por empresa
DROP POLICY IF EXISTS "Authenticated can view company features" ON public.company_features;
CREATE POLICY "Users view own company features"
  ON public.company_features
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. company_locations: remover SELECT permissivo, escopar por empresa
DROP POLICY IF EXISTS "Authenticated can view active locations" ON public.company_locations;
CREATE POLICY "Users view active locations of own company"
  ON public.company_locations
  FOR SELECT
  TO authenticated
  USING (
    active = true
    AND (
      company_id = public.get_user_company_id(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 3. municipality_features: remover SELECT permissivo, escopar por município
DROP POLICY IF EXISTS "Authenticated can view features" ON public.municipality_features;
CREATE POLICY "Users view own municipality features"
  ON public.municipality_features
  FOR SELECT
  TO authenticated
  USING (
    municipality_id = public.get_user_municipality_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. doctor_availability: remover INSERT sem restrição.
-- Já existem: "Professionals can manage own availability" (dono do partner) e
-- "Anon can insert doctor availability for pending partners" (auto-cadastro) e admin manage.
DROP POLICY IF EXISTS "Authenticated can insert doctor availability" ON public.doctor_availability;

-- 5. partner_doctor_links: remover INSERT e SELECT sem restrição.
DROP POLICY IF EXISTS "Authenticated can insert partner doctor links" ON public.partner_doctor_links;
DROP POLICY IF EXISTS "Authenticated can view partner doctor links" ON public.partner_doctor_links;

-- Recriar SELECT escopada: dono de qualquer um dos dois partners do vínculo, ou admin
CREATE POLICY "Partner owners view their links"
  ON public.partner_doctor_links
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR clinic_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR doctor_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

-- Permitir INSERT por dono de qualquer um dos partners envolvidos
CREATE POLICY "Partner owners can create links"
  ON public.partner_doctor_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      clinic_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
      AND doctor_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    )
  );

-- 6. Helper estritamente B2B (sem fallback para municipality), para uso futuro.
CREATE OR REPLACE FUNCTION public.get_company_id_strict(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;