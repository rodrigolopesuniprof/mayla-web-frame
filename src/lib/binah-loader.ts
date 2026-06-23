/**
 * Loads the Binah Web SDK (UMD bundle) from /binah-sdk/main.js served by the app.
 * The npm package `@biosensesignal/web-sdk` is NOT installed; we ship the SDK
 * as static assets in `public/binah-sdk/` and inject the bundle via <script>.
 *
 * The UMD bundle attaches its exports to the global object (`self`/`window`).
 * In this build, the `default` export is the HealthMonitorManager.
 */

let cached: any = null;
let loading: Promise<any> | null = null;

export function loadBinahSdk(): Promise<any> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = new Promise<any>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-binah-sdk="true"]',
    );

    const onReady = () => {
      const w = window as any;
      const monitor = w.default || w.HealthMonitorManager;
      if (!monitor?.initialize || typeof monitor.createFaceSession !== "function") {
        reject(new Error("Binah SDK carregado mas monitor indisponível"));
        return;
      }
      cached = monitor;
      resolve(monitor);
    };

    if (existing) {
      if ((window as any).default || (window as any).HealthMonitorManager) {
        onReady();
      } else {
        existing.addEventListener("load", onReady, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Falha ao baixar /binah-sdk/main.js")),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "/binah-sdk/main.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.binahSdk = "true";
    script.onload = onReady;
    script.onerror = () =>
      reject(new Error("Falha ao baixar /binah-sdk/main.js"));
    document.head.appendChild(script);
  }).catch((err) => {
    loading = null;
    throw err;
  });

  return loading;
}
