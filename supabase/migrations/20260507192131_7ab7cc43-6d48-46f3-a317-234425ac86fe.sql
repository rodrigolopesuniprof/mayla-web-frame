
-- Enums
CREATE TYPE public.billing_interval AS ENUM ('monthly', 'yearly');
CREATE TYPE public.payment_method AS ENUM ('credit_card', 'pix');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'pending');
CREATE TYPE public.invoice_status AS ENUM ('pending', 'paid', 'failed', 'canceled', 'refunded');
CREATE TYPE public.commission_status AS ENUM ('pending', 'paid', 'canceled');
CREATE TYPE public.pagarme_environment AS ENUM ('test', 'live');
CREATE TYPE public.kyc_status AS ENUM ('pending', 'approved', 'rejected');

-- ========== Credenciais Pagar.me por empresa ==========
CREATE TABLE public.company_payment_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE,
  pagarme_api_key_encrypted TEXT,
  pagarme_recipient_id TEXT,
  webhook_secret TEXT,
  environment public.pagarme_environment NOT NULL DEFAULT 'test',
  enabled BOOLEAN NOT NULL DEFAULT false,
  require_paid_subscription BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_payment_credentials ENABLE ROW LEVEL SECURITY;

-- ========== Catálogo de planos ==========
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  billing_interval public.billing_interval NOT NULL DEFAULT 'monthly',
  payment_methods public.payment_method[] NOT NULL DEFAULT ARRAY['credit_card','pix']::public.payment_method[],
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- ========== Atribuição de planos a empresas ==========
CREATE TABLE public.company_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  custom_price_cents INTEGER CHECK (custom_price_cents IS NULL OR custom_price_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, plan_id)
);
ALTER TABLE public.company_plan_assignments ENABLE ROW LEVEL SECURITY;

-- ========== Afiliados ==========
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf_cnpj TEXT NOT NULL,
  pagarme_recipient_id TEXT,
  bank_account JSONB,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (commission_percent >= 0 AND commission_percent <= 100),
  referral_code TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_affiliates_referral_code ON public.affiliates(referral_code);

-- ========== Assinaturas ==========
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  affiliate_id UUID REFERENCES public.affiliates(id),
  pagarme_subscription_id TEXT UNIQUE,
  pagarme_customer_id TEXT,
  status public.subscription_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  card_brand TEXT,
  card_last4 TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- ========== Faturas ==========
CREATE TABLE public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  pagarme_charge_id TEXT UNIQUE,
  pagarme_invoice_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status public.invoice_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method NOT NULL,
  pix_qr_code TEXT,
  pix_qr_code_url TEXT,
  pix_expires_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invoices_subscription ON public.subscription_invoices(subscription_id);
CREATE INDEX idx_invoices_status ON public.subscription_invoices(status);

-- ========== Comissões de afiliados ==========
CREATE TABLE public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  commission_percent NUMERIC(5,2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  pagarme_split_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_commissions_affiliate ON public.affiliate_commissions(affiliate_id);

-- ========== Eventos de webhook ==========
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  pagarme_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ========== Triggers updated_at ==========
CREATE TRIGGER trg_payment_credentials_updated BEFORE UPDATE ON public.company_payment_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscription_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_affiliates_updated BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== Função has_platform_access ==========
CREATE OR REPLACE FUNCTION public.has_platform_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_requires_payment BOOLEAN;
  v_has_active_sub BOOLEAN;
BEGIN
  -- Sem usuário, sem acesso
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Pega empresa do usuário
  SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  -- Se a empresa não exige pagamento, libera (vias: cadastro direto / token / sem empresa)
  SELECT COALESCE(require_paid_subscription, false) INTO v_requires_payment
  FROM public.company_payment_credentials WHERE company_id = v_company_id;

  IF NOT COALESCE(v_requires_payment, false) THEN
    RETURN true;
  END IF;

  -- Empresa exige assinatura: checar se o usuário tem assinatura ativa
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status IN ('active','trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  ) INTO v_has_active_sub;

  RETURN COALESCE(v_has_active_sub, false);
END;
$$;

-- ========== Helper: gera referral code ==========
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM public.affiliates WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ========== RLS POLICIES ==========

-- company_payment_credentials: super admin gerencia, admin de empresa lê
CREATE POLICY "Super admin manages payment credentials"
ON public.company_payment_credentials FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company admin reads own credentials"
ON public.company_payment_credentials FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) AND public.is_company_admin(auth.uid()));

-- subscription_plans: super admin gerencia, todos autenticados leem ativos
CREATE POLICY "Super admin manages plans"
ON public.subscription_plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans FOR SELECT TO anon, authenticated
USING (active = true);

-- company_plan_assignments
CREATE POLICY "Super admin manages plan assignments"
ON public.company_plan_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone reads active plan assignments"
ON public.company_plan_assignments FOR SELECT TO anon, authenticated
USING (active = true);

-- affiliates: super admin gerencia, admin de empresa vê os da empresa
CREATE POLICY "Super admin manages affiliates"
ON public.affiliates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company admin reads own affiliates"
ON public.affiliates FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) AND public.is_company_admin(auth.uid()));

CREATE POLICY "Anyone can verify referral by code"
ON public.affiliates FOR SELECT TO anon, authenticated
USING (active = true);

-- subscriptions: usuário vê as próprias; super admin tudo; admin empresa vê da empresa
CREATE POLICY "Users view own subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admin manages subscriptions"
ON public.subscriptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company admin reads company subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) AND public.is_company_admin(auth.uid()));

-- subscription_invoices
CREATE POLICY "Users view own invoices"
ON public.subscription_invoices FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid()));

CREATE POLICY "Super admin manages invoices"
ON public.subscription_invoices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company admin reads company invoices"
ON public.subscription_invoices FOR SELECT TO authenticated
USING (
  EXISTS(SELECT 1 FROM public.subscriptions s
    WHERE s.id = subscription_id
      AND s.company_id = public.get_user_company_id(auth.uid())
      AND public.is_company_admin(auth.uid()))
);

-- affiliate_commissions: só super admin
CREATE POLICY "Super admin manages commissions"
ON public.affiliate_commissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- webhook_events: só super admin lê (edge function usa service role)
CREATE POLICY "Super admin reads webhook events"
ON public.webhook_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
