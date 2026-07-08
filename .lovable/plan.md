
# Redesenho do módulo Ligas — Mayla Saúde

## Escopo
Aplicar o design final (bege quente, Newsreader/Instrument Sans, coral/dourado, cards escuros) **apenas dentro do módulo Ligas**, restruturar a navegação do detalhe da liga, montar o feed ao vivo com dados derivados do que já existe e adicionar a tabela `league_pokes` para cutucadas/torcidas/recados.

## 1. Tokens & fontes (escopados)

- Instalar `@fontsource/newsreader` e `@fontsource/instrument-sans` via bun; importar em `src/main.tsx`.
- Em `src/components/mayla/leagues/leagues.css` (novo): variáveis escopadas por `.liga-scope`:
  - `--liga-canvas #f4efe6`, `--liga-card #fff`, `--liga-ink #2e2a26`, `--liga-ink-soft #7b746c`, `--liga-hairline rgba(46,42,38,.1)`, `--liga-coral #df6a4d`, `--liga-steel #567095`, `--liga-pill-blue #eef1f5`, `--liga-gold #c9973a`, `--liga-gold-bg #f6ecd4`, `--liga-gold-ink #8a5f16`, `--liga-green #8fd6a0`, `--liga-alert-bg #fbe9e3`, `--liga-alert-ink #b8543a`, `--liga-dark #2e2a26`, `--liga-on-dark #f4efe6`.
  - Utilitários locais (`.liga-serif`, `.liga-sans`, `.liga-card`, `.liga-pill`, `.liga-bar`, `.liga-dark-card`, `.liga-gold-card`, `.liga-coral-card`) — nenhuma classe Tailwind global alterada.
- Envelope: a raiz de `LeaguesPanel`, `LeagueDetailPanel`, `LeagueManagePanel`, `LeagueInvitePanel` e a nova caixa de recados recebe `className="liga-scope"`.

## 2. Hub "Minhas ligas" (`LeaguesPanel.tsx`)

Estrutura de cima para baixo:

1. **Header** "Ligas" (serifa 30px) + avatar coral com badge de streak (usa `useDailyStreak`).
2. **Faixa de estado da semana** (card escuro):
   - Posição + nome da liga selecionada (default Liga Mayla), variação de posição no dia (compara `mayla_ranking` de hoje vs. `points_ledger` de ontem — cálculo client), countdown até virada da semana (domingo 23:59 America/Sao_Paulo).
   - Barra `pontos_semana / weekly_goal` (`get_effective_goals`).
   - Rodapé: `Nível N · {user_xp} XP vitalício ∞` + selo "não zera".
3. **Foco da semana** (card âmbar): copy fixa "Caminhada rende 2× essa semana" + fallback quando não há evento âmbar. Botão "Registrar" → abre HomeTab (rota `home` do MaylaApp).
4. **Switcher de ligas** (pills): "🏆 Liga Mayla" · pills das minhas ligas · "+ código". Alterna qual liga alimenta feed/faixa.
5. **Feed ao vivo** (derivado, sem persistência nova):
   - Alerta de queda: se `posicao > 1` e delta para posição anterior ≤ 30pts → card escuro com CTA "Bater meta agora".
   - Desafio relâmpago: primeira `league_challenges` da semana em aberto (card âmbar + "Entrar").
   - Evento de pontuação: 3 últimas linhas de `points_ledger` da liga (join com `league_members`) com pontos ≥ 100 → "X bateu Y pts 🔥" + "Torcer/Alcançar" (grava `league_pokes` tipo `torcer`).
   - Cutucar parado: membros sem `points_ledger` há ≥ 48h → "Cutucar" (grava `league_pokes` tipo `cutucar`).
   - Streak coletivo: contagem de membros que pontuaram hoje vs. total (card coral-tint).
   - Convite viral: `league_prize_eligible` para a liga selecionada (card escuro com barra x/10).
6. **Rodapé fixo:** "+ Criar liga" (desabilita com nota se já tem 1 ativa) · "Entrar por código". Linha fina informativa.

## 3. Detalhe da liga (`LeagueDetailPanel.tsx`) — reestrutura de navegação

Substituir o layout Tabs por **sub-rotas internas** com header consistente `← Nome da liga`:

- **/ranking** (default): top 3 em pódio dourado + lista completa com Nv + pontos/semana.
- **/desafios**: `league_challenges` (aberto/em andamento/encerrado) e histórico de vencedores.
- **/membros**: nova UX (ver §4).
- **/recados**: nova caixa de recados da liga (ver §6).
- **/gerenciar** (dono/coadmin): mantém painel atual.

Navegação por barra segmentada abaixo do header: `Ranking · Desafios · Membros · Recados`, com ação `⋯` que abre gerenciar quando admin. Estado local via `useState<'ranking'|'desafios'|'membros'|'recados'>`.

## 4. Membros com ações contextuais

Lista renderiza cada linha com regra:
- Você → borda coral, chip "Dono/Coadmin/Membro · Nº · pts", tag Nv.
- Líder (posição 1, ≠ você) → botão âmbar "🔥 Provocar".
- Sem pontos há ≥ 48h → borda coral, botão coral "👉 Cutucar".
- Posição = minha ± 1 → botão azul "👏 Torcer".
- Demais → botão neutro "Recado".

Banner escuro no topo: "📣 Manda um recado pra liga toda" + "Novo recado" (broadcast — abre compositor com `to_user = null`).

## 5. Compositor de recado (bottom-sheet)

Novo componente `LeaguePokeComposer.tsx` (Dialog full-height mobile):
- Grabber + título dinâmico ("Cutucar Sandra" / "Torcer por José" / "Recado pra liga").
- 3 grupos de chips (👉 Cutucar / 🔥 Provocar / 👏 Torcer) com atalhos textuais listados no prompt.
- Prévia + textarea (max 140 chars).
- Botão coral "Enviar recado" → `insert` em `league_pokes`.
- Nota anti-spam com o limite ativo do tipo.

## 6. Caixa "Recados da liga"

Sub-view `/recados` do detalhe **e** mini-widget acessível pela home do hub (badge no avatar). Renderiza `league_pokes` onde `to_user = auth.uid()` OU `to_user IS NULL AND league_id ∈ minhas`:
- Cutucada recebida (borda coral) → botões "🎯 Bater meta" (nav home) e "↩ Responder" (compositor).
- Torcida (`tipo='torcer'`) → "Agradecer" (envia torcida de volta).
- Broadcast (`to_user null`, card escuro).
- Sistema (para "ultrapassado por X"): derivado de mudanças em `posicao` — sem persistência, calculado client via comparação de rankings entre polling.

Push nativo fica para depois — apenas registra `notifications` com `scope='personal'` no insert de poke direto (trigger `notify_league_poke`).

## 7. Backend — migration única

Tabela nova:

```sql
CREATE TABLE public.league_pokes (
  id uuid PK default gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NULL,            -- null = broadcast pra liga
  tipo text NOT NULL CHECK (tipo IN ('cutucar','torcer','provocar','recado')),
  texto text NOT NULL CHECK (char_length(texto) <= 200),
  created_at timestamptz DEFAULT now()
);
```
GRANTs para `authenticated` e `service_role` (sem anon). Índices: `(league_id, to_user, created_at desc)`, `(from_user, to_user, tipo, created_at)`.

RLS:
- INSERT: `from_user = auth.uid()` AND `is_league_member(league_id)`.
- SELECT: `is_league_member(league_id)` AND (`to_user = auth.uid()` OR `to_user IS NULL` OR `is_league_admin(league_id)`).
- DELETE: `from_user = auth.uid()` OR `is_league_admin(league_id)`.

Trigger de trava 1/dia (só `cutucar`):

```sql
CREATE FUNCTION public.enforce_poke_rate_limit() RETURNS trigger ...
IF NEW.tipo = 'cutucar' AND EXISTS(
  SELECT 1 FROM league_pokes
  WHERE from_user = NEW.from_user AND to_user = NEW.to_user
    AND tipo = 'cutucar'
    AND created_at::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
) THEN RAISE EXCEPTION 'poke_rate_limit'; END IF;
```

Trigger opcional `notify_league_poke` que cria linha em `public.notifications` para o alvo quando `to_user IS NOT NULL`.

Habilitar Realtime em `league_pokes` (ADD TABLE ao `supabase_realtime`) para atualizar caixa em tempo real (subscription dentro de useEffect).

**Não** cria/altera `point_events` ou `referral_rewards` — respeitando invariante do prompt.

## 8. Aba Desafios (`CampanhasTab.tsx`)

Apenas revisar copy/tokens: raiz `liga-scope`, header serifa "Desafios", CTA principal "Minhas ligas" abre `LeaguesPanel`. Nenhuma outra mudança funcional.

## Arquivos afetados

Novos: `src/components/mayla/leagues/leagues.css`, `LeaguePokeComposer.tsx`, `LeagueMessagesBox.tsx`, `useLeagueFeed.ts` (agregador), migration SQL única.

Editados: `LeaguesPanel.tsx`, `LeagueDetailPanel.tsx`, `LeagueManagePanel.tsx`, `LeagueInvitePanel.tsx`, `CampanhasTab.tsx`, `src/main.tsx` (imports de fontes), `src/integrations/supabase/types.ts` (após migration).

## Detalhes técnicos

- **Countdown**: `useEffect` com `setInterval(60_000)` calculando `dueDate = próximo domingo 23:59 -03:00`.
- **Feed derivado**: hook `useLeagueFeed(leagueId)` faz `Promise.all` de rankings/ledger/challenges/prize e devolve array tipado de cards; polling a cada 30s + subscription realtime em `league_pokes`.
- **Anti-spam client-side**: desabilita botão "Cutucar" pra alvo já cutucado hoje (checagem via `league_pokes` local após insert).
- **Tokens não vazam**: nenhum utilitário Tailwind global adicionado; `.liga-scope` isola CSS variables e fontes.
- **Sem alterações no schema global** exceto a nova tabela + trigger + publication.

## Ordem de implementação

1. Migration `league_pokes` + trigger + realtime.
2. Fontes + `leagues.css` + wrappers `liga-scope`.
3. `LeaguesPanel` (faixa, foco, switcher, feed, rodapé).
4. `LeagueDetailPanel` reestruturado + membros com ações.
5. `LeaguePokeComposer` + `LeagueMessagesBox`.
6. Ajustes `CampanhasTab` + smoke test via Playwright em `/`.
