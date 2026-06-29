
-- 1) companies: drop anon SELECT, expose safe columns via view
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;

CREATE OR REPLACE VIEW public.companies_public
WITH (security_invoker = on) AS
SELECT id, name, slug, industry, employee_count, plan_type, logo_url,
       wellbeing_program_name, telemedicine_url, rppg_url,
       primary_color, accent_color, background_color, foreground_color, secondary_color,
       created_at, updated_at, state, cnae
FROM public.companies;

GRANT SELECT ON public.companies_public TO anon, authenticated;

-- Allow the view (security_invoker) to read base table even though anon SELECT policy was dropped.
-- Re-add a permissive policy that only the view will use indirectly is not possible with security_invoker.
-- Switch to security definer view instead:
ALTER VIEW public.companies_public SET (security_invoker = off);

-- 2) partner-logos: drop unrestricted anon upload policy
DROP POLICY IF EXISTS "Anon can upload partner logos" ON storage.objects;

-- 3) appointment_reminders: allow users to read their own
CREATE POLICY "Users can view own appointment reminders"
ON public.appointment_reminders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_reminders.appointment_id
      AND a.user_id = auth.uid()
  )
);

-- 4) clinical_notes: allow patient (owner) to read own notes
CREATE POLICY "Users can view own clinical notes"
ON public.clinical_notes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5) wellbeing_checkins: company admins and wellbeing managers can read company data
CREATE POLICY "Company admins can view company checkins"
ON public.wellbeing_checkins
FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (
    public.is_company_admin(auth.uid())
    OR public.is_hr_manager(auth.uid())
    OR public.is_wellbeing_manager(auth.uid())
  )
);

-- 6) validation-photos bucket is now private; ensure SELECT policy restricts to owner/admin
-- (existing "Users can view own validation photos" already enforces folder = uid())
