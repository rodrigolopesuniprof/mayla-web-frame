CREATE POLICY "Anon can self-register partner locations"
ON public.partner_locations
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.partners p
    WHERE p.id = partner_locations.partner_id
      AND p.approval_status = 'pending'::approval_status
      AND p.active = false
  )
);

CREATE POLICY "Authenticated can self-register partner locations"
ON public.partner_locations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.partners p
    WHERE p.id = partner_locations.partner_id
      AND p.approval_status = 'pending'::approval_status
      AND p.active = false
  )
);