
## Diagnóstico

A tela "Análise indisponível neste navegador" é gerada em `src/hooks/useVitalsMeasurement.ts` no pre-flight de `initializeShenai` (linhas 308–331). Ele bloqueia (`hardReasons`) quando falta `WebAssembly`, `getUserMedia` ou contexto **WebGL2**.

Em Chrome/Safari mobile **modernos**, esses três normalmente existem — então o bloqueio mais provável hoje é um falso negativo da checagem de WebGL2 (quando o navegador exige gesto/contexto ativo) ou o próprio SDK falhando depois por falta de `crossOriginIsolated` em produção.

Sobre a orientação da Shen.ai (`crossorigin="anonymous"` no `<script>`): no nosso código o SDK é importado via npm (`import("@shenai/sdk")`), não via `<script>`. O equivalente é garantir COOP/COEP no domínio publicado, que hoje só está configurado no Vite (dev/preview) e não em `https://saude.saudecomvc.com.br`.

## Mudanças

### 1. Relaxar o gate "navegador não suportado" (`src/hooks/useVitalsMeasurement.ts`)
- Remover **WebGL2** dos `hardReasons` do pre-flight: o SDK fará a checagem real internamente e, se falhar, cairá no `catch` com motivo correto via `envFingerprint`.
- Manter apenas `WebAssembly` e `getUserMedia` como bloqueios duros (impossíveis de contornar).
- Continuar tratando `isolation` (SAB/COI) como soft, mas registrar como `unsupportedReasons` informativo.
- Adicionar detecção de **WebView** (Instagram/Facebook/LinkedIn/etc.) e, quando detectada **e** o init falhar, expor um motivo `webview` na UI com ação "Abrir no navegador externo".

### 2. Detecção de WebView e UX de fallback (`src/components/mayla/BinahCapture.tsx`)
- Helper `isInAppWebView()` baseado em UA (`FBAN|FBAV|Instagram|Line|MicroMessenger|WhatsApp|wv\)`).
- Quando `phase === "unsupported"` e for WebView: mostrar texto orientando abrir em Chrome/Safari + botão **"Abrir no navegador"** que tenta `intent://...#Intent;end` (Android) e link direto (iOS Safari).
- Quando não for WebView: manter texto atual, mas adicionar botão "Tentar mesmo assim" que chama `initializeShenai` ignorando soft reasons (já é o comportamento — só evidenciar visualmente).

### 3. Habilitar COOP/COEP em produção
Lovable hosting não processa `_headers`/`_redirects`/`netlify.toml`. Como não dá para definir esses headers no servidor estático, fazemos o que é possível no cliente:
- Adicionar `<meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">` e `<meta http-equiv="Cross-Origin-Embedder-Policy" content="credentialless">` em `index.html`. Navegadores modernos respeitam esses meta tags para COOP (e parcialmente COEP), o que pode habilitar `crossOriginIsolated` mesmo sem header HTTP.
- Manter `vite-plugin-wasm` + `topLevelAwait` que já estão no projeto.

### 4. (Opcional) Reportar a causa real ao usuário
- Logar `unsupportedReasons` na tela técnica (já existe `sdkErrorDetail`) para facilitar suporte.

## Fora de escopo
- Alterar headers HTTP de produção (não é configurável em Lovable hosting).
- Trocar `import("@shenai/sdk")` por CDN com `crossorigin="anonymous"` — não é necessário; o problema da Shen.ai é COI/COEP, não tag de script. Mantemos o npm.
- Mudar a lógica do RPPG básico ou da Binah.

## Verificação
- Abrir `/login` no preview, navegar à medição avançada e confirmar que não cai mais em "unsupported" em Chrome desktop e mobile padrão.
- Em WebView (WhatsApp), confirmar que aparece a nova UI com "Abrir no navegador".
- Conferir `console` por `[Vitals] env check` — `isolated` deve passar a `true` no domínio publicado após a meta tag.
