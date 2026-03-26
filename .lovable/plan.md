

# Plano: Corrigir "Token não encontrado" para empresas novas

## Diagnóstico

A empresa MEDDIT não possui token na tabela `company_invite_tokens`. O trigger `auto_create_invite_token` que gera tokens automaticamente ao criar empresas existe, mas pode ter falhado ou a empresa foi criada antes do trigger.

O botão "Regenerar link" já resolve o problema manualmente, mas o fluxo deveria ser mais robusto: se não existe token, o botão "Copiar link de cadastro" deveria **criar um automaticamente** em vez de apenas mostrar um erro.

## Correção

Alterar `copyInviteLink` no `AdminCompanySettings.tsx` para, quando `token` for `null`, criar o token automaticamente antes de copiar o link — em vez de simplesmente exibir o erro.

### Mudança no `AdminCompanySettings.tsx`

```typescript
const copyInviteLink = async () => {
  let currentToken = token;
  if (!currentToken) {
    // Auto-criar token se não existir
    const { data, error } = await supabase
      .from("company_invite_tokens")
      .insert({ company_id: company.id })
      .select("token")
      .single();
    if (error || !data) {
      toast({ title: "Erro ao gerar token", variant: "destructive" });
      return;
    }
    currentToken = data.token;
    onCompanyUpdated(); // recarregar dados
  }
  const url = `${PUBLISHED_DOMAIN}/cadastro/${currentToken}`;
  navigator.clipboard.writeText(url);
  toast({ title: "Link de cadastro copiado!", description: url });
};
```

## Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/admin/AdminCompanySettings.tsx` — auto-criar token no copyInviteLink |

