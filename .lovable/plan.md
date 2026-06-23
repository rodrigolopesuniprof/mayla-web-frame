## Diagnóstico

Rastreei o fluxo do Shen.ai em `src/hooks/useVitalsMeasurement.ts` (initializeShenai, linhas 294‑477) e em `src/components/mayla/BinahCapture.tsx` (saveResult, linhas 246‑314). A captura da câmera ocorre, o SDK roda a medição, mas o objeto `MeasurementResults` raramente chega ao estado `rawResults/finalResults` — e quando chega, ainda pode não ser persistido. Encontrei seis causas concretas:

### 1. Polling 1s perde a janela `FINISHED`
O resultado só é coletado dentro de `setInterval(..., 1000)` que checa `state === s.MeasurementState?.FINISHED`. Como o SDK está configurado com `enableSummaryScreen: true`, `showResultsFinishButton: true` e `showHealthIndicesFinishButton: true`, ao terminar a medição o SDK transita automaticamente para a tela de resumo e, quando o usuário toca em "Finish", o estado volta para `IDLE/POSITIONING`. Se o tick de 1s cair fora dessa janela, `getMeasurementResults()` nunca é chamado.

### 2. Comparação por enum frágil
`s.MeasurementState?.FINISHED` pode ser `undefined` em builds onde o enum é exposto como string. A comparação `state === undefined` casa com qualquer leitura nula e nunca dispara o ramo de sucesso. Não há fallback nem log do valor real do estado.

### 3. Não usamos os callbacks do SDK
O Shen.ai expõe `setOnMeasurementFinishedCallback` (e variantes `setOnStateChangeCallback`). São disparados síncronamente quando o resultado fica pronto, sem race com a UI de resumo. Hoje confiamos só no polling.

### 4. Save é manual e tardio
Mesmo quando `rawResults` chega, o registro no banco só ocorre se o usuário tocar em "Salvar Medição" (`saveResult` em BinahCapture.tsx:246). Se ele fechar a tela, voltar ou tocar em "Finish" do SDK, **os dados são perdidos** — nada vai para `special_measurements` nem `health_measurements`.

### 5. `startMeasurement` zera resultados sem proteção
Em `useVitalsMeasurement.ts:559` chamamos `setFinalResults(null); setRawResults(null)` ao re-entrar em "measuring". Se o usuário toca duas vezes em Start (botão nosso + botão do SDK), pode zerar um resultado já capturado.

### 6. Falhas silenciosas
O `catch` do polling apenas faz `console.warn("[Vitals poll]", e)`. Quando `getMeasurementResults()` retorna `null` (ex.: state já voltou), não há aviso na tela nem retry — o usuário vê a câmera fechar sem feedback e nada é salvo.

---

## Plano de correção

Tudo dentro de `src/hooks/useVitalsMeasurement.ts` e `src/components/mayla/BinahCapture.tsx`. Sem mudanças em backend ou edge functions.

### A. Capturar o resultado por callback do SDK (não por polling)
Em `initializeShenai`, após `sdk.initialize(...)`:
1. Criar `commitShenaiResult(s)` que faz: `const final = s.getMeasurementResults(); if (!final?.heart_rate_bpm) { tentar s.getMeasurementResultsHistory() último item }`; monta payload, `setRawResults` e `setStatus("completed")`. Idempotente (não roda se já completou).
2. Registrar callbacks disponíveis:
   - `sdk.setOnMeasurementFinishedCallback?.(() => commitShenaiResult(s))`
   - `sdk.setOnStateChangeCallback?.((state) => { if (isFinishedState(state)) commitShenaiResult(s) })`
3. Manter o `setInterval` apenas para **realtime metrics** + fallback (chama `commitShenaiResult` se detectar estado finalizado por comparação por nome OU número OU presença de `getMeasurementResults()` retornando algo válido).

### B. Tornar o reconhecimento de `FINISHED` robusto
Helper `isFinishedState(s, state)`:
- aceita `state === s.MeasurementState?.FINISHED`
- aceita `String(state).toUpperCase().includes("FINISH")`
- aceita `state === 4 /* enum index histórico do SDK */`
Logar `state`, `typeof state` e `s.MeasurementState` na primeira execução para diagnóstico futuro.

### C. Desligar a tela de resumo nativa do SDK
Em `sdk.initialize(...)` mudar:
- `enableSummaryScreen: false`
- `showResultsFinishButton: false`
- `showHealthIndicesFinishButton: false`

Assim o estado permanece `FINISHED` até nós chamarmos `setOperatingMode(POSITIONING)`, eliminando a corrida. Nossa própria tela de "Resultados" já existe (`phase === "result"`).

### D. Auto-salvar quando o resultado chega
Em `BinahCapture.tsx`, no `useEffect` que reage a `status === "completed"`:
- Continuar mostrando a tela de resultados.
- Disparar `saveResult()` automaticamente uma única vez (guarda por ref `autoSavedRef`). O botão "Salvar" vira indicador "✓ Salvo".
- Em `handleCancel`, se já há `rawResults` e ainda não salvo, salvar antes de fechar.

### E. Proteger `startMeasurement` contra duplo-clique
Não zerar `finalResults/rawResults` se `status === "completed"`. Só limpar quando o usuário inicia uma **nova** medição via fluxo de consentimento (já chama `cleanup`).

### F. Logs e feedback de erro
- `console.info("[Shenai] commit results", { hasFinal, keys })` ao salvar.
- Se `commitShenaiResult` rodar e `final` vier vazio, `setErrorMessage("Não foi possível obter os resultados da medição. Tente novamente em melhor iluminação.")` + `setStatus("error")`.
- No `catch` do poll/callback, propagar para `setSdkErrorDetail` para a tela exibir.

### G. Validação no banco (somente leitura, sem migração)
Após implementar, executar uma medição de teste e checar `select * from special_measurements where user_id=... order by created_at desc limit 1` para confirmar que `measurement_data` contém o payload Shen.ai completo (heart_rate_bpm, hrv_sdnn_ms, blood pressures, _health_risks, etc.).

---

## Arquivos afetados

- `src/hooks/useVitalsMeasurement.ts` — refatoração do `initializeShenai` (callbacks, helper `isFinishedState`, `commitShenaiResult`, logs); ajuste em `startMeasurement` para não zerar resultados já completos; flags do `initialize` (`enableSummaryScreen` etc.).
- `src/components/mayla/BinahCapture.tsx` — `useEffect` que auto-chama `saveResult` em `status === "completed"`; `handleCancel` salva pendente; ref `autoSavedRef`.

## Fora de escopo

- `rppg-proxy`, `useBinahMonitor`, `RppgCapture` (fluxo básico) — não tocados.
- Edge function `shenai-config`.
- Esquema do banco (`special_measurements`/`health_measurements`).
