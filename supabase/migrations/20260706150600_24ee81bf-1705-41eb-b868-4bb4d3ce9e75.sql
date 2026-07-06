
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS leagues_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.leagues (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  marca_logo_url text,
  visibilidade   text NOT NULL DEFAULT 'privada' CHECK (visibilidade IN ('publica','privada')),
  invite_code    text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(5),'hex'),
  status         text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','arquivada')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_league_per_owner
  ON public.leagues (owner_id) WHERE status = 'ativa';
CREATE INDEX IF NOT EXISTS idx_leagues_company ON public.leagues(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.league_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel      text NOT NULL DEFAULT 'membro' CHECK (papel IN ('dono','coadmin','membro')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON public.league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_league ON public.league_members(league_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_members TO authenticated;
GRANT ALL ON public.league_members TO service_role;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.league_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  inviter_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_contato text,
  affiliate_code  text NOT NULL,
  status          text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','cadastrado','assinou','expirado')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invites_league ON public.league_invites(league_id);
CREATE INDEX IF NOT EXISTS idx_invites_inviter ON public.league_invites(inviter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_invites TO authenticated;
GRANT ALL ON public.league_invites TO service_role;
ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.league_challenges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  titulo     text NOT NULL,
  metrica    text NOT NULL,
  alvo       integer NOT NULL,
  week_id    text NOT NULL DEFAULT to_char(now(),'IYYY"-W"IW'),
  premio     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenges_league ON public.league_challenges(league_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_challenges TO authenticated;
GRANT ALL ON public.league_challenges TO service_role;
ALTER TABLE public.league_challenges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id),
  invite_id        uuid REFERENCES public.league_invites(id),
  affiliate_code   text NOT NULL,
  valor            numeric(10,2),
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','em_carencia','elegivel','pago','cancelado')),
  pago_em          timestamptz,
  carencia_ate     timestamptz,
  release_ate      timestamptz,
  split_ref        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_inviter ON public.referral_rewards(inviter_id);
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.league_members(league_id, user_id, papel)
  VALUES (NEW.id, NEW.owner_id, 'dono')
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_add_owner_as_member ON public.leagues;
CREATE TRIGGER trg_add_owner_as_member
AFTER INSERT ON public.leagues
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

CREATE OR REPLACE FUNCTION public.handle_owner_leaving()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_owner uuid;
BEGIN
  IF OLD.papel = 'dono' THEN
    SELECT user_id INTO v_new_owner
    FROM public.league_members
    WHERE league_id = OLD.league_id AND user_id <> OLD.user_id
    ORDER BY (papel = 'coadmin') DESC, joined_at ASC
    LIMIT 1;
    IF v_new_owner IS NULL THEN
      UPDATE public.leagues SET status = 'arquivada', updated_at = now() WHERE id = OLD.league_id;
    ELSE
      UPDATE public.leagues SET owner_id = v_new_owner, updated_at = now() WHERE id = OLD.league_id;
      UPDATE public.league_members SET papel = 'dono'
        WHERE league_id = OLD.league_id AND user_id = v_new_owner;
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_handle_owner_leaving ON public.league_members;
CREATE TRIGGER trg_handle_owner_leaving
AFTER DELETE ON public.league_members
FOR EACH ROW EXECUTE FUNCTION public.handle_owner_leaving();

DROP TRIGGER IF EXISTS trg_leagues_updated_at ON public.leagues;
CREATE TRIGGER trg_leagues_updated_at
BEFORE UPDATE ON public.leagues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- HELPERS + LEITURA
CREATE OR REPLACE FUNCTION public.is_league_member(p_league uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.league_members
                WHERE league_id = p_league AND user_id = p_user);
$$;

CREATE OR REPLACE FUNCTION public.is_league_admin(p_league uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.league_members
                WHERE league_id = p_league AND user_id = p_user
                  AND papel IN ('dono','coadmin'));
$$;

CREATE OR REPLACE FUNCTION public.user_xp(p_user uuid DEFAULT auth.uid())
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(points),0)::int FROM public.points_ledger WHERE user_id = p_user;
$$;

CREATE OR REPLACE FUNCTION public.league_ranking(
  p_league_id uuid,
  p_week_id   text DEFAULT to_char(now(),'IYYY"-W"IW')
)
RETURNS TABLE(user_id uuid, pontos_semana int, posicao bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH scores AS (
    SELECT m.user_id,
           COALESCE(SUM(pl.points) FILTER (WHERE to_char(pl.created_at,'IYYY"-W"IW') = p_week_id),0)::int AS pontos_semana
    FROM public.league_members m
    LEFT JOIN public.points_ledger pl ON pl.user_id = m.user_id
    WHERE m.league_id = p_league_id
    GROUP BY m.user_id
  )
  SELECT user_id, pontos_semana,
         rank() OVER (ORDER BY pontos_semana DESC) AS posicao
  FROM scores ORDER BY pontos_semana DESC;
$$;

CREATE OR REPLACE FUNCTION public.mayla_ranking(
  p_company_id uuid,
  p_week_id    text DEFAULT to_char(now(),'IYYY"-W"IW')
)
RETURNS TABLE(user_id uuid, pontos_semana int, posicao bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH scores AS (
    SELECT p.user_id,
           COALESCE(SUM(pl.points) FILTER (WHERE to_char(pl.created_at,'IYYY"-W"IW') = p_week_id),0)::int AS pontos_semana
    FROM public.profiles p
    LEFT JOIN public.points_ledger pl ON pl.user_id = p.user_id
    WHERE p.company_id = p_company_id
    GROUP BY p.user_id
  )
  SELECT user_id, pontos_semana,
         rank() OVER (ORDER BY pontos_semana DESC) AS posicao
  FROM scores ORDER BY pontos_semana DESC;
$$;

CREATE OR REPLACE VIEW public.league_prize_eligible AS
SELECT league_id, count(*) AS membros, (count(*) >= 10) AS elegivel_premio_mayla
FROM public.league_members GROUP BY league_id;
GRANT SELECT ON public.league_prize_eligible TO authenticated;

-- RLS
DROP POLICY IF EXISTS leagues_select ON public.leagues;
CREATE POLICY leagues_select ON public.leagues FOR SELECT TO authenticated
USING (visibilidade = 'publica' OR public.is_league_member(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS leagues_insert ON public.leagues;
CREATE POLICY leagues_insert ON public.leagues FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.leagues_enabled)
);

DROP POLICY IF EXISTS leagues_update ON public.leagues;
CREATE POLICY leagues_update ON public.leagues FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS leagues_delete ON public.leagues;
CREATE POLICY leagues_delete ON public.leagues FOR DELETE TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS members_select ON public.league_members;
CREATE POLICY members_select ON public.league_members FOR SELECT TO authenticated
USING (
  public.is_league_member(league_id)
  OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.visibilidade = 'publica')
);

DROP POLICY IF EXISTS members_join_public ON public.league_members;
CREATE POLICY members_join_public ON public.league_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.visibilidade = 'publica')
);

DROP POLICY IF EXISTS members_admin_insert ON public.league_members;
CREATE POLICY members_admin_insert ON public.league_members FOR INSERT TO authenticated
WITH CHECK (public.is_league_admin(league_id));

DROP POLICY IF EXISTS members_delete ON public.league_members;
CREATE POLICY members_delete ON public.league_members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_league_admin(league_id));

DROP POLICY IF EXISTS members_update ON public.league_members;
CREATE POLICY members_update ON public.league_members FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.owner_id = auth.uid()));

DROP POLICY IF EXISTS invites_select ON public.league_invites;
CREATE POLICY invites_select ON public.league_invites FOR SELECT TO authenticated
USING (inviter_id = auth.uid() OR public.is_league_admin(league_id));

DROP POLICY IF EXISTS invites_insert ON public.league_invites;
CREATE POLICY invites_insert ON public.league_invites FOR INSERT TO authenticated
WITH CHECK (inviter_id = auth.uid() AND public.is_league_member(league_id));

DROP POLICY IF EXISTS challenges_select ON public.league_challenges;
CREATE POLICY challenges_select ON public.league_challenges FOR SELECT TO authenticated
USING (public.is_league_member(league_id));

DROP POLICY IF EXISTS challenges_insert ON public.league_challenges;
CREATE POLICY challenges_insert ON public.league_challenges FOR INSERT TO authenticated
WITH CHECK (public.is_league_admin(league_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS referral_select_self ON public.referral_rewards;
CREATE POLICY referral_select_self ON public.referral_rewards FOR SELECT TO authenticated
USING (inviter_id = auth.uid());
