

## Plano: Corrigir visibilidade de dados no app do usuário

### Diagnóstico

Após investigar o banco de dados e o código, identifiquei as causas raiz:

1. **Programs/Campanhas/Times não aparecem**: As políticas RLS usam a função `get_user_company_id(auth.uid())` para filtrar dados. Se o perfil do usuário logado não tem `company_id` preenchido (mas o CompanyContext consegue carregar via `user_metadata`), o RLS retorna NULL e bloqueia todos os dados.

2. **Time "Geral" inexistente**: A trigger `create_default_team` foi criada após a empresa Uniprof, então o time padrão "Geral" nunca foi gerado. Só existe o "Time Energia" criado manualmente.

3. **Logomarca**: A empresa Uniprof não tem `logo_url` cadastrado (está NULL no banco). Precisa ser carregado via admin.

### Correções

**1. CompanyContext — sincronizar company_id no perfil (raiz do problema)**

Quando o CompanyContext encontra o company_id via `user_metadata` mas o perfil não tem, atualizar o perfil automaticamente. Isso garante que `get_user_company_id()` funcione no RLS.

```typescript
// CompanyContext.tsx — após carregar companyId e companyData
if (companyId && profile && !profile.company_id) {
  await supabase.from("profiles").update({ company_id: companyId }).eq("user_id", user.id);
}
```

**2. Inserir time "Geral" para Uniprof (migration de dados)**

Usar o insert tool para criar o time padrão:
```sql
INSERT INTO collaborative_teams (company_id, name, emoji, created_by, is_default)
VALUES ('cadab8a8-7507-4351-8b3f-08861ea33f5c', 'Geral', '🌟', 'cadab8a8-7507-4351-8b3f-08861ea33f5c', true);
```

**3. Atualizar `get_user_company_id` para ser mais robusto (migration)**

Adicionar fallback para verificar `user_metadata` caso o perfil não tenha company_id:
```sql
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1),
    (SELECT municipality_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  );
$$;
```

Isso garante que usuários que só têm `municipality_id` (legado B2G) também tenham seus dados visíveis.

**4. Exibir logomarca e nome da empresa no TopBar do HomeTab**

O TopBar do HomeTab usa `BrandBadge` (ícone genérico Mayla). Substituir pela logomarca da empresa quando disponível, usando dados do CompanyContext.

### Arquivos modificados
- `src/contexts/CompanyContext.tsx` — sync company_id para perfil
- `src/components/mayla/HomeTab.tsx` — mostrar logo/nome da empresa no header
- Migration SQL — atualizar `get_user_company_id` com fallback
- Insert SQL — criar time "Geral" para Uniprof

