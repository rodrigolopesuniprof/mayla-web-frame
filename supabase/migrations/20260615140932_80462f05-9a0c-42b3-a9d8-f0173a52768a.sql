-- Tabela para armazenar cadastros aguardando confirmação de pagamento (PIX)
CREATE TABLE public.pending_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagarme_charge_id text UNIQUE NOT NULL,
  pagarme_subscription_id text,
  pagarme_customer_id text NOT NULL,
  email text NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  cpf text NOT NULL,
  company_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  affiliate_id uuid,
  payment_method text NOT NULL,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  processed_at timestamptz,
  user_id uuid
);

-- Acesso somente via service_role (edge functions). Sem GRANT a anon/authenticated.
GRANT ALL ON public.pending_signups TO service_role;

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy → bloqueado a anon/authenticated por padrão (apenas service_role acessa)
CREATE INDEX idx_pending_signups_charge ON public.pending_signups(pagarme_charge_id);
CREATE INDEX idx_pending_signups_email ON public.pending_signups(lower(email));