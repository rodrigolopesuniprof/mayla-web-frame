# Corrigir leaderboard mostrando apenas o usuário logado

## Causa

A view `public.company_leaderboard` foi criada com `WITH (security_invoker = true)`. Isso faz com que a leitura respeite as RLS policies de `public.profiles`, e a única policy de SELECT que se aplica a um colaborador comum é `Users can view their own profile` (`auth.uid() = user_id`). Resultado: a view só devolve a linha do próprio usuário, mesmo havendo outros colaboradores na mesma empresa.

Confirmado pela resposta da API: `company_leaderboard?company_id=eq.0ca13b2a...` retorna apenas `Machado de Assis`.

## Correção (migração única)

Recriar a view sem `security_invoker`, restringindo o resultado ao company do próprio usuário via `get_user_company_id(auth.uid())`. Assim:

- A view bypassa RLS de `profiles` (é dona dos próprios direitos), expondo apenas colunas seguras para ranking: `user_id, company_id, full_name, total_points, month_points, current_level, rank_total, rank_month`.
- Nenhum usuário consegue ler o leaderboard de outra empresa: o `WHERE` interno força `p.company_id = get_user_company_id(auth.uid())`.
- Admin global continua enxergando — `get_user_company_id` retorna o `company_id` do próprio admin; para super-admin sem company a view fica vazia, o que é aceitável (admins usam o painel admin, não a UI mobile).

```sql
DROP VIEW IF EXISTS public.company_leaderboard;

CREATE VIEW public.company_leaderboard AS
SELECT
  p.user_id,
  p.company_id,
  p.full_name,
  p.points AS total_points,
  COALESCE((SELECT SUM(pl.points) FROM public.points_ledger pl
            WHERE pl.user_id = p.user_id
              AND pl.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')), 0) AS month_points,
  ulp.current_level,
  RANK() OVER (PARTITION BY p.company_id ORDER BY p.points DESC) AS rank_total,
  RANK() OVER (PARTITION BY p.company_id ORDER BY COALESCE((
    SELECT SUM(pl.points) FROM public.points_ledger pl
    WHERE pl.user_id = p.user_id
      AND pl.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')), 0) DESC) AS rank_month
FROM public.profiles p
LEFT JOIN public.user_level_progress ulp ON ulp.user_id = p.user_id
WHERE p.company_id IS NOT NULL
  AND p.company_id = public.get_user_company_id(auth.uid());

GRANT SELECT ON public.company_leaderboard TO authenticated;
```

## Privacidade

A view expõe apenas `full_name`, pontos e nível dos colegas da mesma empresa — dados explicitamente públicos no contexto de ranking corporativo. Nenhum dado de saúde, CPF, e-mail ou telefone é exposto.

## Fora de escopo

- Lógica de pontuação, missões, desafios, níveis.
- Componente `LeaderboardScreen.tsx` (queries permanecem idênticas).
- Outras tabelas e policies.
