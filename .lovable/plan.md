## Objetivo
Reimplantar as Edge Functions `external-auth` e `mcp` com o código atual da branch main, sem alterar código.

## Passos
1. Rodar `supabase--deploy_edge_functions` com `function_names: ["external-auth", "mcp"]`.
2. Verificar sucesso do deploy nos retornos das tools.
3. (Opcional) Fazer um smoke test com `supabase--curl_edge_functions` em `mcp` (ex.: `/.well-known/oauth-protected-resource`) para confirmar que está no ar.

## Observações
- Nenhuma edição de arquivo será feita.
- `supabase/config.toml` já mantém `verify_jwt = false` para ambas as funções — nada a ajustar.
