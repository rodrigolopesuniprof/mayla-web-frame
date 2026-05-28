## Mover regra de pontos da missão para dentro de cada Missão

Hoje, "Missão concluída" aparece como uma regra única em **Regras de Pontos** (com pontos base, caps de dia/semana/mês/total, validade, ativo/inativo). Isso é confuso porque cada missão já tem seus próprios pontos no admin de Missões — e o cap global se aplica a todas as missões juntas, o que raramente é o desejado.

### Mudança

**1. Admin → Missões (`AdminMissions.tsx`)**
No formulário de cada missão, adicionar uma seção "Regras de pontuação" com:
- Ativo/Inativo (já existe via `active`)
- Pontos (já existe)
- Máx/dia, Máx/semana, Máx/mês, Máx total (lifetime)
- Válido a partir de / Válido até

Esses campos passam a viver na própria tabela `missions` (novas colunas: `cap_per_day`, `cap_per_week`, `cap_per_month`, `cap_lifetime`, `valid_from`, `valid_until`).

**2. Admin → Regras de Pontos (`AdminPointRules.tsx`)**
Esconder a linha `mission_complete` do listing (filtro client-side). A regra continua no banco apenas como fallback técnico, mas o admin não vê mais — evita duplicidade de UI.

**3. Engine (`award_event`)**
Quando `_event_key = 'mission_complete'` e `_source_id` for o id da missão, usar caps/validade/active da **missão** em vez do `point_rules`. Para qualquer outro evento, comportamento atual permanece.

Implementação: nova função `award_mission_event(_user_id, _mission_id)` chamada pelo trigger `add_points_on_mission_complete`, que:
- lê `missions.active`, `points`, `valid_from`, `valid_until`, caps
- valida caps consultando `points_ledger` por `source='mission_complete' AND source_id=_mission_id`
- credita via `award_points` se passar

O trigger deixa de chamar `award_event('mission_complete', …)` e chama `award_mission_event` direto.

### Fora de escopo
- Outras regras (rPPG, vitals, daily challenge, ESF, etc.) continuam em **Regras de Pontos**.
- Sem mudança de UI fora do form de missão e do listing de regras.
- Sem migração de dados (caps ficam NULL = ilimitado, como hoje).
