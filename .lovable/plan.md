# Finalizar Engine de Pontuação Centralizada

Já criamos as tabelas (`point_rules`, `rewards`, `reward_grants`, `public_dashboard_tokens`), as funções `award_event` e `get_public_dashboard`, e a UI admin (`AdminGamification`, `AdminPointRules`, `AdminRewards`, `AdminPublicDashboard`) + página pública `PublicLeaderboard.tsx`.

Faltam 2 passos para tudo funcionar de ponta a ponta:

## 1. Registrar rota pública

Em `src/App.tsx`, adicionar:
```
<Route path="/painel-publico/:token" element={<PublicLeaderboard />} />
```
Rota fora do guard de auth, para permitir compartilhamento externo.

## 2. Refatorar call sites para usar `award_event`

Substituir chamadas hardcoded de pontos por `supabase.rpc('award_event', { _event_key: '...' })`. Cada uma respeita pontos e caps definidos no admin.

| Arquivo | Evento hoje | event_key |
|---|---|---|
| `AvatarCustomizerButton.tsx` | +150 ao salvar avatar DiceBear | `avatar_dicebear` |
| `RppgCapture` / hook rPPG | +50 medição | `rppg_measurement` |
| `BinahCapture` / vitals | +100 medição completa | `vitals_measurement` |
| `WellbeingCheckin` | +100 check-in semanal | `weekly_checkin` |
| `MissionComplete` | +100 missão | `mission_complete` |
| `Medication` daily | +100 adesão | `medication_adherence` |
| Daily challenge | variável | `daily_challenge` |
| Vincular ESF | pontos | `esf_link` |
| Vincular Time | pontos | `support_team_link` |
| Survey complete | pontos | `survey_complete` |

Comportamento:
- Sucesso → toast "+X pts" usando `points` retornado pela RPC (não mais hardcoded).
- `cap_reached` → toast "Você já atingiu o limite desta atividade".
- `rule_inactive`/`not_found` → silencioso (admin desativou).

Remover lógica antiga de `add_points_to_profile` + tabela auxiliar `avatar_points_awarded` nos componentes (a função `award_event` já controla cap via `points_ledger`).

## 3. Seed de regras padrão por empresa

Garantir que toda empresa tenha as 10 regras default ativas. Trigger `AFTER INSERT ON companies` que copia template para `point_rules` (já incluído na migration anterior — confirmar e, se faltar, adicionar).

## Fora de escopo
- Sem mudança em billing, Meddit, Jitsi, auth, RLS de outras tabelas.
- Notificações de prêmio continuam manuais (mailto/wa.me) — já implementado em `AdminRewards`.
