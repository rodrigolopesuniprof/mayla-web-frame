

# Plano: Reestruturar Gestão de Usuários com Link de Cadastro por Empresa

## Problema Atual
- No signup (`Login.tsx`), o usuário precisa selecionar manualmente a empresa em um dropdown — inviável com milhares de empresas
- No admin, os usuários são listados em uma tabela global sem hierarquia empresa → usuários
- A empresa não consegue gerenciar seus próprios usuários no CompanyDashboard

## Solução

### 1. Tabela `company_invite_tokens` (nova migração)
- `id uuid`, `company_id uuid NOT NULL`, `token text UNIQUE NOT NULL`, `created_at`, `expires_at nullable`, `created_by uuid`
- RLS: admin pode CRUD; company_admin pode ver os seus
- Ao criar empresa no admin, gerar automaticamente um token UUID

### 2. Rota `/cadastro/:token` (novo)
- Nova rota em `App.tsx` → novo componente `CompanySignup.tsx`
- Ao abrir, busca `company_invite_tokens` pelo token → carrega empresa
- Exibe tela de cadastro com logo e nome da empresa já preenchidos (sem dropdown)
- No `signUp()`, passa `company_id` no `user_metadata` automaticamente
- Se token inválido/expirado, mostra erro

### 3. Admin: Link de convite na listagem de empresas
- Em `AdminCompanies.tsx`, ao criar empresa → gerar token automaticamente
- Botão "🔗 Link cadastro" em cada empresa → copia `{origin}/cadastro/{token}`
- Botão para regenerar token se necessário

### 4. Admin: Empresas → Usuários (drill-down)
- Em `AdminCompanies.tsx`, adicionar botão "👥 Usuários" em cada empresa
- Ao clicar, abre modal/sub-view com lista de perfis filtrados por `company_id`
- Nessa sub-view: editar, excluir, resetar senha (reutilizando lógica do `AdminUsers`)
- O `AdminUsers` global continua existindo para busca transversal

### 5. CompanyDashboard: Aba "Usuários" para gestão pela empresa
- Adicionar nova aba "Usuários" no `CompanyDashboard.tsx`
- Listar perfis com `company_id = company.id`
- Permitir: adicionar (via import-users), editar nome/cpf/email, excluir, resetar senha
- **Não** permitir editar dados da empresa (slug, cores, logo, etc.)
- Usar as mesmas edge functions `manage-user` e `import-users`

### 6. Simplificar `Login.tsx`
- Remover dropdown de empresa do formulário de signup genérico
- Manter signup genérico apenas com email/senha/nome/cpf (sem empresa)
- A vinculação à empresa é feita exclusivamente via link `/cadastro/:token`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | `company_invite_tokens` + RLS + trigger gerar token ao criar empresa |
| Criar | `src/pages/CompanySignup.tsx` |
| Editar | `src/App.tsx` — nova rota `/cadastro/:token` |
| Editar | `src/pages/Login.tsx` — remover dropdown empresa do signup |
| Editar | `src/components/admin/AdminCompanies.tsx` — botão link cadastro + drill-down usuários |
| Editar | `src/pages/CompanyDashboard.tsx` — aba Usuários com CRUD |

