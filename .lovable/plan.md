

# Plano: Reparar 9 perfis órfãos e corrigir trigger

## Problema
O trigger `handle_new_user` está falhando silenciosamente para todos os cadastros recentes. **9 usuários** existem no Auth mas não têm registro em `profiles`, impedindo o uso do app. Todos pertencem à Uniprof (`cadab8a8`).

## Correções

### 1. Migration — Inserir os 9 perfis ausentes
Um único `INSERT INTO profiles` com os dados do metadata de cada usuário (user_id, full_name, cpf, company_id). O `joao@uniprof.com.br` não tem `company_id` no metadata — vincular manualmente à Uniprof.

### 2. Migration — Recriar o trigger com tratamento de erro
Alterar `handle_new_user()` para:
- Usar `INSERT ... ON CONFLICT (user_id) DO NOTHING` para evitar falhas em duplicatas
- Envolver em bloco `BEGIN ... EXCEPTION WHEN others THEN RETURN NEW` para nunca bloquear a criação do usuário no Auth, mesmo que o insert falhe

### 3. Fallback no CompanyContext (segurança extra)
Adicionar lógica no `CompanyContext` para criar o profile via `upsert` caso detecte que o usuário tem `company_id` no metadata mas não tem profile. Isso funciona como rede de segurança caso o trigger falhe novamente.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migration | Inserir 9 profiles + recriar trigger resiliente |
| Editar | `src/contexts/CompanyContext.tsx` — fallback upsert |

