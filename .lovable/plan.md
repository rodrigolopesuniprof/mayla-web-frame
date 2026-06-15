# Bug crítico de pagamento — Plano de correção

## Diagnóstico

Reproduzi o fluxo do screenshot. Há **dois problemas independentes**, ambos críticos:

### Problema 1 — Falha de validação no Pagar.me ("value is required")
A cobrança recorrente (`ch_EV4KbXIbWhpxr7lO`) retornou `validation_error | billing | "value" is required` com `Valor autorizado R$ 0,00`.

Causa: o payload enviado em `pagarme-create-subscription/index.ts` para `POST /subscriptions` usa **simultaneamente**:
- `minimum_price: priceCents`
- `items[].pricing_scheme: { price: priceCents, scheme_type: "unit" }`

Na API v5 do Pagar.me, quando há item com `pricing_scheme` fixo, `minimum_price` não deve ser enviado, e o `pricing_scheme` precisa do formato correto. Hoje, no momento de gerar a fatura do ciclo, o Pagar.me não consegue resolver o valor → dispara `billing "value" is required` e a charge nasce com R$ 0,00 → falha.

### Problema 2 — Usuário acessa o sistema mesmo com cobrança falha (CRÍTICO)
Fluxo atual em `pagarme-create-subscription`:
1. Cria customer no Pagar.me
2. Cria `auth.user` no Supabase imediatamente (`email_confirm: true`)
3. Cria `POST /subscriptions` no Pagar.me
4. Insere linha em `subscriptions` com `status = sub.status === "active" ? "active" : "pending"`

Problemas decorrentes:
- A conta `auth.users` é criada **antes** de saber se a 1ª cobrança vai passar. O usuário consegue fazer login com email/senha mesmo sem nunca ter pago.
- `AccessGate` só está aplicado na rota `/` (Index). Rotas como `/perfil/assinatura`, `/afiliado` e outras ficam acessíveis. Conforme o usuário navega, ele vê a plataforma.
- Quando o webhook `charge.payment_failed` chega, atualizamos apenas `subscription_invoices.status='failed'`, **sem mexer em `subscriptions.status`** — assinatura fica eternamente `pending`, sem virar `past_due`/`canceled`, e sem disparar limpeza da conta.
- Não há nenhum job/lógica que remova a conta `auth.users` criada se a 1ª cobrança falhar.

## Correções propostas

### 1. Ajustar payload do Pagar.me (`supabase/functions/pagarme-create-subscription/index.ts`)
- Remover `minimum_price` quando o item tem `pricing_scheme.price` fixo.
- Garantir `pricing_scheme: { scheme_type: "unit", price: priceCents }` (capitalização e tipos corretos conforme docs v5).
- Adicionar `billing_day` (cartão) e `installments: 1` explícito.
- Após criar a subscription, fazer `GET /subscriptions/{id}` para ler o status real da 1ª charge antes de gravar local (ou aguardar webhook — ver item 3).

### 2. Não criar conta `auth.users` antes da 1ª cobrança aprovada
Reordenar o fluxo em `pagarme-create-subscription`:
1. Validar dados e plano.
2. Criar customer + subscription no Pagar.me.
3. **Aguardar (poll curto, 2–3 tentativas com 1s) o status da 1ª charge** — ou exigir que o front faça polling após receber `subscription_id` provisório.
4. Só criar `auth.users` (e gravar `subscriptions` com `status='active'`) **após** confirmar `charge.paid` (cartão aprovado) ou, no caso PIX, manter usuário não-criado até webhook `charge.paid`.
5. Para PIX: salvar pré-cadastro em uma nova tabela `pending_signups` (token + dados criptografados + charge_id). Quando webhook `charge.paid` chegar, a função processa essa fila e cria o `auth.users` + `subscriptions`.

Tabela nova:
```sql
CREATE TABLE public.pending_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagarme_charge_id text UNIQUE NOT NULL,
  pagarme_subscription_id text,
  pagarme_customer_id text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,        -- bcrypt server-side
  full_name text NOT NULL,
  cpf text NOT NULL,
  company_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  affiliate_id uuid,
  payment_method text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours'
);
-- GRANTs apenas para service_role (acesso só via edge function)
GRANT ALL ON public.pending_signups TO service_role;
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;
-- nenhuma policy → bloqueado para anon/authenticated
```

### 3. Reagir corretamente a falhas no webhook (`pagarme-webhook/index.ts`)
- `charge.payment_failed`: além de marcar invoice como `failed`, atualizar `subscriptions.status = 'past_due'` (ou `canceled` se for a 1ª cobrança e não houver `auth.users` ainda → deletar a linha de subscription).
- `charge.paid`: se vier de uma `pagarme_charge_id` registrada em `pending_signups`, criar `auth.users` + `subscriptions` + `subscription_invoices` agora; depois remover de `pending_signups`.
- `subscription.canceled`: já tratado.

### 4. Fortalecer o gate de acesso (`src/App.tsx` + `AccessGate.tsx`)
- Envolver **todas** as rotas autenticadas com `AccessGate`, exceto `/perfil/assinatura` e `/admin/*` (admin tem RBAC próprio).
- No `useHasAccess`, mudar default: quando `require_paid_subscription` for **null/undefined** ou empresa não encontrada, assumir `requiresPayment = true` (fail-closed em vez de fail-open) para usuários que vieram do fluxo Pagar.me (detectar por existência de qualquer linha em `subscriptions` para o user).

### 5. Reconciliação manual + UI
- Adicionar botão "Verificar status no Pagar.me" em `/perfil/assinatura` → invoca função que faz `GET /subscriptions/{id}` e sincroniza estado local.
- Cron diário (já existe `pagarme-cron-renew-pix`) — adicionar varredura de `subscriptions.status='pending'` há mais de 1h → consultar Pagar.me e reconciliar.

## Detalhes técnicos (resumo de arquivos a alterar)

```
supabase/functions/pagarme-create-subscription/index.ts   # itens 1 e 2
supabase/functions/pagarme-webhook/index.ts               # item 3
supabase/migrations/<nova>.sql                            # tabela pending_signups + status past_due
src/App.tsx                                               # item 4 (envolver rotas)
src/hooks/useHasAccess.ts                                 # item 4 (fail-closed)
src/pages/MySubscription.tsx                              # item 5 (botão reconciliar)
supabase/functions/pagarme-reconcile/index.ts             # nova função para reconciliação
```

## Ordem de implementação sugerida
1. **Hotfix imediato (segurança):** envolver todas as rotas com `AccessGate` + fail-closed no `useHasAccess` — corta o vazamento de acesso agora.
2. Corrigir payload do Pagar.me + poll do status real antes de inserir no banco.
3. Criar `pending_signups` e mover criação de `auth.users` para depois do `charge.paid`.
4. Atualizar webhook para mexer em `subscriptions.status` em falhas.
5. UI de reconciliação + cron.

## Perguntas antes de implementar
1. Para **PIX**, você prefere (a) não criar a conta até o pagamento ser confirmado (mais seguro, usuário recebe email com link após pagar) ou (b) criar conta mas bloqueada até webhook (UX mais imediata)?
2. Quando uma cobrança recorrente futura falhar (mês 2+, usuário já ativo), você quer bloquear acesso imediatamente em `past_due` ou dar período de tolerância (ex.: 3 dias)?
3. Posso aplicar o **hotfix de segurança (passo 1)** já como primeira entrega isolada, e tratar os demais passos em sequência?
