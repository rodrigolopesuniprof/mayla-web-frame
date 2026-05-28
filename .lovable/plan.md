## Problema

O cadastro via link de convite (`/cadastro/:token`) falha com **"Signups not allowed for this instance"**.

Causa: o backend tem cadastro público **desabilitado de propósito** (regra de segurança — só pode entrar quem tem convite). Mas a página hoje chama `supabase.auth.signUp` direto do navegador, e esse caminho está bloqueado para qualquer um, mesmo quem tem token válido.

A troca de domínio feita antes só mudou a URL exibida, não mexeu nessa regra.

## Solução

Criar uma edge function `invite-signup` que roda no servidor com permissão administrativa, valida o token e cria o usuário pela API de admin do Supabase (que ignora a trava de signup público). Assim mantemos cadastro fechado para o público em geral **e** funcionando para quem tem link válido.

### Passos

1. **Nova edge function `supabase/functions/invite-signup/index.ts`** (pública, sem JWT):
   - Recebe `{ token, email, password, full_name, cpf }`.
   - Valida o token via RPC `validate_invite_token` (checa ativo, prazo, limite).
   - Se válido, cria o usuário com `supabase.auth.admin.createUser` usando `SERVICE_ROLE_KEY`, gravando em `user_metadata`: `full_name`, `cpf`, `company_id`. Mantém `email_confirm: false` (usuário precisa confirmar e-mail, como hoje).
   - O trigger `handle_new_user` já existente cria automaticamente o `profiles` com o `company_id`.
   - Chama `register_via_invite_token` para incrementar o contador e marcar `signed_up_via_token`.
   - Chama `apply_dicebear_avatar` para gerar avatar + creditar 50 pts.
   - Se `register_via_invite_token` falhar (limite atingido em corrida, por ex.), faz `auth.admin.deleteUser` para não deixar conta órfã.
   - Retorna `{ ok, user_id }` ou `{ ok: false, reason }` com mensagens conhecidas: `not_found`, `inactive`, `expired`, `limit_reached`, `email_in_use`, `weak_password`, `invalid_email`.

2. **Registrar no `supabase/config.toml`** com `verify_jwt = false` (já está, mas confirmar).

3. **Ajustar `src/pages/CompanySignup.tsx`**:
   - Trocar a chamada `supabase.auth.signUp(...)` por `supabase.functions.invoke("invite-signup", { body: {...} })`.
   - Remover a etapa cliente de `register_via_invite_token` e `apply_dicebear_avatar` (passam para dentro da function, evitando race conditions).
   - Traduzir os códigos de erro retornados pela function em mensagens em português via toast.

4. **Não mexer** em: configuração global de auth (signup público continua desligado), `.env`, schema do banco, ou no domínio do link já ajustado.

### Resultado esperado

- Link `https://saude.saudecomvc.com.br/cadastro/<token>` válido → cadastro funciona, e-mail de confirmação é enviado, contador do token incrementa, perfil criado com `company_id` correto, avatar e +50 pts.
- Sem token / token expirado / limite / desativado → mensagem clara em português, sem criar usuário.
- Tentativa de cadastro fora do convite → continua bloqueada.
