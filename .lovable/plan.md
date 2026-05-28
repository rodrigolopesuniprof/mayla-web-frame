## Objetivo
Permitir login imediato após cadastro, sem precisar confirmar e-mail.

## Mudanças

1. **Auth global (Lovable Cloud)** — ativar `auto_confirm_email: true` via `configure_auth` (mantendo `disable_signup: true` — cadastro continua só por convite).

2. **`supabase/functions/invite-signup/index.ts`** — alterar `email_confirm: false` → `email_confirm: true` no `admin.createUser`, garantindo que usuários criados pela função de convite já fiquem confirmados.

3. **`src/pages/CompanySignup.tsx`** — trocar a mensagem de sucesso de "Verifique seu e-mail..." para "Conta criada! Faça login para continuar." (sem fluxo de verificação).

## Resultado
Novos cadastros (via link de convite) podem logar imediatamente. O erro "Email not confirmed" não ocorre mais. Quando quiser reativar a verificação no futuro, basta reverter o flag e o `email_confirm`.