# Integração Pagar.me — Assinaturas, Afiliados e Controle de Acesso

## Visão geral

Cada empresa terá sua própria conta Pagar.me conectada. Cobrança mensal/anual em **cartão (recorrente automático)** ou **PIX (cobrança manual mensal)**. Planos criados centralmente pelo super admin. Afiliados recebem comissão via **split automático** do Pagar.me (Recipients).

**Acesso à plataforma** passa a ter 3 vias (todas continuam válidas):
1. Assinatura ativa paga (NOVO)
2. Cadastro direto pelo admin da empresa (existente)
3. Link de convite por token (existente)

---

## 1. Modelo de dados (novas tabelas)

- `company_payment_credentials` — credenciais Pagar.me por empresa
  - `company_id`, `pagarme_api_key` (criptografada), `pagarme_recipient_id`, `webhook_secret`, `environment` (test/live), `enabled`
- `subscription_plans` — catálogo global de planos (gerido pelo super admin)
  - `name`, `description`, `price_cents`, `currency`, `billing_interval` (monthly/yearly), `payment_methods` (cartão/PIX), `trial_days`, `active`
- `company_plan_assignments` — quais planos cada empresa oferece
  - `company_id`, `plan_id`, `custom_price_cents` (override opcional), `active`
- `subscriptions` — assinatura ativa de um usuário em uma empresa
  - `user_id`, `company_id`, `plan_id`, `pagarme_subscription_id`, `pagarme_customer_id`, `status` (active/past_due/canceled/trialing), `current_period_start`, `current_period_end`, `payment_method`, `affiliate_id` (opcional)
- `subscription_invoices` — histórico de faturas
  - `subscription_id`, `pagarme_charge_id`, `amount_cents`, `status` (paid/pending/failed), `payment_method`, `pix_qr_code`, `pix_expires_at`, `paid_at`, `due_date`
- `affiliates` — revendedores cadastrados
  - `company_id` (ou null para globais), `name`, `email`, `cpf_cnpj`, `pagarme_recipient_id`, `bank_account` (jsonb), `commission_percent`, `referral_code`, `active`, `kyc_status`
- `affiliate_commissions` — comissões geradas
  - `affiliate_id`, `subscription_id`, `invoice_id`, `amount_cents`, `status` (pending/paid/canceled), `pagarme_split_id`
- `webhook_events` — log auditoria de webhooks recebidos
  - `company_id`, `pagarme_event_id` (unique), `event_type`, `payload` (jsonb), `processed`, `error`

**Trava de acesso**: criar função `has_platform_access(_user_id)` que retorna `true` se: tem assinatura ativa **OU** foi cadastrado direto **OU** entrou via token. Usada em RLS e gate de UI.

---

## 2. Edge Functions (Supabase)

- `pagarme-create-subscription` — cria customer + subscription no Pagar.me da empresa correta. Retorna client-side token de cartão / QR Code PIX
- `pagarme-cancel-subscription` — cancela assinatura
- `pagarme-generate-pix-charge` — gera cobrança PIX manual mensal (executada por cron no `current_period_end`)
- `pagarme-webhook` — endpoint público que recebe webhooks Pagar.me, valida assinatura HMAC, identifica empresa pelo recipient_id, atualiza `subscriptions`/`subscription_invoices`, registra comissão de afiliado. Eventos: `subscription.created`, `subscription.canceled`, `charge.paid`, `charge.payment_failed`, `invoice.paid`, `invoice.payment_failed`
- `pagarme-create-affiliate-recipient` — cria Recipient no Pagar.me com dados bancários do afiliado
- `pagarme-cron-renew-pix` — cron diário (pg_cron) que gera nova cobrança PIX para assinaturas vencendo

**Secrets necessários**: `PAGARME_WEBHOOK_SECRET_MASTER` (chave para criptografar as keys das empresas no banco). As API keys de cada empresa ficam no banco criptografadas.

---

## 3. Painel Super Admin (novas telas)

- **/admin/billing/plans** — CRUD de planos globais (nome, preço, recorrência, métodos de pagamento, trial)
- **/admin/billing/companies** — lista de empresas com:
  - Status da integração Pagar.me (chave configurada? recipient_id válido?)
  - Botão "Configurar Pagar.me" → modal pra colar `api_key` e `recipient_id`
  - Atribuir planos disponíveis àquela empresa (com override de preço)
  - Toggle "Exigir assinatura paga" (se desligado, empresa só usa cadastro direto/token)
- **/admin/billing/affiliates** — CRUD de afiliados:
  - Cadastro com dados bancários (cria Recipient no Pagar.me automaticamente)
  - Define % de comissão padrão e por plano
  - Gera `referral_code` único e link `/cadastro?ref=CODE`
  - Dashboard de comissões geradas e status de pagamento
- **/admin/billing/subscriptions** — visão de todas as assinaturas, status, faturas, ações (cancelar, reembolsar)

---

## 4. Painel Admin da Empresa

- **/empresa/billing** — visualiza planos atribuídos, lista de colaboradores assinantes e status de pagamento (sem editar preço)

---

## 5. Fluxo do usuário final (B2C)

- Nova rota pública `/assinar/:companySlug?ref=AFFILIATE_CODE`
  - Lista planos da empresa
  - Formulário de checkout: dados pessoais, escolha cartão/PIX
  - **Cartão**: tokenização via SDK JS do Pagar.me no frontend → edge function cria subscription → ativa imediatamente
  - **PIX**: gera QR Code e copia-e-cola, polling do status; ao confirmar pagamento (webhook), ativa
- Após pagamento confirmado, cria conta automaticamente (signup com email/senha) e vincula `subscription` + `affiliate_id` (se veio com `?ref=`)
- Tela `/perfil/assinatura` para ver status, próxima cobrança, trocar cartão, cancelar

---

## 6. Gate de acesso

- Hook `useHasAccess()` consulta `has_platform_access` do usuário logado
- Se `false` (assinatura `past_due`/`canceled` e sem outra via): redireciona para `/perfil/assinatura` com aviso de regularização
- RLS nas tabelas sensíveis (consultas, relatórios) checa `has_platform_access`

---

## 7. Detalhes técnicos

- **Criptografia das API keys**: usar `pgsodium` (ou AES-256 via edge function com `PAGARME_MASTER_KEY`) para armazenar `pagarme_api_key`. Nunca expor ao frontend.
- **Validação de webhook**: HMAC SHA-256 com `webhook_secret` por empresa, conforme docs Pagar.me v5
- **Idempotência**: `webhook_events.pagarme_event_id` UNIQUE evita reprocessamento
- **Split**: no payload de criação da subscription, incluir array `split` com `recipient_id` da empresa (valor principal) + `recipient_id` do afiliado (% de comissão)
- **PIX manual mensal**: cron `pg_cron` roda diariamente, busca assinaturas PIX com `current_period_end <= hoje + 3 dias` e gera nova `charge` via API; envia notificação ao usuário
- **SDK Pagar.me JS**: incluir `pagarme.js` v5 para tokenização de cartão no client (PCI compliance)
- **Ambiente test/live**: flag `environment` por empresa permite testar sem cobrar de verdade

---

## 8. Fora de escopo (fases futuras)

- Reembolso parcial via UI (só via API por enquanto)
- Boleto bancário
- Cupons de desconto
- Múltiplos afiliados por venda
- Pagamento da comissão do afiliado fora do split (manual)

---

## Sequência de implementação sugerida

1. Schema + RLS + função `has_platform_access`
2. Edge function `pagarme-webhook` + tela super admin de credenciais por empresa
3. CRUD de planos globais + atribuição às empresas
4. Checkout público (cartão + PIX) + criação de subscription
5. Gate de acesso + tela de assinatura no perfil
6. Módulo de afiliados (Recipients + split + dashboard de comissões)
7. Cron PIX recorrente
