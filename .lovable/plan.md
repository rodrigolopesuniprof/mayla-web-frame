

# Plano: Auto-vincular usuários órfãos à empresa MAYLA

## Problema
Usuários sem `company_id` no perfil e sem `company_id` no metadata ficam "soltos", sem aparecer em nenhuma empresa.

## Solução
No `CompanyContext.tsx`, após determinar que `companyId` é `null`, buscar a empresa MAYLA pelo slug e vincular automaticamente o perfil do usuário.

### Mudança em `src/contexts/CompanyContext.tsx`

Após a linha `const isFallback = !companyId;` (linha 71), inserir:

```typescript
// Auto-vincular usuários sem empresa à MAYLA
if (!companyId) {
  const { data: maylaCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "mayla")
    .maybeSingle();

  if (maylaCompany) {
    await supabase.from("profiles")
      .upsert({ user_id: user.id, company_id: maylaCompany.id }, { onConflict: "user_id" });
    companyId = maylaCompany.id;
  }
}
```

Isso faz `companyId` deixar de ser `const` — precisa virar `let`.

### Mudança em `src/pages/Login.tsx`

Remover o modo `signup`: eliminar o botão "Cadastre-se", os campos de nome/CPF, e a função `handleSignup`. Manter apenas login + recuperar senha.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/contexts/CompanyContext.tsx` — auto-vincular órfãos à MAYLA |
| Editar | `src/pages/Login.tsx` — remover modo signup |

