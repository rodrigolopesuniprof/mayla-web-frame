Remover a janela flutuante "Ranking da semana" (RankingQuickView) do CampanhasTab, fazendo o botão de ranking navegar diretamente para a tela de leaderboard.

Alterações:
- `src/components/mayla/CampanhasTab.tsx`:
  1. Remover o estado `showQuickRanking` e sua lógica.
  2. Remover a importação de `RankingQuickView`.
  3. Remover o componente `RankingQuickView` do JSX.
  4. Alterar o `onClick` do botão de ranking de `() => setShowQuickRanking(true)` para `() => onOpenLeaderboard?.()`.

- `RankingQuickView.tsx`: manter intacto (não será mais usado, mas não precisa ser deletado agora).

Sem alterações em outras telas, componentes ou backend.