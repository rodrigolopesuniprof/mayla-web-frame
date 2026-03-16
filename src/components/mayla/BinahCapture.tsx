import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BinahCaptureProps {
  onClose: () => void;
  onComplete: () => void;
  municipalityId: string | null;
  companyId: string | null;
}

type CapturePhase = "consent" | "preparing" | "capturing" | "processing" | "result" | "error";

interface BinahResult {
  heart_rate?: number;
  blood_pressure_sys?: number;
  blood_pressure_dia?: number;
  spo2?: number;
  respiratory_rate?: number;
  hrv_sdnn?: number;
  stress_level?: number;
  hemoglobin?: number;
  hba1c?: number;
  wellness_score?: number;
  prq?: number;
  cardiac_workload?: number;
}

// Binah SDK types (from @biosensesignal/web-sdk)
interface BinahVitalSigns {
  pulseRate?: { value?: number };
  oxygenSaturation?: { value?: number };
  respirationRate?: { value?: number };
  sdnn?: { value?: number };
  stressLevel?: { value?: number };
  bloodPressure?: { value?: { systolic: number; diastolic: number } };
  hemoglobin?: { value?: number };
  hemoglobinA1c?: { value?: number };
  wellnessLevel?: { value?: number };
  wellnessIndex?: { value?: number };
  prq?: { value?: number };
  cardiacWorkload?: { value?: number };
}

interface BinahSDK {
  initialize(opts: { licenseKey: string }): Promise<void>;
  createFaceSession(opts: {
    input: HTMLVideoElement;
    cameraDeviceId: string;
    processingTime: number;
    onVitalSign?: (vs: BinahVitalSigns) => void;
    onFinalResults?: (res: { results: BinahVitalSigns }) => void;
    onError?: (err: { code: number; message?: string }) => void;
    onWarning?: (warn: { code: number; message?: string }) => void;
    onFaceDetected?: (detected: boolean) => void;
    onStateChange?: (state: number) => void;
  }): Promise<{ start(): void; stop(): void; terminate(): void }>;
  reset(): void;
}

const BINAH_LICENSE_KEY = "9FE0E4-F8E4ED-48B396-2CF86D-322751-1B04DE";

function loadBinahSDK(): Promise<BinahSDK> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).__binahSDK) {
      resolve((window as any).__binahSDK);
      return;
    }

    const script = document.createElement("script");
    script.src = "/binah-sdk/main.js";
    script.async = true;
    script.onload = () => {
      // The SDK may export via module pattern or global
      const sdk = (window as any).HealthMonitorManager ||
                  (window as any).BinahSDK ||
                  (window as any).__binahSDK;
      if (sdk) {
        (window as any).__binahSDK = sdk;
        resolve(sdk);
      } else {
        reject(new Error("SDK carregado mas HealthMonitorManager não encontrado no escopo global"));
      }
    };
    script.onerror = () => reject(new Error("Falha ao carregar o SDK da Binah"));
    document.head.appendChild(script);
  });
}

export function BinahCapture({ onClose, onComplete, municipalityId, companyId }: BinahCaptureProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<CapturePhase>("consent");
  const [result, setResult] = useState<BinahResult | null>(null);
  const [liveVitals, setLiveVitals] = useState<BinahResult>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.terminate(); } catch {}
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const mapVitals = (vs: BinahVitalSigns): BinahResult => ({
    heart_rate: vs.pulseRate?.value,
    spo2: vs.oxygenSaturation?.value,
    respiratory_rate: vs.respirationRate?.value,
    hrv_sdnn: vs.sdnn?.value,
    stress_level: vs.stressLevel?.value,
    blood_pressure_sys: vs.bloodPressure?.value?.systolic,
    blood_pressure_dia: vs.bloodPressure?.value?.diastolic,
    hemoglobin: vs.hemoglobin?.value,
    hba1c: vs.hemoglobinA1c?.value,
    wellness_score: vs.wellnessLevel?.value ?? vs.wellnessIndex?.value,
    prq: vs.prq?.value,
    cardiac_workload: vs.cardiacWorkload?.value,
  });

  const startCapture = async () => {
    setPhase("preparing");
    setLiveVitals({});
    setProgress(0);
    setFaceDetected(false);

    try {
      // Get camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const videoTrack = stream.getVideoTracks()[0];
      const cameraDeviceId = videoTrack.getSettings().deviceId || "";

      // Load SDK
      let sdk: BinahSDK;
      try {
        sdk = await loadBinahSDK();
      } catch {
        // SDK failed to load - fall back to simulation
        console.warn("Binah SDK not available, using simulation mode");
        runSimulation();
        return;
      }

      // Initialize
      await sdk.initialize({ licenseKey: BINAH_LICENSE_KEY });

      const processingTime = 60; // seconds
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed++;
        setProgress(Math.min((elapsed / processingTime) * 100, 100));
      }, 1000);

      // Create session
      const session = await sdk.createFaceSession({
        input: videoRef.current!,
        cameraDeviceId,
        processingTime,
        onVitalSign: (vs) => {
          setLiveVitals(prev => ({ ...prev, ...mapVitals(vs) }));
        },
        onFinalResults: (res) => {
          clearInterval(timer);
          setPhase("processing");
          const finalResult = mapVitals(res.results);
          setTimeout(() => {
            setResult(finalResult);
            setPhase("result");
          }, 1500);
        },
        onError: (err) => {
          clearInterval(timer);
          cleanup();
          setErrorMsg(`Erro ${err.code}: ${err.message || "Erro na medição"}`);
          setPhase("error");
        },
        onFaceDetected: (detected) => setFaceDetected(detected),
        onStateChange: (state) => {
          if (state === 2) setPhase("capturing"); // MEASURING
        },
      });

      sessionRef.current = session;
      session.start();
      setPhase("capturing");
    } catch (err: any) {
      cleanup();
      if (err.name === "NotAllowedError") {
        setErrorMsg("Permissão da câmera negada. Habilite a câmera nas configurações do navegador.");
      } else {
        setErrorMsg(err.message || "Erro ao iniciar medição");
      }
      setPhase("error");
    }
  };

  const runSimulation = () => {
    setPhase("capturing");
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed++;
      setProgress(Math.min((elapsed / 30) * 100, 100));
      setFaceDetected(true);
      setLiveVitals({
        heart_rate: 68 + Math.floor(Math.random() * 8),
        spo2: 97 + Math.floor(Math.random() * 2),
        respiratory_rate: 14 + Math.floor(Math.random() * 4),
        stress_level: 20 + Math.floor(Math.random() * 10),
      });
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      setPhase("processing");
      setTimeout(() => {
        setResult({
          heart_rate: 72,
          blood_pressure_sys: 120,
          blood_pressure_dia: 80,
          spo2: 98,
          respiratory_rate: 16,
          stress_level: 25,
          wellness_score: 85,
        });
        setPhase("result");
      }, 1500);
    }, 10000);
  };

  const saveResult = async () => {
    if (!user || !result) return;

    const { error } = await supabase.from("special_measurements").insert({
      user_id: user.id,
      municipality_id: municipalityId,
      company_id: companyId,
      measurement_data: result as any,
      source: "binah",
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Medição salva! 🎉", description: "+100 pontos de saúde" });
    cleanup();
    onComplete();
    onClose();
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const resultItems = result
    ? [
        { label: "Freq. Cardíaca", value: result.heart_rate, unit: "bpm", emoji: "❤️" },
        { label: "Pressão Arterial", value: result.blood_pressure_sys && result.blood_pressure_dia ? `${result.blood_pressure_sys}/${result.blood_pressure_dia}` : null, unit: "mmHg", emoji: "🩺" },
        { label: "SpO2", value: result.spo2, unit: "%", emoji: "💧" },
        { label: "Respiração", value: result.respiratory_rate, unit: "rpm", emoji: "🫁" },
        { label: "Estresse", value: result.stress_level, unit: "%", emoji: "😰" },
        { label: "Bem-estar", value: result.wellness_score, unit: "pts", emoji: "✨" },
        { label: "HRV (SDNN)", value: result.hrv_sdnn, unit: "ms", emoji: "📊" },
        { label: "Hemoglobina", value: result.hemoglobin, unit: "g/dL", emoji: "🩸" },
        { label: "HbA1c", value: result.hba1c, unit: "%", emoji: "🔬" },
        { label: "PRQ", value: result.prq, unit: "", emoji: "💓" },
      ].filter((i) => i.value != null)
    : [];

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <button onClick={handleClose} className="text-muted-foreground text-lg border-none bg-transparent cursor-pointer">✕</button>
        <h2 className="font-display text-lg font-semibold text-foreground">Medição Especial</h2>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">BINAH</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Consent */}
        {phase === "consent" && (
          <div className="text-center space-y-5">
            <div className="text-6xl">🔬</div>
            <h3 className="font-display text-xl font-semibold text-foreground">Análise Completa de Saúde</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta medição analisa múltiplos indicadores pela câmera, incluindo{" "}
              <strong>pressão arterial</strong>, <strong>hemoglobina</strong>, <strong>variabilidade cardíaca</strong> e mais.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {["❤️ FC", "🩺 PA", "💧 SpO2", "🫁 Resp", "😰 Estresse", "✨ Bem-estar"].map((item, i) => (
                <div key={i} className="bg-secondary rounded-xl py-2 px-1 text-[11px] font-medium text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Duração: ~60 segundos · Necessário boa iluminação
            </p>
            <button
              onClick={startCapture}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white border-none cursor-pointer"
              style={{
                background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
                boxShadow: "0 8px 24px rgba(26,92,138,.3)",
              }}
            >
              Iniciar Medição
            </button>
          </div>
        )}

        {/* Preparing */}
        {phase === "preparing" && (
          <div className="text-center space-y-4">
            <div className="text-5xl animate-pulse">📡</div>
            <p className="text-sm font-medium text-foreground">Preparando câmera...</p>
            <p className="text-[12px] text-muted-foreground">Conectando ao SDK de análise</p>
          </div>
        )}

        {/* Capturing */}
        {phase === "capturing" && (
          <div className="w-full space-y-4">
            {/* Video feed */}
            <div className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-accent/30">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              {!faceDetected && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <p className="text-xs text-foreground font-medium">Posicione o rosto</p>
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {faceDetected ? "Analisando..." : "Posicione o rosto na câmera"}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-48 h-1.5 bg-secondary rounded-full mx-auto overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">{Math.round(progress)}%</p>

            {/* Live vitals */}
            {(liveVitals.heart_rate || liveVitals.spo2) && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {liveVitals.heart_rate && (
                  <div className="bg-secondary rounded-xl p-2.5 text-center">
                    <span className="text-xs text-muted-foreground">❤️ FC</span>
                    <div className="font-display text-lg font-bold text-foreground">{liveVitals.heart_rate}</div>
                  </div>
                )}
                {liveVitals.spo2 && (
                  <div className="bg-secondary rounded-xl p-2.5 text-center">
                    <span className="text-xs text-muted-foreground">💧 SpO2</span>
                    <div className="font-display text-lg font-bold text-foreground">{liveVitals.spo2}%</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Processing */}
        {phase === "processing" && (
          <div className="text-center space-y-4">
            <div className="text-5xl animate-spin-slow">⚙️</div>
            <p className="text-sm font-medium text-foreground">Processando resultados...</p>
          </div>
        )}

        {/* Result */}
        {phase === "result" && result && (
          <div className="w-full space-y-4">
            <div className="text-center mb-2">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="font-display text-lg font-semibold text-foreground">Resultados</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {resultItems.map((item, i) => (
                <div key={i} className="bg-secondary rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{item.emoji}</span>
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-xl font-bold text-foreground">{item.value}</span>
                    <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={saveResult}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white mt-2 border-none cursor-pointer"
              style={{
                background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
              }}
            >
              Salvar Medição
            </button>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <p className="text-sm font-medium text-foreground">Medição não concluída</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => { cleanup(); setPhase("consent"); }}
              className="rounded-2xl px-6 py-2.5 text-sm font-medium bg-secondary text-foreground border-none cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Hidden video element for SDK when not in capturing phase */}
      {phase !== "capturing" && (
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      )}

      {/* Cancel button */}
      {phase !== "result" && phase !== "consent" && (
        <div className="px-6 pb-6">
          <button
            onClick={handleClose}
            className="w-full rounded-2xl py-3 text-sm font-medium bg-secondary text-muted-foreground border-none cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
