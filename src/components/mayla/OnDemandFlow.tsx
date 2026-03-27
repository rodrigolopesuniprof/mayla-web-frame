import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { WaitingRoom } from "./WaitingRoom";
import { JitsiConsultationScreen } from "./JitsiConsultationScreen";

type ProfType = "doctor" | "nurse";
type FlowStep = "choose" | "searching" | "waiting_room" | "video_call";

interface MatchedProfessional {
  id: string;
  name: string;
  specialty: string | null;
  estimated_response_minutes: number;
}

interface Props {
  onBack: () => void;
  onStartCall?: (consultation: { id: string; professionalName: string; professionalType: string; specialty: string }) => void;
}

export function OnDemandFlow({ onBack }: Props) {
  const { user } = useAuth();
  const { company } = useCompany();
  const [step, setStep] = useState<FlowStep>("choose");
  const [profType, setProfType] = useState<ProfType | null>(null);
  const [matched, setMatched] = useState<MatchedProfessional | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step === "searching") {
      timerRef.current = setInterval(() => setWaitSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const formatWait = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
  };

  const handleChoose = async (type: ProfType) => {
    if (!user) return;
    setProfType(type);
    setStep("searching");
    setWaitSeconds(0);

    // Find best available professional
    const { data: onlineProfs } = await supabase
      .from("professional_online_status")
      .select("professional_id, estimated_response_minutes, max_parallel_waiting")
      .eq("online_now", true)
      .eq("accepts_on_demand", true)
      .order("estimated_response_minutes", { ascending: true });

    if (!onlineProfs || onlineProfs.length === 0) {
      toast({ title: "Nenhum profissional disponível", description: "Tente novamente em alguns minutos.", variant: "destructive" });
      setStep("choose");
      return;
    }

    const profIds = onlineProfs.map((p) => p.professional_id);

    const { data: partners } = await supabase
      .from("partners")
      .select("id, name, specialty, partner_type")
      .in("id", profIds)
      .eq("active", true)
      .eq("approval_status", "approved");

    if (!partners || partners.length === 0) {
      toast({ title: "Nenhum profissional disponível", description: "Nenhum profissional aprovado está online agora.", variant: "destructive" });
      setStep("choose");
      return;
    }

    // Count current waiting consultations per professional
    const { data: activeConsults } = await supabase
      .from("consultations")
      .select("professional_id")
      .in("status", ["waiting", "confirmed"] as any[])
      .eq("consultation_flow_type", "on_demand" as any)
      .in("professional_id", profIds);

    const queueMap: Record<string, number> = {};
    (activeConsults || []).forEach((c: any) => {
      queueMap[c.professional_id] = (queueMap[c.professional_id] || 0) + 1;
    });

    const scored = partners
      .map((p) => {
        const status = onlineProfs.find((o) => o.professional_id === p.id);
        const queue = queueMap[p.id] || 0;
        const maxWaiting = status?.max_parallel_waiting || 3;
        if (queue >= maxWaiting) return null;
        return {
          ...p,
          queue,
          estimated_response_minutes: status?.estimated_response_minutes || 15,
          score: queue * 10 + (status?.estimated_response_minutes || 15),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score - b!.score);

    if (scored.length === 0) {
      toast({ title: "Todos os profissionais estão ocupados", description: "Tente novamente em alguns minutos.", variant: "destructive" });
      setStep("choose");
      return;
    }

    const best = scored[0]!;
    const queuePos = best.queue + 1;

    setMatched({
      id: best.id,
      name: best.name,
      specialty: best.specialty || (type === "nurse" ? "Enfermagem" : "Clínico Geral"),
      estimated_response_minutes: best.estimated_response_minutes,
    });

    // Create consultation with status "waiting" — professional must accept
    const insertPayload: any = {
      user_id: user.id,
      professional_id: best.id,
      professional_type: type as any,
      specialty: best.specialty || (type === "nurse" ? "Enfermagem" : "Clínico Geral"),
      consultation_mode: "online",
      consultation_flow_type: "on_demand" as any,
      status: "waiting" as any,
      join_window_starts_at: new Date().toISOString(),
      queue_position: queuePos,
      triage_notes: `Atendimento imediato solicitado`,
    };

    // Only add company_id if available (avoid null FK issues)
    if ((company as any)?.id) {
      insertPayload.company_id = (company as any).id;
    }

    const { data: consultData, error } = await supabase
      .from("consultations")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !consultData?.id) {
      console.error("Erro ao criar consulta on-demand:", error);
      toast({ title: "Erro ao criar consulta", description: error?.message || "Tente novamente.", variant: "destructive" });
      setStep("choose");
      return;
    }

    setConsultationId(consultData.id);
    setStep("waiting_room");
  };

  // Video call overlay
  if (step === "video_call" && consultationId && matched) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <JitsiConsultationScreen
          consultation={{
            id: consultationId,
            roomToken: roomToken || undefined,
            professionalName: matched.name,
            professionalType: profType || "doctor",
            specialty: matched.specialty || "Clínico Geral",
            consultationMode: "online",
          }}
          onLeave={onBack}
        />
      </div>
    );
  }

  // Waiting room — patient waits for professional to accept
  if (step === "waiting_room" && consultationId && matched) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-[22px] py-3 flex items-center gap-3 border-b border-border shrink-0">
          <button
            onClick={onBack}
            className="bg-secondary border-none rounded-xl px-3 py-1.5 text-secondary-foreground text-[13px] font-medium cursor-pointer"
          >
            ← Voltar
          </button>
          <span className="font-display text-base font-medium text-foreground">Atendimento Agora</span>
        </div>
        <WaitingRoom
          consultationId={consultationId}
          doctorName={matched.name}
          specialty={matched.specialty || "Clínico Geral"}
          isOnDemand
          onEnterCall={() => setStep("video_call")}
          onBack={onBack}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="px-[22px] py-3 flex items-center gap-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="bg-secondary border-none rounded-xl px-3 py-1.5 text-secondary-foreground text-[13px] font-medium cursor-pointer"
        >
          ← Voltar
        </button>
        <span className="font-display text-base font-medium text-foreground">Atendimento Agora</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        {/* Step: Choose */}
        {step === "choose" && (
          <div className="w-full max-w-sm space-y-4">
            <div className="text-center mb-6">
              <span className="text-5xl block mb-3">⚡</span>
              <h3 className="font-display text-xl font-semibold text-foreground">Atendimento imediato</h3>
              <p className="text-sm text-muted-foreground mt-1">Conecte-se com um profissional em poucos minutos</p>
            </div>

            <button
              onClick={() => handleChoose("doctor")}
              className="w-full rounded-2xl p-5 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform border-none"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" }}
            >
              <span className="text-3xl">🩺</span>
              <div className="text-left">
                <div className="text-[15px] font-semibold text-primary-foreground">Médico(a)</div>
                <div className="text-[12px]" style={{ color: "rgba(255,255,255,.65)" }}>Consulta médica online imediata</div>
              </div>
            </button>

            <button
              onClick={() => handleChoose("nurse")}
              className="w-full rounded-2xl p-5 flex items-center gap-4 cursor-pointer active:scale-[.97] transition-transform border-none"
              style={{ background: "linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))" }}
            >
              <span className="text-3xl">👩‍⚕️</span>
              <div className="text-left">
                <div className="text-[15px] font-semibold text-accent-foreground">Enfermeiro(a)</div>
                <div className="text-[12px]" style={{ color: "rgba(255,255,255,.65)" }}>Orientação de enfermagem rápida</div>
              </div>
            </button>

            <p className="text-[10px] text-muted-foreground text-center mt-4">
              Disponível quando há profissionais online. Atendimento por videochamada.
            </p>
          </div>
        )}

        {/* Step: Searching */}
        {step === "searching" && (
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Buscando profissional...</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Procurando {profType === "nurse" ? "enfermeiro(a)" : "médico(a)"} disponível
            </p>
            <Badge variant="secondary" className="text-xs">
              ⏱ {formatWait(waitSeconds)}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
