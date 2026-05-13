
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.subscription_plans sp
SET company_id = sub.company_id
FROM (
  SELECT DISTINCT ON (plan_id) plan_id, company_id
  FROM public.company_plan_assignments
  WHERE active = true
  ORDER BY plan_id, created_at ASC
) sub
WHERE sp.id = sub.plan_id AND sp.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_company_active ON public.subscription_plans(company_id, active);
