

# Plano: Remover questionário do onboarding e migrar para botão na Home

## Problema
O questionário de saúde no fluxo de onboarding (splash → onboarding → survey → main) está aparecendo repetidamente apesar de múltiplas tentativas de corrigir. A solução é **removê-lo completamente do onboarding** e transformá-lo em um botão opcional na HomeTab, alimentado pelos questionários criados em "Pesquisas" no painel admin.

## Mudanças

### 1. `MaylaApp.tsx` — Simplificar fluxo de fases
- Remover a fase `"survey"` e a função `checkSurveyStatus`
- Remover import de `HealthSurvey`
- Remover estados `isRetake` e a lógica de `handleRetakeSurvey` / `handleSurveyDone`
- Fluxo simplificado: `splash → onboarding → main` (ou direto `main` se já logado)
- `handleOnboardingDone` vai direto para `"main"`

### 2. `HomeTab.tsx` — Adicionar botão "Preencher Questionário"
- Buscar o questionário mais recente de `questionnaires` (order by `created_at desc`, limit 1)
- Se existir questionário, renderizar um card/botão na Home (ex: "📋 Preencher Questionário")
- Se não existir nenhum questionário no admin, não mostrar nada
- Ao clicar, abrir o `QuestionnaireRunner` inline (mesmo padrão do WellbeingTab)
- Se o usuário já respondeu aquele questionário (verificar em `questionnaire_responses`), mostrar como "✅ Questionário respondido" ou ocultar

### 3. `ProfileTab.tsx` — Remover "Preencher agora" do retake
- Remover prop `onRetakeSurvey` e referências ao retake do questionário hardcoded
- A subview "autoavaliacao" continua mostrando os dados de perfil de saúde, mas sem o botão de refazer o survey antigo

### 4. Limpeza
- O arquivo `HealthSurvey.tsx` permanece no projeto (contém lógica de perfil de saúde útil para a subview "autoavaliacao"), mas não é mais importado no fluxo principal
- Remover `handleRetakeSurvey` do `MaylaApp` e a prop que passa para `ProfileTab`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/mayla/MaylaApp.tsx` — remover fase survey, simplificar fluxo |
| Editar | `src/components/mayla/HomeTab.tsx` — adicionar card de questionário dinâmico com QuestionnaireRunner |
| Editar | `src/components/mayla/ProfileTab.tsx` — remover prop onRetakeSurvey e botão retake |

