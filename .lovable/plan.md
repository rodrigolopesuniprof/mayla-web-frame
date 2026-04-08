

# Fix: `getClaims is not a function` no prontuario-proxy

## Problema

Os logs da Edge Function mostram:
```
TypeError: userClient.auth.getClaims is not a function
```

O método `getClaims()` não existe no supabase-js v2. A função nunca chega ao `test_connection` — falha antes, na validação do usuário.

## Solução

Substituir `getClaims(token)` por `getUser(token)` no `prontuario-proxy/index.ts`.

### `supabase/functions/prontuario-proxy/index.ts`

Trocar linhas 25-30:
```typescript
// ANTES (não funciona)
const token = authHeader.replace("Bearer ", "");
const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
const userId = claimsData.claims.sub as string;

// DEPOIS
const { data: { user }, error: userError } = await userClient.auth.getUser();
if (userError || !user) { ... }
const userId = user.id;
```

Nenhuma configuração da Meddit é necessária — o erro é interno, a requisição nem chega à API deles.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/prontuario-proxy/index.ts` (fix auth) |

