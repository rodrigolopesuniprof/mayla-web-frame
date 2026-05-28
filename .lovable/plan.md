## Problema

Hoje o card `FirstStepsCard` marca cada passo como concluído só quando encontra um registro com `source` específico em `points_ledger`. Resultado: quem já completou perfil, autoavaliação ou rPPG antes (ou já abriu campanhas/ranking) continua vendo tudo como pendente, porque ou nunca houve evento de pontos, ou o cap semanal/lifetime impediu o registro.

Vamos passar a detectar cada passo pelo **estado real** do usuário, e adicionar um passo simples de "visualização de campanhas" sem exigir ação pontuada.

## Mudanças

### 1. `src/components/mayla/FirstStepsCard.tsx` — nova lógica de detecção

Substituir a checagem única em `points_ledger` por consultas paralelas ao estado real. Cada passo fica concluído assim que a condição abaixo é verdadeira (independente de pontos terem sido creditados):

| Passo | Como passa a ser detectado |
|---|---|
| 📋 Complete seus dados pessoais | `profiles.birth_date` **e** `profiles.biological_sex` preenchidos (mesma regra do `ProfileCompletionGate`) |
| 🩺 Faça sua autoavaliação | existe ≥1 linha em `self_assessment_responses` para `user_id` |
| 📷 Faça uma medição rPPG | existe ≥1 linha em `health_measurements` para `user_id` (qualquer data) |
| 👀 Veja as campanhas (**novo**, substitui "Participe de uma campanha ou missão") | flag local `mayla:first-steps:campaigns-viewed:<userId>` em `localStorage`, marcada ao abrir a aba Desafios; **ou** existe registro em `points_ledger` com source `mission_complete` / `daily_challenge` / `weekly_checkin` (mantém compatibilidade pra quem já fez algo) |
| 🏆 Veja sua posição no ranking | flag local `mayla:first-steps:ranking-viewed:<userId>` em `localStorage`, marcada ao abrir `LeaderboardScreen` ou `RankingQuickView`; **ou** ainda registro `tour_step_ranking` no ledger |

A nova lógica:
- Faz `Promise.all` com 4 queries (`profiles`, `self_assessment_responses`, `health_measurements`, `points_ledger` para fallback) + leitura de localStorage.
- Mantém o realtime em `points_ledger` e adiciona um listener no evento customizado `first-steps-refresh` para forçar recarga quando uma flag local for setada na mesma sessão.
- Remove a dependência do source `profile_complete`/`self_assessment`/`rppg_measurement` para marcar como done — eles continuam existindo no banco, só não são mais a fonte de verdade da UI.

### 2. Marcar "viu campanhas" e "viu ranking"

Helper único `src/lib/first-steps.ts` com:
```ts
markFirstStep(userId: string, key: "campaigns-viewed" | "ranking-viewed"): void
hasFirstStep(userId: string, key): boolean
```
Seta no `localStorage` e dispara `window.dispatchEvent(new Event("first-steps-refresh"))`.

Chamadas:
- `src/components/mayla/CampanhasTab.tsx` — `useEffect(() => markFirstStep(user.id, "campaigns-viewed"), [])` quando a aba monta.
- `src/components/mayla/LeaderboardScreen.tsx` — idem ao montar.
- `src/components/mayla/RankingQuickView.tsx` — idem (caso o usuário só abra o quick view sem entrar na tela cheia).

### 3. Sem mudanças em banco / pontuação

- Nenhuma migração.
- Regras de pontos do `point_rules` permanecem como estão — "visualizar campanhas" e "ver ranking" não geram pontos (eram passos informativos no tour).
- Os passos com pontos atrelados (perfil, autoavaliação, rPPG) continuam creditando normalmente via os triggers/`award_event` existentes; só a detecção visual do card é desacoplada.

## Fora de escopo

- Adicionar pontuação por visualizar campanhas/ranking.
- Alterar o `PointsOnboardingTour` (popup) — ele continua usando a mesma flag `points_tour_completed` que já tem.
- Alterar `CampaignsList`/`MissionsTab`.

## Arquivos tocados

- `src/lib/first-steps.ts` (novo)
- `src/components/mayla/FirstStepsCard.tsx`
- `src/components/mayla/CampanhasTab.tsx`
- `src/components/mayla/LeaderboardScreen.tsx`
- `src/components/mayla/RankingQuickView.tsx`
