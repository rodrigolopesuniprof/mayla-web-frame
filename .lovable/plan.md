# Correção: 403 ao invocar SDK do Shen

## Causa raiz

A edge function `shenai-config` está bloqueando o acesso com **403 `shenai_not_enabled_for_company`** porque ainda consulta a feature key antiga:

```ts
.eq("feature_key", "binah_special_measurement")
...
if (!feature?.enabled || cfg.provider !== "shenai") { 403 }
```

Mas na refatoração whitelabel migramos para três keys independentes:
- `vitals_basic_rppg`
- `vitals_premium_binah`
- `vitals_premium_shenai`

Como a key `binah_special_measurement` não existe mais (ou não tem `provider=shenai`), a função sempre nega — a câmera nem chega a abrir.

## Mudança

Editar `supabase/functions/shenai-config/index.ts` para checar a nova key:

```ts
const { data: feature } = await admin
  .from("company_features")
  .select("enabled, config")
  .eq("company_id", companyId)
  .eq("feature_key", "vitals_premium_shenai")
  .maybeSingle();

if (!feature?.enabled) {
  return 403 "shenai_not_enabled_for_company";
}
```

Remover a checagem `cfg.provider !== "shenai"` (não faz mais sentido — a key já é específica do provider).

Manter resto da função idêntico (auth, retorno de `api_key`, CORS).

## Validação

1. Após deploy, abrir "Análise Avançada de Saúde" → request a `/shenai-config` deve retornar `200` com `{ ok: true, api_key, user_id }`.
2. SDK inicializa e câmera abre.

## Fora de escopo

- Não alterar lógica do client (`BinahCapture`, `useVitalsMeasurement`) — o problema é só no gate da edge function.
- Não tocar em `SHENAI_API_KEY` (segredo já configurado).
