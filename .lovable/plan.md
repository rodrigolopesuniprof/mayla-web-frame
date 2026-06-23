## Diagnóstico

A tela "Avaliação Completa de Saúde" (provider **Binah**) falha em produção com:

> `Failed to resolve module specifier '@biosensesignal/web-sdk'`

Causa: em `src/hooks/useVitalsMeasurement.ts` (linha 186-187) e `src/hooks/useBinahMonitor.ts` (linha 122), o código faz `import(/* @vite-ignore */ "@biosensesignal/web-sdk")`. Como o `vite.config.ts` marca o pacote como `external`, o Vite não empacota o módulo. O pacote npm também **não está instalado** (não consta no `package.json`), então em produção o navegador tenta resolver um *bare specifier* sem import map e falha.

Os arquivos do SDK já existem em `public/binah-sdk/` (`main.js`, `a.js`, `a.wasm.gz`, `a.worker.js`, `799.js`, `legacyVideos.js`), servidos pelo próprio site. O `main.js` é um bundle **UMD** que, quando carregado via `<script>`, anexa seus exports (incluindo `default` = monitor) ao objeto global.

Observação: a tela aberta pelo usuário é a **Binah** ("Avaliação Completa de Saúde"), não a Shen.ai mostrada no print de configuração. Este plano só corrige o caminho Binah; a Shen.ai segue por outro fluxo (`initializeShenai`) e não está em erro.

## Plano

Trocar o `import()` dinâmico do pacote npm por um carregamento via `<script>` apontando para `/binah-sdk/main.js` (já hospedado em `public/`). Após o load, ler o monitor de `window.default` (ou de uma variável dedicada caso colida).

### Mudanças

**1. `src/hooks/useVitalsMeasurement.ts` (função `initializeSdkLocal`, ~linha 178-235)**

Substituir:
```ts
const sdkPath = "@biosensesignal/web-sdk";
const sdk = await import(/* @vite-ignore */ sdkPath);
const monitor = sdk.default;
```
por um loader UMD reaproveitável:
```ts
async function loadBinahSdk(): Promise<any> {
  if ((window as any).__binahMonitor) return (window as any).__binahMonitor;
  await new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[data-binah-sdk]')) return resolve();
    const s = document.createElement("script");
    s.src = "/binah-sdk/main.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.binahSdk = "true";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao baixar /binah-sdk/main.js"));
    document.head.appendChild(s);
  });
  // UMD anexa exports em window; "default" = HealthMonitorManager
  const monitor = (window as any).default || (window as any).HealthMonitorManager;
  if (!monitor?.initialize) throw new Error("Binah SDK carregado mas monitor indisponível");
  (window as any).__binahMonitor = monitor;
  return monitor;
}
```
e usar `const monitor = await loadBinahSdk();` no lugar do import.

Atualizar também a checagem de erro (`Cannot find module` / `ERR_MODULE_NOT_FOUND`) para capturar `"Falha ao baixar"` e continuar caindo em demo mode quando o asset não responder.

**2. `src/hooks/useBinahMonitor.ts` (~linha 120-130)**

Aplicar a mesma troca (extrair `loadBinahSdk` para `src/lib/binah-loader.ts` e reaproveitar nos dois hooks).

**3. `vite.config.ts`**

Remover as entradas que tratam o pacote como dependência npm (não usamos mais o specifier):
- `optimizeDeps.exclude: ["@biosensesignal/web-sdk"]`
- `build.rollupOptions.external: ["@biosensesignal/web-sdk"]`

Manter `vite-plugin-wasm` e `topLevelAwait` (necessários por outras razões) e as headers COOP/COEP.

**4. `src/types/binah-sdk.d.ts`**

Manter o `declare module` existente (não é mais referenciado pelo import, mas não atrapalha). Opcionalmente exportar uma interface `BinahMonitor` para tipar o retorno do loader.

### Fora de escopo

- Reinstalar o pacote npm `@biosensesignal/web-sdk` (não temos o .tgz no repo e o caminho local resolve o problema).
- Mexer no fluxo Shen.ai / `initializeShenai`.
- Alterar UI de erro do `BinahCapture.tsx` (a mensagem técnica já aparece).

### Verificação

Após o build, abrir "Avaliação Completa de Saúde" no Chrome mobile e confirmar no console:
- `GET /binah-sdk/main.js` → 200
- Sem erro `Failed to resolve module specifier`
- Câmera abre e a sessão inicia (ou cai em demo se `crossOriginIsolated=false`, comportamento já existente).
