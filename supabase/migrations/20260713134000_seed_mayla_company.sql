-- Required company for users provisioned through the Mayla external auth flow.

INSERT INTO public.companies (
  name,
  slug,
  industry,
  plan_type,
  wellbeing_program_name,
  state
)
VALUES (
  'Mayla',
  'mayla',
  'Saúde',
  'basic',
  'Programa Mayla',
  'ES'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.company_payment_credentials (
  company_id,
  enabled,
  require_paid_subscription
)
SELECT
  id,
  false,
  false
FROM public.companies
WHERE slug = 'mayla'
ON CONFLICT (company_id) DO UPDATE
SET require_paid_subscription = false;
