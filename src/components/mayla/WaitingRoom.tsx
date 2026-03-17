import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type WaitingState = "waiting_professional" | "confirmed" | "in_progress" | "completed" | "cancelled";

interface Props {
  consultationId: string;
  doctorName: string;
  specialty: string;
  scheduledAt?: string;
  isOnDemand?: boolean;
  onEnterCall: () => void;
  onBack: () => void;
}

const STATE_CONFIG: Record<WaitingState, { emoji: string; title: string; subtitle: string; color: string }> = {
  waiting_professional: {
    emoji: "⏳",
    title: "Aguardando profissional",
    subtitle: "O profissional foi notificado e entrará na sala em breve",
    color: "bg-blue-100 text-blue-800",
  },
  confirmed: {
    emoji: "✅",
    title: "Consulta confirmada",
    subtitle: "Sua consulta está confirmada. Aguarde o profissional iniciar o atendimento",
    color: "bg-emerald-100 text-emerald-800",
  },
  in_progress: {
    emoji: "📹",
    title: "Consulta em andamento",
    subtitle: "A videochamada está ativa. Entre agora!",
    color: "bg-primary/10 text-primary",
  },
  completed: {
    emoji: "🎉",
    title: "Consulta finalizada",
    subtitle: "Sua consulta foi concluída. Obrigado!",
    color: "bg-muted text-muted-foreground",
  },
  cancelled: {
    emoji: "❌",
    title: "Consulta cancelada",
    subtitle: "Esta consulta foi cancelada.",
    color: "bg-destructive/10 text-destructive",
  },
};

export function WaitingRoom({ consultationId, doctorName, specialty, scheduledAt, isOnDemand, onEnterCall, onBack }: Props) {
  const [state, setState] = useState<WaitingState>(isOnDemand ? "waiting_professional" : "confirmed");
  const [waitSec, setWaitSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wait timer
  useEffect(() => {
    timerRef.current = setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase
        .from("consultations")
        .select("status")
        .eq("id", consultationId)
        .single();
      if (data) {
        const s = data.status as string;
        if (s === "in_progress") {
          setState("in_progress");
          setTimeout(() => onEnterCall(), 1000);
        } else if (s === "completed") {
          setState("completed");
        } else if (s === "cancelled" || s === "no_show") {
          setState("cancelled");
        } else if (s === "confirmed") {
          setState("confirmed");
        } else if (s === "waiting") {
          setState("waiting_professional");
        }
      }
    };
    fetchStatus();
  }, [consultationId]);

  // Realtime subscription on consultation status
  useEffect(() => {
    const channel = supabase
      .channel(`waiting-${consultationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "consultations", filter: `id=eq.${consultationId}` },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus === "waiting") setState("waiting_professional");
          else if (newStatus === "confirmed") setState("confirmed");
          else if (newStatus === "in_progress") {
            setState("in_progress");
            // Auto-enter after brief delay
            setTimeout(() => onEnterCall(), 1500);
          } else if (newStatus === "completed") {
            setState("completed");
          } else if (newStatus === "cancelled" || newStatus === "no_show") {
            setState("cancelled");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [consultationId, onEnterCall]);

  const formatWait = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const scheduled = scheduledAt ? new Date(scheduledAt) : null;
  const joinWindow = scheduled ? new Date(scheduled.getTime() - 15 * 60 * 1000) : null;
  const canJoinNow = !joinWindow || new Date() >= joinWindow;

  const config = STATE_CONFIG[state];
  const isActive = state === "in_progress";
  const isFinished = state === "completed" || state === "cancelled";

  return (
    <div className="px-5 pt-8 flex flex-col items-center text-center">
      {/* Animated indicator */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center ${!isFinished ? "animate-pulse" : ""}`}>
            <span className="text-3xl">{config.emoji}</span>
          </div>
        </div>
        {!isFinished && (
          <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-background animate-pulse ${
            isActive ? "bg-emerald-500" : "bg-blue-500"
          }`} />
        )}
      </div>

      <h3 className="font-display text-lg font-semibold text-foreground mb-1">{config.title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">{config.subtitle}</p>

      {/* Professional info */}
      {doctorName && (
        <div className="bg-secondary rounded-2xl p-4 w-full max-w-xs mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">🩺</div>
            <div className="text-left">
              <p className="text-[13px] font-semibold text-foreground">{doctorName}</p>
              <p className="text-[11px] text-muted-foreground">{specialty}</p>
            </div>
          </div>
          {scheduled && (
            <div className="mt-3 pt-3 border-t border-foreground/10 text-left">
              <p className="text-[11px] text-muted-foreground">
                📅 {scheduled.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status + timer */}
      <div className="flex items-center gap-2 mb-6">
        <Badge className={`text-xs ${config.color}`}>
          {config.emoji} {config.title}
        </Badge>
        {!isFinished && (
          <span className="text-xs font-mono text-muted-foreground">⏱ {formatWait(waitSec)}</span>
        )}
      </div>

      {/* State-specific messages */}
      {state === "waiting_professional" && (
        <div className="w-full max-w-xs mb-4 bg-secondary rounded-xl p-3">
          <p className="text-xs text-foreground">
            🔔 O profissional foi notificado e entrará na sala em breve. Você será conectado automaticamente.
          </p>
        </div>
      )}

      {state === "confirmed" && (
        <div className="w-full max-w-xs mb-4 bg-secondary rounded-xl p-3">
          <p className="text-xs text-foreground">
            ✅ Sua consulta está confirmada. Quando o profissional iniciar o atendimento, você será conectado automaticamente.
          </p>
        </div>
      )}

      {isActive && (
        <div className="w-full max-w-xs mb-4 bg-primary/5 rounded-xl p-3 border border-primary/20">
          <p className="text-xs text-foreground font-medium">
            📹 A videochamada está ativa! Clique abaixo para entrar.
          </p>
        </div>
      )}

      {/* Enter call button */}
      {!isFinished && state !== "waiting_professional" && (
        <>
          {canJoinNow ? (
            <button
              onClick={onEnterCall}
              className={`w-full max-w-xs py-3.5 rounded-xl border-none text-[14px] font-semibold cursor-pointer ${
                isActive ? "text-primary-foreground animate-pulse" : "text-primary-foreground"
              }`}
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" }}
            >
              📹 {isActive ? "Entrar agora na videochamada" : "Entrar na videochamada"}
            </button>
          ) : (
            <div className="w-full max-w-xs">
              <p className="text-xs text-muted-foreground mb-2">
                A sala abrirá 15 minutos antes do horário
              </p>
              <div className="py-3.5 rounded-xl bg-muted text-[14px] font-semibold text-muted-foreground text-center">
                📹 Aguardando horário...
              </div>
            </div>
          )}
        </>
      )}

      {state === "completed" && (
        <div className="w-full max-w-xs bg-secondary rounded-xl p-4 mb-4">
          <p className="text-sm text-foreground font-medium mb-1">Consulta concluída</p>
          <p className="text-xs text-muted-foreground">O registro ficará disponível no seu histórico de saúde.</p>
        </div>
      )}

      <button
        onClick={onBack}
        className="mt-3 px-6 py-2.5 rounded-xl border border-border bg-transparent text-[13px] font-medium text-muted-foreground cursor-pointer"
      >
        {isFinished ? "Voltar ao início" : "Cancelar e voltar"}
      </button>
    </div>
  );
}
