

# Plano: Corrigir problemas no fluxo de consulta e toggles admin

## Problemas identificados

1. **Especialidades cadastradas no admin sumiram** — O step "specialty" no `ConsultationFlow` só mostra a lista hardcoded `SPECIALTIES`. Não carrega especialidades dos parceiros cadastrados no banco (`partners.specialty`).

2. **Não há distinção entre fluxo API e fluxo interno** — O fluxo de consulta já usa parceiros internos. Este ponto está OK, mas precisa carregar especialidades dinâmicas do banco para que os médicos internos apareçam.

3. **Falta toggle no admin para médicos internos/externos** — O `AdminIntegrations` tem o toggle "Serviço de Consultas" (genérico) mas não há toggles separados para ativar/desativar agendamento com médicos internos vs médicos da API externa (Meddit).

4. **Botão "Realizar Consulta" sumiu da HomeTab** — O botão está condicionado a `consultaEnabled`, que depende de um registro `consulta_servico` na tabela `company_features`. Se esse registro não existir, o botão não aparece.

## Correções

### 1. `ConsultationFlow.tsx` — Carregar especialidades do banco
- No step "specialty", além da lista hardcoded `SPECIALTIES`, fazer query `SELECT DISTINCT specialty FROM partners WHERE active = true AND approval_status = 'approved' AND specialty IS NOT NULL`
- Mesclar as duas listas sem duplicatas (case-insensitive)
- Exibir todas como botões clicáveis (as que vêm do banco sem emoji terão um emoji genérico 🩺)

### 2. `AdminIntegrations.tsx` — Adicionar toggles separados
- Adicionar dois novos feature keys: `consulta_medicos_internos` e `consulta_medicos_externos`
- Exibir como sub-toggles dentro do card "Serviço de Consultas" (visíveis somente quando `consulta_servico` está ativo)
- "Agendamento com médicos internos" — habilita busca na tabela `partners`
- "Agendamento com médicos externos (API parceira)" — habilita busca via API Meddit

### 3. `HomeTab.tsx` — Garantir visibilidade do botão
- Mostrar o botão "Realizar Consulta" **sempre** (sem condicional `consultaEnabled`), pois a decisão de quais médicos mostrar é feita dentro do fluxo
- OU: inverter a lógica para `!loading && consultaEnabled` com fallback para mostrar se o hook ainda está carregando — **melhor opção**: manter condicional mas com default `true` quando não há feature flag cadastrada (comportamento opt-out em vez de opt-in)

### 4. `useCompanyFeature.ts` — Default `true` para `consulta_servico`
- Quando o registro não existe na tabela, retornar `enabled: true` (opt-out) em vez de `false` (opt-in), para que funcionalidades não "sumam" automaticamente

## Arquivos afetados

- **Editar**: `src/hooks/useCompanyFeature.ts` — alterar default de `false` para `true` (ou aceitar parâmetro `defaultValue`)
- **Editar**: `src/components/mayla/ConsultationFlow.tsx` — carregar especialidades dinâmicas do banco e mesclar com lista hardcoded
- **Editar**: `src/components/admin/AdminIntegrations.tsx` — adicionar sub-toggles para médicos internos e externos
- **Editar**: `src/components/mayla/HomeTab.tsx` — ajustar condição de exibição do botão consulta

