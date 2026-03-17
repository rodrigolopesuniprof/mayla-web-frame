
-- Admin full access to professional_online_status
CREATE POLICY "Admins can manage professional status"
ON public.professional_online_status FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
