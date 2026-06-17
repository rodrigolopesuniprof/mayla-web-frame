## Diagnóstico confirmado

O playground (`playground.shen.ai`) prova: API key OK, SDK 3.1.0 inicializa, plano PROFESSIONAL, câmera abre. Logo o problema **não** é licença nem `shenai-config`. A tela "Seu navegador não é compatível" é renderizada pelo **preload display** do SDK (canvas WebGL próprio dele) quando o ambiente não tem `crossOriginIsolated=true` / `SharedArrayBuffer` — caso da preview iframe do Lovable.

Em produção (`saude.saudecomvc.com.br`) os headers COOP/COEP já estão configurados, então o SDK roda normal. Falta whitelabel, fallback amigável na preview e UI 100% nossa.

Observação: `CameraMode.CUSTOM_FRAMES` existe só no SDK React Native (com código nativo). No Web SDK (`@shenai/sdk`) a câmera é sempre gerenciada pelo SDK — "UI 100% nossa" aqui significa `showUserInterface: false` + nossos botões e overlay sobre o canvas.

## Mudanças

### 1. `src/hooks/useVitalsMeasurement.ts` — pré-checagem + loader silencioso

Antes de qualquer `CreateShenaiSDK`, validar o ambiente:

```ts
const reasons: string[] = [];
if (typeof WebAssembly === "undefined") reasons.push("wasm");
if (typeof SharedArrayBuffer === "undefined" || !self.crossOriginIsolated) reasons.push("isolation");
if (!navigator.mediaDevices?.getUserMedia) reasons.push("camera");
if (!document.createElement("canvas").getContext("webgl2")) reasons.push("webgl2");
if (reasons.length) {
  console.warn("[Vitals] unsupported:", reasons);
  setStatus("unsupported");
  return;
}
```

Trocar a criação do SDK para desligar o preload nativo (origem da mensagem) e o telemetry interno:

```ts
const sdk = await CreateShenaiSDK({
  enablePreloadDisplay: false,
  enableErrorReporting: false,
  onWasmLoadingProgress: (p) => setWasmProgress(Math.round(p * 100)),
});
```

Expor novo estado `wasmProgress` no retorno do hook.

### 2. `src/hooks/useVitalsMeasurement.ts` — inicialização whitelabel

`InitializationSettings` em modo "custom UI":

```ts
sdk.initialize(apiKey, userId, {
  language: "pt",
  showUserInterface: false,
  showFacePositioningOverlay: true,
  showVisualWarnings: true,
  showFaceMask: false,
  showBloodFlow: false,
  showSignalQualityIndicator: false,
  showSignalTile: false,
  showStartStopButton: false,
  showInfoButton: false,
  showDisclaimer: false,
  enableSummaryScreen: false,
  showResultsFinishButton: false,
  enableHealthRisks: false,
  hideShenaiLogo: true,
  uiFlowScreens: [],
  onboardingMode: "HIDDEN",
  cameraMode: "FACING_USER",
  operatingMode: "POSITIONING",
  onCameraError: () => { setErrorMessage("Não foi possível acessar a câmera."); setStatus("error"); },
  eventCallback: (e) => { /* MEASUREMENT_FINISHED já tratado pelo polling */ },
}, (r) => { /* mapear OK/INVALID_API_KEY/CONNECTION_ERROR/INTERNAL_ERROR */ });
```

`start()` chama `sdk.setOperatingMode("MEASURE")`, `stop()` volta para `POSITIONING`. Polling de resultados existente permanece.

### 3. `src/components/mayla/BinahCapture.tsx` — UI whitelabel

Fases visuais (sem nomes de fornecedor em texto, log ou placeholder):

- **`loading`** → barra de progresso com `wasmProgress` + texto "Carregando análise…".
- **`ready` / intro** → instruções ("Posicione o rosto na moldura, boa luz, fique parado") + botão **Iniciar medição** → `start()`.
- **`measuring`** → canvas + overlay com timer/orientação + botão **Cancelar**.
- **`done`** → resumo nosso + botão **Concluir**.
- **`unsupported`** → tela nova:
  - Ícone `MonitorOff`.
  - Título: "Análise indisponível neste navegador".
  - Texto: "Esta análise avançada precisa de um navegador moderno em janela própria. Em janelas incorporadas ou navegadores corporativos antigos ela não funciona."
  - Botão primário **Usar Análise Básica** → `onFallbackToBasic()`.
  - Botão secundário **Fechar**.
- **`error`** → `errorMessage` + **Tentar novamente**.

`<canvas id="shenai-canvas">` só é renderizado a partir de `ready`.

### 4. `src/components/mayla/HealthTab.tsx` e `WellbeingTab.tsx` — wiring do fallback

Passar `onFallbackToBasic` para `BinahCapture` apontando para a mesma função que já abre o rPPG básico. Se `useVitalsSources().basic` estiver desabilitado, o botão "Usar Análise Básica" não aparece (só "Fechar").

### 5. Limpeza whitelabel

Remover de UI, logs visíveis, títulos, descrições e props as strings "Binah", "Shen", "Shen.ai", "shenai". Logs internos viram `[Vitals]`. Identificadores técnicos (imports, ids de canvas, nomes de variável) permanecem.

## Fora de escopo

- `customColorTheme` por tenant (próxima entrega).
- `public/_headers` (já configurado em produção).
- `shenai-config`, `AdminIntegrations`, `useVitalsSources` (sem mudanças).
- Short-term tokens / Remote Configuration do portal Shen.ai.
- `cameraMode: CUSTOM_FRAMES` (não existe no Web SDK).

## Validação

1. **Preview Lovable (iframe)**: Análise Avançada → tela "Análise indisponível neste navegador" + **Usar Análise Básica**. Nunca aparece o retângulo cinza nativo.
2. **`saude.saudecomvc.com.br`**: barra de progresso nossa → instruções → **Iniciar medição** → canvas com overlay (sem logo, sem START nativo, sem disclaimer) → resumo nosso.
3. Console sem strings de marca; sem stack trace do SDK na fase inicial.
4. Nenhuma menção visível a "Binah" ou "Shen.ai" em qualquer fase.
