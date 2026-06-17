# Diagnóstico do bloqueio do Shen.AI SDK

## Contexto

A tela "Análise indisponível neste navegador" é gerada pelo **nosso** pre-check em `src/hooks/useVitalsMeasurement.ts` (linhas 298-309), não pelo SDK Shen. Hoje ele bloqueia preventivamente se faltar qualquer um destes 4:

1. `WebAssembly` indefinido
2. `SharedArrayBuffer` indefinido OU `crossOriginIsolated === false`
3. `navigator.mediaDevices.getUserMedia` indisponível
4. Contexto `webgl2` não criável

Não sabemos qual está falhando no ambiente do usuário, e o pre-check é mais rígido que o SDK precisa de fato.

## O que fazer

### 1. Expor o motivo real na tela de bloqueio
Em `useVitalsMeasurement.ts`, guardar o array `reasons` num estado novo (`unsupportedReasons: string[]`) e expor no retorno do hook. Em `BinahCapture.tsx`, mostrar o código (ex.: `ERR_ISOLATION`, `ERR_WEBGL2`, `ERR_CAMERA`, `ERR_WASM`) na tela "Análise indisponível", junto com texto curto por motivo:
- `wasm` → "Navegador sem suporte a WebAssembly"
- `isolation` → "Janela embutida sem isolamento de origem (COOP/COEP)"
- `camera` → "Câmera bloqueada ou indisponível"
- `webgl2` → "Aceleração gráfica WebGL2 indisponível"

Isso permite identificar em segundos se é problema de header (nosso/host), permissão de câmera (usuário), ou capacidade real do browser (Shen).

### 2. Relaxar o pre-check para SAB (tentar mesmo assim)
Hoje bloqueamos se `crossOriginIsolated=false`. Algumas versões do Web SDK Shen funcionam parcialmente sem SAB. Mudar o pre-check para:
- **Bloqueio duro** (não tenta SDK): só se faltar `WebAssembly`, `getUserMedia` ou `WebGL2`.
- **Aviso só** (deixa o SDK tentar): se faltar apenas `SharedArrayBuffer`/`crossOriginIsolated`. Se o `CreateShenaiSDK()` lançar exceção, aí cai pra `unsupported` com motivo real do SDK.

### 3. Capturar e exibir o erro retornado pelo SDK
No `try/catch` da inicialização do SDK (já existe nas linhas ~220), guardar `err.message` num estado `sdkErrorDetail` e exibir na tela de bloqueio em texto pequeno, pra o usuário poder mandar print pro suporte.

### 4. Log estruturado
Adicionar `console.warn("[Vitals] unsupported", { reasons, userAgent: navigator.userAgent, isolated: crossOriginIsolated, hasSAB: typeof SharedArrayBuffer !== "undefined" })` pra ficar fácil debugar via DevTools.

## Arquivos afetados

- `src/hooks/useVitalsMeasurement.ts` — adicionar `unsupportedReasons` e `sdkErrorDetail` no estado e no retorno; relaxar pre-check de SAB; logs.
- `src/components/mayla/BinahCapture.tsx` — renderizar motivo + código de erro na tela "Análise indisponível".

## O que NÃO está incluído (respeitando suas restrições)

- Não abre nova janela / `window.open` / intent.
- Não ativa fallback automático para outra análise.
- Não muda comportamento quando o SDK funciona normalmente.

## Limite do que conseguimos resolver sozinhos

Se depois desse diagnóstico o motivo for **WebAssembly ausente** ou **WebGL2 ausente** no WebView do host, aí sim **só a Shen** resolve (build single-thread / modo `CUSTOM_FRAMES` no Web SDK). Se for **isolation** ou **camera**, é configuração nossa / do app que embeda — resolvível.
