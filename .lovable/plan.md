

# Plano: Relatório de Saúde (Visão Usuário + Profissional)

## Escopo

Feature completa com duas visualizações: `/relatorio` (paciente) e `/relatorio/medico` (profissional via token temporário). Reproduz fielmente os HTMLs de referência fornecidos. Dados reais do banco, com mock quando indisponível ("sem dado no período").

---

## Fase 1 — Banco de Dados

### Alterações na tabela `health_measurements`
Adicionar colunas faltantes:
- `hrv` integer nullable
- `glucose_estimated` numeric nullable  
- `fatigue_score` integer nullable
- `sleep_duration_min` integer nullable
- `sleep_quality_score` integer nullable
- `steps` integer nullable
- `active_minutes` integer nullable

### Novas tabelas

**`health_scores`** — scores calculados por período
- id, user_id, period_start date, period_end date
- score_general, score_physiological, score_emotional, score_lifestyle (integer 0-100)
- recommendation_level integer (1-4)
- generated_at timestamptz
- RLS: user vê os seus, admin vê todos

**`health_alerts`** — alertas gerados automaticamente
- id, user_id, metric text, severity text (low/medium/high/critical)
- description text, detail text, days_triggered integer
- generated_at timestamptz, dismissed_at timestamptz nullable
- RLS: user vê os seus, admin/professional vê via consulta

**`report_shares`** — links temporários para profissionais
- id, user_id, professional_id uuid nullable, token text unique
- created_at, expires_at timestamptz, accessed_at timestamptz nullable
- RLS: user cria os seus, anon pode ler por token (para acesso sem login do médico)

**`clinical_notes`** — notas clínicas do profissional
- id, consultation_id uuid, professional_id uuid, user_id uuid
- conditions_active jsonb, medications jsonb
- note_text text, referrals jsonb
- created_at, updated_at timestamptz
- RLS: professional que criou + admin

---

## Fase 2 — Componentes React (Visão Usuário)

### Novo arquivo: `src/components/report/HealthReport.tsx`
Componente principal da visão paciente. Busca dados de `health_measurements`, `health_scores`, `health_alerts`, `questionnaire_responses` dos últimos 7 dias. Seções em scroll:

1. **Topbar** — "Relatório de saúde" + chip período + avatar/nome + botão "Compartilhar com médico"
2. **ScoreRing** — SVG circular com score geral + 3 sub-scores em barras
3. **AlertsList** — Cards com stripe colorida + severidade
4. **TrendGrid** — Grid 2x2 (FC, Estresse, Sono, Passos) com mini-charts de 7 barras
5. **QuestionnairesSummary** — Cards por categoria com status e variação
6. **Timeline** — Timeline vertical com eventos da semana
7. **RecommendationCard** — Card escuro com recomendação baseada no `recommendation_level`

### Subcomponentes reutilizáveis:
- `src/components/report/ScoreRing.tsx` — anel SVG parametrizado
- `src/components/report/AlertCard.tsx` — card de alerta com stripe
- `src/components/report/TrendCard.tsx` — card métrico com mini-chart
- `src/components/report/TimelineItem.tsx` — item da timeline
- `src/components/report/ReportBottomNav.tsx` — bottom nav com ícones SVG (não emojis)

### Estilos
CSS dedicado em `src/components/report/report.css` reproduzindo fielmente o design system dos HTMLs (DM Sans + DM Mono, paleta semântica, radius, borders).

---

## Fase 3 — Componentes React (Visão Profissional)

### Novo arquivo: `src/components/report/ProfessionalReport.tsx`
4 abas: Resumo / Sinais / Histórico / Nota clínica. Topbar escura (#1A3148).

**Aba Resumo:**
- Score em fundo escuro + sub-scores em cards
- Banner "Dados ocultos ao paciente" + grid 3 colunas (PA, Glicemia, SpO₂)
- Alertas clínicos com linguagem técnica
- Pontos para investigar (lista numerada)

**Aba Sinais:**
- Tabela vertical com todas as métricas + fonte + baseline + tendência + badge

**Aba Histórico:**
- Timeline (como usuário, com dados sensíveis)
- Consultas anteriores em cards cronológicos
- Botão "Registrar consulta atual" (dashed)

**Aba Nota Clínica:**
- Condições ativas em chips + medicamentos
- Textarea para observações + botão "Salvar nota"
- Grid 2x2 de encaminhamentos rápidos

---

## Fase 4 — Rotas e Compartilhamento

### Rotas no App.tsx
- `/relatorio` → `ProtectedRoute` → `HealthReport`
- `/relatorio/medico/:token` → `ProfessionalReport` (acesso público via token, sem login)

### Lógica de compartilhamento
- Botão "Compartilhar com médico" cria registro em `report_shares` com token UUID e `expires_at` = 48h
- Rota `/relatorio/medico/:token` valida token, carrega dados do paciente
- "Encerrar acesso" marca `accessed_at` e redireciona

### Integração no MaylaApp
- Adicionar `showReport` state + navegação a partir do `BottomNav` ou `HomeTab`

---

## Fase 5 — Lógica de Scores (Edge Function)

### `supabase/functions/calculate-health-scores/index.ts`
- Recebe `user_id` e período (default 7 dias)
- Busca `health_measurements` e `questionnaire_responses` do período
- Calcula scores usando lógica híbrida (faixas clínicas + baseline 30 dias)
- Gera alertas quando desvio persiste 3+ dias
- Salva em `health_scores` e `health_alerts`
- Retorna dados calculados

Classificação: 70-100 verde, 40-69 amarelo, 0-39 vermelho.
Recomendação: 1="Tudo dentro do esperado", 2="Vale acompanhar", 3="Recomendamos consulta", 4="Procure atendimento em breve".

---

## Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Migração | health_measurements (ADD cols), health_scores, health_alerts, report_shares, clinical_notes |
| Criar | `src/components/report/report.css` |
| Criar | `src/components/report/ScoreRing.tsx` |
| Criar | `src/components/report/AlertCard.tsx` |
| Criar | `src/components/report/TrendCard.tsx` |
| Criar | `src/components/report/TimelineItem.tsx` |
| Criar | `src/components/report/ReportBottomNav.tsx` |
| Criar | `src/components/report/HealthReport.tsx` |
| Criar | `src/components/report/ProfessionalReport.tsx` |
| Criar | `supabase/functions/calculate-health-scores/index.ts` |
| Editar | `src/App.tsx` (novas rotas) |
| Editar | `src/components/mayla/MaylaApp.tsx` (navegação para relatório) |
| Editar | `src/lib/mayla-config.ts` (adicionar tab "relatorio" se necessário) |

---

## Implementação

Devido à complexidade, implementarei em etapas dentro desta mesma execução:
1. Migrações de banco
2. CSS + subcomponentes reutilizáveis
3. Visão do usuário completa
4. Visão do profissional completa
5. Rotas, compartilhamento e edge function

