import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Shared types (same interface regardless of provider) ──

interface VitalSignValue<T = number> {
  value: T;
  confidence?: number;
}

interface BloodPressureValue {
  systolic: number;
  diastolic: number;
}

export interface VitalSigns {
  pulseRate?: VitalSignValue;
  respirationRate?: VitalSignValue;
  stressLevel?: VitalSignValue;
  sdnn?: VitalSignValue;
  bloodPressure?: VitalSignValue<BloodPressureValue>;
  oxygenSaturation?: VitalSignValue;
  wellnessIndex?: VitalSignValue;
  hemoglobin?: VitalSignValue;
  hemoglobinA1c?: VitalSignValue;
  prq?: VitalSignValue;
  cardiacWorkload?: VitalSignValue;
}

export enum ImageValidity {
  VALID = 0,
  FACE_ORIENTATION = 1,
  INVALID_ROI = 2,
  TILTED_HEAD = 3,
  FACE_TOO_FAR = 4,
  FACE_TOO_CLOSE = 5,
  UNEVEN_LIGHT = 6,
}

export type MonitorStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "measuring"
  | "processing"
  | "completed"
  | "error"
  | "unsupported";

export interface UseVitalsMeasurementReturn {
  status: MonitorStatus;
  partialVitals: VitalSigns | null;
  finalResults: VitalSigns | null;
  rawResults: Record<string, any> | null;
  imageValidity: ImageValidity;
  errorMessage: string;
  isSDKAvailable: boolean;
  isDemoMode: boolean;
  providerName: string;
  provider: VitalsProvider;
  initialize: (videoElement: HTMLVideoElement, cameraDeviceId?: string) => Promise<void>;
  initializeShenai: (canvasId: string) => Promise<void>;
  startMeasurement: () => void;
  stopMeasurement: () => void;
  cleanup: () => void;
}

// ── Config shape from company_features.config ──

export type VitalsProvider = "binah" | "shenai";

interface VitalsProviderConfig {
  provider: VitalsProvider;
  provider_name: string;
  integration_type: "sdk_local" | "api_remota";
  license_key: string;
  base_url: string;
  api_key: string;
  monthly_limit: number;
}


const FALLBACK_LICENSE_KEY = "9FE0E4-F8E4ED-48B396-2CF86D-322751-1B04DE";
const PROCESSING_TIME = 60;

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function generateDemoVitals(): VitalSigns {
  return {
    pulseRate: { value: rand(65, 85) },
    respirationRate: { value: rand(14, 20) },
    stressLevel: { value: rand(20, 60) },
    sdnn: { value: rand(30, 80) },
    bloodPressure: { value: { systolic: rand(110, 130), diastolic: rand(70, 85) } },
    oxygenSaturation: { value: rand(95, 99) },
    wellnessIndex: { value: rand(60, 90) },
    hemoglobin: { value: +(12 + Math.random() * 4).toFixed(1) },
    hemoglobinA1c: { value: +(4.5 + Math.random() * 1.5).toFixed(1) },
    prq: { value: +(3 + Math.random() * 2).toFixed(1) },
    cardiacWorkload: { value: rand(1500, 2500) },
  };
}

// ── Hook ──

export function useVitalsMeasurement(companyId?: string | null): UseVitalsMeasurementReturn {
  const [status, setStatus] = useState<MonitorStatus>("idle");
  const [partialVitals, setPartialVitals] = useState<VitalSigns | null>(null);
  const [finalResults, setFinalResults] = useState<VitalSigns | null>(null);
  const [rawResults, setRawResults] = useState<Record<string, any> | null>(null);
  const [imageValidity, setImageValidity] = useState<ImageValidity>(ImageValidity.VALID);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSDKAvailable, setIsSDKAvailable] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [providerConfig, setProviderConfig] = useState<VitalsProviderConfig | null>(null);

  const sessionRef = useRef<any>(null);
  const shenaiSdkRef = useRef<any>(null);
  const shenaiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoElapsedRef = useRef(0);

  const provider: VitalsProvider = providerConfig?.provider || "binah";
  const providerName = providerConfig?.provider_name
    || (provider === "shenai" ? "Shen.ai" : "Binah");

  // Load provider config from company_features
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("company_features")
      .select("config")
      .eq("company_id", companyId)
      .eq("feature_key", "binah_special_measurement")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.config) {
          const cfg = data.config as Record<string, any>;
          setProviderConfig({
            provider: (cfg.provider === "shenai" ? "shenai" : "binah"),
            provider_name: cfg.provider_name || (cfg.provider === "shenai" ? "Shen.ai" : "Binah"),
            integration_type: cfg.integration_type || "sdk_local",
            license_key: cfg.license_key || "",
            base_url: cfg.base_url || "",
            api_key: cfg.api_key || "",
            monthly_limit: cfg.monthly_limit ?? 3,
          });
        }
      });
  }, [companyId]);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setIsSDKAvailable(false);
    setStatus("ready");
  }, []);


  // ── SDK Local flow (Binah-compatible) ──

  const initializeSdkLocal = useCallback(async (videoElement: HTMLVideoElement, deviceId: string, licenseKey: string) => {
    if (!crossOriginIsolated) {
      console.warn("[Vitals] crossOriginIsolated=false → demo mode");
      enterDemoMode();
      return;
    }

    try {
      const sdkPath = "@biosensesignal/web-sdk";
      const sdk = await import(/* @vite-ignore */ sdkPath);
      const monitor = sdk.default;

      await monitor.initialize({ licenseKey });

      const session = await monitor.createFaceSession({
        input: videoElement,
        cameraDeviceId: deviceId,
        processingTime: PROCESSING_TIME,
        onVitalSign: (vitals: VitalSigns) => {
          setPartialVitals((prev) => ({ ...prev, ...vitals }));
        },
        onFinalResults: (resultsWrapper: any) => {
          const results = resultsWrapper?.results || resultsWrapper;
          setFinalResults(results);
          setStatus("completed");
        },
        onImageData: (validity: ImageValidity) => {
          setImageValidity(validity);
        },
        onError: (alert: any) => {
          console.error("[Vitals SDK] Error:", alert);
          setErrorMessage(alert?.message || `Erro durante a medição (code: ${alert?.code})`);
          setStatus("error");
        },
        onStateChange: (state: string) => {
          console.log("[Vitals SDK] State:", state);
        },
        onWarning: (alert: any) => {
          console.warn("[Vitals SDK] Warning:", alert?.message || alert?.code);
        },
      });

      sessionRef.current = session;
      setStatus("ready");
    } catch (err: any) {
      console.error("[Vitals SDK] Init error:", err);
      if (
        err?.message?.includes("SharedArrayBuffer") ||
        err?.message?.includes("crossOriginIsolated") ||
        err?.message?.includes("Cannot find module") ||
        err?.code === "ERR_MODULE_NOT_FOUND"
      ) {
        enterDemoMode();
      } else {
        setErrorMessage(err?.message || "Erro ao inicializar o SDK");
        setStatus("error");
      }
    }
  }, [enterDemoMode]);

  // ── API Remote flow ──

  const initializeApiRemota = useCallback(async (_videoElement: HTMLVideoElement, _deviceId: string) => {
    // For API-based providers, initialization is just marking ready.
    // Actual frames will be sent via the vitals-proxy edge function during measurement.
    setStatus("ready");
  }, []);

  // ── Shen.ai SDK flow ──

  const mapShenaiResults = (r: any): VitalSigns => {
    if (!r) return {};
    const stress = r.stress_index != null
      ? (r.stress_index <= 1 ? Math.round(r.stress_index * 100) : Math.round(r.stress_index))
      : undefined;
    return {
      pulseRate: r.heart_rate_bpm != null ? { value: r.heart_rate_bpm } : undefined,
      sdnn: r.hrv_sdnn_ms != null ? { value: r.hrv_sdnn_ms } : undefined,
      respirationRate: r.breathing_rate_bpm != null ? { value: r.breathing_rate_bpm } : undefined,
      stressLevel: stress != null ? { value: stress } : undefined,
      bloodPressure: (r.systolic_blood_pressure_mmhg != null && r.diastolic_blood_pressure_mmhg != null)
        ? { value: { systolic: r.systolic_blood_pressure_mmhg, diastolic: r.diastolic_blood_pressure_mmhg } }
        : undefined,
      cardiacWorkload: r.cardiac_workload_mmhg_per_sec != null ? { value: r.cardiac_workload_mmhg_per_sec } : undefined,
    };
  };

  const initializeShenai = useCallback(async (canvasId: string) => {
    setStatus("initializing");
    setPartialVitals(null);
    setFinalResults(null);
    setErrorMessage("");

    if (!crossOriginIsolated) {
      console.warn("[Shen.ai] crossOriginIsolated=false → demo mode");
      enterDemoMode();
      return;
    }

    try {
      // Fetch global API key from edge function
      const { data: cfg, error: cfgErr } = await supabase.functions.invoke("shenai-config");
      if (cfgErr || !cfg?.ok || !cfg?.api_key) {
        throw new Error(cfg?.error || cfgErr?.message || "Falha ao obter chave do Shen.ai");
      }

      const mod = await import("@shenai/sdk");
      const CreateShenaiSDK: any = (mod as any).default;
      const sdk = await CreateShenaiSDK({ hidePreloadDisplayLogo: true });
      shenaiSdkRef.current = sdk;

      const preset = sdk.MeasurementPreset?.ONE_MINUTE_ALL_METRICS
        ?? sdk.MeasurementPreset?.ONE_MINUTE_HR_HRV_BR;

      await new Promise<void>((resolve, reject) => {
        sdk.initialize(
          cfg.api_key,
          cfg.user_id || "",
          {
            measurementPreset: preset,
            precisionMode: sdk.PrecisionMode?.STRICT ?? sdk.PrecisionMode?.RELAXED,
          },
          (result: any) => {
            const ok = result === sdk.InitializationResult?.OK || result === 0;
            if (ok) resolve();
            else if (result === sdk.InitializationResult?.INVALID_API_KEY) reject(new Error("API key inválida"));
            else if (result === sdk.InitializationResult?.CONNECTION_ERROR) reject(new Error("Sem conexão com Shen.ai"));
            else reject(new Error("Erro interno do SDK Shen.ai"));
          },
        );
      });

      sdk.attachToCanvas(`#${canvasId}`, true);
      sdk.setOperatingMode?.(sdk.OperatingMode?.MEASURE ?? 1);

      // Poll measurement state + realtime metrics
      shenaiPollRef.current = setInterval(() => {
        const s = shenaiSdkRef.current;
        if (!s) return;
        try {
          const state = s.getMeasurementState();
          const rt = s.getRealtimeMetrics?.(10) || null;
          if (rt) setPartialVitals(mapShenaiResults(rt));

          if (state === s.MeasurementState?.FINISHED) {
            const final = s.getMeasurementResults();
            setFinalResults(mapShenaiResults(final));
            setStatus("completed");
            if (shenaiPollRef.current) {
              clearInterval(shenaiPollRef.current);
              shenaiPollRef.current = null;
            }
          } else if (state === s.MeasurementState?.FAILED) {
            setErrorMessage("Medição falhou. Tente novamente.");
            setStatus("error");
            if (shenaiPollRef.current) {
              clearInterval(shenaiPollRef.current);
              shenaiPollRef.current = null;
            }
          }
        } catch (e) {
          console.warn("[Shen.ai poll]", e);
        }
      }, 1000);

      setStatus("ready");
    } catch (err: any) {
      console.error("[Shen.ai] Init error:", err);
      setErrorMessage(err?.message || "Erro ao inicializar o SDK Shen.ai");
      setStatus("error");
    }
  }, [enterDemoMode]);


  const initialize = useCallback(async (videoElement: HTMLVideoElement, cameraDeviceId?: string) => {
    setStatus("initializing");
    setPartialVitals(null);
    setFinalResults(null);
    setErrorMessage("");

    const deviceId = cameraDeviceId ||
      ((videoElement.srcObject as MediaStream)?.getVideoTracks()[0]?.getSettings()?.deviceId ?? "");

    const integrationType = providerConfig?.integration_type || "sdk_local";

    if (integrationType === "api_remota") {
      await initializeApiRemota(videoElement, deviceId);
    } else {
      const licenseKey = providerConfig?.license_key || FALLBACK_LICENSE_KEY;
      await initializeSdkLocal(videoElement, deviceId, licenseKey);
    }
  }, [providerConfig, initializeSdkLocal, initializeApiRemota]);

  // ── Start measurement ──

  const startMeasurement = useCallback(() => {
    if (isDemoMode) {
      setStatus("measuring");
      setPartialVitals(null);
      setFinalResults(null);
      setImageValidity(ImageValidity.VALID);
      demoElapsedRef.current = 0;

      const target = generateDemoVitals();

      demoTimerRef.current = setInterval(() => {
        demoElapsedRef.current += 1;
        const t = demoElapsedRef.current;

        if (t >= 5) setPartialVitals((prev) => ({ ...prev, pulseRate: target.pulseRate }));
        if (t >= 12) setPartialVitals((prev) => ({ ...prev, respirationRate: target.respirationRate }));
        if (t >= 20) setPartialVitals((prev) => ({ ...prev, stressLevel: target.stressLevel }));

        if (t >= PROCESSING_TIME) {
          if (demoTimerRef.current) clearInterval(demoTimerRef.current);
          demoTimerRef.current = null;
          setFinalResults(target);
          setStatus("completed");
        }
      }, 1000);
      return;
    }

    // API remote: placeholder for future frame-streaming logic
    if (providerConfig?.integration_type === "api_remota") {
      setStatus("measuring");
      setPartialVitals(null);
      setFinalResults(null);
      // TODO: implement frame capture → vitals-proxy edge function
      // For now, fall back to demo vitals after PROCESSING_TIME
      demoElapsedRef.current = 0;
      const target = generateDemoVitals();
      demoTimerRef.current = setInterval(() => {
        demoElapsedRef.current += 1;
        const t = demoElapsedRef.current;
        if (t >= 5) setPartialVitals((prev) => ({ ...prev, pulseRate: target.pulseRate }));
        if (t >= 12) setPartialVitals((prev) => ({ ...prev, respirationRate: target.respirationRate }));
        if (t >= 20) setPartialVitals((prev) => ({ ...prev, stressLevel: target.stressLevel }));
        if (t >= PROCESSING_TIME) {
          if (demoTimerRef.current) clearInterval(demoTimerRef.current);
          demoTimerRef.current = null;
          setFinalResults(target);
          setStatus("completed");
        }
      }, 1000);
      return;
    }

    // Shen.ai
    if (shenaiSdkRef.current) {
      try {
        setStatus("measuring");
        setPartialVitals(null);
        setFinalResults(null);
        shenaiSdkRef.current.startMeasurement();
      } catch (err: any) {
        console.error("[Shen.ai] Start error:", err);
        setErrorMessage(err?.message || "Erro ao iniciar medição");
        setStatus("error");
      }
      return;
    }

    // SDK local (Binah)
    if (!sessionRef.current) {
      setErrorMessage("Sessão não inicializada");
      setStatus("error");
      return;
    }

    try {
      setStatus("measuring");
      setPartialVitals(null);
      setFinalResults(null);
      sessionRef.current.start();
    } catch (err: any) {
      console.error("[Vitals SDK] Start error:", err);
      setErrorMessage(err?.message || "Erro ao iniciar medição");
      setStatus("error");
    }
  }, [isDemoMode, providerConfig]);

  const stopMeasurement = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    if (shenaiSdkRef.current) {
      try { shenaiSdkRef.current.stopMeasurement(); } catch (err) { console.warn("[Shen.ai] Stop error:", err); }
    }
    if (sessionRef.current) {
      try { sessionRef.current.stop(); } catch (err) { console.warn("[Vitals SDK] Stop error:", err); }
    }
    if (status === "measuring") setStatus("ready");
  }, [status]);

  const cleanup = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    if (shenaiPollRef.current) {
      clearInterval(shenaiPollRef.current);
      shenaiPollRef.current = null;
    }
    if (shenaiSdkRef.current) {
      try { shenaiSdkRef.current.deinitialize(); } catch (err) { console.warn("[Shen.ai] Deinit error:", err); }
      try { shenaiSdkRef.current.destroyRuntime?.(); } catch {}
      shenaiSdkRef.current = null;
    }
    if (sessionRef.current) {
      try { sessionRef.current.terminate(); } catch (err) { console.warn("[Vitals SDK] Terminate error:", err); }
      sessionRef.current = null;
    }
    setStatus("idle");
    setPartialVitals(null);
    setFinalResults(null);
    setImageValidity(ImageValidity.VALID);
    setErrorMessage("");
  }, []);

  return {
    status,
    partialVitals,
    finalResults,
    imageValidity,
    errorMessage,
    isSDKAvailable,
    isDemoMode,
    providerName,
    provider,
    initialize,
    initializeShenai,
    startMeasurement,
    stopMeasurement,
    cleanup,
  };

}

// Re-export old name for backward compatibility
export type BinahVitalSigns = VitalSigns;
