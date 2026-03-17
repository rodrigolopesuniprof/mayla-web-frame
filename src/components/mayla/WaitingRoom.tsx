import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Props {
  consultationId: string;
  doctorName: string;
  specialty: string;
  scheduledAt?: string;
  onEnterCall: () => void;
  onBack: () => void;
}

export function WaitingRoom({ consultationId, doctorName, specialty, scheduledAt, onEnterCall, onBack }: Props) {
  const [status, setStatus] = useState("confirmed");
  const [waitSec, setWaitSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wait timer
  useEffect(() => {
    timerRef.current = setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Realtime subscription on consultation status
  useEffect(() => {
    const channel = supabase
      .channel(`waiting-${consultationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "consultations", filter: `id=eq.${consultationId}` },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus) setStatus(newStatus);
          if (newStatus === "in_progress") {
            // Auto-enter call
            onEnterCall();
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

  const now = new Date();
  const scheduled = scheduledAt ? new Date(scheduledAt) : null;
  const joinWindow = scheduled ? new Date(scheduled.getTime() - 15 * 60 * 1000) : null;
  const canJoinNow = !joinWindow || now >= joinWindow;

  return (
    <div className="px-5 pt-8 flex flex-col items-center text-center">
      {/* Pulse animation */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <span className="text-3xl">📹</span>
          </div>
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
      </div>

      <h3 className="font-display text-lg font-semibold text-foreground mb-1">Aguardando profissional</h3>
      <p className="text-sm text-muted-foreground mb-4">
        O profissional será notificado e entrará na sala em breve
      </p>

      {/* Professional info */}
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

      {/* Status + timer */}
      <div className="flex items-center gap-2 mb-6">
        <Badge variant="secondary" className="text-xs">
          {status === "confirmed" ? "⏳ Aguardando" : status === "waiting" ? "🔔 Profissional notificado" : status === "in_progress" ? "✅ Em andamento" : status}
        </Badge>
        <span className="text-xs font-mono text-muted-foreground">⏱ {formatWait(waitSec)}</span>
      </div>

      {/* Enter call button */}
      {canJoinNow ? (
        <button
          onClick={onEnterCall}
          className="w-full max-w-xs py-3.5 rounded-xl border-none text-[14px] font-semibold text-primary-foreground cursor-pointer"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" }}
        >
          📹 Entrar na videochamada
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

      <button
        onClick={onBack}
        className="mt-3 px-6 py-2.5 rounded-xl border border-border bg-transparent text-[13px] font-medium text-muted-foreground cursor-pointer"
      >
        Voltar ao início
      </button>
    </div>
  );
}
