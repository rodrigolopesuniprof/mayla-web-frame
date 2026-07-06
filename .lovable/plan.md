## Contexto

Você colou uma migration idempotente de um módulo "Ligas + Pontuação". Ela precisa de várias adaptações para este projeto — o schema usa nomes diferentes dos pressupostos do script (`organizations`→`companies`, ledger já existe, `profiles` usa `user_id`, etc.). Também não há UI ainda; a migration sozinha só cria as tabelas.

Abaixo vai o plano do que aplicar (banco) e do que construir depois (frontend), separado em fases pra você aprovar por partes.

---

## Fase 1 — Migration adaptada ao schema real

Ajustes obrigatórios antes de rodar:

- **`organizations` → `companies`**: trocar todas as referências (feature flag, FKs, `mayla_ranking`).
- **`profiles.id` → `profiles.user_id`**: em `mayla_ranking`, o join com `point_events` é por `auth.users.id`; usar `profiles.user_id` e `profiles.company_id`.
- **`point_events` → reusar `public.points_ledger`** (já existe, com 175+ registros históricos, integrado a `award_event`/`award_points`/triggers). Criar `point_events` paralelo dividiria a fonte da verdade e quebraria ranking/níveis atuais. Adicionar apenas a coluna derivada `week_id` (generated) e o índice `(user_id, week_id)`.
- **Feature flag**: `companies.leagues_enabled boolean default false` (em vez de `organizations`).
- **Policy `points_select_self`**: **NÃO** aplicar como escrita. A tabela `points_ledger` já tem policies existentes (admins veem tudo, usuários leem próprios via policy atual). Reviso e mantenho o comportamento atual — não sobrescrevo.
- **`referral_rewards`**: manter como no script, mas com FK opcional a `affiliates.referral_code` (já existe `affiliates` no projeto) para o webhook do Pagar.me popular.
- **Grants obrigatórios** em todas as novas tabelas públicas (`authenticated` + `service_role`) — o script original não inclui e quebraria PostgREST.
- Triggers `add_owner_as_member` e `handle_owner_leaving`: manter como no script.
- Funções `user_xp`, `league_ranking`, `mayla_ranking`, `is_league_member`, `is_league_admin`: manter, apontando para `points_ledger`.

### Tabelas criadas (novas)
- `public.leagues` — 1 ativa por dono (índice único parcial), invite_code, visibilidade pública/privada.
- `public.league_members` — papéis dono/coadmin/membro.
- `public.league_invites` — ponte com `affiliates.referral_code`.
- `public.league_challenges` — desafios não pontuáveis (badge/meta).
- `public.referral_rewards` — lida pelo app, escrita pelo webhook Pagar.me.

### O que **não** faço nesta fase
- Não crio `point_events` (uso `points_ledger`).
- Não mexo em RLS de `points_ledger`, `profiles`, `companies`.
- Não ativo a seção 12 (prêmios / pg_cron) — fica documentada, sem executar.
- Não faço backfill de `week_id` retroativo em `points_ledger` (a coluna `generated` cobre linhas antigas via cálculo, sem migração de dados).

---

## Fase 2 — Frontend (só após Fase 1 aprovada)

Componentes mínimos pra tornar o módulo utilizável:

- **`/ligas` (rota nova)** — lista das minhas ligas + botão "criar liga" (bloqueado se `companies.leagues_enabled = false`).
- **`LeagueDetail`** — placar semanal (via `league_ranking` RPC), membros, invite_code copiável, gestão de papéis se dono.
- **`LeagueInviteAccept`** — landing `/liga/:invite_code` que entra em liga pública ou pede aprovação em privada.
- **Admin toggle** — em `AdminCompanySettings`, checkbox "Habilitar Ligas" que grava `companies.leagues_enabled`.
- **Card "Minha liga" no HomeTab** — atalho para o placar da semana atual.

### O que **não** entra na Fase 2
- Catálogo/premiação (seção 12 do script) — depende de definição de negócio.
- UI de desafios de liga (`league_challenges`) — modelagem existe, tela fica para fase futura.
- Integração de escrita de `referral_rewards` — só leitura no app; escrita é do webhook Pagar.me existente.

---

## Perguntas antes de eu escrever a migration

1. **Confirma reusar `points_ledger`** como fonte única (recomendado) em vez de criar `point_events` paralelo?
2. **Feature flag**: quer `companies.leagues_enabled` (por empresa, controlado no Admin) ou liberar global desde o início?
3. **Fase 2 (UI) entra junto** ou você quer só rodar a migration primeiro e ver o schema no ar antes de eu construir tela?

Responde os 3 pontos e eu já emito a migration adaptada + próximos passos.
