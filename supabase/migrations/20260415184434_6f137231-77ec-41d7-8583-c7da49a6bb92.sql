CREATE POLICY "Professionals can view linked patient profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT pc.user_id FROM prontuario_connections pc
    WHERE pc.active = true
    AND pc.internal_partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  )
);