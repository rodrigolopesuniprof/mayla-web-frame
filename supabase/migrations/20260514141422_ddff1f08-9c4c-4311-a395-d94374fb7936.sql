-- Allow authenticated sessions to validate invite tokens too.
-- Previously only anonymous visitors could read invite tokens for signup validation;
-- if the browser already had a session, the same valid link could appear as invalid/expired.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_invite_tokens'
      AND policyname = 'Authenticated users can validate tokens'
  ) THEN
    CREATE POLICY "Authenticated users can validate tokens"
      ON public.company_invite_tokens
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;