import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Consultation {
  id: string;
  user_id: string;
  specialty: string | null;
  consultation_mode: string;
  consultation_flow_type: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  call_duration_seconds: number | null;
  triage_notes: string | null;
  patient_name?: string;
}

interface Props {
  partnerId: string;
  onStartCall: (consultation: { id: string; patientName: string; specialty: string; roomToken?: string }) => void;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  confirmed: { label: "Confirmada", className: "bg-primary/10 text-primary" },
  waiting: { label: "Aguardando", className: "bg-amber-100 text-amber-800" },
  in_progress: { label: "Em andamento", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "Realizada", className: "bg-muted text-muted-foreground" },
  finished: { label: "Finalizada", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "Não compareceu", className: "bg-destructive/10 text-destructive" },
};

export function TodayConsultations({ partnerId, onStartCall }: Props) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToday = async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const { data } = await supabase
        .from("consultations")
        .select("id, user_id, specialty, consultation_mode, consultation_flow_type, status, scheduled_at, created_at, started_at, ended_at, call_duration_seconds, triage_notes, room_token")
        .eq("professional_id", partnerId)
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd)
        .order("created_at", { ascending: true });

      if (data) {
        const userIds = [...new Set(data.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const nameMap: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Paciente"; });

        setConsultations(data.map((c: any) => ({
          ...c,
          patient_name: nameMap[c.user_id] || "Paciente",
        })));
      }
      setLoading(false);
    };

    fetchToday();

    const channel = supabase
      .channel(`today-${partnerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations", filter: `professional_id=eq.${partnerId}` },
        () => fetchToday()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partnerId]);

  const formatDuration = (secs: number | null) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const canAccept = (status: string) => status === "confirmed" || status === "waiting";

  const handleAccept = async (c: Consultation) => {
    await supabase
      .from("consultations")
      .update({ status: "in_progress" as any, started_at: new Date().toISOString() })
      .eq("id", c.id);

    onStartCall({
      id: c.id,
      patientName: c.patient_name || "Paciente",
      specialty: c.specialty || "Clínico Geral",
      roomToken: (c as any).room_token || undefined,
    });
  };

  if (loading) return <div className="text-center py-8 text-sm text-muted-foreground">Carregando consultas de hoje...</div>;

  if (consultations.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl block mb-3">📅</span>
        <p className="text-sm text-muted-foreground">Nenhuma consulta registrada hoje</p>
        <p className="text-xs text-muted-foreground mt-1">Novas consultas aparecerão aqui automaticamente</p>
      </div>
    );
  }

  const pending = consultations.filter(c => canAccept(c.status));
  const active = consultations.filter(c => c.status === "in_progress");
  const completed = consultations.filter(c => ["completed", "finished", "cancelled", "no_show"].includes(c.status));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{consultations.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{pending.length + active.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Pendentes</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{completed.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Concluídas</p>
        </div>
      </div>

      {/* Consultation Cards */}
      <div className="space-y-3">
        {consultations.map((c) => {
          const st = STATUS_MAP[c.status] || STATUS_MAP.pending;
          const isActionable = canAccept(c.status);
          const scheduledTime = formatTime(c.scheduled_at);
          const duration = formatDuration(c.call_duration_seconds);

          return (
            <div
              key={c.id}
              className={`bg-card rounded-2xl border p-4 ${isActionable ? "border-primary/30 shadow-sm" : "border-border"}`}
            >
              {/* Top row: patient + status */}
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
                <Badge className={`text-[10px] shrink-0 ${st.className}`}>{st.label}</Badge>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="outline" className="text-[9px]">
                  {c.consultation_mode === "online" ? "📹 Online" : "🏥 Presencial"}
                </Badge>
                <Badge variant="outline" className="text-[9px]">
                  {c.consultation_flow_type === "on_demand" ? "⚡ Imediato" : "📅 Agendado"}
                </Badge>
                {scheduledTime && (
                  <span className="text-[10px] text-muted-foreground">🕐 {scheduledTime}</span>
                )}
                {duration && (
                  <span className="text-[10px] text-muted-foreground">⏱ {duration}</span>
                )}
              </div>

              {/* Triage notes */}
              {c.triage_notes && (
                <p className="text-[11px] text-muted-foreground bg-secondary rounded-lg p-2 mb-3">
                  📝 {c.triage_notes}
                </p>
              )}

              {/* Action button */}
              {isActionable && c.consultation_mode === "online" && (
                <Button
                  size="sm"
                  className="w-full text-[12px]"
                  onClick={() => handleAccept(c)}
                >
                  📹 Iniciar atendimento
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
