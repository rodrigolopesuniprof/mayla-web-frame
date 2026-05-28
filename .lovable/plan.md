
## Diagnóstico

A subida de nível **já é automática no banco** (`award_points` → `check_user_level` → atualiza `user_level_progress`, paga bônus em `points_ledger`, atualiza badge). O usuário que bateu 500 pts já está como Nível 2 no banco — só **não houve aviso visível** e o card da Home mostra apenas o **acumulado**, sem separar o que ele ganhou na semana.

## Mudanças

### 1. Notificação automática de subida de nível
- **Migration**: habilitar realtime na tabela `user_level_progress` (`REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE`).
- **Novo hook `src/hooks/useLevelUpNotifier.ts`**: assina mudanças do `user_level_progress` do usuário logado. Quando `current_level` aumenta:
  - Busca o nível alcançado em `get_effective_levels` para pegar `name`, `emoji`, `bonus_points`, `badge_title`.
  - Dispara um **modal celebratório full-screen** (componente novo `LevelUpDialog.tsx`) com:
    - "🎉 Parabéns! Você subiu de nível!"
    - `{emoji} Nível N · {name}`
    - Badge ganha + bônus de pontos creditados
    - Confete leve via CSS animation
    - Botão "Continuar"
  - Toast de fallback caso o modal não monte.
- **Integração**: chamado em `MaylaApp.tsx` (ao lado do `PointsOnboardingTour`) para cobrir o app inteiro.

### 2. Home: separar pontos da semana vs. acumulado
- **`src/hooks/useMyRanking.ts`**: também expor `weekPoints` e `totalPoints` (já vêm em `company_leaderboard`).
- **`GamificationStatusCard.tsx`**: reorganizar Zona 1/2:
  - Destaque grande: **"⚡ {weekPoints} pts esta semana"**
  - Linha secundária: barra de progresso de nível (continua usando acumulado, que é o que define nível), texto "Faltam X pts para 💪 Engajado"
  - Pequeno link à direita: **"🏆 Acumulado: {totalPoints} · ver ranking →"** (abre LeaderboardScreen)
  - Remover a exibição do acumulado em destaque na frase de progresso (mantém só "faltam X pts" sem expor o número absoluto na Home).

### 3. Ranking: adicionar aba "Total" (acumulado)
- **`LeaderboardScreen.tsx`**: incluir `"total"` no array de períodos (`["week", "month", "year", "total"]`). Labels:
  - `total: "Acumulado"` no `periodLabels`
  - `total: "no total"` no `periodSubtitles`
- A infra (`useLeaderboard`, `pointsFor`, `rankFor`, `total_points`, `rank_total`) **já existe** — só falta expor a aba.

## Fora de escopo
- Não muda regras de nível (`levels` permanece 0/500/1500/3500/7500).
- Não muda a função `check_user_level` (já funciona).
- Não muda o cálculo de pontos das regras.
