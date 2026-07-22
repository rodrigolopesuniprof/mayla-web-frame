import { useState } from "react";
import { X, AlertTriangle, Camera, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface LeadData {
  nome: string;
  whatsapp: string;
}

interface DemoLeadFormProps {
  onSubmitted: (data: LeadData) => void;
  onCancel?: () => void;
}

function maskWhatsapp(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function DemoLeadForm({ onSubmitted, onCancel }: DemoLeadFormProps) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = whatsapp.replace(/\D/g, "");
  const valid = nome.trim().length >= 2 && digits.length >= 10 && digits.length <= 11;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!valid) {
      setError("Preencha seu nome e um WhatsApp válido.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("demo-lead-submit", {
        body: { nome: nome.trim(), whatsapp: digits },
      });
      if (fnErr) throw fnErr;
      if (data && (data as any).ok === false) throw new Error("crm_error");
      onSubmitted({ nome: nome.trim(), whatsapp: digits });
    } catch (err) {
      console.error("[demo] lead submit failed", err);
      setError("Não conseguimos registrar seus dados agora. Tente novamente em instantes.");
      setSubmitting(false);
    }
  }

  return (
    <div className="demo-scope">
      <div className="demo-shell">
        <div className="demo-topbar">
          <div>
            <span className="demo-brand">Mayla</span>
            <span className="demo-brand-sub">MEÇA. CUIDE. GANHE.</span>
          </div>
          {onCancel && (
            <button type="button" className="demo-close" onClick={onCancel} aria-label="Fechar">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="demo-hero">
          <div className="demo-icon-ring">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2fcb94" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 3v6a5 5 0 0 0 10 0V3" />
              <path d="M4 3h2" />
              <path d="M12 3h2" />
              <path d="M9 14v2a5 5 0 0 0 10 0v-2" />
              <circle cx="19" cy="10" r="2" />
            </svg>
          </div>
          <h1 className="demo-title">Teste a tecnologia<br />em 60 segundos</h1>
          <p className="demo-subtitle">
            Antes de começar, nos diga quem é você — enviamos as dicas do seu resultado pelo WhatsApp.
          </p>
        </div>

        <div className="demo-warn" role="note">
          <AlertTriangle size={18} className="demo-warn-icon" />
          <span>
            <strong>Ambiente de teste.</strong> O resultado é uma demonstração e{" "}
            <strong>não possui o mesmo grau de acurácia</strong> do sistema efetivamente utilizado no ambiente oficial da Mayla.
          </span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="demo-field">
            <label htmlFor="demo-nome">Seu nome</label>
            <input
              id="demo-nome"
              type="text"
              autoComplete="name"
              placeholder="Como podemos te chamar?"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="demo-field">
            <label htmlFor="demo-wa">Seu WhatsApp</label>
            <input
              id="demo-wa"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(31) 99999-9999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
              required
            />
            {error && <div className="demo-error">{error}</div>}
          </div>

          <button type="submit" className="demo-cta" disabled={!valid || submitting}>
            <Camera size={18} />
            {submitting ? "Enviando…" : "Iniciar teste"}
            {!submitting && <ArrowRight size={16} />}
          </button>

          <p className="demo-microcopy">Grátis · sem compromisso · leva 1 minuto</p>
        </form>
      </div>
    </div>
  );
}
