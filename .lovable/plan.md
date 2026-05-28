## Diagnóstico

O usuário tem **5050 pts** acumulados (e outro tem 500 pts), mas continua como "Iniciante" porque a linha em `user_level_progress` nunca foi criada — o `current_level` está `NULL`.

Motivo: os pontos desses usuários vieram de um lançamento com `source = 'backfill'` (provavelmente um INSERT/UPDATE direto ou via importação), e não pela função `add_points_to_profile`, que é a única que chama `check_user_level`. Ou seja: hoje a promoção de nível só roda quando o código aplicativo se lembra de chamar `add_points_to_profile`. Qualquer outra forma de incrementar `profiles.points` (RPCs específicas, scripts, backfills, ajustes manuais) deixa o nível dessincronizado.

A função `check_user_level` em si está correta — ela cria a linha em `user_level_progress`, percorre todos os níveis atingidos, paga o bônus e atualiza `profiles.level`. O problema é só o gatilho.

## Solução

1. **Trigger automática em `profiles`** — sempre que `points` for alterado (por qualquer caminho: RPC, backfill, ajuste manual, importação), executar `check_user_level(NEW.user_id)`. Assim a promoção fica garantida, independente de quem mexeu nos pontos.

2. **Backfill imediato** — rodar `check_user_level` para todos os usuários que já têm pontos suficientes para subir de nível mas ainda estão no nível 1 (ou sem linha em `user_level_progress`). Isso resolve o caso do usuário Rodrigo (500 pts → Engajado) e do outro com 5050 pts (que deve pular vários níveis e receber os bônus acumulados).

3. **Notificação visual** — como `user_level_progress` já está no Realtime e o `LevelUpNotifier` já está montado, assim que o backfill rodar o usuário verá o modal de "subiu de nível" automaticamente na próxima sessão / reload.

## Detalhes técnicos

Migração única:

```sql
-- 1) Trigger de sincronização
CREATE OR REPLACE FUNCTION public.trg_sync_user_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.points IS DISTINCT FROM OLD.points THEN
    PERFORM public.check_user_level(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_sync_level
AFTER INSERT OR UPDATE OF points ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_user_level();

-- 2) Backfill: roda para todo mundo que tem pontos
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles WHERE points > 0 LOOP
    PERFORM public.check_user_level(r.user_id);
  END LOOP;
END $$;
```

Observações:
- A trigger é idempotente: `check_user_level` só promove se `min_points <= points` e `level_number > current_level`, então atualizações que não cruzam threshold são no-op.
- O bônus de nível é creditado via `UPDATE profiles SET points = points + bonus`, o que dispara a trigger de novo — porém na segunda chamada não há novo nível a alcançar, então não há loop.
- Nenhuma mudança em UI ou no front-end é necessária. O `LevelUpNotifier` já escuta `user_level_progress` em tempo real e exibirá o modal celebrativo automaticamente.

## Arquivo

- nova migração SQL em `supabase/migrations/`
