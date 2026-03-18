

# Plano: Corrigir criação de admin de empresa

## Problema identificado
O usuário `contato@uniprof.com.br` (Rodrigo Lopes) existe no auth e tem o role `company_admin`, mas **não tem registro na tabela `profiles`**. O trigger `handle_new_user` falhou silenciosamente ao criar o perfil, e o `UPDATE` subsequente no edge function atualizou 0 linhas sem erro.

## Correções

### 1. Edge function `manage-user/index.ts` -- tornar criação de perfil robusta
Na action `create_company_admin`, após criar o auth user, em vez de apenas `UPDATE`, usar `upsert` ou fazer `INSERT` direto com fallback:
- Aguardar brevemente ou verificar se o perfil existe
- Se não existir, fazer `INSERT` na tabela profiles (em vez de confiar no trigger)
- Garantir que `company_id` e `full_name` são definidos

### 2. Corrigir o perfil órfão atual
Criar o profile manualmente via migration para o usuário `7140c5ab` que já existe sem perfil.

### 3. CompanyAdminManager -- incluir o próprio admin na busca
Atualmente, o `loadAdmin` busca profiles por `company_id` e depois filtra por `company_admin` role. Se o perfil não existe, o admin nunca aparece. A correção no edge function resolve isso para novos admins.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/manage-user/index.ts` -- INSERT profile se não existir após createUser |
| Migration | Criar profile para user `7140c5ab` com company_id correto |

