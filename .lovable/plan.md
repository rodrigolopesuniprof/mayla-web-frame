## Ajustes no módulo de Ligas

### 1. Remover banner de Ligas da Home
- Em `src/components/mayla/HomeTab.tsx`, retirar o uso de `<MyLeagueCard />` (linha 197) e a prop `onOpenLeagues`/`onOpenLeague` no HomeTab.
- Ajustar `MaylaApp.tsx` para não passar essas props ao HomeTab (mantém navegação pela aba Desafios).
- Manter o arquivo `MyLeagueCard.tsx` por enquanto (não usado) para eventual reaproveitamento — ou remover se preferir limpeza. Proposta: **remover** o arquivo.

### 2. Proprietário escolhe atividades da liga
Objetivo: cada liga pontua apenas nas atividades selecionadas pelo dono.

**Schema (migration):**
- Adicionar coluna `scoring_event_keys text[] not null default '{}'` em `public.leagues`. Array vazio = todos os eventos (comportamento atual).
- Atualizar `public.league_ranking(p_league_id, p_week_id)` para filtrar `points_ledger.source` por `scoring_event_keys` quando o array não estiver vazio.

**UI:**
- Na criação da liga (`LeaguesPanel.tsx`): novo passo/seção "Atividades que pontuam" com checkboxes lendo `public.point_rules` da empresa (event_key, label, emoji). Default: nada marcado = todas.
- No `LeagueDetailPanel.tsx`: botão "Editar atividades" visível para dono/coadmin, abrindo um dialog com a mesma lista.

### 3. Dono pode promover coadmins
- Em `LeagueDetailPanel.tsx`, na lista de membros, quando `isOwner === true` e o membro não for o dono:
  - Botão "Tornar coadmin" (se `papel === 'membro'`) → `UPDATE league_members SET papel='coadmin'`.
  - Botão "Remover coadmin" (se `papel === 'coadmin'`) → volta para `'membro'`.
- RLS: verificar/garantir política que permita ao dono atualizar `papel` em `league_members` da sua liga (adicionar policy se faltar).

### 4. Link de convite como afiliado (base — integração completa depois)
Escopo desta entrega (mínimo viável para rastrear):
- Ao gerar/copiar o link de convite em `LeagueDetailPanel.tsx`, anexar `?ref=<affiliate_code>` quando o dono possuir um `affiliates.referral_code` (consulta rápida na tabela `affiliates` pelo `user_id` do dono).
- Se o dono ainda não tiver affiliate, criar automaticamente uma linha em `public.affiliates` (usar `generate_referral_code()` já existente).
- Em `LeagueJoin.tsx`, ler `?ref=` da URL e persistir no `sessionStorage` como `pending_affiliate_ref` (ainda sem gravar comissão — só rastreio).
- **Não** implementar cálculo/split de comissão nesta fase — apenas a infraestrutura de rastreio.

### Arquivos afetados

**Migration (nova):**
- `leagues.scoring_event_keys` + atualização de `league_ranking()`.
- Policy (se necessário) para dono atualizar `papel` em `league_members`.

**Frontend:**
- `src/components/mayla/HomeTab.tsx` — remover MyLeagueCard.
- `src/components/mayla/MaylaApp.tsx` — remover props relacionadas.
- `src/components/mayla/MyLeagueCard.tsx` — deletar.
- `src/components/mayla/leagues/LeaguesPanel.tsx` — seleção de atividades na criação.
- `src/components/mayla/leagues/LeagueDetailPanel.tsx` — editar atividades, promover coadmin, gerar link com `?ref=`.
- `src/pages/LeagueJoin.tsx` — capturar `?ref=` no sessionStorage.

### Fora do escopo (fica para depois)
- Cálculo de comissão real do afiliado por convite de liga.
- UI de painel de afiliados dentro do contexto de ligas.
