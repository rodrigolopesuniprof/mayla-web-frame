## Problema
Ao concluir a autoavaliação, o trigger chama `award_event(...)` mas há duas funções com o mesmo nome no banco:
- `award_event(uuid, text, uuid, text, uuid)` — versão antiga (5 args)
- `award_event(uuid, text, uuid, text, uuid, integer)` — versão nova com `_override_points`

Postgres não consegue resolver qual usar → `function public.award_event(...) is not unique`.

## Correção
Migration única:

```sql
DROP FUNCTION IF EXISTS public.award_event(uuid, text, uuid, text, uuid);
```

A versão de 6 args permanece e cobre ambos os casos (último argumento é opcional com default NULL).

Nenhuma mudança em código frontend.