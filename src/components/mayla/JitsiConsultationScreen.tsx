import { useState, useEffect, useRef, useCallback } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ConsultationInfo {
  id: string;
  professionalName: string;
  professionalType: string;
  specialty: string;
  consultationMode: string;
  scheduledAt?: string;
}

interface Props {
  consultation: ConsultationInfo;
  onLeave: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando", color: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmada", color: "bg-blue-100 text-blue-800" },
  waiting: { label: "Na fila", color: "bg-purple-100 text-purple-800" },
  in_progress: { label: "Em andamento", color: "bg-emerald-100 text-emerald-800" },
  finished: { label: "Finalizada", color: "bg-muted text-muted-foreground" },
  completed: { label: "Finalizada", color: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800" },
  missed: { label: "Não compareceu", color: "bg-red-100 text-red-800" },
};

export function JitsiConsultationScreen({ consultation, onLeave }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState("waiting");
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedAtRef = useRef<string | null>(null);

  const roomName = `mayla-consulta-${consultation.id}`;
  const displayName = user?.user_metadata?.full_name || user?.email || "Paciente";
  const userEmail = user?.email || "";

  // Record patient joined
  useEffect(() => {
    const now = new Date().toISOString();
    joinedAtRef.current = now;

    supabase
      .from("consultations")
      .update({ status: "waiting" as any, join_window_starts_at: now })
      .eq("id", consultation.id)
      .then();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [consultation.id]);

  // Subscribe to consultation status changes
  useEffect(() => {
    const channel = supabase
      .channel(`consultation-${consultation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "consultations",
          filter: `id=eq.${consultation.id}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus) setStatus(newStatus);
          if (newStatus === "in_progress" && !startedAt) {
            const now = new Date();
            setStartedAt(now);
            startTimer();
          }
          if (newStatus === "completed" || newStatus === "cancelled") {
            stopTimer();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [consultation.id, startedAt]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleApiReady = (api: any) => {
    // When the call actually starts (someone joins)
    api.addEventListener("participantJoined", () => {
      if (!startedAt) {
        const now = new Date();
        setStartedAt(now);
        setStatus("in_progress");
        startTimer();

        supabase
          .from("consultations")
          .update({
            status: "in_progress" as any,
            started_at: now.toISOString(),
          })
          .eq("id", consultation.id)
          .then();
      }
    });

    api.addEventListener("readyToClose", () => {
      handleLeave();
    });
  };

  const handleLeave = async () => {
    stopTimer();
    const now = new Date();

    await supabase
      .from("consultations")
      .update({
        status: "finished" as any,
        ended_at: now.toISOString(),
        call_duration_seconds: elapsed,
      })
      .eq("id", consultation.id);

    onLeave();
  };

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.pending;


  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
              {consultation.professionalType === "nurse" ? "👩‍⚕️" : "🩺"}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">
                {consultation.professionalName}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {consultation.specialty}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLeave}
            className="text-[11px] shrink-0"
          >
            Sair da chamada
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${statusInfo.color}`}>
            {statusInfo.label}
          </Badge>
          {(status === "in_progress" || elapsed > 0) && (
            <span className="text-[11px] font-mono text-muted-foreground">
              ⏱ {formatTime(elapsed)}
            </span>
          )}
        </div>
      </div>

      {/* Jitsi Meeting */}
      <div className="flex-1 relative">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={roomName}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: true,
            enableEmailInProfile: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            toolbarButtons: [
              "microphone",
              "camera",
              "closedcaptions",
              "desktop",
              "fullscreen",
              "hangup",
              "chat",
              "settings",
              "tileview",
            ],
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: "#1a1a2e",
          }}
          userInfo={{
            displayName,
            email: userEmail,
          }}
          onApiReady={handleApiReady}
          getIFrameRef={(iframeRef) => {
            if (iframeRef) {
              iframeRef.style.height = "100%";
              iframeRef.style.width = "100%";
              iframeRef.style.border = "none";
            }
          }}
        />
      </div>
    </div>
  );
}
