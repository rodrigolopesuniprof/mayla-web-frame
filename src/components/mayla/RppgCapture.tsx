import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { HelpCircle, X } from "lucide-react";

interface RppgResult {
  heart_rate: number;
  respiratory_rate: number | null;
  stress_level: number | null;
  spo2: number | null;
}

type Phase = "consent" | "capturing" | "processing" | "result" | "error";

interface RppgCaptureProps {
  onClose: () => void;
  onComplete: () => void;
  displayName?: string;
}

const DEFAULT_DURATION = 20;
const DEFAULT_FPS = 6;
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 240;
const JPEG_QUALITY = 0.4;

export function RppgCapture({ onClose, onComplete, displayName }: RppgCaptureProps) {
  const { session } = useAuth();
  const [phase, setPhase] = useState<Phase>("consent");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RppgResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [captureDuration] = useState(DEFAULT_DURATION);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headerTitle = displayName || "Medição de Sinais Vitais";

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (phase === "capturing" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [phase]);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: FRAME_WIDTH, height: FRAME_HEIGHT },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("capturing");
      setElapsed(0);
      framesRef.current = [];

      const fps = DEFAULT_FPS;
      intervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", JPEG_QUALITY);
        framesRef.current.push(dataUrl.split(",")[1]);
      }, 1000 / fps);

      const duration = captureDuration;
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(sec);
        if (sec >= duration) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
          }
          processFrames();
        }
      }, 200);
    } catch (err) {
      console.error("Camera error:", err);
      setErrorMsg("Não foi possível acessar a câmera. Verifique as permissões.");
      setPhase("error");
    }
  };

  const processFrames = async () => {
    setPhase("processing");
    const frames = framesRef.current;

    if (frames.length < 10) {
      setErrorMsg("Poucos quadros foram capturados. Mantenha o rosto visível e a câmera estável durante toda a medição.");
      setPhase("error");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("rppg-proxy", {
        body: { action: "measure", frames, fps: DEFAULT_FPS, duration: captureDuration },
      });

      if (error) throw new Error(error.message);

      if (data?.success && data?.measurement) {
        const m = data.measurement;
        if (!m.heart_rate || m.heart_rate === 0) {
          setErrorMsg("Não foi possível concluir a medição. Para melhores resultados, procure um ambiente com boa iluminação, mantenha o rosto centralizado e a câmera estável. Tente novamente.");
          setPhase("error");
          return;
        }
        setResult(m);
        setPhase("result");
        toast({
          title: "Medição concluída! ✅",
          description: "+50 pontos de saúde",
        });
      } else {
        const errMsg = data?.error || "";
        if (errMsg.toLowerCase().includes("quality") || errMsg.toLowerCase().includes("face")) {
          throw new Error("Não foi possível concluir a medição. Para melhores resultados, procure um ambiente com boa iluminação, mantenha o rosto centralizado e a câmera estável. Tente novamente.");
        }
        throw new Error(errMsg || "Falha ao processar medição");
      }
    } catch (err) {
      console.error("Process error:", err);
      setErrorMsg(
        err instanceof Error ? err.message : "Erro ao processar medição. Tente novamente em um local bem iluminado."
      );
      setPhase("error");
    }
  };

  const handleCancel = () => {
    cleanup();
    onClose();
  };

  const handleDone = () => {
    onComplete();
    onClose();
  };

  const progressPercent = Math.min((elapsed / captureDuration) * 100, 100);

  const resultItems = result
    ? [
        {
          label: "Freq. Cardíaca", value: result.heart_rate, unit: "bpm", emoji: "❤️",
          info: "Quantas vezes o coração bate por minuto.\n\nNormal em repouso: 60–100 bpm.\nAbaixo de 60: pode indicar bradicardia.\nAcima de 100: pode indicar taquicardia.",
        },
        {
          label: "Respiração", value: result.respiratory_rate, unit: "rpm", emoji: "🫁",
          info: "Quantas respirações por minuto.\n\nNormal: 12–20 rpm.\nAbaixo de 12: pode indicar depressão respiratória.\nAcima de 20: pode indicar taquipneia.",
        },
        {
          label: "Estresse", value: result.stress_level, unit: "%", emoji: "😰",
          info: "Índice estimado via variabilidade cardíaca.\n\n0–30%: estresse baixo.\n30–60%: moderado.\n60–100%: elevado — considere técnicas de relaxamento.",
        },
        {
          label: "SpO2", value: result.spo2, unit: "%", emoji: "💧",
          info: "Indica a oxigenação do sangue.\n\nNormal: 95–100%.\nAbaixo de 95%: requer atenção médica.\nAbaixo de 90%: emergência.",
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

      {/* Video card (visible while capturing) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={
          phase === "capturing"
            ? "w-full max-h-[300px] object-cover rounded-2xl mx-auto px-4 shrink-0"
            : "hidden"
        }
        style={phase === "capturing" ? { transform: "scaleX(-1)" } : undefined}
      />
      <canvas ref={canvasRef} width={FRAME_WIDTH} height={FRAME_HEIGHT} className="hidden" />

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="flex flex-col items-center justify-center min-h-full">
          {/* Consent */}
          {phase === "consent" && (
            <div className="text-center space-y-5">
              <div className="text-6xl animate-heartbeat">❤️</div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Medir Sinais Vitais
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vamos usar a câmera frontal para medir seus sinais vitais por{" "}
                <strong>{captureDuration} segundos</strong>. Fique parado, com o rosto bem iluminado.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {["❤️ FC", "🫁 Resp", "😰 Estresse", "💧 SpO2"].map((item, i) => (
                  <div
                    key={i}
                    className="bg-secondary rounded-xl py-2 px-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Duração: ~{captureDuration} segundos · ganhe +50 pontos
              </p>
              <button
                onClick={startCapture}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
                  boxShadow: "0 8px 24px rgba(232,87,74,.3)",
                }}
              >
                Iniciar Medição · +50 pts
              </button>
            </div>
          )}

          {/* Capturing */}
          {phase === "capturing" && (
            <div className="w-full space-y-4 mt-4">
              <div className="text-center py-2 px-4 rounded-xl text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                📷 Capturando vídeo
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Medindo sinais vitais...</span>
                  <span>
                    {elapsed}s / {captureDuration}s
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <p className="text-center text-[11px] text-muted-foreground">
                  {framesRef.current.length} frames capturados
                </p>
              </div>
            </div>
          )}

          {/* Processing */}
          {phase === "processing" && (
            <div className="w-full max-w-xs text-center space-y-4 mt-4">
              <div className="text-4xl animate-pulse">❤️</div>
              <p className="text-sm font-medium text-foreground">Processando medição…</p>
              <Progress value={60} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                Analisando {framesRef.current.length} frames capturados
              </p>
            </div>
          )}

          {/* Result */}
          {phase === "result" && result && (
            <div className="w-full space-y-4 py-2">
              <div className="text-center mb-2">
                <div className="text-4xl mb-2">✅</div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Resultados da Medição
                </h3>
                <p className="text-[12px] text-muted-foreground mt-1">+50 pontos de saúde</p>
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
              <button
                onClick={handleDone}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white mt-2"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
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

      {/* Cancel button during capture/processing */}
      {(phase === "capturing" || phase === "processing") && (
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
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setInfoItem(null)}
        >
          <div
            className="w-full max-w-md bg-background rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{infoItem.emoji}</span>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {infoItem.label}
                </h3>
              </div>
              <button
                onClick={() => setInfoItem(null)}
                className="text-muted-foreground hover:text-foreground active:scale-95"
              >
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
