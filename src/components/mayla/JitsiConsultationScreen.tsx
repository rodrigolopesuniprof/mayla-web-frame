import { useState, useEffect, useRef, useCallback } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShareHealthData } from "@/hooks/useShareHealthData";
import { DocumentSender } from "@/components/professional/DocumentSender";
import { proxyCall } from "@/lib/prontuario-helpers";

interface ConsultationInfo {
  id: string;
  roomToken?: string;
  professionalName: string;
  professionalType: string;
  specialty: string;
  consultationMode: string;
  scheduledAt?: string;
}

interface Props {
  consultation: ConsultationInfo;
  onLeave: () => void;
  isProfessional?: boolean;
  patientName?: string;
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

export function JitsiConsultationScreen({ consultation, onLeave, isProfessional, patientName }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState("waiting");
  const { shared, sharing, shareWithProfessional } = useShareHealthData();
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedAtRef = useRef<string | null>(null);
  const [sharedToken, setSharedToken] = useState<string | null>(null);
  const [consultationMeta, setConsultationMeta] = useState<{ professionalId: string; patientUserId: string } | null>(null);

  const roomName = consultation.roomToken ? `mayla-${consultation.roomToken}` : `mayla-consulta-${consultation.id}`;
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

  // Professional: check for shared health data from patient
  useEffect(() => {
    if (!isProfessional) return;

    // Get the consultation's user_id to filter shares correctly
    const setupSharesListener = async () => {
      const { data: consultData } = await supabase
        .from("consultations")
        .select("user_id, professional_id")
        .eq("id", consultation.id)
        .single();

      const patientUserId = consultData?.user_id;
      if (!patientUserId) return;

      setConsultationMeta({ professionalId: consultData.professional_id, patientUserId });

      // Initial check: find valid shares from this patient
      const { data: existing } = await supabase
        .from("report_shares")
        .select("token, expires_at")
        .eq("user_id", patientUserId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0 && new Date(existing[0].expires_at) > new Date()) {
        setSharedToken(existing[0].token);
      }
    };

    setupSharesListener();

    // Subscribe to realtime inserts on report_shares
    const channel = supabase
      .channel(`shares-${consultation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "report_shares" },
        (payload: any) => {
          const newShare = payload.new;
          if (newShare?.token && new Date(newShare.expires_at) > new Date()) {
            setSharedToken(newShare.token);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isProfessional, consultation.id]);

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
        status: "completed" as any,
        ended_at: now.toISOString(),
        call_duration_seconds: elapsed,
      })
      .eq("id", consultation.id);

    // Notify Meddit that the consultation has ended (if external)
    try {
      const { data: apptRow } = await supabase
        .from("appointments")
        .select("external_appointment_id")
        .eq("user_id", user?.id ?? "")
        .not("external_appointment_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if ((apptRow as any)?.external_appointment_id) {
        supabase.functions.invoke("prontuario-proxy", {
          body: { appointmentId: (apptRow as any).external_appointment_id },
          headers: { "Content-Type": "application/json" },
        }).then(() => console.log("Meddit finish sent"))
          .catch((err: any) => console.warn("Meddit finish failed:", err));
      }
    } catch (e) {
      console.warn("Could not check external appointment:", e);
    }

    onLeave();
  };

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.pending;


  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Professional: shared data banner */}
      {isProfessional && sharedToken && (
        <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">📋</span>
            <p className="text-[12px] font-medium text-emerald-800 truncate">
              {patientName || "Paciente"} compartilhou dados de saúde
            </p>
          </div>
          <a
            href={`/relatorio/medico/${sharedToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shrink-0"
          >
            Ver relatório
          </a>
        </div>
      )}
      {isProfessional && !sharedToken && (
        <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">📋</span>
            <p className="text-[12px] text-muted-foreground truncate">
              Aguardando compartilhamento de dados pelo paciente
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
              {isProfessional ? "👤" : consultation.professionalType === "nurse" ? "👩‍⚕️" : "🩺"}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">
                {isProfessional ? (patientName || "Paciente") : consultation.professionalName}
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
          {!isProfessional && (
            <button
              onClick={() => shareWithProfessional(consultation.id)}
              disabled={sharing || shared}
              className={`ml-auto text-[10px] font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                shared
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              }`}
            >
              {sharing ? "..." : shared ? "✅ Compartilhado" : "📋 Compartilhar dados"}
            </button>
          )}
          {isProfessional && consultationMeta && (
            <div className="ml-auto">
              <DocumentSender
                consultationId={consultation.id}
                professionalId={consultationMeta.professionalId}
                patientUserId={consultationMeta.patientUserId}
                patientName={patientName}
              />
            </div>
          )}
        </div>
      </div>

      {/* Jitsi Meeting */}
      <div className="flex-1 relative">
        <JitsiMeeting
          domain="teleconsulta.saudecomvc.com.br"
          roomName={roomName}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: true,
            enableEmailInProfile: false,
            prejoinPageEnabled: false,
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
            enableLobbyChat: false,
            hideLobbyButton: true,
            requireDisplayName: false,
            enableClosePage: false,
            enableFeedbackAnimation: false,
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
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            DEFAULT_BACKGROUND: "#1a1a2e",
            ENABLE_LOBBY_CHAT: false,
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
