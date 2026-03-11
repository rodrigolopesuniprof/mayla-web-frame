
-- Create storage bucket for municipality logos
INSERT INTO storage.buckets (id, name, public) VALUES ('municipality-logos', 'municipality-logos', true);

-- Allow authenticated users to view logos
CREATE POLICY "Anyone can view municipality logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'municipality-logos');

-- Only admins can upload logos
CREATE POLICY "Admins can upload municipality logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'municipality-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update municipality logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'municipality-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete municipality logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'municipality-logos' AND public.has_role(auth.uid(), 'admin'));
