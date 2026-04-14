

# Plano: Mesclar especialidades Meddit no fluxo de consulta

## Problema
O `SpecialtyStep` no `ConsultationFlow.tsx` carrega especialidades apenas da tabela `partners` (médicos internos). As especialidades vindas da API Meddit (via `prontuario-proxy?action=specialities`) não são carregadas, então os médicos do Meddit nunca aparecem.

## Solução

### `ConsultationFlow.tsx` — `SpecialtyStep`

Alterar o componente `SpecialtyStep` para:

1. **Receber props de contexto**: `user` (do auth) para fazer chamada autenticada ao proxy
2. **Verificar feature flags**: consultar `company_features` para `consulta_medicos_internos` e `consulta_medicos_externos`
3. **Carregar especialidades de ambas as fontes** (em paralelo):
   - Se `consulta_medicos_internos` ativo (default `true`): carregar do `partners` (como hoje)
   - Se `consulta_medicos_externos` ativo (default `true`): chamar `prontuario-proxy?action=specialities` e extrair nomes das especialidades
4. **Mesclar tudo** sem duplicatas (case-insensitive), combinando com a lista hardcoded `SPECIALTIES` para emojis

### `ConsultationFlow.tsx` — Step `doctors`

Quando o usuário seleciona uma especialidade:
- Se `consulta_medicos_internos` ativo: buscar partners internos (como hoje)
- Se `consulta_medicos_externos` ativo: buscar profissionais via `prontuario-proxy?action=professionals&specialityId=X` e exibi-los na mesma lista de médicos, com um badge "Parceiro externo"

Isso unifica a experiência — o usuário vê todos os médicos (internos + Meddit) na mesma tela, sem precisar saber de onde vêm.

### Detalhes técnicos

- Reutilizar a função `proxyCall` já existente em `ProntuarioConveniado.tsx` — extraí-la para um util compartilhado ou duplicar localmente no `ConsultationFlow`
- Na lista de médicos, os que vêm do Meddit terão um campo `source: "meddit"` para diferenciar no momento de agendar (proxy vs interno)
- O agendamento de médicos Meddit redireciona para o fluxo do `prontuario-proxy?action=register`
- O agendamento de médicos internos mantém o fluxo atual (tabela `appointments`)

## Arquivos afetados

- **Editar**: `src/components/mayla/ConsultationFlow.tsx` — `SpecialtyStep` carrega da API Meddit + verifica feature flags; step `doctors` busca profissionais de ambas as fontes
- **Extrair** (opcional): função `proxyCall` para `src/lib/prontuario-helpers.ts` para reutilização

