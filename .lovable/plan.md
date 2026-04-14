

# Plano: Expandir relatório com todos os dados do Binah e remover métricas inexistentes

## O que muda

### Remover
- **Sono médio** — não há dispositivo conectado que capture essa informação
- **Passos/dia** — idem, sem fonte de dados

### Adicionar (dados coletados pelo Binah)
- **SpO2** (Saturação de Oxigênio) — `spo2` em `health_measurements`
- **Pressão Arterial** — `blood_pressure_sys` / `blood_pressure_dia`
- **Respiração** — `respiratory_rate`
- **HRV (SDNN)** — `hrv`
- **Hemoglobina** — campo disponível em `special_measurements.measurement_data`
- **HbA1c** — idem
- **Bem-estar** — `wellness_score` no measurement_data

### Layout dos Trend Cards (grade 2x4 → 8 cards)
1. Freq. Cardíaca (FC) — já existe
2. Estresse — já existe
3. SpO2 — novo
4. Pressão Arterial — novo (formato "120/80")
5. Respiração — novo
6. HRV SDNN — novo
7. Hemoglobina — novo
8. HbA1c — novo

### Timeline
- Enriquecer com mais campos: SpO2, PA, Respiração, HRV além de FC e Estresse

## Implementação

### Arquivo 1: `src/components/mayla/BinahCapture.tsx`
- Na inserção em `health_measurements`, incluir também `hrv` (mapeado de `hrv_sdnn`) para que o campo fique disponível para o relatório

### Arquivo 2: `src/components/report/HealthReport.tsx`
- Remover os 2 trend cards de Sono e Passos
- Adicionar 6 novos trend cards (SpO2, PA, Respiração, HRV, Hemoglobina, HbA1c)
- Buscar dados extras de `special_measurements` para campos que não existem em `health_measurements` (hemoglobina, hba1c, wellness)
- Atualizar o fetch para incluir `spo2`, `blood_pressure_sys`, `blood_pressure_dia`, `respiratory_rate`, `hrv`
- Atualizar a timeline para mostrar mais dados por evento

### Arquivo 3: `src/components/report/TrendCard.tsx`
- Nenhuma alteração necessária — o componente já é genérico

## Arquivos afetados
- `src/components/report/HealthReport.tsx` — principal (expandir trends, remover sono/passos)
- `src/components/mayla/BinahCapture.tsx` — garantir que `hrv` é salvo em `health_measurements`

