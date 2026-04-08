

# Fix: "Testar conexão" do Prontuário Conveniado

## Problema

O botão "Testar conexão" faz `fetch()` direto do browser para `http://meddit-api-clinic-nv...`. Isso falha por dois motivos:
1. **CORS** — a API da Meddit não retorna headers `Access-Control-Allow-Origin`
2. **Mixed content** — o app roda em HTTPS e a URL da Meddit é HTTP

## Solução

Rotear o teste pela Edge Function `prontuario-proxy` que já existe, adicionando uma action `test_connection`.

### 1. `supabase/functions/prontuario-proxy/index.ts`

Adicionar case `"test_connection"` no switch que faz GET em `/v1/clinics/specialities` usando as credenciais do `config` da empresa e retorna `{ ok: true }` ou erro.

### 2. `src/components/admin/AdminIntegrations.tsx`

Substituir o `fetch()` direto por `supabase.functions.invoke("prontuario-proxy", ...)` com `action=test_connection`. Como o admin pode estar testando credenciais ainda não salvas, primeiro salvar as configs e depois testar, ou enviar as credenciais no body do teste.

**Abordagem escolhida**: salvar primeiro (chamar `handleProntuarioSave`), depois invocar a edge function com `?action=test_connection`. A edge function já lê as credenciais do `company_features.config`.

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/prontuario-proxy/index.ts` (add case test_connection) |
| Editar | `src/components/admin/AdminIntegrations.tsx` (usar edge function em vez de fetch direto) |

