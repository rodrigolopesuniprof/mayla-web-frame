## Problema

No ranking, só aparece o próprio usuário (ex.: "José") em vez de todos os colegas da empresa.

## Causa

A view `public.company_leaderboard` está configurada com `security_invoker=true`. Com isso, ela respeita a RLS da tabela `profiles`. As políticas atuais de SELECT em `profiles` permitem que um colaborador comum veja **apenas o próprio perfil** — então a view devolve só 1 linha, mesmo quando a empresa tem vários funcionários com pontos.

## Correção

Mudar a view para **`security_invoker=false`** (modo definer). Justificativa de segurança:

- A view **já filtra por empresa** com `p.company_id = get_user_company_id(auth.uid())`, então cada usuário só vê pessoas da mesma empresa.
- A view **só expõe campos seguros**: `user_id`, `company_id`, `full_name`, `avatar_url`, `avatar_type`, `total_points`, `week_points`, `month_points`, `year_points`, `current_level` e os ranks. **Nenhum dado sensível** (CPF, telefone, data de nascimento, dados de saúde) é exposto.
- A regra de privacidade do projeto (RH só vê dados de saúde agregados em `company_health_summary`) continua intacta — esta view nunca expôs saúde.

## Migration

Migration única alterando apenas a opção da view existente, sem recriá-la nem alterar tabelas:

```sql
ALTER VIEW public.company_leaderboard SET (security_invoker = false);
```

Garantir também que `authenticated` tenha `SELECT` na view (já deve ter, mas reforçamos por segurança):

```sql
GRANT SELECT ON public.company_leaderboard TO authenticated;
```

## O que NÃO muda

- Nenhuma política RLS em `profiles` é alterada — CPF, telefone, etc. continuam protegidos.
- Nenhuma outra view, tabela, função, edge function ou componente React é tocado.
- `LeaderboardScreen.tsx`, `useLeaderboard.ts` e demais consumidores continuam idênticos — apenas passam a receber mais linhas (os colegas).

## Verificação após aplicar

Rodar `SELECT count(*) FROM company_leaderboard;` autenticado como o José deve devolver 7 (em vez de 1), e a tela de Ranking deve listar todos os colegas com pontos > 0 no pódio e no restante.
