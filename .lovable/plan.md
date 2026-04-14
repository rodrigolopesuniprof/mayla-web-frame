

# Plano: Compartilhamento seguro do relatório com médicos Meddit

## Contexto atual

O sistema já tem:
- `prontuario_connections` com `report_token` (UUID permanente por vínculo)
- `prontuario-verify` edge function que valida token + `professional_id` via API key
- Favoritar médico Mayla funciona (PartnerDetail, ConsultationFlow)
- Favoritar médico Meddit funciona via `prontuario-proxy?action=favorite`
- ProfessionalReport carrega dados via `report_token`

## Problemas identificados

1. **Após agendar com médico Meddit, não há prompt para compartilhar/favoritar** — o fluxo termina na tela "done" sem oferecer isso
2. **O ProfessionalReport não valida qual médico está acessando** — qualquer pessoa com o token UUID consegue ver o relatório. Não há vinculação `professional_id ↔ token`
3. **A edge function `prontuario-verify` já valida `professional_id`**, mas o frontend (`ProfessionalReport.tsx`) não usa essa validação — ele consulta diretamente o banco

## Solução

### 1. Prompt de compartilhamento pós-agendamento Meddit
**Arquivo**: `src/components/mayla/ConsultationFlow.tsx`

Na tela "done", quando o médico é `source === "meddit"` e ainda não está favoritado:
- Mostrar card perguntando: "Deseja compartilhar seus dados de saúde com Dr. X?"
- Botão "Compartilhar relatório" chama `prontuario-proxy?action=favorite` com os dados do médico Meddit (`meddit_id`, nome, clínica)
- Após sucesso, mostrar confirmação com o link gerado

### 2. Segurança: validar `professional_id` no acesso ao relatório
**Arquivo**: `src/components/report/ProfessionalReport.tsx`

Quando o relatório é carregado via `prontuario_connections` (token permanente):
- Exigir query param `?pid=<external_professional_id>` na URL
- Comparar o `pid` com o `external_professional_id` da connection
- Se não bater, mostrar "Acesso não autorizado"
- Isso garante que o link só funciona para o médico correto — mesmo que alguém intercepte o token, precisa do `pid` correto

**Arquivo**: `supabase/functions/prontuario-verify/index.ts`
- Incluir o `pid` na URL do `report_url` retornado: `/relatorio/medico/{token}?pid={professional_id}`

### 3. Ajustar a edge function para retornar report_token no favorite
**Arquivo**: `supabase/functions/prontuario-proxy/index.ts`

O upsert de Meddit favorite já retorna a connection, mas precisa garantir que `report_token` é gerado (via default do banco ou código). Verificar se o `report_token` tem default UUID na tabela — se não, gerar no código antes do upsert.

## Fluxo completo

```text
Usuário agenda com Dr. Meddit
        ↓
Tela "Done" mostra card "Compartilhar dados de saúde?"
        ↓
Usuário clica → prontuario-proxy?action=favorite
        ↓
prontuario_connections criada com report_token UUID
        ↓
Meddit chama prontuario-verify?token=X&professional_id=Y
        ↓
Retorna report_url: /relatorio/medico/{token}?pid={prof_id}
        ↓
ProfessionalReport valida pid === connection.external_professional_id
        ↓
Relatório carrega ✅ (outro médico → erro 🚫)
```

## Arquivos afetados
- `src/components/mayla/ConsultationFlow.tsx` — card de compartilhamento na tela "done"
- `src/components/report/ProfessionalReport.tsx` — validação de `pid` query param
- `supabase/functions/prontuario-verify/index.ts` — incluir `pid` na URL retornada
- `supabase/functions/prontuario-proxy/index.ts` — garantir `report_token` gerado no favorite Meddit

