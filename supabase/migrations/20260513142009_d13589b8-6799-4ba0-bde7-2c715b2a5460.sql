ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_email_lower ON public.affiliates(lower(email));

CREATE OR REPLACE FUNCTION public.current_user_affiliate_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id FROM public.affiliates a
  WHERE a.user_id = auth.uid()
     OR lower(a.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.link_affiliate_to_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.affiliates
     SET user_id = NEW.id, updated_at = now()
   WHERE user_id IS NULL
     AND lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_affiliate_on_user ON auth.users;
CREATE TRIGGER trg_link_affiliate_on_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_affiliate_to_new_user();

DROP POLICY IF EXISTS "Affiliate reads own record" ON public.affiliates;
CREATE POLICY "Affiliate reads own record" ON public.affiliates
FOR SELECT TO authenticated
USING (id IN (SELECT public.current_user_affiliate_ids()));

DROP POLICY IF EXISTS "Affiliate reads own referrals" ON public.subscriptions;
CREATE POLICY "Affiliate reads own referrals" ON public.subscriptions
FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT public.current_user_affiliate_ids()));

DROP POLICY IF EXISTS "Affiliate reads own commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliate reads own commissions" ON public.affiliate_commissions
FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT public.current_user_affiliate_ids()));

UPDATE public.affiliates a
   SET user_id = u.id
  FROM auth.users u
 WHERE a.user_id IS NULL
   AND lower(a.email) = lower(u.email);