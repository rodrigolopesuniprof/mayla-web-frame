# Corrigir falso "pagamento recusado" quando charge está pendente

## Causa raiz

Em `supabase/functions/pagarme-create-subscription/index.ts` (fluxo cartão):

- Polling de apenas **6 segundos** (4 × 1.5s).
- Se `chargeStatus !== "paid"` ao final, o código:
  - faz `DELETE /subscriptions/{id}` no Pagar.me,
  - retorna `payment_failed` com mensagem "Cartão recusado",
  - não cria a conta local.

Mas `pending` / `processing` não são recusa — significam que o adquirente ainda está respondendo. Como vimos no log, `chargeId: undefined`, ou seja, a charge nem tinha sido criada ainda na primeira leitura. O Pagar.me efetivamente autorizou depois, mas nós já tínhamos cancelado/errado.

## Mudanças

### 1. `supabase/functions/pagarme-create-subscription/index.ts` — fluxo cartão

**Aumentar e diferenciar estados:**

- Polling: até **12 tentativas × 2s = 24s** (margem segura sem estourar timeout da edge function).
- Estados terminais de falha: `failed`, `refused`, `canceled`, `chargedback`. Apenas estes acionam o caminho de erro.
- `pending` / `processing` / charge ausente → **NÃO** é falha.

**Novo fluxo de decisão depois do polling:**

```
if chargeStatus in [failed, refused, canceled, chargedback]:
    cancela subscription no Pagar.me
    retorna { ok:false, error:"payment_failed", message: <motivo real> }

else if chargeStatus == "paid":
    cria usuário (se novo) + grava subscription com status="active"
    grava invoice "paid"
    retorna { ok:true, status:"active" }

else:  # pending / processing / charge ainda não emitida
    NÃO cancela a subscription
    cria usuário (se novo) + grava subscription com status="pending"
    grava invoice "pending"
    retorna { ok:true, status:"pending", message:"Pagamento em confirmação..." }
```

O webhook `charge.paid` / `charge.payment_failed` (já existente) é quem finaliza:
- `charge.paid` → muda subscription para `active` e invoice para `paid`.
- `charge.payment_failed` → muda para `past_due`/`canceled` conforme a regra atual do webhook.

**Persistência dos campos billing_*** (já implementada) permanece em ambos caminhos (active/pending).

### 2. `src/pages/Subscribe.tsx`

Tratar a nova resposta `ok:true, status:"pending"`:

- Toast informativo (`toast.success` ou `toast`): "Pagamento em processamento. Você receberá a confirmação em instantes." 
- Redirecionar para a tela de boas-vindas/dashboard normalmente — a UI já deve refletir o status `pending` (login funciona porque a conta foi criada).
- Continuar mostrando erro apenas quando `ok:false`.

### 3. Mensagem de erro real (quando for falha de verdade)

Manter a extração já presente:
```
firstCharge?.last_transaction?.acquirer_message
?? gateway_response?.errors?.[0]?.message
?? refuse_reason
?? "Pagamento não autorizado pela operadora"
```
Mas só usar essa mensagem quando o status for realmente terminal de falha.

## Fora de escopo

- Webhook (`pagarme-webhook`) — já existe e trata `charge.paid` para ativar; nenhuma mudança necessária se ele já procura subscription pelo `pagarme_subscription_id`. Verificar apenas que ele atualiza `status` de `pending` → `active`. Se não atualizar, ajustar nesta mesma alteração.
- PIX, RLS, schema, afiliados.

## Validação

1. Refazer assinatura com cartão real.
2. Caso a charge confirme em <24s: resposta `ok:true, status:"active"`, conta criada, sub ativa.
3. Caso demore mais: resposta `ok:true, status:"pending"`, conta criada, sub `pending`, e o webhook a promove para `active` quando o Pagar.me confirmar.
4. Caso o adquirente realmente recuse: resposta `ok:false` com a mensagem real do adquirente (não mais um falso negativo).
