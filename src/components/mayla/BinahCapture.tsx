import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useVitalsMeasurement, ImageValidity, type VitalSigns } from "@/hooks/useVitalsMeasurement";
import { useVisibleIndicators, flattenMeasurementPayload, categoryLabel } from "@/hooks/useVisibleIndicators";
import { Progress } from "@/components/ui/progress";
import { HelpCircle, X, MonitorOff } from "lucide-react";

interface BinahCaptureProps {
  onClose: () => void;
  onComplete: () => void;
  municipalityId: string | null;
  companyId?: string | null;
  /** Force a specific provider. When omitted, falls back to company_features lookup (legacy). */
  providerOverride?: "binah" | "shenai";
  /** Whitelabel title shown in the header (replaces brand name). */
  displayName?: string;
  /** Logical source identifier saved with the measurement (e.g. vitals_premium_binah). */
  sourceKey?: string;
  /** When the environment doesn't support the advanced analysis, offer a fallback to basic rPPG. */
  onFallbackToBasic?: () => void;
}

type CapturePhase = "consent" | "camera" | "ready" | "measuring" | "result" | "error" | "unsupported";

interface MappedResult {
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

function mapVitalsToResult(vitals: VitalSigns): MappedResult {
  return {
    heart_rate: vitals.pulseRate?.value,
    respiratory_rate: vitals.respirationRate?.value,
    stress_level: vitals.stressLevel?.value,
    hrv_sdnn: vitals.sdnn?.value,
    blood_pressure_sys: vitals.bloodPressure?.value?.systolic,
    blood_pressure_dia: vitals.bloodPressure?.value?.diastolic,
    spo2: vitals.oxygenSaturation?.value,
    wellness_score: vitals.wellnessIndex?.value,
    hemoglobin: vitals.hemoglobin?.value,
    hba1c: vitals.hemoglobinA1c?.value,
    prq: vitals.prq?.value,
    cardiac_workload: vitals.cardiacWorkload?.value,
  };
}

const VALIDITY_MESSAGES: Record<number, { text: string; emoji: string }> = {
  [ImageValidity.VALID]: { text: "Rosto detectado ✓", emoji: "✅" },
  [ImageValidity.FACE_ORIENTATION]: { text: "Olhe para a câmera", emoji: "👀" },
  [ImageValidity.INVALID_ROI]: { text: "Centralize o rosto", emoji: "🎯" },
  [ImageValidity.TILTED_HEAD]: { text: "Mantenha a cabeça reta", emoji: "↕️" },
  [ImageValidity.FACE_TOO_FAR]: { text: "Aproxime o rosto", emoji: "🔍" },
  [ImageValidity.FACE_TOO_CLOSE]: { text: "Afaste o rosto", emoji: "↔️" },
  [ImageValidity.UNEVEN_LIGHT]: { text: "Melhore a iluminação", emoji: "💡" },
};

const PROCESSING_TIME = 60;

export function BinahCapture({ onClose, onComplete, municipalityId, companyId, providerOverride, displayName, sourceKey, onFallbackToBasic }: BinahCaptureProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<CapturePhase>("consent");
  const [elapsed, setElapsed] = useState(0);
  const [mappedResult, setMappedResult] = useState<MappedResult | null>(null);

  const {
    status,
    partialVitals,
    finalResults,
    rawResults,
    imageValidity,
    errorMessage,
    isDemoMode,
    provider,
    wasmProgress,
    initialize,
    initializeShenai,
    startMeasurement,
    stopMeasurement,
    cleanup,
  } = useVitalsMeasurement(companyId, providerOverride);

  const isShenai = provider === "shenai";
  const canvasId = "shenai-canvas";
  const headerTitle = displayName || "Análise de Saúde";



  // Map final results when completed
  useEffect(() => {
    if (status === "completed" && finalResults) {
      setMappedResult(mapVitalsToResult(finalResults));
      setPhase("result");
      stopTimer();
      stopCamera();
    }
  }, [status, finalResults]);

  // Handle SDK errors / unsupported environment
  useEffect(() => {
    if (status === "error") {
      setPhase("error");
      stopTimer();
    } else if (status === "unsupported") {
      setPhase("unsupported");
      stopTimer();
    }
  }, [status]);

  // For the advanced provider, surface a ready phase so the user clicks Start themselves.
  // For the basic flow we keep the legacy auto-start behaviour.
  useEffect(() => {
    if (status === "ready" && phase === "camera") {
      if (isShenai) {
        setPhase("ready");
      } else {
        handleStartMeasurement();
      }
    }
  }, [status, phase, isShenai]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopCamera();
      cleanup();
    };
  }, [cleanup]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const openCamera = useCallback(async () => {
    setPhase("camera");

    // Shen.ai: SDK manages its own camera; just attach to canvas
    if (isShenai) {
      try {
        // Fetch demographics so Shen.ai can compute clinical metrics (BP, risks, etc.)
        let userProfile: { age?: number; gender?: "male" | "female" | "other"; height?: number; weight?: number } | undefined;
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("birth_date, biological_sex")
            .eq("user_id", user.id)
            .maybeSingle();
          if (prof) {
            const up: any = {};
            if (prof.birth_date) {
              const dob = new Date(prof.birth_date);
              const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
              if (age > 0 && age < 120) up.age = age;
            }
            const s = (prof.biological_sex || "").toLowerCase();
            if (s.startsWith("m")) up.gender = "male";
            else if (s.startsWith("f")) up.gender = "female";
            else if (s) up.gender = "other";
            if (Object.keys(up).length) userProfile = up;
          }
        }
        await initializeShenai(canvasId, userProfile);
      } catch (err: any) {
        console.error("[Vitals] init error:", err);
        setPhase("error");
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const deviceId = stream.getVideoTracks()[0]?.getSettings()?.deviceId || "";
        await initialize(videoRef.current, deviceId);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setPhase("error");
    }
  }, [initialize, initializeShenai, isShenai, user]);


  const handleStartMeasurement = async () => {
    setPhase("measuring");
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= PROCESSING_TIME) {
          stopTimer();
          return PROCESSING_TIME;
        }
        return prev + 1;
      });
    }, 1000);

    await startMeasurement();
  };

  const handleCancel = () => {
    stopMeasurement();
    stopTimer();
    stopCamera();
    cleanup();
    onClose();
  };

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveResult = async () => {
    if (!user || !mappedResult || saving || saved) return;
    setSaving(true);

    // Persist FULL raw payload when available (Shen.ai), else mapped fields.
    const fullPayload = rawResults?.payload
      ? { ...rawResults.payload, _mapped: mappedResult, _provider: rawResults.provider }
      : mappedResult;

    const { error } = await supabase.from("special_measurements").insert({
      user_id: user.id,
      municipality_id: municipalityId,
      company_id: companyId || null,
      measurement_data: fullPayload as any,
      source: isDemoMode ? "vitals_demo" : (rawResults?.provider === "shenai" ? "shenai" : "vitals_premium"),
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Also save to health_measurements for unified history & scoring
    await supabase.from("health_measurements").insert({
      user_id: user.id,
      measurement_type: isDemoMode ? "vitals_demo" : "vitals_premium",
      heart_rate: mappedResult.heart_rate ? Math.round(mappedResult.heart_rate) : null,
      respiratory_rate: mappedResult.respiratory_rate ? Math.round(mappedResult.respiratory_rate) : null,
      stress_level: mappedResult.stress_level ? Math.round(mappedResult.stress_level) : null,
      spo2: mappedResult.spo2 ?? null,
      blood_pressure_sys: mappedResult.blood_pressure_sys ? Math.round(mappedResult.blood_pressure_sys) : null,
      blood_pressure_dia: mappedResult.blood_pressure_dia ? Math.round(mappedResult.blood_pressure_dia) : null,
      hrv: mappedResult.hrv_sdnn ? Math.round(mappedResult.hrv_sdnn) : null,
      source: isDemoMode ? "vitals_demo" : "vitals_premium",
      notes: `Medição: ${headerTitle}`,
    });

    // Award points via centralized engine
    let awarded = 0;
    let capReached = false;
    try {
      const { data: res } = await supabase.rpc("award_event" as any, {
        _user_id: user.id,
        _event_key: "vitals_measurement",
        _description: "Medição especial Vitals",
      });
      const r: any = res || {};
      if (r.ok) awarded = r.points || 0;
      else if (r.reason === "cap_reached") capReached = true;
    } catch {}

    // Trigger health score calculation
    try {
      await supabase.functions.invoke("calculate-health-scores", {
        body: { user_id: user.id, days: 7 },
      });
    } catch {}

    setSaving(false);
    setSaved(true);
    toast({
      title: "Medição especial salva! 🎉",
      description: capReached
        ? "Limite semanal de pontos atingido."
        : awarded > 0 ? `+${awarded} pontos de saúde` : "Salvo com sucesso",
    });
    onComplete();
  };

  const validityInfo = VALIDITY_MESSAGES[imageValidity] || VALIDITY_MESSAGES[ImageValidity.VALID];
  const partialMapped = partialVitals ? mapVitalsToResult(partialVitals) : null;
  const progressPercent = Math.min((elapsed / PROCESSING_TIME) * 100, 100);

  const resultItems = mappedResult
    ? [
        {
          label: "Freq. Cardíaca", value: mappedResult.heart_rate, unit: "bpm", emoji: "❤️",
          info: "Quantas vezes o coração bate por minuto.\n\nNormal em repouso: 60–100 bpm.\nAbaixo de 60: pode indicar bradicardia.\nAcima de 100: pode indicar taquicardia.",
        },
        {
          label: "Pressão Arterial",
          value: mappedResult.blood_pressure_sys && mappedResult.blood_pressure_dia
            ? `${mappedResult.blood_pressure_sys}/${mappedResult.blood_pressure_dia}` : null,
          unit: "mmHg", emoji: "🩺",
          info: "Mede a força do sangue nas artérias.\n\nIdeal: abaixo de 120/80 mmHg.\n120–139/80–89: pré-hipertensão.\n≥140/90: hipertensão.",
        },
        {
          label: "SpO2", value: mappedResult.spo2, unit: "%", emoji: "💧",
          info: "Indica a oxigenação do sangue.\n\nNormal: 95–100%.\nAbaixo de 95%: requer atenção médica.\nAbaixo de 90%: emergência.",
        },
        {
          label: "Respiração", value: mappedResult.respiratory_rate, unit: "rpm", emoji: "🫁",
          info: "Quantas respirações por minuto.\n\nNormal: 12–20 rpm.\nAbaixo de 12: pode indicar depressão respiratória.\nAcima de 20: pode indicar taquipneia.",
        },
        {
          label: "Estresse", value: mappedResult.stress_level, unit: "%", emoji: "😰",
          info: "Índice estimado via variabilidade cardíaca.\n\n0–30%: estresse baixo.\n30–60%: moderado.\n60–100%: elevado — considere técnicas de relaxamento.",
        },
        {
          label: "HRV SDNN", value: mappedResult.hrv_sdnn, unit: "ms", emoji: "📊",
          info: "Variabilidade da frequência cardíaca — mede o equilíbrio do sistema nervoso.\n\n<30 ms: estresse elevado.\n30–50 ms: moderado.\n>50 ms: ótimo — boa capacidade de recuperação.",
        },
        {
          label: "Bem-estar", value: mappedResult.wellness_score, unit: "pts", emoji: "✨",
          info: "Índice composto calculado pelo algoritmo.\n\n70+: bom.\n80+: muito bom.\n90+: excelente.",
        },
        {
          label: "Hemoglobina", value: mappedResult.hemoglobin, unit: "g/dL", emoji: "🩸",
          info: "Proteína que transporta oxigênio no sangue.\n\nHomens: 13.5–17.5 g/dL.\nMulheres: 12.0–16.0 g/dL.\nValores baixos podem indicar anemia.",
        },
        {
          label: "HbA1c", value: mappedResult.hba1c, unit: "%", emoji: "🧬",
          info: "Média da glicose nos últimos 2–3 meses.\n\n<5.7%: normal.\n5.7–6.4%: pré-diabetes.\n≥6.5%: diabetes — procure orientação médica.",
        },
      ].filter((i) => i.value != null)
    : [];

  const [infoItem, setInfoItem] = useState<{ label: string; emoji: string; info: string } | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 shrink-0">
        <button onClick={handleCancel} className="text-muted-foreground text-lg">
          ✕
        </button>
        <h2 className="font-display text-lg font-semibold text-foreground">{headerTitle}</h2>

      </div>

      {/* Video element (Binah) */}
      {!isShenai && (
        <video
          ref={videoRef}
          playsInline
          muted
          className={
            phase === "camera" || phase === "measuring"
              ? "w-full max-h-[300px] object-cover rounded-2xl mx-auto px-4 shrink-0"
              : "hidden"
          }
        />
      )}

      {/* Canvas (advanced provider — UI rendered by us on top) */}
      {isShenai && (
        <canvas
          id={canvasId}
          className={
            phase === "ready" || phase === "measuring"
              ? "w-full max-h-[480px] aspect-[3/4] rounded-2xl mx-auto px-4 shrink-0 bg-black"
              : "hidden"
          }
        />
      )}


      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="flex flex-col items-center justify-center min-h-full">
          {/* Consent */}
          {phase === "consent" && (
            <div className="text-center space-y-5">
              <div className="text-6xl">🔬</div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Análise Completa de Saúde
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Esta medição especial analisa múltiplos indicadores de saúde pela câmera do celular,
                incluindo <strong>pressão arterial</strong>, <strong>hemoglobina</strong>,{" "}
                <strong>variabilidade cardíaca</strong> e mais.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {["❤️ FC", "🩺 PA", "💧 SpO2", "🫁 Resp", "😰 Estresse", "✨ Bem-estar"].map(
                  (item, i) => (
                    <div
                      key={i}
                      className="bg-secondary rounded-xl py-2 px-1 text-[11px] font-medium text-muted-foreground"
                    >
                      {item}
                    </div>
                  )
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Duração: ~60 segundos · Necessário boa iluminação · ganhe +100 pontos
              </p>
              <button
                onClick={openCamera}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
                  boxShadow: "0 8px 24px rgba(26,92,138,.3)",
                }}
              >
                Iniciar Medição Especial · +100 pts
              </button>
            </div>
          )}

          {/* Camera initializing / SDK loading */}
          {phase === "camera" && status !== "ready" && (
            <div className="w-full max-w-xs text-center space-y-4 mt-4">
              <div className="text-4xl animate-pulse">📡</div>
              <p className="text-sm font-medium text-foreground">Carregando análise…</p>
              {isShenai && wasmProgress > 0 && wasmProgress < 100 && (
                <>
                  <Progress value={wasmProgress} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">{wasmProgress}%</p>
                </>
              )}
              {(!isShenai || wasmProgress === 0) && (
                <p className="text-[12px] text-muted-foreground">Preparando a câmera…</p>
              )}
            </div>
          )}

          {/* Ready — user starts measurement themselves (advanced provider, custom UI) */}
          {phase === "ready" && isShenai && (
            <div className="w-full space-y-4 mt-4">
              <div className="bg-secondary/60 rounded-2xl p-4 text-center space-y-2">
                <p className="text-sm font-medium text-foreground">Tudo pronto</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Posicione o rosto na moldura, garanta boa iluminação e fique parado durante ~60 segundos.
                </p>
              </div>
              <button
                onClick={handleStartMeasurement}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
                  boxShadow: "0 8px 24px rgba(26,92,138,.3)",
                }}
              >
                Iniciar medição
              </button>
            </div>
          )}

          {/* Unsupported environment (e.g. preview iframe without crossOriginIsolated) */}
          {phase === "unsupported" && (
            <div className="text-center space-y-5 max-w-sm">
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <MonitorOff className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Análise indisponível neste navegador
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Esta análise avançada precisa de um navegador moderno em janela própria.
                Em janelas incorporadas ou navegadores corporativos antigos ela não funciona.
              </p>
              <div className="space-y-2">
                {onFallbackToBasic && (
                  <button
                    onClick={() => { cleanup(); onFallbackToBasic(); }}
                    className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
                      boxShadow: "0 8px 24px rgba(232,87,74,.3)",
                    }}
                  >
                    Usar Análise Básica
                  </button>
                )}
                <button
                  onClick={() => { cleanup(); onClose(); }}
                  className="w-full rounded-2xl py-3 text-sm font-medium bg-secondary text-foreground"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Measuring */}
          {phase === "measuring" && (
            <div className="w-full space-y-4 mt-4">
              <div
                className={`text-center py-2 px-4 rounded-xl text-sm font-medium ${
                  imageValidity === ImageValidity.VALID
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}
              >
                {validityInfo.emoji} {validityInfo.text}
              </div>


              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Medindo sinais vitais...</span>
                  <span>
                    {elapsed}s / {PROCESSING_TIME}s
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {partialMapped && (
                <div className="grid grid-cols-3 gap-2">
                  {partialMapped.heart_rate && (
                    <div className="bg-secondary rounded-xl p-2.5 text-center">
                      <span className="text-base">❤️</span>
                      <div className="font-display text-lg font-bold text-foreground">
                        {Math.round(partialMapped.heart_rate)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">bpm</span>
                    </div>
                  )}
                  {partialMapped.respiratory_rate && (
                    <div className="bg-secondary rounded-xl p-2.5 text-center">
                      <span className="text-base">🫁</span>
                      <div className="font-display text-lg font-bold text-foreground">
                        {Math.round(partialMapped.respiratory_rate)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">rpm</span>
                    </div>
                  )}
                  {partialMapped.stress_level != null && (
                    <div className="bg-secondary rounded-xl p-2.5 text-center">
                      <span className="text-base">😰</span>
                      <div className="font-display text-lg font-bold text-foreground">
                        {Math.round(partialMapped.stress_level)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {phase === "result" && mappedResult && (
            <div className="w-full space-y-4 py-2">
              <div className="text-center mb-2">
                <div className="text-4xl mb-2">✅</div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Resultados da Medição
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {resultItems.map((item, i) => (
                  <div key={i} className="bg-secondary rounded-2xl p-3.5 relative">
                    <button
                      onClick={() => setInfoItem(item)}
                      className="absolute top-2.5 right-2.5 text-muted-foreground/50 hover:text-foreground transition-colors active:scale-95"
                      aria-label={`Informações sobre ${item.label}`}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{item.emoji}</span>
                      <span className="text-[11px] text-muted-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-xl font-bold text-foreground">
                        {item.value}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {rawResults?.payload && <AdvancedIndicatorsSection payload={rawResults.payload} />}
              <button
                onClick={saveResult}
                disabled={saving || saved}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white mt-2 disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
                }}
              >
                {saved ? "✓ Salvo" : saving ? "Salvando..." : "Salvar Medição"}
              </button>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="text-center space-y-4">
              <div className="text-5xl">⚠️</div>
              <p className="text-sm font-medium text-foreground">Medição não concluída</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {errorMessage || "Erro desconhecido"}
              </p>
              <button
                onClick={() => {
                  cleanup();
                  setPhase("consent");
                }}
                className="rounded-2xl px-6 py-2.5 text-sm font-medium bg-secondary text-foreground"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cancel button during measurement */}
      {(phase === "camera" || phase === "ready" || phase === "measuring") && (
        <div className="px-6 pb-6 shrink-0">
          <button
            onClick={handleCancel}
            className="w-full rounded-2xl py-3 text-sm font-medium bg-secondary text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Info Modal */}
      {infoItem && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={() => setInfoItem(null)}>
          <div
            className="w-full max-w-md bg-background rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{infoItem.emoji}</span>
                <h3 className="font-display text-lg font-semibold text-foreground">{infoItem.label}</h3>
              </div>
              <button onClick={() => setInfoItem(null)} className="text-muted-foreground hover:text-foreground active:scale-95">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {infoItem.info}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdvancedIndicatorsSection({ payload }: { payload: any }) {
  const { visible } = useVisibleIndicators();
  const flat = flattenMeasurementPayload(payload);
  // Show only indicators that are (a) visible per super admin AND (b) not already in the basic grid.
  const basicKeys = new Set([
    "heart_rate_bpm","systolic_blood_pressure_mmhg","diastolic_blood_pressure_mmhg",
    "spo2_percent","breathing_rate_bpm","stress_index","hrv_sdnn_ms","wellness_score","hemoglobin_g_dl","hemoglobin_a1c_percent",
  ]);
  const extras = visible.filter((ind) => !basicKeys.has(ind.key) && flat[ind.key] != null);
  if (extras.length === 0) return null;

  const grouped: Record<string, typeof extras> = {};
  for (const e of extras) (grouped[e.category] = grouped[e.category] || []).push(e);

  return (
    <div className="bg-secondary/40 rounded-2xl p-3 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase">Indicadores avançados</div>
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <div className="text-[10px] uppercase text-muted-foreground/70 mb-1">{categoryLabel(cat)}</div>
          <div className="grid grid-cols-2 gap-2">
            {list.map((ind) => {
              const v = flat[ind.key];
              const display = typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : String(v);
              return (
                <div key={ind.key} className="bg-background/70 rounded-lg p-2">
                  <div className="text-[10px] text-muted-foreground">{ind.label}</div>
                  <div className="text-sm font-semibold text-foreground">
                    {display} {ind.unit && <span className="text-[10px] text-muted-foreground font-normal">{ind.unit}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
