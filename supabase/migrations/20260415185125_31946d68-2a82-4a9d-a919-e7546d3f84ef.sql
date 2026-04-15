
CREATE POLICY "Professionals can view linked patient health_scores"
ON public.health_scores FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT pc.user_id FROM prontuario_connections pc
    WHERE pc.active = true
    AND pc.internal_partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Professionals can view linked patient health_alerts"
ON public.health_alerts FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT pc.user_id FROM prontuario_connections pc
    WHERE pc.active = true
    AND pc.internal_partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Professionals can view linked patient health_measurements"
ON public.health_measurements FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT pc.user_id FROM prontuario_connections pc
    WHERE pc.active = true
    AND pc.internal_partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Professionals can view linked patient special_measurements"
ON public.special_measurements FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT pc.user_id FROM prontuario_connections pc
    WHERE pc.active = true
    AND pc.internal_partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  )
);
