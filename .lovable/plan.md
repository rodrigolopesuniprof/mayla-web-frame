

# Plano: Feature toggles por empresa + Reestruturação do fluxo de consulta + Favoritar médico

## Resumo

Três frentes de trabalho:
1. **Feature toggles no admin**: permitir ativar/desativar "Realizar Consulta" (e futuramente outros serviços) por empresa
2. **Reestruturar fluxo de consulta**: mudar a ordem para Modo → Especialidade → Médico → Horário → Confirmar, e remover o dialog intermediário na HomeTab (ir direto para o fluxo)
3. **Favoritar médico no fluxo de consulta Mayla**: permitir favoritar médicos da plataforma Mayla (partners), criando uma `prontuario_connection` com token para acesso ao relatório

---

## 1. Feature toggle "consulta" no Admin

### Banco de dados
- Sem migração necessária. Usar a tabela `company_features` existente com `feature_key = "consulta_servico"`.

### AdminIntegrations.tsx (ou nova seção no AdminCompanySettings)
- Adicionar um novo toggle na seção "Integrações" (ou "Serviços Médicos") para ativar/desativar o serviço de consulta
- Usar o mesmo padrão `company_features.upsert` com `feature_key: "consulta_servico"`

### Frontend (HomeTab + ServicosTab)
- Criar hook `useCompanyFeature(featureKey)` genérico que consulta `company_features`
- No HomeTab, condicionar a exibição do card "Consultas" ao toggle `consulta_servico`
- No ServicosTab, condicionar o botão "Realizar Consulta" ao mesmo toggle

---

## 2. Reestruturar fluxo de consulta

### HomeTab.tsx
- Remover o dialog intermediário com 4 opções (Atendimento Agora, Online, Presencial, Histórico)
- Ao clicar no card "Consultas", ir direto para o `ConsultationFlow` (via `onOpenConsultationOnline` ou equivalente)

### ConsultationFlow.tsx
- **Mudar ordem dos steps**: `mode → specialty → doctors → schedule → confirm`
- Step "mode" agora é o primeiro: apresentar apenas "Presencial" e "Online" (remover "Primeiro disponível" como step — pode ser um botão dentro do step doctors)
- Step "specialty": 
  - Carregar especialidades da API parceira (Meddit) via `prontuario-proxy?action=specialities` se feature `prontuario_conveniado` estiver ativa
  - Carregar especialidades dos parceiros cadastrados no admin (lista `SPECIALTIES` atual + query `SELECT DISTINCT specialty FROM partners WHERE active = true`)
  - Combinar ambas as listas sem duplicatas
- Steps doctors, schedule, confirm: manter como estão
- Atualizar `goBack` e `stepLabels` para refletir a nova ordem

---

## 3. Favoritar médico (plataforma Mayla)

### Contexto
Já existe `prontuario_connections` para médicos Meddit. Estender para médicos Mayla (partners).

### ConsultationFlow.tsx
- No card do médico expandido (step doctors), adicionar botão "⭐ Favoritar"
- Ao favoritar, criar registro em `prontuario_connections` com:
  - `external_system: "mayla"`
  - `source_type: "mayla_partner"`
  - `external_professional_id: partner.id`
  - `external_professional_name: partner.name`
  - `report_token: crypto.randomUUID()`
- Para médicos Meddit (via ProntuarioConveniado), o fluxo já existe

### Restrição de acesso por token
- O acesso via token já está implementado em `prontuario-verify` e na rota `/relatorio/medico/:token`
- `FavoriteDoctors.tsx` já exibe e permite revogar conexões de ambos os sistemas

---

## Arquivos afetados

- **Editar**: `src/components/admin/AdminIntegrations.tsx` — adicionar toggle `consulta_servico`
- **Criar**: `src/hooks/useCompanyFeature.ts` — hook genérico para consultar feature flags
- **Editar**: `src/components/mayla/HomeTab.tsx` — remover dialog intermediário, ir direto ao fluxo, condicionar exibição
- **Editar**: `src/components/mayla/ConsultationFlow.tsx` — reordenar steps (mode → specialty → doctors → schedule → confirm), carregar especialidades dinâmicas, adicionar botão favoritar
- **Editar**: `src/components/mayla/ServicosTab.tsx` — condicionar "Realizar Consulta" ao toggle

