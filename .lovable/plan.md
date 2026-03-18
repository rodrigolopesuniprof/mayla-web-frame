

# Plano: Melhorias Gerais (Usuário, Admin, Clínica, Teleconsulta)

São muitas mudanças. Vou dividir em blocos para clareza e prioridade.

---

## Bloco 1 — Correções do Usuário

### 1.1 Formulário aparecendo mais de uma vez
O fluxo de 6 meses já existe em `MaylaApp.tsx`, mas quando o usuário faz login e `health_survey_completed` é `false` (ex: expired reset), ele cai no splash → onboarding → survey novamente. O bug provável: ao completar o survey, o `health_survey_completed_at` pode não estar sendo salvo. Verificar `HealthSurvey.tsx` para garantir que no `onDone` o campo `health_survey_completed_at` é gravado junto com `health_survey_completed = true`.

### 1.2 Informações importantes não aparecendo (UniProf)
As notifications no `HomeTab` usam `supabase.from("notifications").select(...)` sem filtro explícito — depende das RLS policies. As policies filtram por `municipality_id = get_user_municipality_id()` para scope=municipal e `company_id = get_user_company_id()` para scope=company. Se o perfil da pessoa não tem `company_id` preenchido (mesmo estando vinculada à UniProf), as notificações não aparecem. Preciso verificar e ajustar a lógica de vinculação.

### 1.3 Overlay "Centralize seu rosto" na câmera
No `RppgCapture.tsx`, durante a fase `capturing`, a `CapturingOverlay` já mostra "Fique parado · Rosto iluminado". Vou adicionar texto "Centralize seu rosto para um resultado mais preciso" dentro do oval de captura ou logo abaixo dele.

### 1.4 Perfil — Ajustes no menu
- **Remover**: "Notificações" e "Exames e resultados" da lista de menu
- **Configurações**: Implementar subView com: editar nome, upload de foto de perfil, botão "Redefinir senha" que envia email via `supabase.auth.resetPasswordForEmail()`
- **Medicamentos**: Implementar CRUD completo (nome, dosagem, frequência) + check diário de "tomou medicação" no HomeTab (+100 pontos) + integração com relatório

#### Tabela `user_medications` (nova)
- id, user_id, name text, dosage text, frequency text (daily/12h/8h/weekly), active boolean, created_at, updated_at
- RLS: user CRUD próprios

#### Tabela `medication_logs` (nova)
- id, user_id, medication_id FK, taken_at timestamptz, points_awarded integer default 100
- RLS: user insere/lê os seus

#### Componentes:
- `ProfileTab.tsx`: Nova subView `medicamentos` com lista de medicamentos + formulário add/edit + toggle ativo/inativo
- `HomeTab.tsx`: Card "Lembrete de medicação" com lista de medicamentos pendentes hoje + botão check (+100 pts)
- `HealthReport.tsx`: Seção "Adesão à medicação" com percentual de dias com check

---

## Bloco 2 — Admin

### 2.1 Logo não atualizando
Verificar o componente `AdminCompanies.tsx` para garantir que após upload no bucket `company-logos`, o `logo_url` é salvo na tabela `companies` E que o frontend re-renderiza com a nova URL (possível cache ou falta de atualização de estado).

---

## Bloco 3 — Conta Clínica (Disponibilidade de horários)

### 3.1 Interface para clínica definir horários
A tabela `doctor_availability` já existe com `partner_id, weekday, start_time, end_time, specialty, slot_duration_minutes, consultation_mode`. O que falta é uma interface no `ProfessionalDashboard` para o profissional gerenciar seus próprios blocos de disponibilidade.

Criar nova aba "Disponibilidade" no `ProfessionalDashboard.tsx`:
- Grid por dia da semana (seg-sex)
- Cada bloco: hora início, hora fim, especialidade (dropdown das especialidades do parceiro), duração do slot, modo (online/presencial/ambos)
- CRUD com botão + para adicionar bloco, X para remover
- RLS: adicionar policy para profissional gerenciar própria disponibilidade via `partners.user_id`

---

## Bloco 4 — Teleconsulta

### 4.1 Dados compartilhados não carregando para médico (BUG)
**Bug encontrado**: No `JitsiConsultationScreen.tsx`, a query inicial (linha 105) tem `professional_id` hardcoded como string vazia: `.eq("professional_id", consultation.id.split("-")[0] === "mayla" ? "" : "")`. Isso nunca retorna dados.

**Fix**: A consulta do profissional precisa buscar shares pelo `professional_id` correto. Como o componente recebe `consultation.id`, preciso buscar o `professional_id` da consulta e usar esse valor. Além disso, a `initialCheck` (linha 128) faz query sem filtro — retorna qualquer share, não o relevante.

**Correção**:
1. No `ProfessionalDashboard`, passar `professionalId={partner.id}` ao `JitsiConsultationScreen`
2. No `JitsiConsultationScreen`, usar esse `professionalId` para filtrar `report_shares` na query inicial e no realtime
3. Habilitar realtime na tabela `report_shares`: `ALTER PUBLICATION supabase_realtime ADD TABLE public.report_shares`

### 4.2 Área para médico enviar documentos (receitas, atestados, pedidos de exames)
#### Tabela `consultation_documents` (nova)
- id, consultation_id uuid, professional_id uuid, user_id uuid
- document_type text (prescription/certificate/exam_request)
- title text, content text (texto livre ou template)
- file_url text nullable (PDF gerado)
- sent_to_email boolean default false, sent_at timestamptz
- created_at timestamptz

#### Componente `DocumentSender.tsx`
- Dentro da `JitsiConsultationScreen` (lado profissional), botão "📄 Enviar documento"
- Dialog com 3 tipos: Receita, Atestado, Pedido de exame
- Formulário com campos específicos por tipo + textarea
- Ao salvar: grava no banco + dispara email para o paciente via edge function

#### Edge function `send-consultation-document`
- Recebe document_id, busca dados, envia email ao paciente com o conteúdo

---

## Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Migração | `user_medications`, `medication_logs`, `consultation_documents`, RLS policies, realtime report_shares |
| Editar | `src/components/mayla/ProfileTab.tsx` — remover itens, implementar Configurações e Medicamentos |
| Editar | `src/components/mayla/HomeTab.tsx` — card lembrete medicação |
| Editar | `src/components/mayla/RppgCapture.tsx` — overlay "centralize rosto" |
| Editar | `src/components/mayla/MaylaApp.tsx` — verificar bug do survey duplicado |
| Editar | `src/components/mayla/HealthSurvey.tsx` — garantir gravação de timestamp |
| Editar | `src/components/mayla/JitsiConsultationScreen.tsx` — fix query shares + add professionalId prop + DocumentSender |
| Editar | `src/pages/ProfessionalDashboard.tsx` — passar professionalId, aba Disponibilidade |
| Editar | `src/components/report/HealthReport.tsx` — seção adesão medicação |
| Criar | `src/components/professional/AvailabilityEditor.tsx` |
| Criar | `src/components/professional/DocumentSender.tsx` |
| Criar | `supabase/functions/send-consultation-document/index.ts` |
| Verificar | `src/components/admin/AdminCompanies.tsx` — logo upload |

---

## Ordem de implementação

1. Migrações de banco (tabelas + RLS + realtime)
2. Bug fixes (survey duplicado, shares não carregando, logo admin)
3. Overlay câmera + ajustes perfil (remover itens)
4. Configurações (nome, foto, senha)
5. Medicamentos (CRUD + check diário + pontos + relatório)
6. Disponibilidade do profissional
7. Documentos na teleconsulta

