## Objetivo

Deixar transparente para o colaborador **onde e como ele ganha pontos**, completar lacunas funcionais (medicamentos, autoavaliação, gênero) e criar um tour inicial guiado.

---

## 1. Limpeza no painel de Pontuação (admin)

`AdminPointRules.tsx`:
- **Remover** da listagem `mission_complete` (já vive em Missões — feito) **e também** `health_survey_complete` (vira "autoavaliação" e fica no novo painel de Autoavaliação — ver §6).
- Renomear rótulos para refletir UI:
  - `support_team_link` → "Adesão a time"
  - `weekly_checkin` permanece
- Adicionar tooltip "Onde aparece para o usuário" em cada regra (texto livre por regra, opcional).

---

## 2. Medicamentos (perfil) + lembrete diário

**Banco** (tabela `user_medications` já existe; falta lembrete):
- Adicionar colunas em `user_medications`: `reminder_time TIME DEFAULT '09:00'`, `start_date DATE DEFAULT current_date`.
- A tabela `medication_logs` já existe e dispara `award_medication_points` (já delega para `award_event('medication_adherence')`).

**UI — `ProfileTab.tsx`**: nova seção "💊 Meus medicamentos" com:
- Lista de medicamentos ativos (nome, dose, frequência, horário).
- Botão "Adicionar medicamento" abre modal (nome, dose, frequência, horário do lembrete).
- Botão arquivar/excluir.

**Lembrete diário — `HomeTab.tsx`**:
- Novo card "💊 Tomou seu medicamento hoje?" exibido se existir `user_medications.active=true` e não houver `medication_logs` de hoje para aquele medicamento.
- Botão "✅ Já tomei (+100 pts)" cria o log → trigger credita via `award_event`.
- Mostra microcopy "+100 pts por dia (máx. 7/semana)".

---

## 3. Check-in semanal — deixar claro que pontua

`WellbeingCheckin.tsx` (já existe):
- Adicionar selo "+50 pts" no botão de enviar e badge "Disponível esta semana" / "Já respondido (+50 pts creditados)".
- Card de entrada no `HomeTab` ganha sufixo "Ganhe +50 pts".

---

## 4. Desafio do dia — onde criar/programar

Já existe `AdminDailyChallenges.tsx` + tabela `daily_challenges` + `ensure_daily_challenge` (sorteia 1/dia por empresa).
- Acréscimo: **link visível** no painel admin em "Gamificação → Desafio do dia" e tooltip explicando "1 desafio sorteado por dia entre os ativos".
- No HomeTab, o card já existe (`DailyChallengeCard`); adicionar microcopy "Ganhe +X pts" usando `daily_challenges.points`.

---

## 5. Medições rPPG e Vitals — CTA com pontos

`RppgCapture.tsx` e `BinahCapture.tsx` (Vitals):
- **Antes**: botão "Iniciar medição" recebe subtítulo "Faça agora e ganhe +50 pts" (rPPG) / "+100 pts" (Vitals).
- **Depois** (tela de resultado): banner "✅ Resultado salvo — +X pts creditados!" (ou "Limite semanal atingido" se `award_event` retornar `cap_reached`).
- Valores lidos dinamicamente de `point_rules` para a empresa (pequeno hook `usePointRule(event_key)`).

---

## 6. Autoavaliação (substitui "Questionário de saúde")

**Renomeação conceitual**: `health_survey_complete` vira "autoavaliação" — **NÃO** é o mesmo que check-in semanal (check-in é recorrente, autoavaliação é inicial/editável).

**Banco**:
- Nova tabela `self_assessment_questions` (admin edita): `id, company_id NULL=global, order, question, type ('single'|'multi'|'scale'|'text'), options jsonb, active`.
- Nova tabela `self_assessment_responses`: `id, user_id, company_id, answers jsonb, completed_at`.
- Trigger em `self_assessment_responses` (insert) → `award_event('self_assessment', ...)` (renomear regra `health_survey_complete` → `self_assessment` na seed; migração `UPDATE point_rules SET event_key='self_assessment' WHERE event_key='health_survey_complete'`).

**Admin** — novo `AdminSelfAssessment.tsx` na aba Gamificação ou Configurações:
- CRUD das perguntas (drag-and-drop de ordem, tipos de resposta, opções).
- Seed com 6–8 perguntas padrão (estilo de vida, sono, atividade, alimentação, estresse, tabagismo, álcool).

**Mobile** — refatorar `HealthSurvey.tsx` para ler perguntas dinâmicas da nova tabela; CTA "Fazer autoavaliação (+200 pts)" no Home e no Perfil. Permitir refazer/editar.

---

## 7. Pesquisa respondida — deixar claro que pontua

`QuestionnaireRunner.tsx` e cards de pesquisas no Home:
- Badge "+100 pts" no card.
- Tela final: "Obrigado! +100 pts creditados."
- Garantir que o submit chama `award_event('survey_complete', survey_id)` (hoje não chama — adicionar).

---

## 8. Vínculo de equipe de apoio = Adesão a time

- Trigger `award_support_team_link_points` já existe.
- Renomear no painel para "Adesão a time" e no card de TeamPicker mostrar "+500 pts (uma vez)".

---

## 9. Gênero expandido

**Banco**:
- `ALTER TYPE` não — `profiles.biological_sex` hoje é `text`. Manter `text` e aceitar novos valores: `male`, `female`, `non_binary`, `agender`, `other`, `prefer_not_say`.
- Nova coluna `profiles.gender_other_text TEXT NULL` para o caso "Outro".

**UI** — `ProfileCompletionGate.tsx` e `ProfileTab.tsx`:
- Trocar os 2 botões por um seletor com 6 opções; quando "Outro" → mostra input livre.
- Texto: Masculino / Feminino / Não-binário / Agênero / Outro (com campo) / Prefiro não informar.

---

## 10. Tour de onboarding de pontos (primeiro acesso)

Novo componente `PointsOnboardingTour.tsx` exibido no `MaylaApp.tsx` após `ProfileCompletionGate`, **uma vez** por usuário.

**Persistência**: nova coluna `profiles.points_tour_completed BOOLEAN DEFAULT false`. Ao fechar o último passo, salvar `true`.

**Formato**: overlay com 1 card por vez (não lista), avança com "Próximo", X passos:
1. **Complete seus dados pessoais** → CTA leva ao Perfil.
2. **Faça sua autoavaliação** → CTA abre a autoavaliação (+200 pts).
3. **Faça uma medição rPPG** → CTA abre o card de rPPG (+50 pts).
4. **Participe de atividades e desafios** → CTA leva a Campanhas.
5. **Acompanhe sua pontuação no ranking** → CTA abre Leaderboard.

Cada card mostra ícone, frase curta, valor de pontos e botão "Fazer agora" / "Depois".

---

## 11. Engine de pontuação — pequenos ajustes

- Adicionar `survey_complete` ao submit de `QuestionnaireRunner` (faltava call site).
- Renomear regra `health_survey_complete` → `self_assessment` (data migration).
- Hook `usePointRule(event_key)` para mostrar valor dinâmico em qualquer CTA.

---

## Resumo das mudanças de DB

```text
ALTER TABLE user_medications ADD reminder_time TIME, start_date DATE
ALTER TABLE profiles ADD gender_other_text TEXT, points_tour_completed BOOLEAN DEFAULT false
CREATE TABLE self_assessment_questions (...)
CREATE TABLE self_assessment_responses (...) + trigger award self_assessment
UPDATE point_rules SET event_key='self_assessment' WHERE event_key='health_survey_complete'
UPDATE point_rules label 'support_team_link' -> 'Adesão a time'
```

## Arquivos a criar
- `src/components/mayla/PointsOnboardingTour.tsx`
- `src/components/mayla/MedicationReminderCard.tsx`
- `src/components/mayla/MedicationsSection.tsx` (em ProfileTab)
- `src/components/mayla/SelfAssessmentRunner.tsx`
- `src/components/admin/AdminSelfAssessment.tsx`
- `src/hooks/usePointRule.ts`

## Arquivos a editar
- `AdminPointRules.tsx`, `AdminDailyChallenges.tsx` (visibilidade)
- `ProfileTab.tsx`, `ProfileCompletionGate.tsx` (gênero + medicamentos)
- `HomeTab.tsx` (lembrete medicamento + selos de pontos)
- `WellbeingCheckin.tsx`, `RppgCapture.tsx`, `BinahCapture.tsx`, `QuestionnaireRunner.tsx`, `HealthSurvey.tsx`, `TeamPickerDialog.tsx` (CTAs com pontos)
- `MaylaApp.tsx` (montar Tour após Gate)
- `Admin.tsx` (rota/aba Autoavaliação)

## Fora de escopo
- Push notifications nativas para lembrete de medicamento (usaremos card in-app por enquanto).
- Reescrita do engine de pontos (já consolidado).
