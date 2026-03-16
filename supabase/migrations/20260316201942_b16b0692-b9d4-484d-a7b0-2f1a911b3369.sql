
-- Add virtual_store_url column to partners
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS virtual_store_url text;

-- Add authenticated INSERT policy for self-registration
CREATE POLICY "Authenticated can self-register partners"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (approval_status = 'pending'::approval_status AND active = false);

-- Add anon and authenticated INSERT policy on doctor_availability for registration flow
CREATE POLICY "Anon can insert doctor availability"
ON public.doctor_availability
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Authenticated can insert doctor availability"
ON public.doctor_availability
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add anon and authenticated INSERT on partner_doctor_links for clinic registration
CREATE POLICY "Anon can insert partner doctor links"
ON public.partner_doctor_links
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Authenticated can insert partner doctor links"
ON public.partner_doctor_links
FOR INSERT
TO authenticated
WITH CHECK (true);
