## Objetivo

Remover os modais de onboarding (telas "PASSO 1 DE 5" até "PASSO 5 DE 5" com Mayla, ex.: "Participe de atividades e desafios") que aparecem ao entrar no app. O card de validação "Primeiros Passos · ganhe pontos de bônus" na Home permanece intacto.

## Mudanças

### `src/components/mayla/MaylaApp.tsx`
- Remover a renderização de `<PointsOnboardingTour ... />` (linhas 86-94).
- Remover o `import { PointsOnboardingTour } from "./PointsOnboardingTour";` (linha 22).
- Manter `ProfileCompletionGate` e `LevelUpNotifier` (fluxos diferentes).

### `src/components/mayla/FirstStepsCard.tsx`
- Manter o card como está. Ele já dispara `POINTS_TOUR_COMPLETED_EVENT` para silenciar o tour, mas como o tour não será mais renderizado, esse evento simplesmente não terá efeito (sem necessidade de mexer).

### Arquivo `PointsOnboardingTour.tsx`
- Mantido no projeto (não removido) caso queira reativar no futuro. Apenas deixa de ser montado.

## Fora de escopo
- Nenhuma alteração no `FirstStepsCard` (o card da segunda imagem permanece).
- Nenhuma alteração em Splash, Onboarding inicial (boas-vindas) ou `ProfileCompletionGate`.
