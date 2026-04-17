# Relatório de Saúde Mayla — Documentação para IA

> **Objetivo deste documento**: fornecer a uma IA externa o contexto completo sobre **como o relatório de saúde do paciente é estruturado pela Mayla Saúde**, para que ela possa ler o payload, interpretar os indicadores e gerar recomendações e interações com o usuário.
>
> ⚠️ **Todos os dados de exemplo neste arquivo são fictícios e anonimizados. Nenhuma informação real de paciente é exposta.**

---

## 1. Visão Geral

O **Relatório de Saúde Mayla** (`/relatorio` no app do paciente, `/relatorio/medico/:token` para profissionais vinculados) é um dashboard descritivo que consolida os dados biométricos e comportamentais do usuário nos **últimos 7 dias**.

### Diretrizes clínicas (obrigatórias para a IA)
- **Descritivo, não diagnóstico**: o relatório aponta padrões e desvios em relação a faixas de referência. Nunca diagnostica doenças.
- **Sem prescrição**: a IA **nunca** deve recomendar medicamentos, dosagens ou tratamentos.
- **Encaminhamento**: quando indicadores estiverem fora da faixa normal, sugerir avaliação por profissional de saúde.
- **Tom**: acolhedor, empático, em **português brasileiro**, evitando jargão técnico desnecessário.

### Audiência
- **Paciente**: visualização completa em `/relatorio`.
- **Profissional vinculado** (médico/enfermeiro Meddit ou interno): visualização idêntica via `/relatorio/medico/:token` ou modo embed (`?view=embed`).

---

## 2. Estrutura do Relatório

As seções aparecem nesta ordem na interface:

### 2.1 Cabeçalho do Paciente
- Nome
- Idade (calculada a partir de `birth_date`)
- Sexo biológico
- Condições crônicas declaradas: hipertensão, diabetes

### 2.2 Score Geral de Saúde (0–100)
Anel circular (`ScoreRing`) com classificação:

| Faixa  | Classificação |
|--------|---------------|
| 85–100 | Excelente     |
| 70–84  | Bom           |
| 50–69  | Regular       |
| 0–49   | Atenção       |

### 2.3 Sub-scores (4 dimensões)
Cada um varia de 0 a 100 e é calculado pela edge function `calculate-health-scores`:

| Sub-score             | O que mede                                                              |
|-----------------------|-------------------------------------------------------------------------|
| `score_physiological` | Sinais vitais (FC, PA, SpO2, FR, HRV)                                   |
| `score_emotional`     | Estresse, humor, ansiedade, sono (questionários + HRV)                  |
| `score_lifestyle`     | Atividade física, passos, minutos ativos, sono                          |
| `score_general`       | Composição ponderada dos três anteriores                                |

`recommendation_level` (1–5): nível sugerido de intervenção (1 = manter rotina, 5 = procurar ajuda).

### 2.4 Tendências dos Últimos 7 Dias (`TrendCard`)
Variação percentual entre a média da semana atual e a semana anterior para cada indicador-chave. Setas:
- 🔼 melhora
- 🔽 piora
- ➖ estável (variação < 3%)

### 2.5 Oito Indicadores Vitais (capturados via Binah/rPPG)

| # | Indicador                | Campo                              | Unidade  |
|---|--------------------------|------------------------------------|----------|
| 1 | Frequência cardíaca      | `heart_rate`                       | bpm      |
| 2 | Pressão arterial         | `blood_pressure_sys` / `_dia`      | mmHg     |
| 3 | Saturação de oxigênio    | `spo2`                             | %        |
| 4 | Frequência respiratória  | `respiratory_rate`                 | rpm      |
| 5 | Variabilidade da FC (HRV)| `hrv` (SDNN)                       | ms       |
| 6 | Nível de estresse        | `stress_level`                     | 1–5      |
| 7 | Idade vascular           | `special_measurements.vascular_age`| anos     |
| 8 | Risco cardiovascular     | `special_measurements.cv_risk`     | %        |

### 2.6 Alertas de Saúde (`AlertCard`)
Gerados automaticamente quando um indicador permanece fora da faixa por N dias.

| Severidade | Quando aparece                                  |
|------------|-------------------------------------------------|
| `critical` | Risco imediato (ex: SpO2 < 90%, PA ≥ 180/120)   |
| `warning`  | Fora da faixa por ≥ 2 dias                      |
| `info`     | Padrão a observar (variação significativa)      |
| `low`      | Dentro do normal — registro de melhoria         |

Campos: `metric`, `description`, `detail`, `days_triggered`, `generated_at`.

### 2.7 Linha do Tempo (`TimelineItem`)
Medições agrupadas por dia, com chips coloridos (verde/âmbar/vermelho) por indicador.

### 2.8 Histórico
Últimas **20 medições** ordenadas por `measured_at DESC`.

---

## 3. Fontes de Dados

| Tabela                  | Conteúdo                                                                 |
|-------------------------|--------------------------------------------------------------------------|
| `profiles`              | Demografia, condições crônicas, dados de contato                         |
| `health_scores`         | Scores calculados (1 registro por janela de 7 dias)                      |
| `health_alerts`         | Alertas ativos (filtrar por `dismissed_at IS NULL`)                      |
| `health_measurements`   | Medições rPPG/Vitals normalizadas                                        |
| `special_measurements`  | Medições premium (idade vascular, risco CV, etc.) em `measurement_data`  |

A IA recebe todos esses dados consolidados em um único payload via a edge function `prontuario-verify` (ver seção 5).

---

## 4. Faixas de Referência Clínica

Use estas faixas para classificar cada indicador antes de gerar recomendações.

| Indicador                   | Normal         | Atenção                | Crítico                 |
|-----------------------------|----------------|------------------------|-------------------------|
| Frequência cardíaca (bpm)   | 60–100         | 50–59 ou 101–120       | < 50 ou > 120           |
| PA sistólica (mmHg)         | < 130          | 130–139                | ≥ 140                   |
| PA diastólica (mmHg)        | < 85           | 85–89                  | ≥ 90                    |
| SpO2 (%)                    | ≥ 95           | 90–94                  | < 90                    |
| Frequência respiratória     | 12–20          | 21–24 ou 9–11          | > 24 ou < 9             |
| HRV / SDNN (ms)             | > 50           | 30–50                  | < 30                    |
| Estresse (1–5)              | 1–2            | 3                      | 4–5                     |
| Idade vascular vs cronológica | ±5 anos      | +6 a +10 anos          | > +10 anos              |
| Risco cardiovascular (%)    | < 10           | 10–20                  | > 20                    |
| Score Geral                 | ≥ 70           | 50–69                  | < 50                    |

---

## 5. Exemplo Anonimizado (Payload Completo)

> **Dados fictícios para fins de treinamento. Nenhuma informação real de paciente é exposta.**

Resposta simulada de `GET /functions/v1/prontuario-verify?token=...`:

```json
{
  "authorized": true,
  "professional_id": "P-0001",
  "professional_name": "Profissional Anonimizado",
  "report_url": "https://app.exemplo.com/relatorio/medico/00000000-0000-0000-0000-000000000000?view=embed",
  "user_id": "00000000-0000-0000-0000-000000000001",
  "profile": {
    "full_name": "Paciente Anonimizado",
    "birth_date": "1980-01-15",
    "biological_sex": "male",
    "has_hypertension": true,
    "has_diabetes": false
  },
  "scores": {
    "id": "00000000-0000-0000-0000-0000000000aa",
    "user_id": "00000000-0000-0000-0000-000000000001",
    "period_start": "2025-04-10",
    "period_end": "2025-04-17",
    "score_general": 72,
    "score_physiological": 68,
    "score_emotional": 75,
    "score_lifestyle": 70,
    "recommendation_level": 2,
    "generated_at": "2025-04-17T08:00:00Z"
  },
  "alerts": [
    {
      "id": "00000000-0000-0000-0000-0000000000b1",
      "user_id": "00000000-0000-0000-0000-000000000001",
      "metric": "blood_pressure",
      "severity": "warning",
      "description": "Pressão arterial elevada nos últimos dias",
      "detail": "Média de 138/88 mmHg em 4 das últimas 7 medições.",
      "days_triggered": 4,
      "generated_at": "2025-04-16T07:30:00Z",
      "dismissed_at": null
    },
    {
      "id": "00000000-0000-0000-0000-0000000000b2",
      "user_id": "00000000-0000-0000-0000-000000000001",
      "metric": "stress_level",
      "severity": "info",
      "description": "Nível de estresse acima do habitual",
      "detail": "Estresse médio 3.2/5 esta semana vs 2.4/5 na anterior.",
      "days_triggered": 3,
      "generated_at": "2025-04-15T20:10:00Z",
      "dismissed_at": null
    }
  ],
  "measurements": [
    {
      "id": "00000000-0000-0000-0000-0000000000c1",
      "user_id": "00000000-0000-0000-0000-000000000001",
      "measurement_type": "rppg",
      "source": "binah",
      "measured_at": "2025-04-17T07:45:00Z",
      "heart_rate": 78,
      "blood_pressure_sys": 136,
      "blood_pressure_dia": 87,
      "spo2": 97,
      "respiratory_rate": 16,
      "hrv": 42,
      "stress_level": 3,
      "steps": null,
      "active_minutes": null,
      "sleep_duration_min": null
    },
    {
      "id": "00000000-0000-0000-0000-0000000000c2",
      "user_id": "00000000-0000-0000-0000-000000000001",
      "measurement_type": "wearable",
      "source": "manual",
      "measured_at": "2025-04-16T22:00:00Z",
      "heart_rate": 72,
      "spo2": 98,
      "steps": 6420,
      "active_minutes": 28,
      "sleep_duration_min": 380,
      "sleep_quality_score": 72
    },
    {
      "id": "00000000-0000-0000-0000-0000000000c3",
      "user_id": "00000000-0000-0000-0000-000000000001",
      "measurement_type": "rppg",
      "source": "binah",
      "measured_at": "2025-04-15T08:10:00Z",
      "heart_rate": 81,
      "blood_pressure_sys": 140,
      "blood_pressure_dia": 89,
      "spo2": 96,
      "respiratory_rate": 17,
      "hrv": 38,
      "stress_level": 4
    }
  ]
}
```

### Como ler este exemplo
- **Score Geral 72** → faixa "Bom".
- **PA média 138/88** com tendência de alta → alerta `warning` ativo.
- **HRV 38–42 ms** → próximo do limite inferior do normal, sugere monitorar estresse.
- **SpO2 ≥ 96%** → normal.
- **Sono ~6h20min** → abaixo do recomendado (7–9h).

---

## 6. Diretrizes para a IA Gerar Recomendações

### Princípios
1. **Sempre comparar** o valor recebido com a faixa de referência (seção 4) antes de comentar.
2. **Nunca diagnosticar**. Use frases como "os dados sugerem", "vale observar", "pode ser interessante conversar com seu médico".
3. **Nunca prescrever** medicação, dosagem, suplementos ou exames específicos.
4. **Encaminhar** para um profissional sempre que houver indicador `critical` ou alerta de severidade `critical`.
5. **Tom acolhedor** em PT-BR, segunda pessoa ("você"), evitando alarmismo.
6. **Personalizar** considerando condições crônicas (`has_hypertension`, `has_diabetes`) e idade.

### Janelas temporais
- **Últimas 24h**: para recomendações imediatas (ex: "sua medição de hoje cedo mostrou…").
- **Últimos 7 dias**: para padrões e tendências (ex: "esta semana sua pressão esteve em média…").

### Estrutura sugerida de resposta da IA
1. **Saudação personalizada** (usar primeiro nome se disponível).
2. **Resumo do score geral** + classificação.
3. **Destaques positivos** (o que melhorou).
4. **Pontos de atenção** (alertas + indicadores fora da faixa).
5. **Sugestões práticas** de hábitos (sono, hidratação, atividade leve, respiração).
6. **Encaminhamento** quando aplicável ("recomendamos agendar uma teleconsulta").

---

## 7. Glossário

| Termo            | Definição                                                                                  |
|------------------|--------------------------------------------------------------------------------------------|
| **rPPG**         | *Remote photoplethysmography* — extração de sinais vitais via câmera do celular            |
| **Binah**        | SDK de rPPG usado pela Mayla para captura dos 8 indicadores                                |
| **HRV / SDNN**   | *Heart Rate Variability* / *Standard Deviation of NN intervals* — variabilidade da FC      |
| **SpO2**         | Saturação periférica de oxigênio                                                           |
| **Score Geral**  | Composição ponderada dos sub-scores físico, emocional e estilo de vida                     |
| **Idade vascular** | Estimativa da idade biológica do sistema cardiovascular vs idade cronológica             |
| **Risco CV**     | Probabilidade estimada de evento cardiovascular nos próximos 10 anos                       |
| **Mayla Saúde**  | Plataforma B2B de saúde corporativa que origina o relatório                                |
