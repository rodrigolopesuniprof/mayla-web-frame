## Objetivo

Hoje `MAYLA_LEAGUE_ID = "__mayla__"` é um sentinel virtual — não existe linha em `leagues`, então Desafios/Recados/Cutucadas ficam bloqueados. Vamos substituir por uma **liga padrão real** criada automaticamente para cada empresa, com o nome da própria empresa (Mayla Saúde, UniPROF, Meddit, etc.), e um switch de admin que libera as conversas entre os participantes.

## 1. Backend (migration)

Alterações em `public.leagues`:
- `is_default boolean not null default false` — marca a liga padrão da empresa (única por `company_id`, index parcial).
- `conversations_enabled boolean not null default false` — controla se recados/cutucadas/composer aparecem.

Funções + gatilhos (SECURITY DEFINER, `search_path=public`):
- `ensure_default_league(_company_id uuid) returns uuid` — se não existir liga com `is_default=true` para a empresa, cria uma:
  - `nome = companies.name`, `visibilidade='publica'`, `status='ativa'`, `owner_id` = primeiro `user_roles.role='company_admin'` da empresa (fallback: primeiro profile), `is_default=true`, `conversations_enabled=false`, `marca_logo_url = companies.logo_url`.
  - Insere todos os `profiles.company_id = _company_id` como membros (`papel='membro'`, o dono sobrescrito para `'dono'`).
- Trigger `after insert on companies` → chama `ensure_default_league(NEW.id)`.
- Trigger `after insert on profiles` → se `NEW.company_id is not null`, insere membro na liga padrão da empresa (ignore conflict).
- Backfill: `select ensure_default_league(id) from companies;`

Regras/Policies:
- Ninguém pode deletar a liga default nem alterar `is_default` via UI; a policy de UPDATE existente permanece, e adicionamos check em `LeagueManagePanel` para esconder "Arquivar".
- `handle_owner_leaving` já existe — se dono da default sair, transfere automaticamente. OK.

## 2. Frontend

### `constants.ts`
- Remove `MAYLA_LEAGUE_ID` e `isMaylaLeague`. Substitui por hook `useDefaultLeague(companyId)` que busca `leagues where company_id=? and is_default=true` uma vez.

### `LeaguesPanel.tsx`
- No lugar do card fixo "Liga Mayla", renderiza a liga default retornada pelo hook, com nome/logo da empresa. Se ainda estiver carregando, mantém skeleton. Comportamento de `onOpen(defaultLeague.id)` é idêntico às outras.

### `LeagueDetailPanel.tsx`
- Remove todo o branch `isMayla`. Passa a checar `league.is_default` e `league.conversations_enabled`:
  - Abas Ranking, Desafios, Membros sempre visíveis.
  - Aba **Recados** só aparece se `conversations_enabled=true`.
  - Chips "Cutucar / Torcer / Provocar / Recado" e composer só aparecem se `conversations_enabled=true`.
  - Se `conversations_enabled=false` e usuário é admin, mostra call-to-action "Liberar conversas na liga" que abre `LeagueManagePanel`.
  - Se `is_default=true`, esconde botão "Sair da liga" (participação automática).

### `LeagueManagePanel.tsx`
- Adiciona switch **"Liberar conversas entre os participantes"** que faz `update leagues set conversations_enabled=? where id=?`. Visível só para `dono`/`coadmin`.
- Para `is_default=true`: esconde "Arquivar liga" e o campo de renomear (nome segue `companies.name`).

### `DesafiosTab.tsx` / `LeaguesPanel.tsx`
- Nenhuma mudança estrutural — só param de tratar Mayla como caso especial.

## 3. Fora de escopo

- Não mexe em `league_pokes` (schema, RLS, notificações, rate-limit já funcionam com league_id real).
- Não muda ranking/scoring: a liga padrão herda `scoring_event_keys` default (`{}` = todas as fontes), preservando o comportamento atual da "Liga Mayla" que somava tudo.
- Sem migração de dados históricos — o feed simplesmente passa a ler da liga real a partir do momento em que é provisionada.

## Detalhes técnicos

- Migration única com CREATE das colunas, function, triggers, GRANT (leagues já tem grants), backfill.
- Regenerar types após approve da migration; então aplicar as edições no frontend.
- Fluxo de teste: (1) abrir aba Desafios como colaborador → vê liga com nome da empresa; (2) como admin, ligar toggle → aba Recados e chips aparecem; (3) enviar recado/cutucada → gravado com `league_id` real, notifica membros.
