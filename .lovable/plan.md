

# Plano: Acesso permanente ao relatório para médicos favoritos

## Problema atual

O sistema implementou recentemente um fluxo com `access_code` temporário (5 min, single-use) para acesso via Meddit. Isso quebra o conceito de "favorito = acesso permanente". Além disso, médicos Mayla internos não têm acesso direto ao relatório dos pacientes que os favoritaram.

## Solução

### Dois caminhos de acesso permanente baseados no tipo de médico:

**Médico Meddit (parceiro externo)**:
- A API `prontuario-verify` continua sendo o ponto de entrada, validando `api_key` + `professional_id` + `report_token`
- Mas em vez de gerar `access_code` temporário, retorna os **dados do relatório diretamente** na resposta (perfil, scores, alertas, medições)
- Elimina a necessidade de `report_access_codes` e do fluxo `report-access` intermediário
- O Meddit chama `prontuario-verify` sempre que quiser mostrar o relatório — enquanto a conexão estiver `active`, retorna dados

**Médico Mayla (interno)**:
- No painel profissional, nova seção "Pacientes vinculados" que lista conexões ativas onde `external_system = 'mayla'` e o `internal_partner_id` corresponde ao partner do profissional logado
- Cada paciente vinculado tem um botão "Ver relatório" que abre `/relatorio/medico/{report_token}` com autenticação do profissional
- O `ProfessionalReport` verifica se o usuário autenticado é o profissional vinculado àquela conexão

**Revogação pelo usuário**:
- Já funciona via `Perfil > Meus Médicos > Revogar` (seta `active = false`)
- Ao revogar, ambos os caminhos param de funcionar imediatamente

## Mudanças

### 1. `prontuario-verify` — retornar dados diretamente
- Após validar `api_key` + `token` + `professional_id`, buscar dados do paciente (perfil, scores, alertas, medições)
- Retornar tudo no response JSON
- Remover geração de `access_code`
- A URL de relatório visual (`report_url`) ainda pode ser retornada como link para embed, mas protegida pela mesma lógica

### 2. `report-access` — simplificar para acesso autenticado
- Aceitar POST com `{ token }` + header Authorization (JWT do profissional Mayla)
- Validar que o profissional logado tem um `partner` vinculado à `prontuario_connection` daquele token
- Retornar dados do relatório
- Manter também o fluxo legado de `report_shares` (48h) para teleconsultas avulsas

### 3. `ProfessionalReport.tsx` — suportar acesso autenticado
- Se não tem `code` na URL, verificar se o usuário está autenticado
- Se autenticado, chamar `report-access` com `{ token }` + JWT
- Se não autenticado e sem code, verificar `report_shares` (legado)

### 4. Painel profissional — listar pacientes vinculados
- Novo componente `LinkedPatients` no painel profissional
- Busca `prontuario_connections` onde `external_system = 'mayla'` e `internal_partner_id = partnerId` e `active = true`
- Mostra nome do paciente + botão "Ver relatório"

### 5. Limpeza
- Tabela `report_access_codes` pode ser mantida mas não será mais usada para favoritos
- `FavoriteDoctors.tsx` — remover "Copiar link" (não faz mais sentido expor URL direta)

## Arquivos afetados
- `supabase/functions/prontuario-verify/index.ts` — retornar dados inline
- `supabase/functions/report-access/index.ts` — aceitar JWT de profissional Mayla
- `src/components/report/ProfessionalReport.tsx` — fluxo autenticado
- `src/components/professional/LinkedPatients.tsx` — novo componente
- `src/pages/ProfessionalDashboard.tsx` — integrar LinkedPatients
- `src/components/mayla/FavoriteDoctors.tsx` — remover "Copiar link", manter apenas revogar
- RLS: nova policy em `prontuario_connections` para profissionais lerem conexões vinculadas

