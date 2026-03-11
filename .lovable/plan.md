

## Plano: Substituir perguntas APS por Análise de Saúde Mental

### O que será removido
As seguintes telas/steps serão removidos do `HealthSurvey.tsx`:
- **family** — "Qual a situação da sua família?" (acamado, grávida em casa, criança <5)
- **child_vaccine** — "Seu filho tem menos de 12 anos?"
- **infant** — "Você mora com crianças menores de 1 ano?"
- **bolsa** — "Sua família é beneficiária do Bolsa Família?"
- **acs** — "Recebeu a visita de um Agente Comunitário de Saúde?"
- **dental** — "Quando foi sua última consulta com o dentista?"
- **prenatal_dental** — "Acompanhamento odontológico do pré-natal?"

### O que será adicionado (conforme imagens de referência)
5 novas telas com seleção visual usando emojis, estilo card com 5 opções cada:

| Step | Categoria | Pergunta | Opções (1→5) |
|------|-----------|----------|--------------|
| `mental_mood` | HUMOR | "Nas últimas 2 semanas, você se sentiu desanimado ou sem esperança?" | Sempre, Frequente, Às vezes, Raramente, Nunca |
| `mental_anxiety` | ANSIEDADE | "Você se sentiu nervoso ou ansioso hoje?" | Muito, Bastante, Moderado, Pouco, Nada |
| `mental_stress` | ESTRESSE | "Você sentiu que as coisas estavam fora do seu controle?" | Completo, Bastante, Moderado, Pouco, Nada |
| `mental_sleep` | SONO | "Como você dormiu na última noite?" | Muito mal, Mal, Regular, Bem, Muito bem |
| `mental_social` | SUPORTE SOCIAL | "Você sente que tem pessoas com quem pode contar quando precisa?" | Nenhuma, Quase, Algumas, Sim, Sim muito |

### UI das novas telas
- Header com label de categoria (ex: "HUMOR") em texto pequeno uppercase
- Pergunta principal em destaque
- 5 botões com emoji + label, dispostos em row (horizontal), estilo rounded card — seguindo o design das imagens enviadas

### Alterações no modelo de dados
- Remover campos APS do `SurveyData`: `lives_with_infant`, `is_bolsa_familia`, `last_acs_visit`, `last_dental_visit`, `prenatal_dental_done`, `has_bedridden_at_home`, `has_pregnant_at_home`, `has_child_under_5`, `has_child_under_12`
- Adicionar: `mental_mood`, `mental_anxiety`, `mental_stress`, `mental_sleep`, `mental_social` (todos number 1-5)
- No `handleFinish`, salvar os novos campos no profile (ou em tabela separada se não existirem as colunas)

### Migration
- Adicionar colunas `mental_mood`, `mental_anxiety`, `mental_stress`, `mental_sleep`, `mental_social` (integer) à tabela `profiles`

### Tags/Missões
- Remover tags APS (`TAG_VULNERAVEL`, `TAG_RESPONSAVEL_VACINA`)  
- Adicionar lógica de tag de saúde mental: se mood ≤ 2 ou anxiety ≥ 4 ou stress ≥ 4 → `TAG_SAUDE_MENTAL`

### Fluxo final de steps
1. sex → 2. birth → 3. pregnant (se aplicável) → 4. prenatal (se grávida) → 5. chronic → 6. address → 7. body → 8. mental_mood → 9. mental_anxiety → 10. mental_stress → 11. mental_sleep → 12. mental_social

