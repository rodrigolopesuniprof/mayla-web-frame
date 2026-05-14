-- Add usage tracking + active flag to invite tokens
ALTER TABLE public.company_invite_tokens
  ADD COLUMN IF NOT EXISTS max_uses int NULL,
  ADD COLUMN IF NOT EXISTS uses_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Back-fill: only the most recent token per company stays active
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY company_id ORDER BY created_at DESC) AS rn
  FROM public.company_invite_tokens
)
UPDATE public.company_invite_tokens t
SET active = false
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- Enforce 1 active token per company
CREATE UNIQUE INDEX IF NOT EXISTS company_invite_tokens_one_active_per_company
  ON public.company_invite_tokens (company_id) WHERE active;

-- Audit on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signed_up_via_token uuid NULL REFERENCES public.company_invite_tokens(id) ON DELETE SET NULL;

-- RPC to validate + count usage atomically
CREATE OR REPLACE FUNCTION public.register_via_invite_token(_token text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t public.company_invite_tokens%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.company_invite_tokens WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT t.active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;
  IF t.expires_at IS NOT NULL AND t.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF t.max_uses IS NOT NULL AND t.uses_count >= t.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached');
  END IF;

  UPDATE public.company_invite_tokens SET uses_count = uses_count + 1 WHERE id = t.id;
  UPDATE public.profiles SET signed_up_via_token = t.id WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'company_id', t.company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_via_invite_token(text, uuid) TO anon, authenticated;