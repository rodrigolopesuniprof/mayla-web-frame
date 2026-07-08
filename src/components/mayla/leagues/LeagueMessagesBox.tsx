import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { LeaguePokeComposer } from "./LeaguePokeComposer";

interface Poke {
  id: string;
  league_id: string;
  from_user: string;
  to_user: string | null;
  tipo: "cutucar" | "torcer" | "provocar" | "recado";
  texto: string;
  created_at: string;
  from_name?: string | null;
  from_avatar?: string | null;
}

interface Props {
  leagueId: string;
  leagueName: string;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - +new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
};

export function LeagueMessagesBox({ leagueId, leagueName }: Props) {
  const { user } = useAuth();
  const [pokes, setPokes] = useState<Poke[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<{ user_id: string; full_name: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("league_pokes" as any)
      .select("id, league_id, from_user, to_user, tipo, texto, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data || []) as any[];
    const fromIds = Array.from(new Set(rows.map((r) => r.from_user)));
    let profMap = new Map<string, any>();
    if (fromIds.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, full_name, avatar_url").in("user_id", fromIds);
      ((profs || []) as any[]).forEach((p) => profMap.set(p.user_id, p));
    }
    setPokes(rows.map((r) => ({
      ...r,
      from_name: profMap.get(r.from_user)?.full_name || null,
      from_avatar: profMap.get(r.from_user)?.avatar_url || null,
    })));
    setLoading(false);
  }, [leagueId, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase
      .channel(`pokes-${leagueId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "league_pokes", filter: `league_id=eq.${leagueId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leagueId, load]);

  const thank = async (to_user: string) => {
    if (!user) return;
    const { error } = await supabase.from("league_pokes" as any).insert({
      league_id: leagueId, from_user: user.id, to_user, tipo: "torcer",
      texto: "Valeu pela força! 🙏",
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Agradecimento enviado 💙" });
    load();
  };

  if (loading) return <p className="text-sm liga-muted p-4">Carregando recados…</p>;

  if (pokes.length === 0) {
    return (
      <div className="liga-card text-center py-8">
        <div className="text-3xl mb-2">📬</div>
        <p className="text-sm" style={{ color: "var(--liga-ink-soft)" }}>
          Nenhum recado na liga ainda. Que tal cutucar alguém parado?
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pokes.map((p) => {
          const isBroadcast = p.to_user === null;
          const isForMe = p.to_user === user?.id;
          const isFromMe = p.from_user === user?.id;
          const firstName = (p.from_name || "Alguém").split(" ")[0];

          if (isBroadcast) {
            return (
              <div key={p.id} className="liga-dark-card">
                <div className="liga-caps mb-1" style={{ color: "var(--liga-on-dark)", opacity: .7 }}>
                  📣 Recado pra liga · {timeAgo(p.created_at)}
                </div>
                <p style={{ fontSize: 14 }}>
                  <strong>{firstName}:</strong> {p.texto}
                </p>
              </div>
            );
          }

          const badge =
            p.tipo === "cutucar" ? { emoji: "👉", label: "te cutucou" }
            : p.tipo === "torcer" ? { emoji: "👏", label: "torceu por você" }
            : p.tipo === "provocar" ? { emoji: "🔥", label: "te provocou" }
            : { emoji: "💬", label: "te mandou um recado" };

          if (isForMe) {
            const bubbleBg = p.tipo === "torcer" ? "var(--liga-pill-blue)"
              : p.tipo === "provocar" ? "var(--liga-gold-bg)"
              : "var(--liga-coral-soft)";
            const border = p.tipo === "torcer" ? "rgba(86,112,149,.25)"
              : p.tipo === "provocar" ? "rgba(201,151,58,.28)"
              : "rgba(223,106,77,.35)";
            return (
              <div key={p.id} className="liga-card" style={{ borderColor: border }}>
                <div className="text-sm mb-1" style={{ color: "var(--liga-ink-soft)" }}>
                  <strong style={{ color: "var(--liga-ink)" }}>{firstName}</strong> {badge.label} {badge.emoji}
                  <span className="ml-2 text-[11px]" style={{ color: "var(--liga-ink-mute)" }}>{timeAgo(p.created_at)}</span>
                </div>
                <div className="rounded-xl px-3 py-2 text-sm mb-2"
                  style={{ background: bubbleBg, color: "var(--liga-ink)" }}>
                  "{p.texto}"
                </div>
                <div className="flex gap-2">
                  {p.tipo === "torcer" ? (
                    <button className="liga-btn liga-btn--sm liga-btn--steel" onClick={() => thank(p.from_user)}>
                      👏 Agradecer
                    </button>
                  ) : (
                    <button
                      className="liga-btn liga-btn--sm"
                      onClick={() => setReplyTo({ user_id: p.from_user, full_name: p.from_name || null })}
                    >
                      ↩ Responder
                    </button>
                  )}
                </div>
              </div>
            );
          }

          if (isFromMe) {
            return (
              <div key={p.id} className="liga-card" style={{ opacity: 0.9 }}>
                <div className="text-xs" style={{ color: "var(--liga-ink-soft)" }}>
                  Você {badge.label.replace("te ", "").replace("por você", "")} · {timeAgo(p.created_at)}
                </div>
                <div className="text-sm mt-1">"{p.texto}"</div>
              </div>
            );
          }
          return null;
        })}
      </div>

      <LeaguePokeComposer
        open={replyTo !== null}
        onOpenChange={(o) => !o && setReplyTo(null)}
        leagueId={leagueId}
        leagueName={leagueName}
        target={replyTo}
        defaultTipo="torcer"
        onSent={load}
      />
    </>
  );
}
