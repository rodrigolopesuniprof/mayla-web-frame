
## Objetivo

Criar uma subseção visual destacada **"🚀 Onboarding — Primeiros Passos"** no painel admin de Regras de Pontos, agrupando as 5 etapas do tour inicial para facilitar configuração e tornar evidente quais regras direcionam o onboarding.

## Mudanças

### 1. `src/components/admin/AdminPointRules.tsx`
- Definir constante `ONBOARDING_KEYS = ['profile_complete', 'self_assessment', 'rppg_measurement', 'daily_challenge', 'weekly_checkin']` com ordem fixa (espelha as etapas do `PointsOnboardingTour`).
- Remover o filtro atual que esconde `self_assessment` (passa a aparecer dentro do grupo Onboarding).
- Separar `rules` em dois arrays:
  - `onboardingRules` — filtradas e **ordenadas** pela posição em `ONBOARDING_KEYS`.
  - `otherRules` — todas as demais, mantém ordenação por label.
- Renderizar duas seções com cabeçalhos:
  - **🚀 Onboarding — Primeiros Passos** com card de destaque (borda primária, fundo `bg-primary/5`), descrição: *"Estas 5 regras controlam a sequência do tour de boas-vindas. Cada conclusão dispara o popup '🎉 +X pontos!' e avança automaticamente para a próxima etapa."*
  - **Outras regras** — eventos avulsos (medicação, missões, vínculo ESF/time, avatar, etc.).
- Cada etapa do Onboarding mostra um chip **"Etapa 1"…"Etapa 5"** ao lado do label para deixar a sequência explícita.

### 2. Sem mudanças de banco
As 5 regras (`profile_complete`, `self_assessment`, `rppg_measurement`, `daily_challenge`, `weekly_checkin`) já existem no `seed_default_point_rules` — só vamos **agrupá-las visualmente**.

## Fora de escopo
- Não alteramos valores padrão das regras (admin continua editando livremente).
- Não criamos nova tabela ou categoria persistida — o agrupamento é puramente UI baseado nas chaves.
- Não mexemos no `PointsOnboardingTour` em si.
