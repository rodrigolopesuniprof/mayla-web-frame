

# Plano: Corrigir usuários não aparecendo após cadastro

## Diagnóstico

A função `import-users` cria o usuário auth e depois faz um `UPDATE` no perfil para definir `company_id`. Porém:

1. O trigger `handle_new_user` usa `ON CONFLICT (user_id) DO NOTHING` — se já existir um perfil (de tentativa anterior), ele não atualiza o `company_id`
2. O `UPDATE` subsequente não verifica se retornou `0 rows affected`
3. Se o perfil não existir ainda (race condition), o UPDATE também falha silenciosamente

## Correção

Alterar a função `import-users` para usar **UPSERT** em vez de UPDATE, garantindo que o perfil sempre seja criado/atualizado com o `company_id` correto.

### Mudança na edge function `supabase/functions/import-users/index.ts`

Substituir o bloco de UPDATE (linhas 107-114) por um **upsert**:

```typescript
await supabaseAdmin
  .from("profiles")
  .upsert(
    {
      user_id: userData.user.id,
      company_id,
      cpf: cpf || null,
      full_name: name || null,
    },
    { onConflict: "user_id" }
  );
```

Isso garante que:
- Se o perfil já existe → atualiza `company_id`, `cpf`, `full_name`
- Se o perfil não existe → cria com todos os campos

Mesma correção no bloco de "usuário já existia" (linhas 92-95): trocar `update` por `upsert`.

## Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/import-users/index.ts` — trocar UPDATE por UPSERT |

