# Cancelamento e inadimplência — webhook + UX

## 1. Configurar webhook no painel Pagar.me (passo manual do usuário)

Para a empresa Mayla (e cada futura empresa com Pagar.me), no painel:

- **Menu Desenvolvedores → Webhooks → Adicionar endpoint**
- **URL:** `https://ymexlslqsdflgkcvwjoz.supabase.co/functions/v1/pagarme-webhook`
- **Eventos a marcar** (essenciais para cancelamento/inadimplência):
  - `charge.paid`
  - `charge.payment_failed`
  - `charge.refunded`
  - `subscription.created`
  - `subscription.canceled`
  - `invoice.created`
  - `invoice.paid`
  - `invoice.payment_failed`
- **Segredo do webhook (opcional, recomendado):** gerar uma chave e salvar em **Admin → Empresas → Mayla → Pagar.me → Webhook secret** (coluna `company_payment_credentials.webhook_secret` que já existe). Se preenchido, a edge function valida HMAC.

Te entrego esse trecho como instrução escrita após implementar — não há como configurar pelo código nosso lado.

## 2. Webhook (`supabase/functions/pagarme-webhook/index.ts`) — completar eventos

Acrescentar / ajustar:

| Evento | Ação |
|---|---|
| `invoice.created` | Insere `subscription_invoices` com `status='pending'`, vinculando pelo `subscription_id` da Pagar.me → assim quando vier `charge.paid` da renovação, casa pelo `pagarme_charge_id` (já tratado). |
| `invoice.payment_failed` / `charge.payment_failed` | invoice → `failed`, sub → `past_due` (já existente, mas garantir lookup também por `pagarme_subscription_id` quando charge.id não casar). Dispara e-mail "Pagamento recusado". |
| `charge.paid` numa sub `past_due` | Reativa sub → `active` e atualiza `current_period_end`. Hoje o código já promove para `active`, só precisa garantir que funciona vindo de `past_due`. |
| `subscription.canceled` | Já existente. Acrescentar disparo de e-mail "Assinatura cancelada". |
| `charge.refunded` | invoice → `refunded`, sub → `canceled`. |

## 3. Cancelamento pelo usuário (fim do ciclo)

### Edge function nova: `pagarme-cancel-subscription`

- Recebe `{ subscription_id }`, valida que `auth.uid()` é o dono.
- Chama `DELETE /subscriptions/{pagarme_subscription_id}?cancel_pending_invoices=false` no Pagar.me. Isso instrui o gateway a não emitir mais cobranças e cancelar ao fim do ciclo.
- Marca local: `cancel_at_period_end = true` (nova coluna boolean) e `canceled_at = now()`. **NÃO** muda `status` ainda — sub continua `active` até `current_period_end`.
- Quando chegar o evento `subscription.canceled` do Pagar.me, o webhook seta `status='canceled'` (já implementado) e dispara e-mail.

### UI: aba "Assinatura" no Perfil

Pequeno bloco mostrando: plano, próxima cobrança, status, e botão "Cancelar assinatura" com confirmação. Se já estiver em `cancel_at_period_end`, mostrar aviso "Sua assinatura encerra em DD/MM/AAAA" e botão "Reativar" (chama Pagar.me para recriar — fora deste escopo, fica para depois).

## 4. Schema

Migration adicionando à `subscriptions`:
- `cancel_at_period_end boolean DEFAULT false`
- (já existe `canceled_at`)

Adicionando a `subscription_invoices`:
- valor `refunded` ao status (string livre hoje, só documentação).

## 5. E-mails automáticos

Reusar a infra de e-mail transacional já existente (escrita em planos anteriores). Dois templates novos disparados pelo próprio webhook:

- **`subscription-payment-failed`** — quando charge falha. CTA "atualizar cartão" (link para `/perfil/assinatura`).
- **`subscription-canceled`** — quando vem `subscription.canceled`. Confirmação + convite a reassinar.

Se a infra de e-mail transacional ainda não estiver montada neste projeto, o plano inclui criar o helper mínimo de envio (usando Lovable Cloud Email). Identificar isso no momento da implementação e ajustar.

## 6. Fora de escopo agora

- Reativação automática após cancelamento (botão "Reativar" só mostra mensagem manual).
- Dunning customizado (Pagar.me já faz retentativas próprias).
- Telas administrativas de inadimplência (admin já pode filtrar `subscriptions` por status no Supabase).

## Validação

1. Configurar webhook no painel.
2. Cancelar uma sub teste pelo botão → checar `cancel_at_period_end=true`, e-mail "cancelada" depois do evento.
3. Forçar falha de cobrança (cartão de teste recusado) → sub vira `past_due` na hora, usuário perde acesso, recebe e-mail "pagamento recusado".
4. Pagar novamente → sub volta a `active`.
