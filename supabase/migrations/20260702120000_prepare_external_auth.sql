-- Prepare profiles and external identity mapping for external authentication.

CREATE OR REPLACE FUNCTION public.is_valid_cpf(_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  _sum integer := 0;
  _digit integer;
  _first_check integer;
  _second_check integer;
  _i integer;
BEGIN
  IF _cpf !~ '^[0-9]{11}$' THEN
    RETURN false;
  END IF;

  IF length(replace(_cpf, substr(_cpf, 1, 1), '')) = 0 THEN
    RETURN false;
  END IF;

  FOR _i IN 1..9 LOOP
    _sum := _sum + substr(_cpf, _i, 1)::integer * (11 - _i);
  END LOOP;

  _digit := 11 - (_sum % 11);
  _first_check := CASE WHEN _digit >= 10 THEN 0 ELSE _digit END;

  IF _first_check <> substr(_cpf, 10, 1)::integer THEN
    RETURN false;
  END IF;

  _sum := 0;
  FOR _i IN 1..10 LOOP
    _sum := _sum + substr(_cpf, _i, 1)::integer * (12 - _i);
  END LOOP;

  _digit := 11 - (_sum % 11);
  _second_check := CASE WHEN _digit >= 10 THEN 0 ELSE _digit END;

  RETURN _second_check = substr(_cpf, 11, 1)::integer;
END;
$$;

-- Store only digits. Empty values remain nullable.
UPDATE public.profiles
SET cpf = nullif(regexp_replace(cpf, '[^0-9]', '', 'g'), '')
WHERE cpf IS NOT NULL
  AND cpf IS DISTINCT FROM nullif(regexp_replace(cpf, '[^0-9]', '', 'g'), '');

-- Abort without exposing personal data if the preflight assumption is wrong.
DO $$
DECLARE
  _invalid_count bigint;
  _duplicate_count bigint;
BEGIN
  SELECT count(*)
  INTO _invalid_count
  FROM public.profiles
  WHERE cpf IS NOT NULL
    AND NOT public.is_valid_cpf(cpf);

  IF _invalid_count > 0 THEN
    RAISE EXCEPTION
      'Cannot enable CPF validation: % profile(s) have an invalid CPF',
      _invalid_count;
  END IF;

  SELECT count(*)
  INTO _duplicate_count
  FROM (
    SELECT cpf
    FROM public.profiles
    WHERE cpf IS NOT NULL
    GROUP BY cpf
    HAVING count(*) > 1
  ) AS duplicates;

  IF _duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot enable CPF uniqueness: % duplicated CPF group(s) exist',
      _duplicate_count;
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cpf_valid
  CHECK (cpf IS NULL OR public.is_valid_cpf(cpf));

CREATE UNIQUE INDEX profiles_cpf_unique
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL;

CREATE TABLE public.external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_subject text NOT NULL,
  external_client_id text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_login_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_identities_source_format
    CHECK (source ~ '^[a-z][a-z0-9_-]{1,31}$'),
  CONSTRAINT external_identities_subject_not_blank
    CHECK (length(btrim(external_subject)) BETWEEN 1 AND 255),
  CONSTRAINT external_identities_source_subject_key
    UNIQUE (source, external_subject),
  CONSTRAINT external_identities_source_user_key
    UNIQUE (source, user_id)
);

CREATE INDEX external_identities_user_id_idx
  ON public.external_identities (user_id);

CREATE TRIGGER update_external_identities_updated_at
BEFORE UPDATE ON public.external_identities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.external_identities ENABLE ROW LEVEL SECURITY;

-- This mapping is backend-only. The service role bypasses RLS.
REVOKE ALL ON TABLE public.external_identities FROM anon, authenticated;

COMMENT ON TABLE public.external_identities IS
  'Backend-only mapping between external identities and Supabase users.';
COMMENT ON COLUMN public.external_identities.external_subject IS
  'Stable identifier returned by the external provider; never an SSID.';

CREATE TABLE public.external_auth_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1,
  CONSTRAINT external_auth_rate_limits_key_hash_format
    CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT external_auth_rate_limits_attempt_count_positive
    CHECK (attempt_count > 0)
);

ALTER TABLE public.external_auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_auth_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_external_auth_rate_limit(
  _key_hash text,
  _limit integer DEFAULT 10,
  _window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _allowed boolean;
  _now timestamptz := clock_timestamp();
BEGIN
  IF _key_hash !~ '^[0-9a-f]{64}$'
    OR _limit NOT BETWEEN 1 AND 100
    OR _window_seconds NOT BETWEEN 1 AND 3600
  THEN
    RAISE EXCEPTION 'Invalid rate-limit arguments';
  END IF;

  INSERT INTO public.external_auth_rate_limits AS limits (
    key_hash,
    window_started_at,
    attempt_count
  )
  VALUES (_key_hash, _now, 1)
  ON CONFLICT (key_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= _now - make_interval(secs => _window_seconds)
        THEN _now
      ELSE limits.window_started_at
    END,
    attempt_count = CASE
      WHEN limits.window_started_at <= _now - make_interval(secs => _window_seconds)
        THEN 1
      ELSE limits.attempt_count + 1
    END
  RETURNING attempt_count <= _limit INTO _allowed;

  RETURN _allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_external_auth_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_external_auth_rate_limit(text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(btrim(_email))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;

COMMENT ON FUNCTION public.get_auth_user_id_by_email(text) IS
  'Backend-only lookup used to resolve external authentication conflicts safely.';
