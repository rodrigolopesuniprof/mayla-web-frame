import { useState, useCallback, useRef } from "react";
import { loadBinahSdk } from "@/lib/binah-loader";

interface VitalSignValue<T = number> {
  value: T;
  confidence?: number;
}

interface BloodPressureValue {
  systolic: number;
  diastolic: number;
}

export interface BinahVitalSigns {
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

export interface UseBinahMonitorReturn {
  status: MonitorStatus;
  partialVitals: BinahVitalSigns | null;
  finalResults: BinahVitalSigns | null;
  imageValidity: ImageValidity;
  errorMessage: string;
  isSDKAvailable: boolean;
  isDemoMode: boolean;
  initialize: (videoElement: HTMLVideoElement, cameraDeviceId?: string) => Promise<void>;
  startMeasurement: () => void;
  stopMeasurement: () => void;
  cleanup: () => void;
}

const BINAH_LICENSE_KEY = "9FE0E4-F8E4ED-48B396-2CF86D-322751-1B04DE";
const PROCESSING_TIME = 60;

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function generateDemoVitals(): BinahVitalSigns {
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

export function useBinahMonitor(): UseBinahMonitorReturn {
  const [status, setStatus] = useState<MonitorStatus>("idle");
  const [partialVitals, setPartialVitals] = useState<BinahVitalSigns | null>(null);
  const [finalResults, setFinalResults] = useState<BinahVitalSigns | null>(null);
  const [imageValidity, setImageValidity] = useState<ImageValidity>(ImageValidity.VALID);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSDKAvailable, setIsSDKAvailable] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const sessionRef = useRef<any>(null);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoElapsedRef = useRef(0);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setIsSDKAvailable(false);
    setStatus("ready");
  }, []);

  const initialize = useCallback(async (videoElement: HTMLVideoElement, cameraDeviceId?: string) => {
    setStatus("initializing");
    setPartialVitals(null);
    setFinalResults(null);
    setErrorMessage("");

    // Check crossOriginIsolated — required for SharedArrayBuffer
    if (!crossOriginIsolated) {
      console.warn("[Binah] crossOriginIsolated=false → demo mode. Verifique se o Nginx tem os headers COOP/COEP configurados:\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp");
      enterDemoMode();
      return;
    }

    // Resolve cameraDeviceId from stream if not provided
    const deviceId = cameraDeviceId ||
      ((videoElement.srcObject as MediaStream)?.getVideoTracks()[0]?.getSettings()?.deviceId ?? "");
    console.log("[Binah] Using deviceId:", deviceId || "(empty)");

    try {
      const monitor = await loadBinahSdk();
      console.log("[Binah] SDK loaded successfully");


      await monitor.initialize({ licenseKey: BINAH_LICENSE_KEY });
      console.log("[Binah] SDK initialized with license key");

      const session = await monitor.createFaceSession({
        input: videoElement,
        cameraDeviceId: deviceId,
        processingTime: PROCESSING_TIME,
        onVitalSign: (vitals: BinahVitalSigns) => {
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
          console.error("[Binah SDK] Error:", alert);
          setErrorMessage(alert?.message || `Erro durante a medição (code: ${alert?.code})`);
          setStatus("error");
        },
        onStateChange: (state: string) => {
          console.log("[Binah SDK] State:", state);
        },
        onWarning: (alert: any) => {
          console.warn("[Binah SDK] Warning:", alert?.message || alert?.code);
        },
      });

      sessionRef.current = session;
      setStatus("ready");
    } catch (err: any) {
      console.error("[Binah SDK] Init error:", err);

      if (
        err?.message?.includes("SharedArrayBuffer") ||
        err?.message?.includes("crossOriginIsolated") ||
        err?.message?.includes("Cannot find module") ||
        err?.message?.includes("Failed to resolve module") ||
        err?.message?.includes("Falha ao baixar") ||
        err?.code === "ERR_MODULE_NOT_FOUND"
      ) {
        console.warn(`[Binah] Fallback para demo mode. Motivo: ${err?.message}`);
        enterDemoMode();
      } else {
        setErrorMessage(err?.message || "Erro ao inicializar o SDK");
        setStatus("error");
      }
    }
  }, [enterDemoMode]);

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

        if (t >= 5) {
          setPartialVitals((prev) => ({ ...prev, pulseRate: target.pulseRate }));
        }
        if (t >= 12) {
          setPartialVitals((prev) => ({ ...prev, respirationRate: target.respirationRate }));
        }
        if (t >= 20) {
          setPartialVitals((prev) => ({ ...prev, stressLevel: target.stressLevel }));
        }

        if (t >= PROCESSING_TIME) {
          if (demoTimerRef.current) clearInterval(demoTimerRef.current);
          demoTimerRef.current = null;
          setFinalResults(target);
          setStatus("completed");
        }
      }, 1000);

      return;
    }

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
      console.error("[Binah SDK] Start error:", err);
      setErrorMessage(err?.message || "Erro ao iniciar medição");
      setStatus("error");
    }
  }, [isDemoMode]);

  const stopMeasurement = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.stop();
      } catch (err) {
        console.warn("[Binah SDK] Stop error:", err);
      }
    }
    if (status === "measuring") {
      setStatus("ready");
    }
  }, [status]);

  const cleanup = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.terminate();
      } catch (err) {
        console.warn("[Binah SDK] Terminate error:", err);
      }
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
    initialize,
    startMeasurement,
    stopMeasurement,
    cleanup,
  };
}
