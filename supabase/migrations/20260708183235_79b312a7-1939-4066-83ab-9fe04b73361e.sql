
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conversations_enabled boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS leagues_default_per_company
  ON public.leagues (company_id) WHERE is_default = true;

-- Redefine "one active league per owner" to ignore the default (auto-provisioned) league
DROP INDEX IF EXISTS public.uq_one_active_league_per_owner;
CREATE UNIQUE INDEX uq_one_active_league_per_owner
  ON public.leagues (owner_id)
  WHERE status = 'ativa' AND is_default = false;

CREATE OR REPLACE FUNCTION public.ensure_default_league(_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league_id uuid;
  v_owner uuid;
  v_company_name text;
  v_logo text;
BEGIN
  IF _company_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_league_id FROM public.leagues
   WHERE company_id = _company_id AND is_default = true LIMIT 1;
  IF v_league_id IS NOT NULL THEN
    INSERT INTO public.league_members (league_id, user_id, papel)
    SELECT v_league_id, p.user_id,
           CASE WHEN p.user_id = (SELECT owner_id FROM public.leagues WHERE id = v_league_id) THEN 'dono' ELSE 'membro' END
    FROM public.profiles p
    WHERE p.company_id = _company_id
    ON CONFLICT (league_id, user_id) DO NOTHING;
    RETURN v_league_id;
  END IF;

  SELECT name, logo_url INTO v_company_name, v_logo
    FROM public.companies WHERE id = _company_id;
  IF v_company_name IS NULL THEN RETURN NULL; END IF;

  SELECT ur.user_id INTO v_owner
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
   WHERE p.company_id = _company_id
     AND ur.role IN ('company_admin'::app_role, 'admin'::app_role)
   ORDER BY ur.user_id LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM public.profiles
      WHERE company_id = _company_id ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.leagues (company_id, owner_id, nome, visibilidade, status,
                              marca_logo_url, is_default, conversations_enabled,
                              scoring_event_keys, invite_code)
  VALUES (_company_id, v_owner, v_company_name, 'publica', 'ativa',
          v_logo, true, false, ARRAY[]::text[],
          upper(substring(md5(random()::text || _company_id::text) FROM 1 FOR 8)))
  RETURNING id INTO v_league_id;

  INSERT INTO public.league_members (league_id, user_id, papel)
  SELECT v_league_id, p.user_id, CASE WHEN p.user_id = v_owner THEN 'dono' ELSE 'membro' END
  FROM public.profiles p
  WHERE p.company_id = _company_id
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN v_league_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_companies_ensure_default_league()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_default_league(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS companies_ensure_default_league ON public.companies;
CREATE TRIGGER companies_ensure_default_league
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.trg_companies_ensure_default_league();

CREATE OR REPLACE FUNCTION public.trg_profiles_join_default_league()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lid uuid;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  v_lid := public.ensure_default_league(NEW.company_id);
  IF v_lid IS NOT NULL THEN
    INSERT INTO public.league_members (league_id, user_id, papel)
    VALUES (v_lid, NEW.user_id, 'membro')
    ON CONFLICT (league_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_join_default_league ON public.profiles;
CREATE TRIGGER profiles_join_default_league
AFTER INSERT OR UPDATE OF company_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_profiles_join_default_league();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.ensure_default_league(r.id);
  END LOOP;
END $$;
