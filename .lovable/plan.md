

# Plano: Conectar Mayla ao Gemini (API direta) + Admin de Prompt + Testes

## Passo 1 — Secret da API key
Pedir `GEMINI_API_KEY` (Google AI Studio) ao usuário via `add_secret`. Sem ela a função não funciona, então é o primeiro passo bloqueante.

**Como obter** (incluído na mensagem do `add_secret`):
1. Acesse https://aistudio.google.com/apikey
2. "Create API key" → copie o valor
3. Cole no campo solicitado

## Passo 2 — Tabela `assistant_prompts` (admin do prompt)
Migração nova:
- `id` uuid PK, `name` text único (ex: `"mayla_default"`), `system_prompt` text, `model` text default `'gemini-2.0-flash'`, `temperature` numeric default 0.7, `is_active` bool, `created_at`, `updated_at`, `created_by` uuid
- RLS: SELECT autenticado para o registro ativo; INSERT/UPDATE só admin global (`has_role(auth.uid(),'admin')`)
- Seed: 1 registro `"mayla_default"` com o prompt atual da edge function (Mayla enfermeira + regras de segurança)

## Passo 3 — Refatorar edge function `health-assistant-chat`
- Trocar gateway Lovable AI por **API direta Google AI**: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`
- Modelo configurável (lê do banco, default `gemini-2.0-flash`)
- Buscar `system_prompt` ativo da tabela `assistant_prompts` no início de cada request
- Adaptar payload Gemini (estrutura `contents` com `role: user/model` + `systemInstruction`) — diferente do formato OpenAI
- Adaptar parser SSE: chunks Gemini vêm como `{"candidates":[{"content":{"parts":[{"text":"..."}]}}]}`
- Re-emitir para o cliente em formato OpenAI-like (`data: {"choices":[{"delta":{"content":"..."}}]}`) para não quebrar o frontend
- **Corrigir bug runtime**: `userClient.auth.getClaims is not a function` — substituir por `userClient.auth.getUser(token)` (o SDK 2.45 não tem `getClaims`)
- Manter: anonimização de contexto, persistência de mensagens, detecção de safety flags, conversation tracking

## Passo 4 — Tela admin `AdminAssistantPrompt`
Nova aba dentro de `AdminAssistantInsights` (ou seção colapsável):
- Editor de texto grande para `system_prompt`
- Select de modelo (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`)
- Slider de temperature (0–1)
- Botão "Salvar e ativar"
- Histórico das últimas 5 versões (read-only) para reverter
- Acesso restrito a admins globais

## Passo 5 — Testes (suite Deno)
Novo arquivo `supabase/functions/health-assistant-chat/index.test.ts` com:
1. **Auth**: 401 sem header / com token inválido
2. **Validação**: 400 com `messages` vazio
3. **Anonimização**: contexto enviado ao Gemini não contém `full_name`, `cpf`, `email`
4. **Safety flags**: detecta tentativa de prescrição na resposta
5. **Persistência**: cria conversation + message + atualiza counters
6. **Streaming**: response tem `Content-Type: text/event-stream` e emite chunks parseáveis

Mocks de fetch para simular resposta do Gemini sem gastar API real.

## Passo 6 — Validação manual + painel
- Após deploy, abrir o chat na preview, mandar "explique meu score"
- Verificar resposta em streaming
- Checar tabelas `assistant_conversations`, `assistant_messages`, `assistant_safety_flags` via `read_query`
- Confirmar feedback 👍/👎 no `AdminAssistantInsights`

---

## Arquivos afetados

**Novos**
- `supabase/migrations/<timestamp>_assistant_prompts.sql`
- `supabase/functions/health-assistant-chat/index.test.ts`
- `src/components/admin/AdminAssistantPrompt.tsx`

**Modificados**
- `supabase/functions/health-assistant-chat/index.ts` — Gemini direto + load prompt do DB + fix `getClaims`
- `src/components/admin/AdminAssistantInsights.tsx` — embutir editor de prompt
- `src/pages/Admin.tsx` — registrar a aba (caso ainda não esteja)

## Decisões técnicas
- **Modelo default**: `gemini-2.0-flash` (escolha do usuário)
- **Streaming**: SSE nativo do Gemini (`?alt=sse`), reformatado para o frontend não precisar mudar
- **Privacidade mantida**: zero PII enviado ao Google (igual ao gateway anterior)
- **Custo**: passa a ser cobrado direto na conta Google AI Studio do usuário (não consome créditos Lovable)

