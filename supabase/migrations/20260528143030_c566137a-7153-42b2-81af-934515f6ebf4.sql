
-- 1) affiliates: remove anon/public exposure
DROP POLICY IF EXISTS "Anyone can verify referral by code" ON public.affiliates;

-- 2) clinical_notes: drop anon policies, add SECURITY DEFINER helper for professional notes via share token
DROP POLICY IF EXISTS "Anon can view clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Anon can insert clinical notes" ON public.clinical_notes;
DROP POLICY IF EXISTS "Anon can update clinical notes" ON public.clinical_notes;

CREATE OR REPLACE FUNCTION public.save_clinical_note_via_share(_token text, _note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _share record;
  _id uuid;
BEGIN
  SELECT user_id, expires_at INTO _share FROM public.report_shares WHERE token = _token LIMIT 1;
  IF _share.user_id IS NULL THEN RAISE EXCEPTION 'invalid token'; END IF;
  IF _share.expires_at IS NOT NULL AND _share.expires_at < now() THEN RAISE EXCEPTION 'token expired'; END IF;
  INSERT INTO public.clinical_notes (user_id, note_text)
  VALUES (_share.user_id, _note)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_clinical_note_via_share(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_clinical_note_via_share(text, text) TO anon, authenticated;

-- 3) company_invite_tokens: remove enumeration, add validation RPC
DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.company_invite_tokens;
DROP POLICY IF EXISTS "Authenticated users can validate tokens" ON public.company_invite_tokens;

CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
RETURNS TABLE(company_id uuid, valid boolean, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t public.company_invite_tokens%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.company_invite_tokens WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, 'not_found'::text; RETURN;
  END IF;
  IF NOT t.active THEN
    RETURN QUERY SELECT NULL::uuid, false, 'inactive'::text; RETURN;
  END IF;
  IF t.expires_at IS NOT NULL AND t.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, false, 'expired'::text; RETURN;
  END IF;
  IF t.max_uses IS NOT NULL AND t.uses_count >= t.max_uses THEN
    RETURN QUERY SELECT NULL::uuid, false, 'limit_reached'::text; RETURN;
  END IF;
  RETURN QUERY SELECT t.company_id, true, NULL::text;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_invite_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_invite_token(text) TO anon, authenticated;

-- 4) doctor_availability: restrict anon insert to pending partners only
DROP POLICY IF EXISTS "Anon can insert doctor availability" ON public.doctor_availability;
CREATE POLICY "Anon can insert doctor availability for pending partners"
  ON public.doctor_availability
  FOR INSERT
  TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = doctor_availability.partner_id
      AND p.approval_status = 'pending'
  ));

-- 5) partner_doctor_links: restrict anon insert to pending partners only
DROP POLICY IF EXISTS "Anon can insert partner doctor links" ON public.partner_doctor_links;
CREATE POLICY "Anon can insert partner doctor links for pending"
  ON public.partner_doctor_links
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_doctor_links.clinic_id AND p.approval_status = 'pending')
    AND EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_doctor_links.doctor_id AND p.approval_status = 'pending')
  );

-- 6) prontuario_connections: drop unrestricted anon read (handled via edge functions)
DROP POLICY IF EXISTS "Anon can verify by token" ON public.prontuario_connections;

-- 7) report_shares: drop anon read/update, add consume RPC
DROP POLICY IF EXISTS "Anon can read shares by token" ON public.report_shares;
DROP POLICY IF EXISTS "Anon can update accessed_at" ON public.report_shares;

CREATE OR REPLACE FUNCTION public.consume_report_share(_token text)
RETURNS TABLE(user_id uuid, expires_at timestamptz, valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s public.report_shares%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.report_shares WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::timestamptz, false; RETURN;
  END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, s.expires_at, false; RETURN;
  END IF;
  IF s.accessed_at IS NULL THEN
    UPDATE public.report_shares SET accessed_at = now() WHERE id = s.id;
  END IF;
  RETURN QUERY SELECT s.user_id, s.expires_at, true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_report_share(text) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_report_share(text) TO anon, authenticated;

-- 8) validation-photos bucket: make private, restrict SELECT to owner or admin
UPDATE storage.buckets SET public = false WHERE id = 'validation-photos';

DROP POLICY IF EXISTS "Anyone can view validation photos" ON storage.objects;
CREATE POLICY "Users can view own validation photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'validation-photos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
