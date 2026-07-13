## Problema
No ranking da liga padrão da empresa (Liga Mayla / UNIPROF), aparece "0 membros" e "Ninguém pontuou". Os colaboradores existentes não foram inscritos automaticamente na `league_members` da liga padrão — só entram novos perfis (via trigger `profiles_join_default_league`). O backfill original rodou uma vez na migração, mas usuários criados depois (ou profiles cuja `company_id` foi setada sem disparar o trigger corretamente) ficaram de fora, resultando em ranking vazio.

## Regra
- Ligas **padrão** (`is_default = true`): todos os perfis da empresa são membros automaticamente, sem etapa de aceite.
- Ligas **criadas por usuários** (`is_default = false`): continuam com convite/aceite como hoje.

## Alterações

### 1. Migração de banco
- Atualizar `ensure_default_league(_company_id)` para sempre reconciliar membros: inserir todo `profile` da empresa que ainda não esteja em `league_members` (idempotente, `ON CONFLICT DO NOTHING`). Já faz isso, mas garantir que o path "liga já existe" também rode o backfill (hoje roda — validar).
- Rodar um `DO $$` de backfill para todas as empresas existentes, invocando `ensure_default_league` novamente agora.
- Garantir que o trigger `profiles_join_default_league` dispare também em `UPDATE` de `company_id` (já está) e adicionar um pequeno RPC público `join_default_league()` que o front chama ao entrar na tela, como rede de segurança.

### 2. Frontend
- Em `src/components/mayla/leagues/LeagueDetailPanel.tsx` (e/ou `LeaguesPanel.tsx`), quando `league.is_default = true`, chamar `supabase.rpc("ensure_default_league", { _company_id })` uma vez no mount antes de carregar o feed — isso reconcilia a lista caso algum perfil tenha ficado fora.
- Nenhuma mudança para ligas privadas (fluxo de aceite preservado).

## Resultado
Todos os colaboradores da empresa aparecem automaticamente no ranking da liga padrão. Ligas privadas continuam exigindo entrada explícita via convite.
