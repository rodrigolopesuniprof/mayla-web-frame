
-- Allow professionals to read their linked prontuario_connections
CREATE POLICY "Professionals can view linked connections"
ON public.prontuario_connections
FOR SELECT
TO authenticated
USING (
  active = true
  AND internal_partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid()
  )
);
