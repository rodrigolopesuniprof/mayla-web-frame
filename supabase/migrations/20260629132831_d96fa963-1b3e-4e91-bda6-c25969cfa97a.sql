
-- Remove the security-definer view (linter error) and use column-level privileges instead
DROP VIEW IF EXISTS public.companies_public;

-- Re-add anon SELECT but revoke sensitive columns
CREATE POLICY "Anyone can view companies"
ON public.companies
FOR SELECT
TO anon
USING (true);

REVOKE SELECT ON public.companies FROM anon;
GRANT SELECT (
  id, name, slug, industry, employee_count, plan_type, logo_url,
  wellbeing_program_name, telemedicine_url, rppg_url,
  primary_color, accent_color, background_color, foreground_color, secondary_color,
  created_at, updated_at, state, cnae
) ON public.companies TO anon;
