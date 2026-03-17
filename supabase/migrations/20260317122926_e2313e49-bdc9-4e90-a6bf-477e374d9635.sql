-- Add user_id to partners for professional login
ALTER TABLE public.partners ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- RLS: professionals can view consultations assigned to them
CREATE POLICY "Professionals can view assigned consultations"
ON public.consultations FOR SELECT TO authenticated
USING (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));

-- RLS: professionals can update assigned consultations
CREATE POLICY "Professionals can update assigned consultations"
ON public.consultations FOR UPDATE TO authenticated
USING (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));

-- RLS: professionals can select own status
CREATE POLICY "Professionals can select own status"
ON public.professional_online_status FOR SELECT TO authenticated
USING (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));

-- RLS: professionals can update own status
CREATE POLICY "Professionals can update own status"
ON public.professional_online_status FOR UPDATE TO authenticated
USING (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
))
WITH CHECK (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));

-- RLS: professionals can insert own status
CREATE POLICY "Professionals can insert own status"
ON public.professional_online_status FOR INSERT TO authenticated
WITH CHECK (professional_id IN (
  SELECT id FROM public.partners WHERE user_id = auth.uid()
));