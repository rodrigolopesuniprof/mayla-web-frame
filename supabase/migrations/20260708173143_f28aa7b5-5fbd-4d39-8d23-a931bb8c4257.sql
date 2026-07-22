
CREATE TABLE public.league_pokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NULL,
  tipo text NOT NULL CHECK (tipo IN ('cutucar','torcer','provocar','recado')),
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX league_pokes_league_to_idx ON public.league_pokes(league_id, to_user, created_at DESC);
CREATE INDEX league_pokes_rate_idx ON public.league_pokes(from_user, to_user, tipo, created_at);

GRANT SELECT, INSERT, DELETE ON public.league_pokes TO authenticated;
GRANT ALL ON public.league_pokes TO service_role;

ALTER TABLE public.league_pokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can send pokes"
ON public.league_pokes FOR INSERT TO authenticated
WITH CHECK (from_user = auth.uid() AND public.is_league_member(league_id, auth.uid()));

CREATE POLICY "members can read pokes for them or broadcast"
ON public.league_pokes FOR SELECT TO authenticated
USING (
  public.is_league_member(league_id, auth.uid())
  AND (to_user = auth.uid() OR to_user IS NULL OR from_user = auth.uid() OR public.is_league_admin(league_id, auth.uid()))
);

CREATE POLICY "sender or league admin can delete poke"
ON public.league_pokes FOR DELETE TO authenticated
USING (from_user = auth.uid() OR public.is_league_admin(league_id, auth.uid()));

-- Anti-spam: 1 cutucada por dia por (from, to)
CREATE OR REPLACE FUNCTION public.enforce_poke_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'cutucar' AND NEW.to_user IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.league_pokes
      WHERE from_user = NEW.from_user
        AND to_user = NEW.to_user
        AND tipo = 'cutucar'
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date
            = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ) THEN
      RAISE EXCEPTION 'poke_rate_limit' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER league_pokes_rate_limit
BEFORE INSERT ON public.league_pokes
FOR EACH ROW EXECUTE FUNCTION public.enforce_poke_rate_limit();

-- Notificação in-app para o alvo
CREATE OR REPLACE FUNCTION public.notify_league_poke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_name text;
  v_league_name text;
  v_emoji text;
  v_title text;
BEGIN
  IF NEW.to_user IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(full_name),''), 'Alguém') INTO v_from_name
    FROM public.profiles WHERE user_id = NEW.from_user;
  SELECT nome INTO v_league_name FROM public.leagues WHERE id = NEW.league_id;

  v_emoji := CASE NEW.tipo
    WHEN 'cutucar' THEN '👉'
    WHEN 'torcer' THEN '👏'
    WHEN 'provocar' THEN '🔥'
    ELSE '💬'
  END;

  v_title := v_from_name || ' ' || CASE NEW.tipo
    WHEN 'cutucar' THEN 'te cutucou'
    WHEN 'torcer' THEN 'torceu por você'
    WHEN 'provocar' THEN 'te provocou'
    ELSE 'te mandou um recado'
  END || ' na ' || COALESCE(v_league_name, 'sua liga');

  INSERT INTO public.notifications (title, body, emoji, scope, target_user_id, created_by, color)
  VALUES (v_title, NEW.texto, v_emoji, 'personal', NEW.to_user, NEW.from_user, '16 74% 59%');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER league_pokes_notify
AFTER INSERT ON public.league_pokes
FOR EACH ROW EXECUTE FUNCTION public.notify_league_poke();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_pokes;
