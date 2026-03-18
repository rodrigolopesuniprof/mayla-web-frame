import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
}

const DEFAULT_DURATION = 20;
const DEFAULT_FPS = 6;
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 240;
const JPEG_QUALITY = 0.4;

export function RppgCapture({ onClose, onComplete }: RppgCaptureProps) {
  const { session } = useAuth();
  const [phase, setPhase] = useState<Phase>("consent");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RppgResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [captureDuration, setCaptureDuration] = useState(DEFAULT_DURATION);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Attach stream to video element when phase changes to capturing
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

      // Set phase first so the video element renders, then useEffect attaches stream
      setPhase("capturing");
      setElapsed(0);
      framesRef.current = [];

      const fps = DEFAULT_FPS;

      // Capture frames
      intervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", JPEG_QUALITY);
        const base64 = dataUrl.split(",")[1];
        framesRef.current.push(base64);
      }, 1000 / fps);

      // Timer
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
        // Check if measurement quality is too low (heart_rate = 0 or missing)
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

  const handleDone = () => {
    onComplete();
    onClose();
  };

  const isCapturing = phase === "capturing";
  const progress = Math.min((elapsed / captureDuration) * 100, 100);

  return (
    <div className="flex-1 flex flex-col">
      {/* Always-rendered video & canvas (hidden when not capturing) */}
      <video
        ref={videoRef}
        className={isCapturing ? "absolute inset-0 w-full h-full object-cover" : "hidden"}
        playsInline
        muted
        autoPlay
        style={isCapturing ? { transform: "scaleX(-1)" } : undefined}
      />
      <canvas
        ref={canvasRef}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        className="hidden"
      />

      {phase === "consent" && (
        <ConsentScreen
          duration={captureDuration}
          onStart={startCapture}
          onClose={onClose}
        />
      )}

      {phase === "capturing" && (
        <CapturingOverlay
          elapsed={elapsed}
          duration={captureDuration}
          progress={progress}
          frameCount={framesRef.current.length}
        />
      )}

      {phase === "processing" && (
        <ProcessingScreen frameCount={framesRef.current.length} />
      )}

      {phase === "error" && (
        <ErrorScreen
          errorMsg={errorMsg}
          onClose={onClose}
          onRetry={() => {
            cleanup();
            setPhase("consent");
          }}
        />
      )}

      {phase === "result" && (
        <ResultScreen result={result} onDone={handleDone} />
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function ConsentScreen({
  duration,
  onStart,
  onClose,
}: {
  duration: number;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col animate-fade-up">
      <div className="px-[22px] py-3 flex items-center gap-3 border-b border-border shrink-0">
        <button
          onClick={onClose}
          className="bg-secondary border-none rounded-xl px-3 py-1.5 text-secondary-foreground text-[13px] font-medium cursor-pointer"
        >
          ← Voltar
        </button>
        <span className="font-display text-base font-medium text-foreground">
          Medição rPPG
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="text-7xl animate-heartbeat">❤️</div>
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            Medir Sinais Vitais
          </h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Vamos usar a câmera frontal para medir seus sinais vitais por{" "}
            <strong>{duration} segundos</strong>. Fique parado, com o rosto bem
            iluminado.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {[
            { emoji: "❤️", label: "Freq. Cardíaca" },
            { emoji: "🫁", label: "Respiração" },
            { emoji: "😰", label: "Estresse" },
            { emoji: "💧", label: "SpO2" },
          ].map((item, i) => (
            <div key={i} className="bg-secondary rounded-2xl p-3 text-center">
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-[11px] text-muted-foreground">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="w-full max-w-xs py-3.5 rounded-2xl text-[15px] font-semibold border-none cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(232,87,74,.3)",
          }}
        >
          📸 Iniciar Medição
        </button>

        <p className="text-[10px] text-muted-foreground">
          A câmera só será usada durante a medição
        </p>
      </div>
    </div>
  );
}

function CapturingOverlay({
  elapsed,
  duration,
  progress,
  frameCount,
}: {
  elapsed: number;
  duration: number;
  progress: number;
  frameCount: number;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between py-8 z-10 bg-black/0">
      <div className="text-center">
        <div
          className="px-4 py-2 rounded-2xl text-sm font-medium"
          style={{ background: "rgba(0,0,0,.5)", color: "#fff" }}
        >
          Fique parado · Rosto iluminado
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div
          className="w-48 h-64 rounded-[50%] border-[3px]"
          style={{
            borderColor: "rgba(232,87,74,.7)",
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,.3), inset 0 0 40px rgba(232,87,74,.1)",
          }}
        />
        <div
          className="px-4 py-1.5 rounded-xl text-[11px] font-medium text-center"
          style={{ background: "rgba(0,0,0,.5)", color: "rgba(255,255,255,.85)" }}
        >
          Centralize seu rosto para um resultado mais preciso
        </div>
      </div>

      <div className="w-full px-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xl" style={{ color: "#fff" }}>
            ❤️
          </span>
          <span
            className="text-2xl font-display font-bold"
            style={{ color: "#fff" }}
          >
            {duration - elapsed}s
          </span>
          <span className="text-xl animate-heartbeat">💓</span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,.2)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
            }}
          />
        </div>
        <p
          className="text-center text-[11px] mt-2"
          style={{ color: "rgba(255,255,255,.7)" }}
        >
          {frameCount} frames capturados
        </p>
      </div>
    </div>
  );
}

function ProcessingScreen({ frameCount }: { frameCount: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
      <div className="text-6xl animate-heartbeat">❤️</div>
      <div className="text-center">
        <h2 className="font-display text-lg font-semibold text-foreground mb-2">
          Processando medição...
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Analisando {frameCount} frames capturados
        </p>
      </div>
      <div className="w-full max-w-xs">
        <div className="h-2 rounded-full overflow-hidden bg-secondary">
          <div
            className="h-full rounded-full animate-pulse"
            style={{
              width: "60%",
              background:
                "linear-gradient(90deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({
  errorMsg,
  onClose,
  onRetry,
}: {
  errorMsg: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
      <div className="text-6xl">😔</div>
      <div className="text-center">
        <h2 className="font-display text-lg font-semibold text-foreground mb-2">
          Erro na medição
        </h2>
        <p className="text-[13px] text-muted-foreground">{errorMsg}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-[13px] font-medium bg-secondary text-secondary-foreground border-none cursor-pointer"
        >
          Voltar
        </button>
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl text-[13px] font-medium border-none cursor-pointer"
          style={{ background: "hsl(var(--mayla-rose))", color: "#fff" }}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function ResultScreen({
  result,
  onDone,
}: {
  result: RppgResult | null;
  onDone: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col animate-fade-up overflow-y-auto pb-6">
      <div className="px-[22px] py-3 flex items-center gap-3 border-b border-border shrink-0">
        <button
          onClick={onDone}
          className="bg-secondary border-none rounded-xl px-3 py-1.5 text-secondary-foreground text-[13px] font-medium cursor-pointer"
        >
          ← Voltar
        </button>
        <span className="font-display text-base font-medium text-foreground">
          Resultado
        </span>
      </div>

      <div className="px-[22px] pt-6 pb-4 text-center">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-1">
          Medição concluída!
        </h2>
        <p className="text-[13px] text-muted-foreground">+50 pontos de saúde</p>
      </div>

      <div className="px-[22px] grid grid-cols-2 gap-3">
        {result && (
          <>
            <ResultCard
              emoji="❤️"
              label="Freq. Cardíaca"
              value={result.heart_rate}
              unit="bpm"
              color="hsl(var(--mayla-rose))"
            />
            <ResultCard
              emoji="🫁"
              label="Respiração"
              value={result.respiratory_rate}
              unit="rpm"
              color="hsl(var(--mayla-teal))"
            />
            <ResultCard
              emoji="😰"
              label="Estresse"
              value={result.stress_level}
              unit="%"
              color="hsl(var(--mayla-amber))"
            />
            <ResultCard
              emoji="💧"
              label="SpO2"
              value={result.spo2}
              unit="%"
              color="hsl(var(--mayla-pref))"
            />
          </>
        )}
      </div>

      <div className="px-[22px] mt-6">
        <button
          onClick={onDone}
          className="w-full py-3.5 rounded-2xl text-[15px] font-semibold border-none cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
            color: "#fff",
          }}
        >
          Ver histórico completo
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  emoji,
  label,
  value,
  unit,
  color,
}: {
  emoji: string;
  label: string;
  value: number | null;
  unit: string;
  color: string;
}) {
  return (
    <div className="bg-secondary rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-3xl font-bold" style={{ color }}>
          {value ?? "—"}
        </span>
        <span className="text-[11px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
