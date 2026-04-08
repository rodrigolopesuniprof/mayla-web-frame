

# Plano: Integração Mayla <> Meddit (Prontuário Conveniado)

## Resumo

Integração bidirecional entre o Mayla e a API da Meddit para agendamento de consultas e compartilhamento de relatórios de saúde com médicos. A feature é habilitada por empresa via feature flag.

## API Meddit - Endpoints Mapeados

```text
Base URL: http://meddit-api-clinic-nv.us-west-2.elasticbeanstalk.com
Auth: Header "Authorization: meddit-atria-2026"

Users:
  GET /v1/users/cpf/{nro}              → busca paciente por CPF

Clinics:
  GET /v1/clinics/user/cpf/{nro}       → clínicas do paciente por CPF
  GET /v1/clinics/specialities          → lista especialidades
  GET /v1/clinics/search                → busca clínicas
  GET /v1/clinics/speciality/search     → busca por especialidade
  GET /v1/clinics/professional/search   → busca por profissional
  GET /v1/clinics/offices               → lista consultórios

Professionals:
  GET /v1/professionals/{id}/office/{officeId}/calendar → agenda

Appointments:
  GET /v1/appointments/{qtddays}/professional/{id}/patient/{patientId}/check
  POST /v1/appointments/register        → cria agendamento
```

## Arquitetura

```text
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  App Mayla (FE)  │────▶│  Edge Function       │────▶│  API Meddit  │
│                  │     │  prontuario-proxy    │     │              │
│                  │     │  (API key segura)     │     │              │
└──────────────────┘     └─────────────────────┘     └──────────────┘
                                  │
                         ┌────────┴────────┐
                         │  Supabase DB    │
                         │  - prontuario_  │
                         │    connections  │
                         │  - report_shares│
                         │  - appointments │
                         └─────────────────┘

┌──────────────────┐     ┌─────────────────────┐
│  Sistema Meddit  │────▶│  Edge Function       │  Meddit chama p/ validar
│  (embed iframe)  │     │  prontuario-verify   │  se médico X tem acesso
│                  │     │  (API key compartilh)│  ao token Y
└──────────────────┘     └─────────────────────┘
```

## Etapas de Implementação

### 1. Secret + Banco de Dados

**Secret**: `MEDDIT_API_KEY` = `meddit-atria-2026`

**Migração SQL**:
- Tabela `prontuario_connections` para vincular user_id (Mayla) a um professional_id externo e armazenar token permanente de acesso ao relatório
- Colunas: `id`, `user_id`, `company_id`, `external_system` (ex: 'meddit'), `external_professional_id`, `external_professional_name`, `external_clinic_name`, `report_token` (UUID permanente), `active`, `created_at`
- Feature flag: inserir registro em `company_features` com `feature_key = 'prontuario_conveniado'`
- RLS: usuário lê/escreve os próprios registros; admins gerenciam tudo

### 2. Edge Function `prontuario-proxy`

Proxy seguro que:
- Recebe requests do front-end autenticado (JWT do Supabase)
- Repassa para a API Meddit com a API key
- Rotas: `GET /specialities`, `GET /professionals`, `GET /calendar`, `GET /check`, `POST /register`
- Envia CPF do usuário (obtido do profile via service_role) para identificar paciente no Meddit

### 3. Edge Function `prontuario-verify`

Endpoint público protegido por API key compartilhada com o Meddit:
- `GET /prontuario-verify?token=XXX&professional_id=YYY`
- Valida se existe registro ativo em `prontuario_connections` com aquele token e professional_id
- Retorna: `{ authorized: true, report_url: "https://...relatorio/medico/TOKEN" }` ou `{ authorized: false }`

### 4. Front-end: Seção "Prontuário Conveniado" no ServicosTab

- Verificar feature flag `prontuario_conveniado` para a empresa do usuário
- Se ativo, exibir botão "Prontuário Conveniado" no menu de Serviços
- Fluxo:
  1. Lista especialidades (GET specialities)
  2. Busca profissionais por especialidade (GET professional/search)
  3. Exibe agenda do profissional (GET calendar)
  4. Verifica conflitos (GET check)
  5. Confirma agendamento (POST register no Meddit + INSERT na tabela `appointments` do Mayla com `external_source: 'prontuario_system'`)

### 5. Front-end: Favoritar e Autorizar no card do médico

- Botão com icone Heart (Lucide) no card do profissional Meddit
- Ao clicar: cria registro em `prontuario_connections` com token UUID permanente
- Chama a Edge Function que envia o token + dados para o Meddit (POST ou endpoint definido)
- UI mostra estado "Autorizado" com coração preenchido

### 6. Ajuste no ProfessionalReport

- Além de validar via `report_shares` (temporário, 48h), também validar via `prontuario_connections` (permanente)
- Se o token vier de `prontuario_connections`, verificar se o `external_professional_id` bate

### 7. Admin: Toggle da feature no painel da empresa

- Na seção "Dados da Conta" do AdminCompanyDetail, adicionar toggle "Prontuário Conveniado"
- Ao ativar, inserir/atualizar registro em `company_features` com `feature_key = 'prontuario_conveniado'`
- Campo de configuração opcional para informações específicas do sistema externo

## Arquivos Afetados

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/functions/prontuario-proxy/index.ts` |
| Criar | `supabase/functions/prontuario-verify/index.ts` |
| Migração | Nova tabela `prontuario_connections` + RLS |
| Criar | `src/components/mayla/ProntuarioConveniado.tsx` (fluxo completo) |
| Editar | `src/components/mayla/ServicosTab.tsx` (adicionar botao) |
| Editar | `src/components/report/ProfessionalReport.tsx` (validar token permanente) |
| Editar | `src/components/admin/AdminCompanySettings.tsx` (toggle feature) |
| Criar | `src/hooks/useProntuarioFeature.ts` (verificar feature flag) |

## Ordem de Execução

1. Adicionar secret `MEDDIT_API_KEY`
2. Criar migração (tabela + RLS)
3. Criar Edge Functions (proxy + verify)
4. Criar hook `useProntuarioFeature`
5. Criar componente `ProntuarioConveniado` + integrar no ServicosTab
6. Ajustar ProfessionalReport
7. Adicionar toggle no Admin

