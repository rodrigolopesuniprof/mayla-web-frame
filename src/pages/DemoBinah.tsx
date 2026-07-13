import { useState } from "react";
import { BinahCapture } from "@/components/mayla/BinahCapture";
import { DemoLeadForm, type LeadData } from "./DemoLeadForm";
import { supabase } from "@/integrations/supabase/client";
import "./demo.css";

type Phase = "lead" | "measure" | "chat";

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

const LUNA_CHAT_URL = "https://mayla.lunaos.com.br/chat/PSMiOg0P9Fik9MnYr8GgK8BN0Gdjm9Vj";

export default function DemoBinah() {
  const [phase, setPhase] = useState<Phase>("lead");
  const [lead, setLead] = useState<LeadData | null>(null);
  const [sending, setSending] = useState(false);
  const [captureKey, setCaptureKey] = useState(0);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);

  async function sendHealth(result: DemoResult) {
    if (!lead) return;
    if (sending) return;
    setSending(true);
    let nextWidgetUrl: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("demo-health-submit", {
        body: { nome: lead.nome, whatsapp: lead.whatsapp, medicao: result },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) throw new Error("crm_error");
      nextWidgetUrl = (data as any)?.widgetUrl ?? null;
    } catch (err) {
      console.error("[demo] health submit failed", err);
    } finally {
      setWidgetUrl(nextWidgetUrl);
      setSending(false);
      setPhase("chat");
    }
  }

  function restart() {
    setLead(null);
    setWidgetUrl(null);
    setPhase("lead");
    setCaptureKey((k) => k + 1);
  }

  if (phase === "lead") {
    return <DemoLeadForm onSubmitted={(d) => { setLead(d); setPhase("measure"); }} />;
  }

  if (phase === "chat") {
    return (
      <div className="demo-scope demo-chat-scope">
        {widgetUrl ? (
          <iframe
            src={widgetUrl}
            title="Mayla Assistente"
            className="demo-chat-iframe"
          />
        ) : (
          <div className="demo-done" style={{ flex: 1 }}>
            <div className="demo-done-icon">✓</div>
            <h2>Teste concluído</h2>
            <p>Não conseguimos abrir o chat agora, mas seus dados foram enviados. Tente novamente em instantes.</p>
          </div>
        )}
        <button className="demo-chat-restart" onClick={restart}>
          Fazer novo teste
        </button>
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
