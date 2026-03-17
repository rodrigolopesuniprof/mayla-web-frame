import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WaitingConsultation {
  id: string;
  user_id: string;
  specialty: string | null;
  consultation_mode: string;
  consultation_flow_type: string;
  status: string;
  created_at: string;
  triage_notes: string | null;
  scheduled_at: string | null;
  patient_name?: string;
}

interface Props {
  partnerId: string;
  onStartCall: (consultation: { id: string; patientName: string; specialty: string }) => void;
  onQueueCountChange?: (count: number) => void;
}

export function WaitingQueue({ partnerId, onStartCall, onQueueCountChange }: Props) {
  const [consultations, setConsultations] = useState<WaitingConsultation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from("consultations")
      .select("id, user_id, specialty, consultation_mode, consultation_flow_type, status, created_at, triage_notes, scheduled_at")
      .eq("professional_id", partnerId)
      .in("status", ["confirmed", "waiting", "pending"] as any[])
      .order("created_at", { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      let nameMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Paciente"; });
      }

      const enriched = data.map((c: any) => ({
        ...c,
        patient_name: nameMap[c.user_id] || "Paciente",
      }));
      setConsultations(enriched);
      onQueueCountChange?.(enriched.length);
    } else {
      onQueueCountChange?.(0);
    }
    setLoading(false);
  }, [partnerId, onQueueCountChange]);

  useEffect(() => {
    fetchQueue();

    // Periodic refetch as fallback (every 15s)
    const interval = setInterval(() => fetchQueue(), 15000);

    const channel = supabase
      .channel(`prof-queue-${partnerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations", filter: `professional_id=eq.${partnerId}` },
        () => fetchQueue()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [partnerId, fetchQueue]);

  const handleAccept = async (consultation: WaitingConsultation) => {
    await supabase
      .from("consultations")
      .update({ status: "in_progress" as any, started_at: new Date().toISOString() })
      .eq("id", consultation.id);

    onStartCall({
      id: consultation.id,
      patientName: consultation.patient_name || "Paciente",
      specialty: consultation.specialty || "Clínico Geral",
    });
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
  };

  const formatScheduledTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Carregando fila...</div>;
  }

  if (consultations.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl block mb-3">😌</span>
        <p className="text-sm font-medium text-foreground">Nenhum paciente aguardando</p>
        <p className="text-xs text-muted-foreground mt-1">Novos pacientes aparecerão aqui em tempo real</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Pacientes aguardando</h3>
        <Badge variant="destructive" className="text-xs animate-pulse">
          {consultations.length} na fila
        </Badge>
      </div>

      {consultations.map((c) => {
        const isOnDemand = c.consultation_flow_type === "on_demand";
        const isOnline = c.consultation_mode === "online";
        const scheduledTime = formatScheduledTime(c.scheduled_at);

        return (
          <div
            key={c.id}
            className={`bg-card rounded-2xl border p-4 ${isOnDemand ? "border-destructive/30 shadow-sm" : "border-border"}`}
          >
            {/* On-demand urgent tag */}
            {isOnDemand && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider">Atendimento imediato</span>
              </div>
            )}

            {/* Patient info */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-base shrink-0">
                  👤
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{c.patient_name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.specialty || "Consulta"}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-muted-foreground">Aguardando há</p>
                <p className="text-xs font-mono font-semibold text-foreground">{getWaitTime(c.created_at)}</p>
              </div>
            </div>

            {/* Meta badges */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Badge variant="outline" className="text-[9px]">
                {isOnline ? "📹 Online" : "🏥 Presencial"}
              </Badge>
              <Badge variant="outline" className="text-[9px]">
                {isOnDemand ? "⚡ Imediato" : "📅 Agendado"}
              </Badge>
              {scheduledTime && (
                <span className="text-[10px] text-muted-foreground">🕐 {scheduledTime}</span>
              )}
              <Badge variant="outline" className="text-[9px]">
                {c.status === "waiting" ? "🔔 Na sala" : "⏳ Confirmado"}
              </Badge>
            </div>

            {/* Triage notes */}
            {c.triage_notes && (
              <p className="text-[11px] text-muted-foreground bg-secondary rounded-lg p-2 mb-3">
                📝 {c.triage_notes}
              </p>
            )}

            {/* Accept button */}
            {isOnline && (
              <Button
                size="sm"
                className="w-full text-[12px]"
                variant={isOnDemand ? "destructive" : "default"}
                onClick={() => handleAccept(c)}
              >
                📹 {isOnDemand ? "Atender agora" : "Iniciar consulta"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
