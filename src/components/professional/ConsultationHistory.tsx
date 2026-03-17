import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
  id: string;
  specialty: string | null;
  consultation_mode: string;
  consultation_flow_type: string;
  status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  call_duration_seconds: number | null;
  patient_name?: string;
}

interface Props {
  partnerId: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  completed: { label: "Realizada", className: "bg-emerald-100 text-emerald-700" },
  finished: { label: "Finalizada", className: "bg-emerald-100 text-emerald-700" },
  in_progress: { label: "Em andamento", className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmada", className: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-700" },
  no_show: { label: "Não compareceu", className: "bg-red-100 text-red-700" },
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  waiting: { label: "Na fila", className: "bg-purple-100 text-purple-700" },
};

export function ConsultationHistory({ partnerId }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("consultations")
        .select("id, user_id, specialty, consultation_mode, consultation_flow_type, status, created_at, started_at, ended_at, call_duration_seconds")
        .eq("professional_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        const userIds = [...new Set(data.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const nameMap: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Paciente"; });

        setItems(data.map((c: any) => ({
          ...c,
          patient_name: nameMap[c.user_id] || "Paciente",
        })));
      }
      setLoading(false);
    };
    fetch();
  }, [partnerId]);

  const formatDuration = (secs: number | null) => {
    if (!secs) return "—";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  if (loading) return <div className="text-center py-8 text-sm text-muted-foreground">Carregando histórico...</div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl block mb-3">📋</span>
        <p className="text-sm text-muted-foreground">Nenhuma consulta realizada ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Histórico de consultas</h3>
      {items.map((item) => {
        const st = STATUS_MAP[item.status] || STATUS_MAP.pending;
        return (
          <div key={item.id} className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{item.patient_name}</p>
                <p className="text-[11px] text-muted-foreground">{item.specialty}</p>
              </div>
              <Badge className={`text-[10px] ${st.className}`}>{st.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
              <span>{new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <Badge variant="outline" className="text-[9px]">
                {item.consultation_mode === "online" ? "📹 Online" : "🏥 Presencial"}
              </Badge>
              <Badge variant="outline" className="text-[9px]">
                {item.consultation_flow_type === "on_demand" ? "⚡ Imediato" : "📅 Agendado"}
              </Badge>
              {item.call_duration_seconds != null && item.call_duration_seconds > 0 && (
                <span>⏱ {formatDuration(item.call_duration_seconds)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
