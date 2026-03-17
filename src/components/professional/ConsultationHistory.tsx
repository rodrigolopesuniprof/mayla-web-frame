import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
  scheduled_at: string | null;
  patient_name?: string;
}

interface Props {
  partnerId: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  completed: { label: "Realizada", className: "bg-emerald-100 text-emerald-700" },
  finished: { label: "Finalizada", className: "bg-emerald-100 text-emerald-700" },
  in_progress: { label: "Em andamento", className: "bg-primary/10 text-primary" },
  confirmed: { label: "Confirmada", className: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
  no_show: { label: "Não compareceu", className: "bg-destructive/10 text-destructive" },
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  waiting: { label: "Na fila", className: "bg-purple-100 text-purple-700" },
};

export function ConsultationHistory({ partnerId }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("consultations")
        .select("id, user_id, specialty, consultation_mode, consultation_flow_type, status, created_at, started_at, ended_at, call_duration_seconds, scheduled_at")
        .eq("professional_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(100);

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
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filtered = search
    ? items.filter(i =>
        (i.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (i.specialty || "").toLowerCase().includes(search.toLowerCase())
      )
    : items;

  if (loading) return <div className="text-center py-8 text-sm text-muted-foreground">Carregando histórico...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Histórico de consultas</h3>
        <span className="text-xs text-muted-foreground">{items.length} registros</span>
      </div>

      <Input
        placeholder="Buscar por paciente ou especialidade..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="text-sm"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl block mb-3">📋</span>
          <p className="text-sm text-muted-foreground">
            {search ? "Nenhum resultado encontrado" : "Nenhuma consulta realizada ainda"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const st = STATUS_MAP[item.status] || STATUS_MAP.pending;
            return (
              <div key={item.id} className="bg-card rounded-2xl border border-border p-4">
                {/* Patient + status */}
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{item.patient_name}</p>
                    <p className="text-[11px] text-muted-foreground">{item.specialty || "Consulta"}</p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${st.className}`}>{st.label}</Badge>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">📅 Data</span>
                    <span className="text-foreground">{formatDate(item.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">⏱ Duração</span>
                    <span className="text-foreground">{formatDuration(item.call_duration_seconds)}</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px]">
                    {item.consultation_mode === "online" ? "📹 Online" : "🏥 Presencial"}
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">
                    {item.consultation_flow_type === "on_demand" ? "⚡ Imediato" : "📅 Agendado"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
