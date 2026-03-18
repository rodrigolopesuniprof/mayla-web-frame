

# Plano: Criar área para gerar admin de empresa no painel super admin

## Objetivo
Adicionar na seção "Dados da Conta" (`AdminCompanySettings`) um card para criar/gerenciar o administrador da empresa (company_admin), com e-mail e senha visíveis para o super admin compartilhar com o cliente.

## Solução

### 1. Edge function `manage-user` — adicionar action `create_company_admin`
Adicionar uma nova action no `manage-user/index.ts` que:
- Recebe `{ action: "create_company_admin", email, password, company_id, full_name }`
- Cria o usuário via `auth.admin.createUser` com `email_confirm: true`
- Atualiza o profile com `company_id`
- Insere role `company_admin` na `user_roles`
- Retorna `{ success: true, user_id }`

### 2. `AdminCompanySettings.tsx` — novo card "Administrador da Empresa"
Adicionar um card que:
- Ao carregar, busca se já existe um usuário com role `company_admin` vinculado àquela empresa (query profiles + user_roles)
- **Se existe**: mostra o e-mail (via `manage-user` action `list_emails`) e botões para "Resetar senha" e "Remover admin"
- **Se não existe**: mostra formulário com campos e-mail, senha e nome, e botão "Criar admin"
- Ao criar, chama a edge function `manage-user` com action `create_company_admin`
- Ao resetar senha, chama `reset_password` e exibe a senha temporária em um campo copiável

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/manage-user/index.ts` — adicionar action `create_company_admin` |
| Editar | `src/components/admin/AdminCompanySettings.tsx` — adicionar card de gestão do admin da empresa |

