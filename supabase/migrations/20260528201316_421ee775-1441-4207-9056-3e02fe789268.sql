
-- Create app-branding bucket for global favicon + social share image
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-branding', 'app-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "App branding is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-branding');

-- Only super admins can write
CREATE POLICY "Super admins can upload app branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-branding' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can update app branding"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'app-branding' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can delete app branding"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'app-branding' AND public.has_role(auth.uid(), 'admin'::app_role));
