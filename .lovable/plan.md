
# Redesign do card de gamificação na HomeTab

## Objetivo
A linha `⭐ 310 pontos · 🏆 Ranking → · Ver missões →` (rodapé do Health Score Card) tem fraca chamada à ação e nenhum contexto. Vou transformá-la num **card próprio** com 3 zonas que ativam os gatilhos de Goal-Gradient, Zeigarnik, peer-ranking e streak.

## Mudança visual

Hoje (rodapé dentro do card de Saúde):
```
⭐ 310 pontos                    🏆 Ranking →   Ver missões →
```

Novo card (entre o Health Score card e o card da Mayla, mesmo slot do "Ver missões"):
```
┌──────────────────────────────────────────────┐
│ [Nível 3 · Ativo]              🏅 #3 da semana│
│ ████████████░░░░░░░  310 / 500 pts           │
│ Faltam 190 pts para Nível 4 · Dedicado       │
│ ──────────────────────────────────────────── │
│ 🔥 3 dias seguidos            [Desafio de hoje →]│
└──────────────────────────────────────────────┘
```

- Rodapé atual do Health Score (linha com pontos/ranking/missões) é **removido** — fica só o bloco superior de medição.
- O novo card vai logo depois do Health Score, antes do card da Mayla.

## Estrutura do card

Container: `bg-card rounded-2xl shadow-sm p-4 mx-5 mb-5`.

**Zona 1 — Identidade + posição social** (flex row):
- Esquerda: pill com nível atual — `Nível {N} · {name}` tingida com o `color_hex` do nível via `style={{ backgroundColor: hex+'20', color: hex }}` (único uso de cor hardcoded, vinda do banco). Se não houver `color_hex`, fallback para `bg-secondary text-secondary-foreground`.
- Direita: se `rank_week` existe → `🏅 #{n} da semana` em `text-sm text-muted-foreground`. Se não → omite.

**Zona 2 — Progresso até próximo nível**:
- Barra: trilho `bg-secondary`, preenchimento `bg-primary` (ou gradient accent→primary já usado no Leaderboard), `h-2 rounded-full`, largura `((points - current.min) / (next.min - current.min)) * 100%`.
- Texto abaixo (`text-xs text-muted-foreground`): `{points} / {next.min_points} pts · Faltam {delta} pts para {next.name}`.
- Se `next` for null (nível máximo): mostrar `Nível máximo atingido 🏆` sem barra.

**Divisor** `border-t border-border/50 my-3`.

**Zona 3 — Urgência diária** (flex row):
- Esquerda: streak.
  - `streak >= 1` → `🔥 {streak} dia{s} seguido{s}` (text-sm font-medium).
  - `streak === 0` → `Comece sua sequência hoje 💪` (text-sm text-muted-foreground).
- Direita: botão (`Button` shadcn `variant="outline" size="sm"`):
  - Desafio pendente → `Desafio de hoje →`, onClick scrolla / abre o `DailyChallengeCard` (vou expor uma prop `onOpenDailyChallenge` e por padrão `setTab("campanhas")` que já mostra o desafio, ou navegar pra um state). Para manter o escopo simples e sem nova tela, o clique faz `setTab("campanhas")` (onde o DailyChallengeCard já aparece via Leaderboard) **ou** dispara scroll para uma seção visível — vou optar por `setTab("campanhas")` e deixar evolução futura.
  - Concluído → `✓ Concluído hoje` desabilitado, com ícone verde (`text-mayla-green`).

O link `🏆 Ranking →` antigo migra para o ícone `🏅 #X da semana` da Zona 1, que vira clicável e chama `onOpenLeaderboard`. O link `Ver missões →` é substituído pelo CTA "Desafio de hoje".

## Dados

Tudo que precisamos já existe; só falta um cálculo:

| Campo | Fonte |
|---|---|
| `points`, `current_level`, `current.name`, `next.min_points`, `next.name` | `useGamification().progress` (já retorna `current`, `next`, `points`) |
| `color_hex` do nível | **não existe** em `EffectiveLevel` hoje. Vou usar fallback (`bg-secondary`) e deixar `color_hex` como melhoria futura — evita migration. |
| `rank_week` | novo: `useLeaderboard("week")` filtrado pelo `user_id` (hook já existe; o card lê só a própria linha). Para evitar buscar 50 linhas só pra achar a minha, vou adicionar um pequeno hook `useMyRanking()` que faz `select rank_week from company_leaderboard where user_id = auth.uid()`. |
| `streak` | novo hook `useDailyStreak()` — query: `select assigned_date from daily_challenge_completions dcc join daily_challenge_assignments a on a.id = dcc.assignment_id where dcc.user_id = auth.uid() order by assigned_date desc limit 60`. Conta dias consecutivos a partir de hoje (ou ontem, se hoje ainda não foi feito) no fuso `America/Sao_Paulo`. Puro cliente, sem migration. |
| `challenge.completed` | `useGamification().challenge.completed` (já existe). |

## Arquivos

**Novos:**
- `src/hooks/useMyRanking.ts` — retorna `{ rank_week, rank_month, loading }`.
- `src/hooks/useDailyStreak.ts` — retorna `{ streak, loading }`.
- `src/components/mayla/GamificationStatusCard.tsx` — o card novo.

**Editados:**
- `src/components/mayla/HomeTab.tsx`
  - Remover o rodapé `border-t … ⭐ {points} pontos … Ranking … Ver missões` do Health Score Card.
  - Renderizar `<GamificationStatusCard onOpenLeaderboard={onOpenLeaderboard} onOpenChallenges={() => setTab("campanhas")} />` no slot logo após o Health Score Card.

## Fora de escopo
- Adicionar `color_hex` em `levels` (migration). Fica fallback `bg-secondary` por ora.
- Abrir o `DailyChallengeCard` num modal dedicado — por enquanto o CTA leva para a aba Campanhas onde ele já aparece.
- Mudar lógica de pontuação, ranking ou desafios.

Posso seguir assim?
