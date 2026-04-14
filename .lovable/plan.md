

# Plano: Melhorar relatório de saúde — interatividade, explicações e visual

## Mudanças propostas

### 1. Gráficos interativos nos Trend Cards
- Ao tocar numa barra do mini chart, mostrar tooltip com o valor real e a data (ex: "Seg 7/abr — 82 bpm")
- Identificar pico e vale da semana e exibir legenda abaixo do gráfico (ex: "Pico: 92 bpm (ter) · Mínima: 68 bpm (qui)")
- **Arquivo**: `TrendCard.tsx` — adicionar state para barra selecionada + tooltip; receber array de datas + valores reais como props
- **Arquivo**: `HealthReport.tsx` — passar datas e valores brutos (não apenas percentuais) para cada TrendCard

### 2. Botão "?" de explicação em cada seção
- Adicionar ícone "?" ao lado de "Score geral", cada subscore, e cada trend card
- Ao clicar, abrir um Sheet/Dialog com explicação:
  - **Score geral (72)**: "Média ponderada: 40% Fisiológico + 30% Emocional + 30% Estilo de vida. Baseado nas suas medições dos últimos 7 dias."
  - **Fisiológico**: "Calculado a partir de FC, SpO2, PA, Respiração, HRV, Hemoglobina e HbA1c"
  - **Emocional**: "Baseado no nível de estresse medido via câmera"
  - **Estilo de vida**: "Atualmente sem fontes conectadas (sono/passos). Valor padrão aplicado."
  - Cada trend card: faixa ideal, o que significa alto/baixo
- **Arquivos**: `HealthReport.tsx`, `ScoreRing.tsx` (ou novo componente `InfoButton`)

### 3. Seção de Questionários — conectar à empresa
- Remover os 3 cards hardcoded de "Sem dados"
- Buscar questionários vinculados à empresa do usuário via `company_campaigns` ou `surveys`
- Se não houver campanhas ativas, mostrar mensagem única "Nenhuma campanha de questionários ativa para sua empresa"
- Preparar a estrutura para quando campanhas forem criadas
- **Arquivo**: `HealthReport.tsx` — fetch de campanhas/surveys da empresa

### 4. Timeline semanal — redesign visual
- Agrupar eventos por dia (em vez de um item por medição)
- Card por dia com visual de cartão arredondado, ícone de tipo, hora da medição
- Mostrar resumo dos vitais em formato de chips coloridos dentro do card
- Data no topo como header de grupo
- **Arquivos**: `TimelineItem.tsx` — redesign do componente; `report.css` — novos estilos

## Arquivos afetados
- `src/components/report/TrendCard.tsx` — tooltip interativo + pico/vale
- `src/components/report/HealthReport.tsx` — passar dados brutos, explicações, fetch questionários, timeline agrupada
- `src/components/report/TimelineItem.tsx` — redesign visual agrupado por dia
- `src/components/report/report.css` — estilos novos (tooltip, info button, timeline cards)
- Novo: `src/components/report/InfoSheet.tsx` — componente reutilizável para explicações "?"

