

## Plano: Questionário de Saúde a cada 6 meses

### Problema atual
O campo `health_survey_completed` é um boolean simples — uma vez marcado `true`, o questionário nunca mais é solicitado (exceto retake manual).

### Solução

**1. Migration: adicionar campo `health_survey_completed_at`**
```sql
ALTER TABLE public.profiles 
ADD COLUMN health_survey_completed_at timestamptz DEFAULT NULL;

-- Preencher retroativamente: quem já completou, assume que foi no updated_at
UPDATE public.profiles 
SET health_survey_completed_at = updated_at 
WHERE health_survey_completed = true;
```

**2. MaylaApp.tsx — lógica de verificação**
- Buscar `health_survey_completed` e `health_survey_completed_at`
- Se `health_survey_completed = true` E `health_survey_completed_at` está dentro dos últimos 6 meses → ir para `main`
- Se `health_survey_completed = true` mas já passaram 6 meses → resetar e mostrar questionário novamente
- Se `health_survey_completed = false` → splash/onboarding/survey

**3. HealthSurvey.tsx — salvar timestamp**
- Ao completar, além de `health_survey_completed: true`, salvar `health_survey_completed_at: new Date().toISOString()`

**4. Arquivos modificados**
- Migration SQL (novo campo)
- `src/components/mayla/MaylaApp.tsx` (lógica de 6 meses)
- `src/components/mayla/HealthSurvey.tsx` (salvar timestamp)

