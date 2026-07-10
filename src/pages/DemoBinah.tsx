import { useState } from "react";
import { BinahCapture } from "@/components/mayla/BinahCapture";
import { DemoLeadForm, type LeadData } from "./DemoLeadForm";
import { supabase } from "@/integrations/supabase/client";
import "./demo.css";

type Phase = "lead" | "measure" | "done";

interface DemoResult {
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
}

export default function DemoBinah() {
  const [phase, setPhase] = useState<Phase>("lead");
  const [lead, setLead] = useState<LeadData | null>(null);
  const [sending, setSending] = useState(false);
  const [captureKey, setCaptureKey] = useState(0);

  async function sendHealth(result: DemoResult) {
    if (!lead) return;
    if (sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-health-submit", {
        body: { nome: lead.nome, whatsapp: lead.whatsapp, medicao: result },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) throw new Error("crm_error");
    } catch (err) {
      console.error("[demo] health submit failed", err);
      // We still show the "done" screen — the user finished the test — but log the error.
    } finally {
      setSending(false);
      setPhase("done");
    }
  }

  function restart() {
    setLead(null);
    setPhase("lead");
    setCaptureKey((k) => k + 1);
  }

  if (phase === "lead") {
    return <DemoLeadForm onSubmitted={(d) => { setLead(d); setPhase("measure"); }} />;
  }

  if (phase === "done") {
    return (
      <div className="demo-scope">
        <div className="demo-shell">
          <div className="demo-done">
            <div className="demo-done-icon">✅</div>
            <h2>Recebemos seus dados!</h2>
            <p>
              Em instantes você receberá pelo WhatsApp uma mensagem da equipe Mayla com as dicas do seu resultado.
            </p>
            <button className="demo-cta" onClick={restart}>Fazer novo teste</button>
          </div>
        </div>
      </div>
    );
  }

  // phase === "measure"
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <BinahCapture
          key={captureKey}
          onClose={restart}
          onComplete={() => { /* handled by onSaveOverride */ }}
          municipalityId={null}
          companyId={null}
          providerOverride="binah"
          displayName="Mayla Saúde · Teste"
          saveButtonLabel={sending ? "Enviando…" : "Enviar dados e finalizar teste"}
          hidePointsHint
          consentCtaLabel="Iniciar medição"
          onSaveOverride={(result) => sendHealth(result as DemoResult)}
        />
      </div>
    </div>
  );
}
