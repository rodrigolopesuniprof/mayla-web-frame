
-- Admin can view all health_measurements
CREATE POLICY "Admins can view all measurements"
ON public.health_measurements FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all user_missions  
CREATE POLICY "Admins can view all user missions"
ON public.user_missions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
