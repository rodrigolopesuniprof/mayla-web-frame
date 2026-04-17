
O usuário quer que o arquivo de documentação do relatório de saúde (para treino de IA) tenha **dados anonimizados** no exemplo. Vou ajustar o plano anterior para que o exemplo JSON do paciente Machado de Assis seja substituído por dados fictícios/anonimizados.

# Plano: Documentação do Relatório de Saúde (Anonimizada) para Treino de IA

Criar `relatorio-saude-mayla.md` na raiz do projeto, com **todos os dados de exemplo anonimizados**.

## Conteúdo

### 1. Visão geral
- Propósito do relatório, audiência (paciente + profissional), diretriz descritiva (sem diagnósticos)

### 2. Estrutura do relatório
- Cabeçalho (nome, idade, sexo, condições)
- Score Geral (0-100) + 4 sub-scores (Físico, Emocional, Estilo de Vida, Geral)
- Tendências 7 dias
- 8 indicadores Binah: FC, PA, SpO2, FR, HRV/SDNN, Estresse, Idade Vascular, Risco CV
- Alertas (severidade)
- Linha do tempo + histórico de medições

### 3. Fontes de dados
Tabelas: `profiles`, `health_scores`, `health_alerts`, `health_measurements`, `special_measurements`

### 4. Faixas de referência clínica
Tabela com normal/atenção/crítico para cada indicador

### 5. Exemplo anonimizado (JSON)
Payload completo simulando a resposta da API `prontuario-verify`, com:
- `profile.full_name`: "Paciente Anonimizado" (ou "P-XXXX")
- `birth_date`: ano genérico (ex: "1980-01-01")
- `user_id`: UUID fictício/redacted
- `report_token`: `00000000-0000-0000-0000-000000000000`
- Scores, alertas e medições com valores plausíveis mas fictícios

Aviso explícito no topo do exemplo: "**Dados fictícios para fins de treinamento. Nenhuma informação real de paciente é exposta.**"

### 6. Diretrizes para a IA
- Comparar valores às faixas normais
- Nunca prescrever/diagnosticar
- Sugerir consulta quando fora da faixa
- Tom acolhedor em PT-BR
- Janelas: 24h para imediato, 7 dias para padrões

### 7. Glossário
HRV, SDNN, rPPG, Binah, Score Geral

## Arquivo afetado
- **Novo**: `relatorio-saude-mayla.md` (raiz do projeto, dados 100% fictícios)
