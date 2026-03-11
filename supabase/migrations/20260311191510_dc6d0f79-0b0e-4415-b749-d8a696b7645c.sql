
-- Helper functions for corporate role checks
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('company_admin'::app_role, 'admin'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_hr_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'hr_manager'::app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_wellbeing_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'wellbeing_manager'::app_role
  )
$$;

-- Aggregated health view (HR sees ONLY aggregated data, never individual records)
CREATE OR REPLACE VIEW public.company_health_summary AS
SELECT 
  p.company_id,
  count(DISTINCT hm.user_id) as active_users,
  round(avg(hm.heart_rate)::numeric, 1) as avg_heart_rate,
  round(avg(hm.stress_level)::numeric, 1) as avg_stress_level,
  round(avg(hm.spo2)::numeric, 1) as avg_spo2,
  date_trunc('week', hm.measured_at) as week
FROM health_measurements hm
JOIN profiles p ON p.user_id = hm.user_id
WHERE p.company_id IS NOT NULL
GROUP BY p.company_id, date_trunc('week', hm.measured_at);

-- RLS: company_admin can view company profiles
CREATE POLICY "Company admins can view company profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: company_admin can update company profiles (non-health fields)
CREATE POLICY "Company admins can update company profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: hr_manager can view company profiles (for aggregated metrics)
CREATE POLICY "HR managers can view company profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_hr_manager(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: wellbeing_manager can view company profiles
CREATE POLICY "Wellbeing managers can view company profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_wellbeing_manager(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: company_admin can update company settings
CREATE POLICY "Company admins can update own company"
ON public.companies FOR UPDATE TO authenticated
USING (is_company_admin(auth.uid()) AND id = get_user_company_id(auth.uid()));

-- RLS: company_admin can manage support_teams in their company
CREATE POLICY "Company admins can manage support teams"
ON public.support_teams FOR ALL TO authenticated
USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
WITH CHECK (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: company_admin can manage company_locations
CREATE POLICY "Company admins can manage locations"
ON public.company_locations FOR ALL TO authenticated
USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
WITH CHECK (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: wellbeing_manager can manage notifications for their company
CREATE POLICY "Wellbeing managers can manage company notifications"
ON public.notifications FOR ALL TO authenticated
USING (is_wellbeing_manager(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
WITH CHECK (is_wellbeing_manager(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: company_admin can view company appointments
CREATE POLICY "Company admins can view company appointments"
ON public.appointments FOR SELECT TO authenticated
USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- RLS: Users can view notifications for their company
CREATE POLICY "Users can view company notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  active = true 
  AND (expires_at IS NULL OR expires_at > now()) 
  AND scope = 'company' 
  AND target_user_id IS NULL 
  AND company_id = get_user_company_id(auth.uid())
);
