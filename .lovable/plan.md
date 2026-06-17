# Plano: remover resquício do box de welcome/onboarding

## Diagnóstico

O box da imagem ainda existe em `PointsOnboardingTour.tsx`. Mesmo removido do app principal anteriormente, o componente ainda está no código e tem mecanismos próprios para reabrir:

- Abre automaticamente no carregamento se `points_tour_completed` estiver falso.
- Reabre por evento `open-points-tour` disparado pelo card `FirstStepsCard`.
- Tem timer de reabertura a cada 5 minutos (`IDLE_REOPEN_MS`).
- Reabre após avançar etapa com `setTimeout`.
- O card `FirstStepsCard` ainda importa esse tour e tem botão “Continuar” que pode reativá-lo.

## Correção proposta

1. Remover a dependência do `FirstStepsCard` em relação ao `PointsOnboardingTour`:
   - Apagar imports `POINTS_TOUR_EVENT` e `POINTS_TOUR_COMPLETED_EVENT`.
   - Remover qualquer `dispatchEvent` que abra o tour.
   - Remover a função/botão “Continuar” que reabre o popup.

2. Manter apenas o card inline de primeiros passos, sem modal:
   - O card pode continuar mostrando progresso se ainda for desejado.
   - Ao completar tudo, ele continua marcando `points_tour_completed = true` no perfil para silenciar usuários antigos.
   - Não abrirá nenhuma janela sobreposta.

3. Desativar o componente `PointsOnboardingTour` para não haver reativação futura:
   - Remover timers/event listeners/toasts de avanço do popup ou deixar o componente como `return null` permanente.
   - Preferência técnica: excluir o uso prático do componente sem mexer em banco/migrações.

4. Verificação:
   - Buscar novamente por `open-points-tour`, `PointsOnboardingTour`, `PASSO`, `Pular esta etapa`, `Ver campanhas`.
   - Confirmar que não há mais caminho no frontend que exiba o box de welcome/onboarding.