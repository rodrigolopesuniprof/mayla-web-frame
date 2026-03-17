import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WaitingConsultation {
  id: string;
  user_id: string;
  specialty: string | null;
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
}

export function WaitingQueue({ partnerId, onStartCall }: Props) {
  const [consultations, setConsultations] = useState<WaitingConsultation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from("consultations")
      .select("id, user_id, specialty, consultation_flow_type, status, created_at, triage_notes, scheduled_at")
      .eq("professional_id", partnerId)
      .in("status", ["confirmed", "waiting"] as any[])
      .order("created_at", { ascending: true });

    if (data) {
      // Fetch patient names
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

  useEffect(() => {
    fetchQueue();

    // Realtime subscription
    const channel = supabase
      .channel(`prof-queue-${partnerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations", filter: `professional_id=eq.${partnerId}` },
        () => fetchQueue()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partnerId]);

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
    return `${Math.floor(diff / 60)}m`;
  };

  if (loading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Carregando fila...</div>;
  }

  if (consultations.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl block mb-3">😌</span>
        <p className="text-sm text-muted-foreground">Nenhum paciente aguardando no momento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Pacientes aguardando</h3>
        <Badge variant="destructive" className="text-xs animate-pulse">{consultations.length} na fila</Badge>
      </div>
      {consultations.map((c) => (
        <div key={c.id} className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">👤</div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{c.patient_name}</p>
                <p className="text-[11px] text-muted-foreground">{c.specialty}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-[10px]">
                {c.consultation_flow_type === "on_demand" ? "⚡ Imediato" : "📅 Agendado"}
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-1">⏱ {getWaitTime(c.created_at)}</p>
            </div>
          </div>
          {c.triage_notes && (
            <p className="text-[11px] text-muted-foreground bg-secondary rounded-lg p-2 mb-2">📝 {c.triage_notes}</p>
          )}
          <Button
            size="sm"
            className="w-full text-[12px]"
            onClick={() => handleAccept(c)}
          >
            📹 Atender paciente
          </Button>
        </div>
      ))}
    </div>
  );
}
