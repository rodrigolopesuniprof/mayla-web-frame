## Problema

O Ranking e a aba Membros mostram todos como "Colaborador" sem avatar. Não é anonimização proposital — o front já extrai o primeiro nome de `full_name` e usa `avatar_url`. O que falta é dado: a RLS de `public.profiles` só libera o próprio perfil do usuário logado, então a query de perfis dos outros membros da liga volta vazia.

## Solução

Expor **apenas** os campos públicos mínimos (primeiro nome + avatar) via uma RPC `security definer`, restrita a membros da mesma liga. Sem afrouxar a RLS de `profiles`, sem expor PII (email, CPF, telefone, etc.).

### 1. Migration — nova RPC

```sql
CREATE OR REPLACE FUNCTION public.get_league_members_public(p_league_id uuid)
RETURNS TABLE(user_id uuid, first_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id,
    CASE
      WHEN p.full_name IS NULL OR length(trim(p.full_name)) = 0 THEN 'Colaborador'
      ELSE split_part(trim(p.full_name), ' ', 1)
    END AS first_name,
    p.avatar_url
  FROM public.league_members lm
  JOIN public.profiles p ON p.user_id = lm.user_id
  WHERE lm.league_id = p_league_id
    AND public.is_league_member(p_league_id, auth.uid());  -- caller precisa estar na liga
$$;

GRANT EXECUTE ON FUNCTION public.get_league_members_public(uuid) TO authenticated;
```

Retorna **apenas** `user_id`, `first_name` e `avatar_url`. Chamável só por quem é membro da liga (usa a função `is_league_member` já existente).

### 2. Frontend — `src/components/mayla/leagues/useLeagueFeed.ts`

Nos dois ramos (liga default e liga real), trocar:

```ts
supabase.from("profiles").select("user_id, full_name, avatar_url")…
```

por:

```ts
supabase.rpc("get_league_members_public", { p_league_id: leagueId })
```

e ajustar o `nameMap` para usar `first_name` em vez de `full_name`. O tipo local `Member.full_name` vira `first_name` (ou mantém `full_name` recebendo `first_name` para minimizar diff nos consumidores — o front já roda `firstName()` em cima, então é seguro).

Sem outras mudanças de UI: `LeagueDetailPanel` continua renderizando avatar quando existir e o primeiro nome no lugar de "Colaborador".

## Escopo fora

- Não mexer na RLS de `profiles`.
- Não expor outros campos além de nome + avatar.
- `LeagueManagePanel` (visível só para dono/coadmin) continua usando a query atual, que já funciona por serem admins com policy própria.

## Validação

Após a migration:
1. Recarregar a aba Membros de uma liga com vários usuários — nomes e avatares aparecem.
2. Ranking mostra primeiro nome + avatar.
3. Confirmar via `read_query` que a RPC não retorna linhas quando chamada por não-membro (retorna vazio).
