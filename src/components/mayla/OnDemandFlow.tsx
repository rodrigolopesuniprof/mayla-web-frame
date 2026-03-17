import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type ProfType = "doctor" | "nurse";
type FlowStep = "choose" | "searching" | "found" | "connecting" | "ready";

interface MatchedProfessional {
  id: string;
  name: string;
  specialty: string | null;
  estimated_response_minutes: number;
  queue_position: number;
}

interface Props {
  onBack: () => void;
  onStartCall: (consultation: { id: string; professionalName: string; professionalType: string; specialty: string }) => void;
}

export function OnDemandFlow({ onBack, onStartCall }: Props) {
  const { user } = useAuth();
  const { company } = useCompany();
  const [step, setStep] = useState<FlowStep>("choose");
  const [profType, setProfType] = useState<ProfType | null>(null);
  const [matched, setMatched] = useState<MatchedProfessional | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Waiting timer
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

    // Filter by partner_type matching the chosen professional type
    const partnerType = type === "nurse" ? "doctor" : "doctor"; // nurses are also in partners as doctor type for now
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

    // Count current waiting consultations per professional to find lowest queue
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

    // Score: lower queue + faster response = better
    const scored = partners
      .map((p) => {
        const status = onlineProfs.find((o) => o.professional_id === p.id);
        const queue = queueMap[p.id] || 0;
        const maxWaiting = status?.max_parallel_waiting || 3;
        if (queue >= maxWaiting) return null; // full
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

    // Simulate brief search delay for UX
    await new Promise((r) => setTimeout(r, 1500));
    setMatched({
      id: best.id,
      name: best.name,
      specialty: best.specialty || (type === "nurse" ? "Enfermagem" : "Clínico Geral"),
      estimated_response_minutes: best.estimated_response_minutes,
      queue_position: queuePos,
    });
    setStep("found");

    // Brief pause then create consultation
    await new Promise((r) => setTimeout(r, 1200));
    setStep("connecting");

    const { data: consultData, error } = await supabase
      .from("consultations")
      .insert({
        user_id: user.id,
        professional_id: best.id,
        professional_type: type as any,
        specialty: best.specialty || (type === "nurse" ? "Enfermagem" : "Clínico Geral"),
        consultation_mode: "online",
        consultation_flow_type: "on_demand" as any,
        status: "confirmed" as any,
        join_window_starts_at: new Date().toISOString(),
        queue_position: queuePos,
        triage_notes: `Atendimento imediato solicitado. Tempo de espera: ${waitSeconds}s`,
        company_id: (company as any)?.id || null,
      } as any)
      .select("id")
      .single();

    if (error || !consultData?.id) {
      toast({ title: "Erro ao criar consulta", description: error?.message || "Tente novamente.", variant: "destructive" });
      setStep("choose");
      return;
    }

    setConsultationId(consultData.id);
    await new Promise((r) => setTimeout(r, 800));
    setStep("ready");
  };

  const handleEnterCall = () => {
    if (!matched || !consultationId) return;
    onStartCall({
      id: consultationId,
      professionalName: matched.name,
      professionalType: profType || "doctor",
      specialty: matched.specialty || "Clínico Geral",
    });
  };

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

        {/* Step: Found */}
        {step === "found" && matched && (
          <div className="text-center max-w-xs animate-fade-up">
            <span className="text-5xl block mb-3">✅</span>
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Profissional encontrado!</h3>
            <div className="bg-secondary rounded-2xl p-4 mt-4 text-left space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                  {profType === "nurse" ? "👩‍⚕️" : "🩺"}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{matched.name}</p>
                  <p className="text-[11px] text-muted-foreground">{matched.specialty}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px]">⏱ ~{matched.estimated_response_minutes} min</Badge>
                {matched.queue_position <= 1 && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">Sem fila</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step: Connecting */}
        {step === "connecting" && (
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Preparando consulta...</h3>
            <p className="text-sm text-muted-foreground">Criando sala de videochamada</p>
          </div>
        )}

        {/* Step: Ready */}
        {step === "ready" && matched && (
          <div className="text-center max-w-xs animate-fade-up">
            <span className="text-5xl block mb-3">📹</span>
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">Consulta pronta!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sua sala com <strong>{matched.name}</strong> está pronta.
            </p>
            <div className="text-[10px] text-muted-foreground mb-4">
              Tempo de espera: {formatWait(waitSeconds)}
            </div>
            <button
              onClick={handleEnterCall}
              className="w-full py-3.5 rounded-xl border-none text-[14px] font-semibold text-primary-foreground cursor-pointer"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" }}
            >
              📹 Entrar na videochamada
            </button>
            <button
              onClick={onBack}
              className="w-full mt-2 py-2.5 rounded-xl border border-border bg-transparent text-[13px] font-medium text-muted-foreground cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
