## Problema

O `PointsOnboardingTour` abre apenas no primeiro acesso. Quando o usuário fecha (ou pula), ele marca `points_tour_completed = true` e o tour nunca mais aparece — mesmo que o usuário não tenha terminado de fato as 5 etapas.

## Proposta

Combinar três pontos de acesso, do mais sutil ao mais explícito:

### 1. Distinguir "fechado" de "concluído"

Hoje só existe `profiles.points_tour_completed`. Vamos separar em duas colunas:

- `points_tour_completed` (boolean) — só vira `true` quando o usuário clica em "Concluir" na última etapa.
- `points_tour_dismissed_at` (timestamp) — preenchido quando o usuário fecha/pula no meio.

Comportamento:
- Se `completed = true` → não reabre automaticamente.
- Se `dismissed_at` definido e `completed = false` → reabre automaticamente **uma vez por dia** (até concluir).
- Se nunca abriu → abre no primeiro acesso (comportamento atual).

### 2. Botão flutuante permanente no HomeTab

Adicionar um chip no canto superior direito da `HomeTab` (ao lado do nome do usuário) com:

```
🎯 Como ganhar pontos
```

- Sempre visível, independente do estado do tour.
- Ao clicar, reabre o `PointsOnboardingTour` do passo 1.
- Após concluir, o chip muda para um ícone discreto `?` que ainda permite reabrir.

### 3. Card de progresso na Home (até concluir)

Enquanto `points_tour_completed = false`, mostrar no topo da `HomeTab` um card pequeno:

```
┌─────────────────────────────────────┐
│ 🎯  Continue conhecendo o app       │
│     Passo 2 de 5 · Autoavaliação    │
│                          [Retomar →]│
└─────────────────────────────────────┘
```

- Salva também `points_tour_current_step` (int) no profile para retomar de onde parou.
- Some assim que o usuário conclui o último passo.

## Implementação técnica

**Migration:**
- Adicionar `points_tour_dismissed_at timestamptz` e `points_tour_current_step integer default 0` em `profiles`.
- Manter `points_tour_completed` com a semântica nova (só `true` ao terminar de fato).

**`PointsOnboardingTour.tsx`:**
- Aceitar prop `forceOpen?: boolean` para abertura manual via botão.
- Ao fechar no meio: gravar `points_tour_dismissed_at = now()` e `points_tour_current_step = stepAtual`. **Não** marcar completed.
- Ao concluir na última etapa: gravar `points_tour_completed = true`, limpar `dismissed_at`.
- Lógica de auto-abrir: se `!completed && (dismissed_at IS NULL || dismissed_at < hoje 00:00)`, abre.

**`HomeTab.tsx`:**
- Adicionar botão "🎯 Como ganhar pontos" no header.
- Adicionar card "Continue o tour" enquanto não concluído (lê `points_tour_current_step`).
- Estado controlado para forçar reabertura via `forceOpen`.

**`MaylaApp.tsx`:**
- Já monta o tour — só passar a nova lógica de "abrir uma vez por dia até concluir".

## Fora de escopo

- Notificação push para lembrar do tour.
- Tour reaberto dentro de outras tabs (Campanhas, Serviços, Perfil) — só Home e botão permanente.
