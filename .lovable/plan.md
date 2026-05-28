# Corrigir pontuação mensal zerada no ranking

## Causa raiz

A view `company_leaderboard` calcula `month_points` somando `points_ledger` filtrado pelo mês atual. Porém o `points_ledger` está **vazio** (0 linhas). Os pontos atuais nos perfis vieram de triggers/funções legadas que escrevem direto em `profiles.points` sem registrar no ledger:

- `add_points_on_mission_complete()` — missões completadas
- `award_medication_points()` — adesão a medicamentos
- `award_esf_link_points()` / `award_support_team_link_points()` — bônus de vínculo
- Updates manuais e migrações antigas

Apenas as funções novas (`award_points`, `add_points_to_profile`, `check_user_level`) registram no ledger.

## Correção

Migração única que atualiza as funções legadas para também inserir no `points_ledger`. Assim, **toda nova pontuação concedida passa a contar no ranking mensal**. Pontos históricos permanecem em `profiles.points` (ranking "Geral" continua correto); não fazemos backfill porque pontos antigos não foram ganhos "este mês".

### Funções a atualizar

1. `add_points_on_mission_complete()` — após o `UPDATE profiles`, inserir em `points_ledger` com `source = 'mission'`, `source_id = NEW.mission_id`, `description = 'Missão completada'`.

2. `award_medication_points()` — após o `UPDATE profiles`, inserir em `points_ledger` com `source = 'medication'`, `source_id = NEW.id`, `description = 'Adesão a medicamento'`.

3. `award_esf_link_points()` / `award_support_team_link_points()` — essas funções rodam em `BEFORE UPDATE` em `profiles` e mexem em `NEW.points`. Adicionar `INSERT INTO points_ledger` com `source = 'team_link'`, `description = 'Bônus por vínculo de equipe'`, 500 pontos.

Em todas, ler `company_id` do próprio NEW/profiles para preencher a coluna `company_id` do ledger.

## Validação pós-migração

- Conceder 1 ponto de teste via `award_points()` → checar que `month_points` reflete no leaderboard "Este mês".
- Completar uma missão de teste → checar entrada nova em `points_ledger` e atualização do `month_points`.

## Fora de escopo

- Backfill histórico para o mês atual (criaria pontuação mensal artificial).
- Alteração da view, do componente `LeaderboardScreen.tsx` ou de qualquer UI.
- Lógica de níveis, badges, desafios.
