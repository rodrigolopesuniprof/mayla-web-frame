ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_zip_code text,
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_number text,
  ADD COLUMN IF NOT EXISTS billing_complement text,
  ADD COLUMN IF NOT EXISTS billing_neighborhood text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_state text,
  ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS customer_phone text;

ALTER TABLE public.pending_signups
  ADD COLUMN IF NOT EXISTS billing_zip_code text,
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_number text,
  ADD COLUMN IF NOT EXISTS billing_complement text,
  ADD COLUMN IF NOT EXISTS billing_neighborhood text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_state text,
  ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS customer_phone text;