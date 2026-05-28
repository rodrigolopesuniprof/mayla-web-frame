# 2ª onda — Unificar pontuação via `award_event`

Migrar todos os triggers/RPCs antigos para consultarem `point_rules` (via `award_event`), garantindo que pontos, caps, ativo/inativo e validade configurados no admin valham para 100% das fontes.

## Migration única

Reescrever as 5 funções existentes para delegar a `public.award_event`:

1. **`add_points_on_mission_complete`** → chamar `award_event(_user_id, 'mission_complete', mission_id)`. Como a missão tem pontos próprios (`missions.points`), `award_event` recebe um novo parâmetro opcional `_override_points` ou — alternativa mais limpa — manter `award_points` para missões mas adicionar checagem de `point_rules.active` para o evento `mission_complete` (kill switch global).
2. **`complete_daily_challenge`** → substituir `award_points(...,'daily_challenge',...)` por `award_event(...,'daily_challenge',...)`. Pontos do desafio (`daily_challenges.points`) seguem o mesmo padrão da missão (override).
3. **`award_medication_points`** → trocar lógica direta por `award_event(...,'medication_adherence',...)`.
4. **`award_esf_link_points`** → trocar `+500` hardcoded por `award_event(...,'esf_link',...)`.
5. **`award_support_team_link_points`** → trocar `+500` hardcoded por `award_event(...,'support_team_link',...)`.

## Ajuste em `award_event`

Adicionar parâmetro opcional `_override_points integer DEFAULT NULL`:
- Se `_override_points` IS NOT NULL → usa esse valor (caso missões/desafios com pontos próprios)
- Senão → usa `point_rules.points`
- `active`, validade e caps continuam aplicáveis em ambos os casos
- Quando `active = false` → retorna `{ok:false, reason:'inactive'}` e nada é creditado (kill switch funciona pra todos)

## Survey/Questionário

Buscar se há call site de pontos em `HealthSurvey.tsx`/`QuestionnaireRunner.tsx`. Se houver hardcoded, refatorar para `award_event(..., 'survey_complete')`. Se não houver, apenas documentar que o evento existe nas regras para uso futuro.

## Validação

- Após a migration, confirmar que `point_rules` tem as 11 entradas seedadas para empresas existentes (rodar `seed_default_point_rules` para `company_id IN (SELECT id FROM companies)` onde faltar).
- Testar: desativar `mission_complete` no admin → completar missão → nenhum ponto creditado e nada no `points_ledger`.

## Fora de escopo
- Sem mudança em billing, Meddit, Jitsi, auth.
- Sem mudança de UI (toasts permanecem como estão; pontos exibidos vêm do retorno da RPC quando aplicável).
