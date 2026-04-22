

# Correção: Modelo Gemini 2.0 Flash via API correta

## Diagnóstico
A imagem do Google AI Studio confirma que **`gemini-2.0-flash` existe e está disponível** na sua conta. O erro 404 anterior foi causado pelo **endpoint errado**, não pelo modelo.

A edge function provavelmente está chamando `v1beta` quando o `gemini-2.0-flash` exige o endpoint **`v1`** (ou vice-versa), ou usando um path de modelo incorreto (ex: `models/gemini-2.0-flash` vs `gemini-2.0-flash`).

## O que muda

### 1. `supabase/functions/health-assistant-chat/index.ts`
- Manter `gemini-2.0-flash` como modelo (conforme sua escolha original).
- Corrigir URL do endpoint para o formato exato que o AI Studio expõe:
  ```
  https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}
  ```
- Adicionar **fallback em cascata** quando der 404: tenta na ordem `gemini-2.0-flash` → `gemini-2.5-flash` → `gemini-flash-latest`. Garante que nunca quebre por modelo indisponível.
- Logar no console qual modelo respondeu, para diagnóstico futuro.

### 2. `src/components/admin/AdminAssistantPrompt.tsx`
- Manter `gemini-2.0-flash` como opção e default.
- Adicionar `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-flash-latest` como alternativas.
- Texto explicativo: "Se o modelo escolhido falhar com 404, o sistema tenta automaticamente o próximo disponível."

### 3. Migração SQL (caso o registro tenha sido alterado)
Garantir que `assistant_prompts` ativo está com `gemini-2.0-flash`:
```sql
UPDATE public.assistant_prompts
   SET model = 'gemini-2.0-flash'
 WHERE name = 'mayla_default' AND is_active = true;
```

## Validação
1. Após deploy: enviar "oi" no chat → resposta em streaming.
2. Conferir log da edge function: linha `[health-assistant] using model: gemini-2.0-flash` (sem 404).
3. Se ainda houver 404, o log mostrará automaticamente qual modelo de fallback foi usado.

## Arquivos afetados
- **Modificado**: `supabase/functions/health-assistant-chat/index.ts` — URL correta + fallback em cascata + log de modelo
- **Modificado**: `src/components/admin/AdminAssistantPrompt.tsx` — restaurar `gemini-2.0-flash` como default
- **Novo**: migração SQL para garantir modelo ativo

