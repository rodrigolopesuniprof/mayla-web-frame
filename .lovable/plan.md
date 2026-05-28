
# Plano — Gamificação Mayla

Aproveita o que já existe (`profiles.points`, RPC `add_points_to_profile`, `collaborative_teams`, `missions`) e adiciona 3 pilares: **Desafio Diário**, **Ranking por Empresa** e **Níveis configuráveis**.

---

## 1. Desafio Diário (curadoria do admin)

**Modelo**
- Admin de cada empresa cadastra um **pool de desafios** (rotulados com pontos, descrição, emoji, tipo de validação reaproveitando o de missões: QR, foto, auto-relato, check-in, survey).
- Job/edge function seleciona 1 desafio por dia por empresa (rotativo determinístico por `date + company_id` para todos verem o mesmo desafio do dia).
- Colaborador conclui → pontos vão para `profiles.points` via RPC existente + registro de conclusão.

**Tabelas novas**
- `daily_challenges` — pool por empresa: `company_id`, `title`, `description`, `emoji`, `points`, `validation_type`, `validation_config` (jsonb), `active`, `sort_order`.
- `daily_challenge_assignments` — escolha do dia: `company_id`, `challenge_id`, `assigned_date` (unique por empresa+data).
- `daily_challenge_completions` — conclusões: `user_id`, `assignment_id`, `completed_at`, `points_awarded` (unique por user+assignment).

**UI**
- **HomeTab**: novo card "Desafio do dia" abaixo do Health Score, com CTA "Concluir".
- **Admin** (`AdminCampaigns` ou nova aba `AdminDailyChallenges`): CRUD do pool + preview do desafio do dia.

---

## 2. Ranking individual por empresa

**Modelo**
- Ranking baseado em `profiles.points` filtrado por `company_id`.
- Suporte a **período**: all-time + mensal (calculado a partir de `points_ledger`).
- Tabela `points_ledger` (nova) registra cada ganho de pontos com `user_id`, `company_id`, `points`, `source` ('rppg' | 'vitals' | 'mission' | 'daily_challenge' | 'medication' | 'level_bonus'), `source_id`, `created_at`. RPC `add_points_to_profile` passa a inserir no ledger também.
- View `company_leaderboard` agrega pontos por período + empresa, com nome/avatar do `profiles` (respeitando privacidade: mostra `full_name` apenas dentro da mesma empresa via RLS).

**UI**
- Nova tela **"Ranking"** dentro da aba **Campanhas** (ou novo botão na HomeTab): top 50 da empresa + posição do usuário, toggle Mês/Geral, pódio top 3.

---

## 3. Níveis (admin define níveis e metas)

**Modelo**
- Cada empresa define sua escala: `levels` com `company_id`, `level_number`, `name` (ex: "Iniciante", "Atleta"), `emoji`, `min_points` (meta para entrar), `bonus_points` (pago ao subir), `badge_title`.
- `user_level_progress` rastreia `user_id`, `current_level`, `reached_at`, `bonus_paid`.
- Trigger/edge function ao inserir em `points_ledger` recalcula nível do usuário: se acumulado ≥ `min_points` do próximo nível → atualiza `current_level`, paga `bonus_points` (cria entrada no ledger source='level_bonus'), grava badge.

**UI**
- **ProfileTab**: barra de progresso "Nível X — faltam Y pts para Z", lista de badges conquistados.
- **Admin** (nova aba `AdminLevels`): CRUD da escala de níveis da empresa, com validação (níveis sequenciais, pontos crescentes).
- **Fallback global**: se a empresa não definir escala, usa uma escala padrão (5 níveis) seeded para `company_id IS NULL`.

---

## 4. Integração com pontuação existente

- Refatorar RPC `add_points_to_profile` para:
  1. Atualizar `profiles.points` (como já faz).
  2. Inserir em `points_ledger` (com `source`, `source_id`).
  3. Chamar `check_user_level(user_id)` que avalia subida de nível.
- Todos os pontos atuais (rPPG +50, Vitals +100, medicação +100, missões) passam a alimentar ledger + ranking + níveis automaticamente, sem mudar chamadas existentes.

---

## 5. Estrutura técnica (apêndice)

**Migrations (todas com GRANT + RLS por `company_id`)**
- `daily_challenges` — admin/company_admin escreve, colaborador da empresa lê ativos.
- `daily_challenge_assignments` — service_role/admin escreve, colaborador da empresa lê do dia.
- `daily_challenge_completions` — colaborador insere/lê o próprio, admin/HR vê agregado.
- `points_ledger` — colaborador lê o próprio, agregação por empresa só via view.
- `levels` — admin/company_admin gerencia, colaborador da empresa lê.
- `user_level_progress` — colaborador lê o próprio, admin/HR agregado.
- View `company_leaderboard` (security invoker, filtra por `company_id = get_user_company_id(auth.uid())`).

**Edge functions / jobs**
- `assign-daily-challenge` (cron diário 00:05 BRT): para cada `company_id` com pool ativo, escolhe e grava `daily_challenge_assignments` do dia.
- `check_user_level` (DB function `SECURITY DEFINER`) chamada via trigger após insert em `points_ledger`.

**Frontend**
- `src/components/mayla/DailyChallengeCard.tsx` (HomeTab).
- `src/components/mayla/LeaderboardScreen.tsx` (acessível pela aba Campanhas).
- `src/components/mayla/LevelProgress.tsx` (ProfileTab).
- `src/components/admin/AdminDailyChallenges.tsx`, `AdminLevels.tsx`.
- Hook `useGamification()` consolidando query de desafio do dia, nível atual e posição no ranking.

**Recompensas (fase 1)**
- Badge + título no perfil quando sobe de nível.
- Pontos bônus do nível creditados via ledger.
- Sem desbloqueio de conteúdo/serviço nesta fase (deixa preparado o campo `unlock_config jsonb` em `levels` para extensão futura).

---

## Fora do escopo desta fase
- Ranking por times colaborativos (fica para fase 2 — base do ledger já permite).
- Temporadas sazonais com reset (ledger por período já cobre mensal, reset visual fica para depois).
- Recompensas materiais / desbloqueio de serviços.
- Notificações push do desafio do dia (fica como melhoria após validar).
