## Diagnóstico

O 504 vem do endpoint `/auth/v1/token` do Lovable Cloud (autenticação), não do app. Os logs mostram requisições de `refresh_token` levando 8–10 segundos antes de estourar timeout. O banco está sobrecarregado por algumas consultas muito repetidas, o que faz o serviço de auth (que usa o mesmo Postgres) responder devagar e cair em 504.

Top ofensores (somando tempo total):

- `profiles` por `user_id` — 10.554 chamadas, máx 1.6s
- `notifications` ordenando por `priority, created_at` — 3.066 chamadas, máx 1.1s
- Várias releituras de `profiles` na inicialização do app
- `company_leaderboard` filtrando por `company_id, user_id`

## O que vou fazer

### 1. Reiniciar o backend
Reinício controlado do Lovable Cloud para limpar a fila de conexões saturadas e restabelecer o auth imediatamente.

### 2. Otimizar banco com índices
Migração criando índices que faltam para as consultas mais lentas, reduzindo o risco de novos 504:

- `profiles(user_id)` (único)
- `profiles(company_id)`
- `notifications(priority DESC, created_at DESC)` + filtro de `scope` quando aplicável
- `company_leaderboard(company_id, user_id)`
- `health_measurements(user_id, measured_at DESC)`
- `health_scores(user_id, generated_at DESC)`
- `special_measurements(user_id, measured_at DESC)`
- `subscriptions(user_id, created_at DESC)`

### 3. Reduzir chamadas redundantes no boot do app
Pequenos ajustes para o app deixar de carregar para sempre quando o auth/backend está lento:

- `AuthContext`: timeout defensivo em `getSession` para não travar a tela.
- `CompanyContext`: cache em memória do `profiles.company_id` e da empresa para evitar refazer a query toda navegação.
- `HomeTab`: unificar as 4 leituras de `profiles` em uma só (`select full_name, points, avatar_url, avatar_type`).
- `useHasAccess`: rodar `subscriptions` + `profiles` + `company_payment_credentials` em paralelo já no mesmo round trip.
- `AccessGate` / `ProtectedRoute`: mostrar mensagem amigável + botão "Tentar novamente" se a verificação demorar mais que 8s, em vez de "Carregando..." infinito.

### 4. Validar
- Conferir status do backend após o restart.
- Testar login no preview como usuário e como admin.
- Confirmar que não há mais 504 nos logs de auth nos próximos minutos.

## Observações

- As tabelas novas de indicadores (`vitals_indicators_catalog`, `user_visible_indicators`) não são a causa — elas só carregam na tela admin de Indicadores e no relatório, não no boot.
- Não vou mexer no esquema de RLS, em `auth/`, nem nos tipos auto-gerados.
- Se o problema persistir após restart + índices, o próximo passo é aumentar o tamanho da instância do Lovable Cloud (Backend → Configurações avançadas → Upgrade), porque o gargalo passa a ser CPU/RAM.
