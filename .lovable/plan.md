# Plano: Corrigir medição rPPG (session_not_found)

## Diagnóstico

Os logs da edge function mostram que **todas as tentativas recentes falham** com `session_not_found_or_expired`. A sessão é criada via POST, mas quando o WebSocket conecta 500ms depois, o backend diz que não existe.

## Correções na edge function `rppg-proxy`

### 1. Aumentar delay antes do WebSocket

- De 500ms para **2000ms** — dar mais tempo ao backend para registrar a sessão

### 2. Adicionar retry no WebSocket

- Se receber `session_not_found` na primeira tentativa, esperar 1s e reconectar (até 2 retries)

### 3. Reduzir payload

- não diminuir frames pra não prejudicar a leitura 
  &nbsp;

### 4. Adicionar health-check antes do WS

- Fazer um GET `/sessions/{id}/status` (se a API suportar) para confirmar que a sessão existe antes de abrir o WS

## Arquivo


| Ação   | Arquivo                                                                   |
| ------ | ------------------------------------------------------------------------- |
| Editar | `supabase/functions/rppg-proxy/index.ts` — delay, retry, limite de frames |
