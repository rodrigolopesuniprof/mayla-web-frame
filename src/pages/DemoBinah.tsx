import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BinahCapture } from "@/components/mayla/BinahCapture";
import { toast } from "@/hooks/use-toast";

type Phase = "form" | "disclaimer" | "capture" | "done";

export default function DemoBinah() {
  const [phase, setPhase] = useState<Phase>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const canSubmit = name.trim().length >= 2 && digits.length >= 8 && !submitting;

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const { error } = await supabase.from("demo_leads" as any).insert({
      name: name.trim(),
      phone: phone.trim(),
      source: "binah_demo",
      user_agent: navigator.userAgent,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" });
      return;
    }
    setPhase("disclaimer");
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {phase === "form" && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-lg space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl">📷</div>
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Teste a medição por câmera
              </h1>
              <p className="text-sm text-muted-foreground">
                Mayla Saúde · demonstração da tecnologia Binah.ai
              </p>
            </div>

            <form onSubmit={submitLead} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  className="w-full mt-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone (WhatsApp)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  required
                  className="w-full mt-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
                }}
              >
                {submitting ? "Enviando..." : "Continuar para o teste"}
              </button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Ao continuar, você concorda em receber contato da Mayla Saúde sobre a tecnologia demonstrada.
              </p>
            </form>
          </div>
        )}

        {phase === "disclaimer" && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-lg space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl">⚠️</div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Antes de começar
              </h2>
            </div>

            <div className="rounded-2xl bg-secondary/60 p-4 text-sm text-foreground/80 leading-relaxed space-y-3">
              <p>
                Esta é uma <strong>demonstração experimental</strong> da tecnologia de análise por câmera
                (rPPG · Binah.ai). Os resultados <strong>não constituem diagnóstico médico</strong> e não
                substituem consulta ou exames clínicos.
              </p>
              <p>
                Os dados exibidos são apenas para fins de degustação da tecnologia e{" "}
                <strong>não serão armazenados</strong> em um histórico clínico.
              </p>
              <p>
                Requisitos: navegador atualizado (Chrome ou Safari), boa iluminação e permissão de câmera.
                Não utilize dentro de apps como WhatsApp, Instagram ou Facebook.
              </p>
              <p className="text-[12px] text-muted-foreground">
                Em caso de sintomas ou dúvidas sobre sua saúde, procure um profissional habilitado.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1"
              />
              <span>Li e concordo com o aviso acima.</span>
            </label>

            <button
              onClick={() => setPhase("capture")}
              disabled={!accepted}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
              }}
            >
              Iniciar medição de teste
            </button>
          </div>
        )}

        {phase === "capture" && (
          <BinahCapture
            onClose={() => setPhase("done")}
            onComplete={() => setPhase("done")}
            municipalityId={null}
            companyId={null}
            providerOverride="binah"
            displayName="Mayla Saúde · Teste"
          />
        )}

        {phase === "done" && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-lg text-center space-y-4">
            <div className="text-5xl">🙌</div>
            <h2 className="font-display text-xl font-semibold text-foreground">Obrigado por testar!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Em breve entraremos em contato pelo telefone informado para conversar sobre a tecnologia.
            </p>
            <button
              onClick={() => { setPhase("form"); setName(""); setPhone(""); setAccepted(false); }}
              className="rounded-2xl px-5 py-2.5 text-sm font-medium bg-secondary text-foreground"
            >
              Fazer novo teste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
