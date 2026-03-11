import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BinahCaptureProps {
  onClose: () => void;
  onComplete: () => void;
  municipalityId: string | null;
}

type CapturePhase = "consent" | "preparing" | "capturing" | "processing" | "result" | "error";

interface BinahResult {
  heart_rate?: number;
  blood_pressure_sys?: number;
  blood_pressure_dia?: number;
  spo2?: number;
  respiratory_rate?: number;
  hrv_sdnn?: number;
  stress_level?: number;
  hemoglobin?: number;
  hba1c?: number;
  wellness_score?: number;
  prq?: number;
  cardiac_workload?: number;
}

export function BinahCapture({ onClose, onComplete, municipalityId }: BinahCaptureProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<CapturePhase>("consent");
  const [result, setResult] = useState<BinahResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const startCapture = () => {
    setPhase("preparing");

    // TODO: Initialize Binah Web SDK here when available
    // For now, simulate the flow with a placeholder
    setTimeout(() => {
      setPhase("capturing");
    }, 1500);

    // Simulated capture duration
    setTimeout(() => {
      setPhase("processing");
    }, 5000);

    // Simulated processing
    setTimeout(() => {
      // Placeholder: in production, this will come from the Binah SDK
      setPhase("result");
      setResult({
        heart_rate: 72,
        blood_pressure_sys: 120,
        blood_pressure_dia: 80,
        spo2: 98,
        respiratory_rate: 16,
        stress_level: 25,
        wellness_score: 85,
      });
    }, 7000);
  };

  const saveResult = async () => {
    if (!user || !result) return;

    const { error } = await supabase.from("special_measurements").insert({
      user_id: user.id,
      municipality_id: municipalityId,
      measurement_data: result as any,
      source: "binah",
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Medição especial salva! 🎉", description: "+100 pontos de saúde" });
    onComplete();
    onClose();
  };

  const resultItems = result
    ? [
        { label: "Freq. Cardíaca", value: result.heart_rate, unit: "bpm", emoji: "❤️" },
        { label: "Pressão Arterial", value: result.blood_pressure_sys && result.blood_pressure_dia ? `${result.blood_pressure_sys}/${result.blood_pressure_dia}` : null, unit: "mmHg", emoji: "🩺" },
        { label: "SpO2", value: result.spo2, unit: "%", emoji: "💧" },
        { label: "Respiração", value: result.respiratory_rate, unit: "rpm", emoji: "🫁" },
        { label: "Estresse", value: result.stress_level, unit: "%", emoji: "😰" },
        { label: "Bem-estar", value: result.wellness_score, unit: "pts", emoji: "✨" },
      ].filter((i) => i.value != null)
    : [];

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <button onClick={onClose} className="text-muted-foreground text-lg">✕</button>
        <h2 className="font-display text-lg font-semibold text-foreground">Medição Especial</h2>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">BINAH</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Consent */}
        {phase === "consent" && (
          <div className="text-center space-y-5">
            <div className="text-6xl">🔬</div>
            <h3 className="font-display text-xl font-semibold text-foreground">Análise Completa de Saúde</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta medição especial analisa múltiplos indicadores de saúde pela câmera do celular,
              incluindo <strong>pressão arterial</strong>, <strong>hemoglobina</strong>, <strong>variabilidade cardíaca</strong> e mais.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {["❤️ FC", "🩺 PA", "💧 SpO2", "🫁 Resp", "😰 Estresse", "✨ Bem-estar"].map((item, i) => (
                <div key={i} className="bg-secondary rounded-xl py-2 px-1 text-[11px] font-medium text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Duração: ~60 segundos · Necessário boa iluminação
            </p>
            <button
              onClick={startCapture}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
                boxShadow: "0 8px 24px rgba(26,92,138,.3)",
              }}
            >
              Iniciar Medição Especial
            </button>
          </div>
        )}

        {/* Preparing */}
        {phase === "preparing" && (
          <div className="text-center space-y-4">
            <div className="text-5xl animate-pulse">📡</div>
            <p className="text-sm font-medium text-foreground">Preparando análise...</p>
            <p className="text-[12px] text-muted-foreground">Conectando ao servidor de análise</p>
          </div>
        )}

        {/* Capturing */}
        {phase === "capturing" && (
          <div className="text-center space-y-4">
            <div className="w-48 h-48 rounded-full border-4 border-accent/30 flex items-center justify-center bg-secondary mx-auto">
              <div className="text-5xl animate-heartbeat">📸</div>
            </div>
            <p className="text-sm font-medium text-foreground">Analisando...</p>
            <p className="text-[12px] text-muted-foreground">
              Mantenha o rosto centralizado e imóvel
            </p>
            <div className="w-48 h-1.5 bg-secondary rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* Processing */}
        {phase === "processing" && (
          <div className="text-center space-y-4">
            <div className="text-5xl animate-spin-slow">⚙️</div>
            <p className="text-sm font-medium text-foreground">Processando resultados...</p>
            <p className="text-[12px] text-muted-foreground">Calculando seus indicadores de saúde</p>
          </div>
        )}

        {/* Result */}
        {phase === "result" && result && (
          <div className="w-full space-y-4">
            <div className="text-center mb-2">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="font-display text-lg font-semibold text-foreground">Resultados da Medição</h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                ⚠️ Versão demonstrativa · Dados simulados
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {resultItems.map((item, i) => (
                <div key={i} className="bg-secondary rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{item.emoji}</span>
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-xl font-bold text-foreground">{item.value}</span>
                    <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={saveResult}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white mt-2"
              style={{
                background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
              }}
            >
              Salvar Medição
            </button>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <p className="text-sm font-medium text-foreground">Medição não concluída</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => setPhase("consent")}
              className="rounded-2xl px-6 py-2.5 text-sm font-medium bg-secondary text-foreground"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Back button on non-result phases */}
      {phase !== "result" && phase !== "consent" && (
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full rounded-2xl py-3 text-sm font-medium bg-secondary text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
