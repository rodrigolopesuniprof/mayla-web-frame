
# Reestruturação do Ranking + Desafios + Atalho em Campanhas

## Objetivo
Hoje a tela "Ranking" mostra apenas "Este mês" vs "Geral", e o mês aparece zerado porque pontos antigos não estavam no `points_ledger` (já corrigido na migração anterior — novos pontos contam). Vamos evoluir a tela para suportar desafios **semanais, mensais e anuais**, mostrar **progresso de meta**, dar destaque ao **desafio do dia**, e criar um **atalho de ranking dentro de Campanhas**.

## 1. Banco de dados

### 1a. View `company_leaderboard` — adicionar semana e ano
Recriar a view incluindo:
- `week_points` (soma de `points_ledger` da semana corrente, segunda a domingo, TZ America/Sao_Paulo)
- `year_points` (soma do ano corrente)
- `rank_week`, `rank_year` (window function por `company_id`)
- manter `month_points`, `total_points`, `rank_month`, `rank_total`

### 1b. Tabela `company_point_goals` (nova)
Metas mínimas configuráveis por empresa para badge/recompensa:
- `company_id`, `weekly_goal`, `monthly_goal`, `yearly_goal`
- Defaults globais (linha com `company_id IS NULL`): 200 / 800 / 10000
- Função `get_effective_goals(_company_id)` no mesmo padrão de `get_effective_levels`
- RLS: leitura para `authenticated` da própria empresa; escrita só admin

> Admin UI de edição das metas fica fora deste escopo (criar depois se quiser).

## 2. Tela Ranking (`LeaderboardScreen.tsx`)

### 2a. Toggle com 3 períodos
Substituir o toggle binário por **segmented control de 3 abas**:
`Semana` · `Mês` · `Ano` · (manter `Geral` como 4ª aba opcional num botão "ver geral" discreto abaixo, para não poluir)

### 2b. Card "Sua meta" (topo, acima do pódio)
Para o período ativo, exibir:
```
SEMANA · 120 / 200 pts
[========------]  60%
Faltam 80 pts para a meta semanal 🎯
```
- Barra de progresso usando tokens do design system
- Trocar copy conforme período (Semana/Mês/Ano)
- Se já bateu a meta: "Meta atingida! 🎉" com check

### 2c. Card "Desafio do dia" (abaixo da meta)
Um card destacado com:
- Emoji + título do desafio (vindo de `useGamification().challenge`)
- Pontos
- Botão CTA "Fazer desafio" (ou "Concluído ✓" se já feito)
- Ao clicar: abre a mesma experiência do `DailyChallengeCard` (reusar componente ou navegar para Home)

### 2d. Pódio + Lista
Manter visual atual, apenas usando o período ativo para `points`/`rank`.

## 3. Atalho na aba Campanhas (`CampanhasTab.tsx`)
Adicionar no topo (ou após o header da aba) um **card-botão "Ranking"**:
- Ícone 🏆 + título "Ranking da empresa" + subtítulo dinâmico "Você está em #N esta semana"
- Ao clicar: abre uma **tela rápida** (drawer/sheet ou rota interna) com versão compacta do ranking — pódio + top 10, sem toggle de período (mostra semana por padrão) + link "Ver ranking completo" que abre o `LeaderboardScreen` normal.

Componente novo: `RankingQuickView.tsx` (reusa o fetch da view e renderiza compacto).

## 4. Arquivos afetados

**Migrations:**
- Nova migration: recriar `company_leaderboard` com week/year + criar `company_point_goals` + `get_effective_goals` + seed defaults

**Frontend:**
- `src/components/mayla/LeaderboardScreen.tsx` — toggle 3 períodos, card de meta, card desafio do dia
- `src/components/mayla/RankingQuickView.tsx` — novo, drawer compacto
- `src/components/mayla/CampanhasTab.tsx` — botão atalho Ranking
- `src/hooks/useLeaderboard.ts` — novo hook centralizando fetch da view + meta efetiva (reduz duplicação)

## 5. Fora de escopo
- Tela admin para editar `company_point_goals` (usa defaults por enquanto)
- Backfill histórico de `points_ledger`
- Recompensas automáticas ao bater meta (só visual por ora)

---

Quer que eu siga assim ou prefere ajustar algo (ex.: trocar "Geral" por aba fixa, mudar defaults de meta, ou começar só pelo banco + toggle de 3 períodos)?
