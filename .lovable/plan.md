## Diagnóstico

O motivo de o painel da Shen.ai estar zerado e o relatório aparecer idêntico ao Binah:

1. **SDK Shen.ai nunca roda de fato.** O hook exige `crossOriginIsolated === true` (SharedArrayBuffer/WASM threads). No preview da Lovable os headers COOP/COEP não chegam ao iframe, então cai em **modo demo** silenciosamente, sem consumir API. Por isso o painel da Shen.ai continua em zero.
2. **UI nativa da Shen.ai não é exibida.** O componente abre uma `<video>` própria do Binah em vez de delegar o canvas ao SDK da Shen.ai (que renderiza overlay de rosto, instruções e barra de qualidade do próprio fornecedor).
3. **Mapeamento de resultados é parcial.** `mapShenaiResults()` só converte 6 campos (HR, HRV SDNN, BR, stress, PA, carga cardíaca). Todos os outros (PNS/SNS, LF/HF, RMSSD, MAP, débito cardíaco, idade vascular, hemoglobina, HbA1c, glicose, colesterol, BMI, riscos clínicos, scores) são descartados na tela final mesmo que cheguem no payload bruto.
4. **Tela de resultado do paciente é hardcoded.** Renderiza só a lista fixa de cards estilo Binah, ignorando o catálogo `vitals_indicators_catalog` que já existe no banco.
5. **Perfil clínico não é enviado ao SDK.** Sem idade/sexo/altura/peso, a Shen.ai não calcula pressão, riscos e métricas metabólicas — o que esvazia o relatório.

## O que será feito

### 1. Garantir que o SDK Shen.ai realmente execute
- Ajustar `useVitalsMeasurement` para **não cair em demo se `crossOriginIsolated` for false em ambiente Shen.ai**: tentar carregar o SDK assim mesmo (o `@shenai/sdk` aceita modo single-thread quando o WASM threaded falha). Só cai em demo quando o próprio `CreateShenaiSDK` lançar erro irrecuperável.
- Adicionar **meta tag e iframe sandbox flags** no `index.html` (`<meta http-equiv="Cross-Origin-Opener-Policy" ...>` não funciona, mas adicionamos `crossorigin` nos scripts críticos e instrução para publicar em domínio próprio quando precisar do modo isolado).
- Confirmar config do `vite.config.ts` (já tem COOP/COEP) e adicionar fallback explícito de log para o admin saber se a página está isolada.
- Em runtime, antes de iniciar a medição, mostrar aviso amigável caso `crossOriginIsolated=false` ("Use o domínio publicado para máxima precisão") em vez de silenciosamente virar demo.

### 2. Usar a UI nativa do Shen.ai
- `BinahCapture` (renomeado conceitualmente para `VitalsCapture`, mas mantendo o arquivo) passa a:
  - Quando provider = `shenai`, **não abrir `getUserMedia` próprio**. Em vez disso, criar um `<canvas id="shenai-canvas">` em tela cheia e passar para o SDK via `sdk.attachToCanvas(canvasId)` (ou opção equivalente do `initialize`).
  - Esconder os overlays próprios (face mask Binah, mensagens de validade) quando isShenai = true — a Shen.ai já desenha guias, qualidade do sinal e instruções no canvas.
  - Manter o cronômetro e botão "Cancelar" por cima do canvas Shen.ai.

### 3. Enviar perfil clínico do paciente ao SDK
- Antes de `sdk.startMeasurement()`, ler `profiles` (birth_date → idade, biological_sex, height_cm, weight_kg) e chamar `sdk.setUserProfile({ age, sex, height, weight })` (API do Shen.ai). Sem esses dados, métricas como PA, riscos e hemoglobina não são calculadas.
- Se faltar algum dado, abrir o gate de perfil que já existe (memória `Profile Completion Gate`) antes de iniciar a medição Shen.ai.

### 4. Capturar e persistir TODOS os indicadores
- Estender `mapShenaiResults()` para cobrir todas as 36 chaves do `vitals_indicators_catalog` (HRV completo, PNS/SNS, LF/HF, MAP, débito cardíaco, idade vascular, riscos, scores etc.).
- Sempre salvar em `special_measurements.measurement_data` o objeto **bruto completo** retornado por `sdk.getMeasurementResults()` (já é feito parcialmente). Adicionar também `getRealtimeMetricsHistory()` e `getHeartbeats()` quando disponíveis para auditoria.
- Em `health_measurements`, gravar os campos canônicos atuais (HR, BR, stress, SpO2, PA, HRV) para manter compatibilidade com gráficos existentes e cálculo de score.

### 5. Relatório do usuário 100% dinâmico
- Substituir a lista hardcoded de cards no `BinahCapture` por render dinâmico vindo de `useVisibleIndicators` + `flattenMeasurementPayload(rawResults)`:
  - Mostra **somente** os indicadores marcados como visíveis ao usuário em `user_visible_indicators` (já existe).
  - Agrupa por `category` usando `categoryLabel`.
  - Cada card recebe `label`, `unit`, `description` (tooltip) direto do catálogo.
- Indicadores não visíveis ficam ocultos para o paciente mas continuam no banco para o admin.

### 6. Painel admin com todos os parâmetros Shen.ai
- `UserVitalsFullPanel` já existe e lê o catálogo + `flattenMeasurementPayload`. Vamos:
  - Garantir que todas as 36 chaves caiam corretamente em `flattenMeasurementPayload` (já está OK, manter).
  - Acrescentar coluna de **fonte** (badge "Shen.ai" / "Binah") e link "ver JSON bruto" que abre modal com `measurement_data` completo.
  - Marcar visualmente indicadores cujo valor veio nulo (Shen.ai retorna `null` quando não há confiança suficiente).

### 7. Verificação
- Após implementar: abrir a medição no preview, validar no console que `[Shen.ai] Init OK` aparece (não demo), confirmar que o canvas mostra a UI do Shen.ai com tracking facial, e que após 60 s os 30+ indicadores aparecem no relatório do paciente e no painel admin do usuário.
- Pedir ao usuário para abrir o painel da Shen.ai e validar que houve consumo de API real.

## Arquivos afetados

- `src/hooks/useVitalsMeasurement.ts` — mapeamento completo, perfil clínico, fluxo Shen.ai sem fallback silencioso.
- `src/components/mayla/BinahCapture.tsx` — UI nativa Shen.ai, relatório dinâmico do paciente, gate de perfil.
- `src/components/admin/UserVitalsFullPanel.tsx` — badge de fonte e modal de JSON bruto.
- `src/hooks/useVisibleIndicators.ts` — pequenos ajustes no `flattenMeasurementPayload` se necessário.
- `index.html` / `vite.config.ts` — revisão dos headers COOP/COEP.
- Nenhuma migração de banco nova: o catálogo `vitals_indicators_catalog`, `user_visible_indicators` e `special_measurements` já cobrem o necessário.

## Pontos abertos

- Para o `crossOriginIsolated=true` valer **em produção** (domínio `saude.saudecomvc.com.br`), o servidor que serve o build precisa emitir COOP/COEP — já está documentado em `DEPLOY.md`. Validar com o usuário se o nginx atual está aplicando esses headers; caso negativo, precisamos ajustar a configuração do servidor antes de o SDK rodar com performance total.