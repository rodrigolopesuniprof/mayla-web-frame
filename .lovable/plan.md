

# Plano: Corrigir sistema de pontuação, histórico e relatório de saúde

## Problemas identificados

### 1. Medição especial (Binah/Vitals) não aparece no histórico
- `BinahCapture.tsx` salva apenas em `special_measurements`
- O histórico em `ProfileTab.tsx` (`HistoricoMedicoes`) lê apenas de `health_measurements`
- **Solução**: Após salvar em `special_measurements`, também inserir em `health_measurements` com os dados vitais extraídos do `measurement_data`

### 2. Pontos não são computados
- O toast mostra "+100 pontos" mas nenhum `UPDATE profiles SET points = points + 100` é executado
- A medição rPPG (no `rppg-proxy`) também mostra "+50 pontos" via toast, mas igualmente não atualiza o banco
- **Solução**: Adicionar `UPDATE profiles.points` em ambos os fluxos (BinahCapture e rppg-proxy)

### 3. Relatório de saúde vazio
- A tabela `health_scores` está vazia — a edge function `calculate-health-scores` nunca é chamada automaticamente
- Os trend cards (FC, Estresse, Sono, Passos) são todos hardcoded com `"--"` e dados fictícios de barras
- **Solução**: 
  - Chamar `calculate-health-scores` automaticamente após cada medição salva
  - Popular os trend cards com dados reais de `health_measurements` dos últimos 7 dias

## Implementação

### Arquivo 1: `src/components/mayla/BinahCapture.tsx`
- Na função `saveResult`, após inserir em `special_measurements`:
  1. Inserir também em `health_measurements` com `measurement_type: "vitals_premium"` (ou `"vitals_demo"`), extraindo `heart_rate`, `spo2`, `blood_pressure_sys/dia`, `respiratory_rate`, `stress_level` do `mappedResult`
  2. Atualizar `profiles.points` com `+100`
  3. Chamar `calculate-health-scores` via `supabase.functions.invoke`

### Arquivo 2: `supabase/functions/rppg-proxy/index.ts`
- Após salvar em `health_measurements` (já existe), adicionar:
  1. `UPDATE profiles SET points = points + 50 WHERE user_id = userId`
  2. Chamar `calculate-health-scores` internamente (ou inserir score inline)

### Arquivo 3: `src/components/report/HealthReport.tsx`
- Buscar dados reais de `health_measurements` dos últimos 7 dias para popular os trend cards (FC, Estresse)
- Buscar dados de `questionnaire_responses` para popular a seção de questionários
- Popular a timeline com eventos reais (medições + questionários)

### Arquivo 4: `src/components/mayla/ProfileTab.tsx` (HistoricoMedicoes)
- Incluir também dados de `special_measurements` no histórico, mapeando `measurement_data` para os campos visuais

## Arquivos afetados
- `src/components/mayla/BinahCapture.tsx` — salvar em `health_measurements` + pontos
- `supabase/functions/rppg-proxy/index.ts` — computar pontos
- `src/components/report/HealthReport.tsx` — popular trends e timeline com dados reais
- `src/components/mayla/ProfileTab.tsx` — unificar histórico

