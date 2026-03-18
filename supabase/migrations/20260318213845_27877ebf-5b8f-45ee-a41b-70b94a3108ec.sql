-- Permitir visualização pública
CREATE POLICY "Anyone can view company logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

-- Admins podem fazer upload
CREATE POLICY "Admins can upload company logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins podem atualizar (upsert)
CREATE POLICY "Admins can update company logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'company-logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins podem deletar
CREATE POLICY "Admins can delete company logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'company-logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));