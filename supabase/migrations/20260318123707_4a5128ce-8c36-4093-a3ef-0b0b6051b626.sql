CREATE POLICY "Professionals can view their shares" ON public.report_shares
  FOR SELECT TO authenticated
  USING (professional_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));