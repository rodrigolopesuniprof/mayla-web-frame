

# Plano: Botão de Cancelar Solicitação (estilo Uber)

## O que será feito

Adicionar um botão de cancelamento na `WaitingRoom` que:
1. Atualiza o status da consulta para `cancelled` no banco
2. Mostra confirmação antes de cancelar (dialog simples)
3. Após cancelar, chama `onBack` para voltar ao início
4. Visualmente destacado em vermelho, posicionado na parte inferior da tela de espera

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/mayla/WaitingRoom.tsx` | Adicionar estado `cancelling`, função `handleCancel` que faz update da consulta para `cancelled`, dialog de confirmação, e substituir o botão "Cancelar e voltar" por um botão vermelho estilo Uber com confirmação |

## Comportamento

- Enquanto o estado for `waiting_professional` ou `confirmed`, exibe botão "Cancelar solicitação"
- Ao clicar, mostra confirmação inline: "Tem certeza?" com "Sim, cancelar" e "Não"
- Ao confirmar: `supabase.from("consultations").update({ status: "cancelled" }).eq("id", consultationId)` → toast de sucesso → `onBack()`
- Durante o cancelamento, botão fica desabilitado com loading
- Não exibe o botão quando `in_progress`, `completed` ou `cancelled`

