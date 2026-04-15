

# Plano: Proteger relatório médico com acesso exclusivo via POST + validação server-side

## Problema

O link `/relatorio/medico/{token}?pid=X` é acessível via GET no navegador — qualquer pessoa com o link vê o relatório. O `pid` na query string é apenas cosmético, sem validação real server-side.

## Solução

Criar uma arquitetura onde o relatório **não carrega dados diretamente do banco no frontend**. Em vez disso:

1. **Nova edge function `report-access`** — aceita apenas POST com `{ token, pid }`, valida no banco se o par corresponde, e retorna os dados do relatório (perfil, scores, medições, alertas). Sem POST válido = sem dados.

2. **Frontend `/relatorio/medico/:token`** — a rota continua existindo (necessária para o Meddit renderizar em iframe/webview), mas:
   - Remove o `pid` da query string
   - Não faz queries diretas ao Supabase
   - Exige que o Meddit envie um POST (via `postMessage` ou form submit) com o `pid` para inicializar
   - Alternativamente, o Meddit chama `prontuario-verify` → recebe um **access_code temporário** (válido 5 min) → abre a URL com esse code → frontend valida o code na edge function

3. **Fluxo recomendado (access_code temporário)**:

```text
Meddit → POST prontuario-verify (token + professional_id + api_key)
       ← { authorized: true, access_code: "abc123", report_url: "/relatorio/medico/{token}?code=abc123" }

Meddit abre report_url no iframe/webview

Frontend → POST report-access (token + access_code)
         ← { profile, scores, measurements, alerts }
         (access_code é single-use, expira em 5 min)
```

## Mudanças

### 1. Tabela `report_access_codes` (migração)
- `id` UUID PK
- `report_token` text (referência ao prontuario_connections)
- `access_code` UUID unique
- `professional_id` text
- `created_at` timestamp (default now)
- `used` boolean (default false)
- RLS: sem acesso público (apenas service_role)

### 2. Edge function `prontuario-verify` — gerar access_code
- Após validar token + professional_id + api_key, gerar um `access_code` UUID
- Inserir na tabela `report_access_codes`
- Retornar `access_code` na resposta + URL com `?code=`
- Não retornar mais o `pid` na URL

### 3. Nova edge function `report-access`
- Aceita apenas POST
- Body: `{ token, access_code }`
- Valida: access_code existe, não foi usado, criado há menos de 5 min, token bate
- Marca como `used = true`
- Retorna todos os dados do relatório (perfil, scores, medições, alertas, histórico)
- Sem API key necessária (o access_code já é a prova de autorização)

### 4. `ProfessionalReport.tsx` — consumir via POST
- Extrair `code` da query string
- Chamar `report-access` via POST com `{ token, access_code: code }`
- Remover todas as queries diretas ao Supabase
- Se code inválido/expirado → mostrar erro "Acesso expirado"

### 5. `prontuario-verify` — remover `pid` da URL pública

## Arquivos afetados
- Nova migração: tabela `report_access_codes`
- `supabase/functions/prontuario-verify/index.ts` — gerar access_code
- Novo: `supabase/functions/report-access/index.ts` — servir dados via POST
- `src/components/report/ProfessionalReport.tsx` — consumir via POST, remover queries diretas

## Segurança garantida
- Link sem code → não carrega nada
- Code expirado (5 min) → não carrega
- Code já usado → não carrega
- Sem API key do Meddit → não gera code
- Professional_id errado → não gera code

