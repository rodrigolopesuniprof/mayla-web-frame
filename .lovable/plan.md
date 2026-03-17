

# Plano: Corrigir Status Online e Fluxo de Atendimento Imediato

## Problemas Identificados

### 1. Status Online some ao atualizar a página
O `OnlineStatusToggle` usa `useState(initialOnline)` — quando a página carrega, se não existe registro em `professional_online_status` para esse profissional, `statusData` retorna `null`, então `initialOnline = false`. Quando o profissional liga o toggle, o `update` falha (sem registro), e o fallback `upsert` cria o registro — mas na próxima recarga, os valores voltam ao estado correto **somente se o registro existir**. O problema real é que o `update` pode falhar silenciosamente (0 rows affected sem erro) e o upsert não é chamado. Além disso, ao recarregar, o `OnlineStatusToggle` recebe `initialOnline` e `initialAcceptsOnDemand` do fetch no dashboard — se o fetch retorna dados corretos, deveria funcionar. Preciso verificar se o `update` sem match retorna erro ou apenas 0 rows.

**Causa raiz**: O Supabase `.update().eq()` retorna sucesso mesmo com 0 linhas afetadas. O fallback `upsert` só roda quando há `error`, então quando não há registro, o toggle "salva" sem errar mas sem persistir nada.

### 2. Atendimento imediato não aparece para ninguém
O on-demand cria uma consulta com `status: "waiting"` e `professional_id` do profissional pareado. O `WaitingQueue` do profissional filtra por `.in("status", ["confirmed", "waiting"])` — deveria funcionar. O problema pode ser de RLS ou de que a publicação realtime não dispara para o profissional.

## Correções

### A. Fix: Status Online persistente
- Alterar `OnlineStatusToggle.updateStatus` para usar **upsert** sempre (em vez de update + fallback). Isso garante que o registro é criado na primeira vez e atualizado nas seguintes.

### B. Fix: Criar registro de status automaticamente no cadastro
- Quando o profissional faz login pela primeira vez e o `professional_online_status` não existe, criar automaticamente no `ProfessionalDashboard` durante o fetch.

### C. Fix: Atendimento imediato visível no painel profissional
- Verificar se o `WaitingQueue` está filtrando corretamente pelo `consultation_flow_type` (atualmente não filtra — busca todos os status `confirmed`/`waiting`, o que está correto).
- O problema pode ser que consultas on-demand com `status: "waiting"` estão sendo criadas mas a query do profissional não as retorna por timing. Adicionar log e garantir que a subscription realtime está ativa.
- Garantir que o realtime está habilitado para `consultations` (já está).

### D. Fix: Paciente não vê resultado
- O `WaitingRoom` do paciente subscreve a `consultations` por `id` — se a consulta foi criada corretamente, deveria funcionar. Verificar se o insert retorna sucesso.

## Arquivos a Editar

| Arquivo | Mudança |
|---|---|
| `OnlineStatusToggle.tsx` | Trocar update+fallback por upsert direto |
| `ProfessionalDashboard.tsx` | Auto-criar registro de `professional_online_status` se não existe |
| `WaitingQueue.tsx` | Adicionar fallback para refetch periódico além do realtime |
| `OnDemandFlow.tsx` | Adicionar tratamento de erro mais visível e garantir que `municipality_id` não bloqueia o insert |

