import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export type PokeTipo = "cutucar" | "torcer" | "provocar" | "recado";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  leagueName: string;
  target: { user_id: string; full_name: string | null } | null; // null = broadcast
  defaultTipo?: PokeTipo;
  onSent?: () => void;
}

const SHORTCUTS: Record<Exclude<PokeTipo, "recado">, { label: string; group: string; chips: string[] }> = {
  cutucar: {
    label: "Cutucar",
    group: "👉 CUTUCAR",
    chips: ["Cadê você? 👀", "Bora bater a meta! 💪", "A liga conta com você 🤝"],
  },
  provocar: {
    label: "Provocar",
    group: "🔥 PROVOCAR",
    chips: ["Tô te alcançando 🔥", "Já te passei 😏", "Cuida do pescoço 🦒"],
  },
  torcer: {
    label: "Torcer",
    group: "👏 TORCER",
    chips: ["Você consegue! 👏", "Orgulho da liga 💙", "Segue firme! ✨"],
  },
};

export function LeaguePokeComposer({
  open, onOpenChange, leagueId, leagueName, target, defaultTipo = "cutucar", onSent,
}: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<PokeTipo>(defaultTipo);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);

  const isBroadcast = target === null;
  const title = useMemo(() => {
    if (isBroadcast) return "Recado pra liga";
    const first = (target?.full_name || "").split(" ")[0] || "colega";
    if (tipo === "torcer") return `Torcer por ${first}`;
    if (tipo === "provocar") return `Provocar ${first}`;
    if (tipo === "recado") return `Recado pra ${first}`;
    return `Cutucar ${first}`;
  }, [tipo, target, isBroadcast]);

  const submit = async () => {
    if (!user || !texto.trim()) return;
    setSending(true);
    const payload: any = {
      league_id: leagueId,
      from_user: user.id,
      to_user: isBroadcast ? null : target!.user_id,
      tipo: isBroadcast ? "recado" : tipo,
      texto: texto.trim().slice(0, 200),
    };
    const { error } = await supabase.from("league_pokes" as any).insert(payload);
    setSending(false);
    if (error) {
      const msg = /poke_rate_limit/.test(error.message)
        ? "Você já cutucou essa pessoa hoje. Volte amanhã!"
        : error.message;
      toast({ title: "Não deu pra enviar", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: isBroadcast ? "Recado enviado pra liga! 📣" : "Enviado! 👉" });
    setTexto("");
    onOpenChange(false);
    onSent?.();
  };

  const antispam = tipo === "cutucar" && !isBroadcast
    ? "Ela recebe uma notificação · limite de 1 cutucada por pessoa/dia (sem spam)"
    : isBroadcast
      ? `Todos os membros da ${leagueName} recebem uma notificação.`
      : "A pessoa recebe uma notificação in-app.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="liga-scope p-0 gap-0 max-w-[430px] max-h-[80vh] rounded-t-3xl rounded-b-none sm:rounded-3xl"
        style={{ background: "var(--liga-card)", border: "none" }}
      >
        <div className="flex flex-col overflow-hidden">
          <div className="pt-3 pb-1 flex justify-center">
            <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--liga-hairline-strong)" }} />
          </div>
          <div className="px-5 pt-2 pb-4 border-b" style={{ borderColor: "var(--liga-hairline)" }}>
            <h3 className="liga-serif" style={{ fontSize: 22, fontWeight: 600 }}>{title}</h3>
            {!isBroadcast && target && (
              <p className="text-xs mt-1" style={{ color: "var(--liga-ink-soft)" }}>
                {tipo === "cutucar" && "😴 mandar um empurrãozinho amigável"}
                {tipo === "provocar" && "🔥 tá quase alcançando essa pessoa"}
                {tipo === "torcer" && "👏 celebrar o esforço"}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!isBroadcast && (
              <>
                {(Object.keys(SHORTCUTS) as (keyof typeof SHORTCUTS)[]).map((k) => (
                  <div key={k}>
                    <div className="liga-caps mb-2" style={{ color: "var(--liga-ink-soft)" }}>
                      {SHORTCUTS[k].group}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SHORTCUTS[k].chips.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setTipo(k); setTexto(c); }}
                          className={`liga-pill ${k === "provocar" ? "liga-pill--gold" : k === "torcer" ? "liga-pill--blue" : ""}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div>
              <div className="liga-caps mb-2">Prévia do recado</div>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, 200))}
                placeholder={isBroadcast ? "Ex.: Bora bater a meta hoje, time! 💪" : "Escolha um recado acima ou escreva o seu…"}
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                style={{
                  background: "var(--liga-canvas)",
                  border: "1px solid var(--liga-hairline)",
                  color: "var(--liga-ink)",
                  fontFamily: "Instrument Sans, sans-serif",
                }}
              />
              <div className="text-right text-[11px] mt-1" style={{ color: "var(--liga-ink-mute)" }}>
                {texto.length}/200
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 pt-2 space-y-2 border-t" style={{ borderColor: "var(--liga-hairline)" }}>
            <button
              className="liga-btn liga-btn--coral w-full"
              onClick={submit}
              disabled={!texto.trim() || sending}
            >
              {sending ? "Enviando…" : isBroadcast ? "Enviar pra liga" : "Enviar recado"}
            </button>
            <p className="text-[11px] text-center" style={{ color: "var(--liga-ink-mute)" }}>{antispam}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
