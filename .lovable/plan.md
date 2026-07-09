## Diagnóstico

Não há bug no ambiente de testes nem problema de conexão. Verifiquei diretamente no backend:

- Usuário `lbachtschin@uniprof.com.br` existe (id `1d843b6c-...`)
- E-mail confirmado (11/03/2026)
- Senha cadastrada
- Não está banido/bloqueado
- Último login com sucesso: 28/05/2026
- Logs de auth mostram os POSTs recentes em `/token` retornando **400** com `msg: "request completed"` — sem erro de infra

O Supabase Auth só devolve **400 Invalid login credentials** em uma situação: **e-mail + senha não batem**. Não é 500 (backend caiu), não é 429 (rate limit), não é 401 (token/sessão). É credencial errada.

Como a conta existe e já logou antes, o cenário é: **a senha atual não é a que está sendo digitada** (esquecida, trocada por outro admin, ou o usuário está tentando uma senha antiga).

## Ação sugerida (não é mudança de código)

Uma das três opções, você escolhe:

1. **Usuário faz "Esqueceu a senha?"** na própria tela de login → recebe e-mail com link para `/reset-password` (fluxo já existe e funciona).
2. **Você (admin) redefine a senha** pelo painel admin de usuários — se quiser, eu confirmo se essa ação já existe na UI de `AdminUsers` ou preciso expor um botão "Redefinir senha".
3. **Eu reseto agora via migration** (um `UPDATE` em `auth.users` com senha temporária que você me passa) — só faço se você pedir explicitamente, porque envolve tocar em senha de usuário real.

## O que NÃO farei sem sua confirmação

- Não vou alterar código de login / AuthContext (está funcionando — outros usuários logam normalmente).
- Não vou mexer em `auto_confirm_email` nem em políticas de auth.
- Não vou resetar senha sem você dizer qual caminho prefere.

Me diga qual das 3 opções seguir (ou se quer que eu investigue outro usuário específico da UNIPROF antes).