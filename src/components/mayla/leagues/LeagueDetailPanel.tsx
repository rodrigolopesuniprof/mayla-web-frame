import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { ChevronLeft, Settings, UserPlus, LogOut, Crown, Lock } from "lucide-react";
import { LeagueManagePanel } from "./LeagueManagePanel";
import { LeagueInvitePanel } from "./LeagueInvitePanel";
import { LeaguePokeComposer } from "./LeaguePokeComposer";
import { LeagueMessagesBox } from "./LeagueMessagesBox";
import { useLeagueFeed } from "./useLeagueFeed";
import "./leagues.css";

interface League {
  id: string; nome: string; visibilidade: "publica" | "privada";
  invite_code: string; status: string; owner_id: string; company_id: string;
  marca_logo_url: string | null; scoring_event_keys: string[]; created_at: string;
  is_default: boolean; conversations_enabled: boolean;
}

interface Challenge {
  id: string; titulo: string; metrica: string; alvo: number;
  premio: string | null; week_id: string;
}

interface Props { leagueId: string; onBack: () => void; onLeft: () => void; }
type Tab = "ranking" | "desafios" | "membros" | "recados";
type Sub = "detail" | "manage" | "invite";

const firstName = (n?: string | null) => (n || "Colaborador").split(" ")[0];

export function LeagueDetailPanel({ leagueId, onBack, onLeft }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompany();

  const [league, setLeague] = useState<League | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [tab, setTab] = useState<Tab>("ranking");
  const [sub, setSub] = useState<Sub>("detail");
  const [pokeState, setPokeState] = useState<{ target: { user_id: string; full_name: string | null } | null; tipo: "cutucar" | "torcer" | "provocar" | "recado" } | null>(null);

  const feed = useLeagueFeed(league?.id || leagueId, companyId);

  const loadLeague = () => {
    supabase.from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, company_id, marca_logo_url, scoring_event_keys, created_at, is_default, conversations_enabled")
      .eq("id", leagueId).maybeSingle()
      .then(({ data }) => setLeague(data as any));
  };

  useEffect(() => {
    loadLeague();
    supabase.from("league_challenges" as any)
      .select("id, titulo, metrica, alvo, premio, week_id")
      .eq("league_id", leagueId)
      .order("week_id", { ascending: false }).limit(10)
      .then(({ data }) => setChallenges(((data || []) as any[])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  // Safety-net: if this is a default (company) league, ensure current user is a member
  useEffect(() => {
    if (league?.is_default && companyId) {
      supabase.rpc("ensure_default_league" as any, { _company_id: companyId })
        .then(() => feed.reload());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league?.is_default, companyId]);


  if (!league) {
    return <div className="liga-scope flex-1 p-6"><p className="text-sm liga-muted">Carregando…</p></div>;
  }

  if (sub === "manage") {
    const members = feed.members.map((m) => ({ user_id: m.user_id, papel: m.papel, full_name: m.full_name, avatar_url: m.avatar_url }));
    return <LeagueManagePanel league={league} members={members} onBack={() => { setSub("detail"); loadLeague(); feed.reload(); }} onArchived={onLeft} />;
  }
  if (sub === "invite") {
    return <LeagueInvitePanel league={league} onBack={() => setSub("detail")} />;
  }

  const me = feed.members.find((m) => m.user_id === user?.id);
  const isOwner = league.owner_id === user?.id;
  const isCoadmin = me?.papel === "coadmin";
  const canManage = isOwner || isCoadmin;
  const isDefault = league.is_default;
  const chatOn = league.conversations_enabled;

  const displayName = league.nome;
  const totalMembers = feed.members.length;
  const top3 = feed.members.slice(0, 3);
  const leaderId = feed.members[0]?.user_id;
  const memberRoleLabel = (papel: string, isMe: boolean) =>
    isMe ? (papel === "dono" ? "Dono" : papel === "coadmin" ? "Coadmin" : "Você")
         : (papel === "dono" ? "Dono" : papel === "coadmin" ? "Coadmin" : "");

  const chipFor = (m: typeof feed.members[number]) => {
    if (m.user_id === user?.id) return null;
    const isParado = !m.last_point_at || Date.now() - +new Date(m.last_point_at) > 1000 * 60 * 60 * 48;
    if (m.user_id === leaderId) {
      return { label: "🔥 Provocar", cls: "liga-btn--gold", tipo: "provocar" as const };
    }
    if (isParado) {
      return { label: "👉 Cutucar", cls: "liga-btn--coral", tipo: "cutucar" as const };
    }
    if (me?.posicao && m.posicao && Math.abs(m.posicao - me.posicao) === 1) {
      return { label: "👏 Torcer", cls: "liga-btn--steel", tipo: "torcer" as const };
    }
    return { label: "Recado", cls: "", tipo: "recado" as const };
  };

  const handleLeave = async () => {
    if (!user) return;
    if (!confirm("Sair desta liga?")) return;
    const { error } = await supabase.from("league_members" as any).delete().eq("league_id", league.id).eq("user_id", user.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você saiu da liga." });
    onLeft();
  };

  const enableChat = async () => {
    const { error } = await supabase.from("leagues" as any)
      .update({ conversations_enabled: true } as any).eq("id", league.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Conversas liberadas 💬" });
    loadLeague();
  };

  return (
    <div className="liga-scope flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="liga-btn liga-btn--ghost liga-btn--sm" aria-label="Voltar"
          style={{ padding: 6, border: "none" }}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="liga-serif flex-1 truncate" style={{ fontSize: 22, fontWeight: 600 }}>
          {displayName}
        </h1>
        <div className="flex gap-1">
          {!isDefault && (
            <button className="liga-btn liga-btn--sm" onClick={() => setSub("invite")} title="Convidar">
              <UserPlus className="h-4 w-4" />
            </button>
          )}
          {canManage && (
            <button className="liga-btn liga-btn--sm" onClick={() => setSub("manage")} title="Gerenciar">
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-nav segmentada */}
      <div className="px-5 pb-3">
        <div className="liga-tab-strip">
          {(["ranking", "desafios", "membros", "recados"] as Tab[]).map((t) => {
            const disabled = t === "recados" && !chatOn;
            return (
              <button key={t} onClick={() => !disabled && setTab(t)}
                className={tab === t ? "is-active" : ""}
                disabled={disabled}
                title={disabled ? "Conversas desativadas pelo admin" : undefined}
                style={disabled ? { opacity: 0.35 } : undefined}>
                {t === "ranking" && "Ranking"}
                {t === "desafios" && "Desafios"}
                {t === "membros" && "Membros"}
                {t === "recados" && "Recados"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
        {/* Info liga */}
        <div className="flex items-center gap-3 pb-1 flex-wrap">
          <span className="text-xs" style={{ color: "var(--liga-ink-soft)" }}>
            {isDefault ? "🏢 Liga da empresa" : (league.visibilidade === "publica" ? "🌍 Pública" : "🔒 Privada")} · {totalMembers} membros
            {!isDefault && ` · criada em ${new Date(league.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
          </span>
          {feed.prize?.elegivel && <span className="liga-pill liga-pill--gold">Prêmio ativo</span>}
        </div>

        {/* Admin CTA para liberar conversas */}
        {!chatOn && canManage && (
          <div className="liga-dark-card flex items-center gap-3">
            <Lock className="h-5 w-5" />
            <div className="flex-1 text-sm">
              Recados e cutucadas entre participantes estão desativados.
            </div>
            <button className="liga-btn liga-btn--coral liga-btn--sm" onClick={enableChat}>
              Liberar
            </button>
          </div>
        )}

        {/* Ranking */}
        {tab === "ranking" && (
          <>
            {top3.length > 0 && (
              <div className="liga-podium">
                {[1, 0, 2].map((idx) => {
                  const r = top3[idx];
                  if (!r) return <div key={idx} />;
                  return (
                    <div key={r.user_id} className="liga-podium-block"
                      style={idx === 0 ? { paddingTop: 20, background: "var(--liga-gold)", color: "#fff", borderColor: "transparent" } : undefined}>
                      <div style={{ fontSize: idx === 0 ? 28 : 22, marginBottom: 4 }}>
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                      </div>
                      {r.avatar_url
                        ? <img src={r.avatar_url} alt="" className="mx-auto rounded-full" style={{ height: 36, width: 36, objectFit: "cover" }} />
                        : <div className="liga-avatar-coral mx-auto" style={{ height: 36, width: 36, fontSize: 13, background: idx === 0 ? "rgba(255,255,255,.25)" : "var(--liga-ink-mute)" }}>{firstName(r.full_name)[0]?.toUpperCase()}</div>}
                      <div className="text-xs mt-1 truncate" style={{ fontWeight: 600 }}>{firstName(r.full_name)}</div>
                      <div className="text-[11px]" style={{ opacity: .8 }}>{r.pontos_semana} pts</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-1.5">
              {feed.members.slice(3).map((r) => {
                const isMe = r.user_id === user?.id;
                return (
                  <div key={r.user_id} className={`liga-row ${isMe ? "liga-row--me" : ""}`}>
                    <div style={{ width: 22, textAlign: "center", fontWeight: 600, color: "var(--liga-ink-mute)", fontSize: 13 }}>{r.posicao}º</div>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt="" className="rounded-full" style={{ height: 32, width: 32, objectFit: "cover" }} />
                      : <div className="liga-avatar-coral" style={{ height: 32, width: 32, fontSize: 12, background: "var(--liga-ink-mute)" }}>{firstName(r.full_name)[0]?.toUpperCase()}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ fontWeight: 500 }}>{isMe ? "Você" : firstName(r.full_name)}</p>
                    </div>
                    <span className="text-sm" style={{ fontWeight: 600 }}>{r.pontos_semana} pts</span>
                  </div>
                );
              })}
              {feed.members.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "var(--liga-ink-soft)" }}>
                  Ninguém pontuou esta semana ainda.
                </p>
              )}
            </div>
            <p className="text-[11px] px-1" style={{ color: "var(--liga-ink-mute)" }}>
              O placar zera na virada da semana. Nível (vitalício) continua contando ∞
            </p>
          </>
        )}

        {/* Desafios */}
        {tab === "desafios" && (
          <div className="space-y-2">
            {challenges.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: "var(--liga-ink-soft)" }}>
                Nenhum desafio criado nesta liga ainda.
              </p>
            )}
            {challenges.map((c) => (
              <div key={c.id} className="liga-card">
                <p style={{ fontSize: 14, fontWeight: 600 }}>⚡ {c.titulo}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--liga-ink-soft)" }}>
                  Meta: {c.alvo} · {c.metrica} · semana {c.week_id}
                </p>
                {c.premio && <p className="text-xs mt-1" style={{ color: "var(--liga-gold-ink)" }}>🎁 {c.premio}</p>}
              </div>
            ))}
            <p className="text-[11px] px-1" style={{ color: "var(--liga-ink-mute)" }}>
              Desafios de liga dão badges/prêmios, não pontos — o placar vem só de atividade real de saúde.
            </p>
          </div>
        )}

        {/* Membros */}
        {tab === "membros" && (
          <>
            {chatOn && (
              <div className="liga-dark-card flex items-center gap-3 mb-2">
                <div style={{ fontSize: 22 }}>📣</div>
                <div className="flex-1 text-sm">Manda um recado pra liga toda</div>
                <button className="liga-btn liga-btn--coral liga-btn--sm"
                  onClick={() => setPokeState({ target: null, tipo: "recado" })}>
                  Novo recado
                </button>
              </div>
            )}
            <div className="liga-caps px-1">{feed.members.length} MEMBROS</div>
            <div className="space-y-1.5">
              {feed.members.map((m) => {
                const isMe = m.user_id === user?.id;
                const isParado = !m.last_point_at || Date.now() - +new Date(m.last_point_at) > 1000 * 60 * 60 * 48;
                const chip = chipFor(m);
                const roleLbl = memberRoleLabel(m.papel, isMe);
                return (
                  <div key={m.user_id} className={`liga-row ${isMe ? "liga-row--me" : ""} ${!isMe && isParado ? "liga-row--warn" : ""}`}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="rounded-full" style={{ height: 36, width: 36, objectFit: "cover" }} />
                      : <div className="liga-avatar-coral" style={{ height: 36, width: 36, fontSize: 13, background: isMe ? "var(--liga-coral)" : "var(--liga-ink-mute)" }}>{firstName(m.full_name)[0]?.toUpperCase()}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate flex items-center gap-1" style={{ fontWeight: 500 }}>
                        {isMe ? "Você" : firstName(m.full_name)}
                        {m.papel === "dono" && <Crown className="h-3 w-3" style={{ color: "var(--liga-gold)" }} />}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--liga-ink-soft)" }}>
                        {roleLbl}{roleLbl && " · "}{m.posicao ? `${m.posicao}º` : "—"} · {m.pontos_semana} pts
                        {isParado && !isMe && " · 😴 parad" + (m.full_name?.match(/a$/) ? "a" : "o")}
                      </p>
                    </div>
                    {chip && chatOn && (
                      <button
                        className={`liga-btn liga-btn--sm ${chip.cls}`}
                        onClick={() => setPokeState({ target: { user_id: m.user_id, full_name: m.full_name }, tipo: chip.tipo })}
                      >
                        {chip.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Recados */}
        {tab === "recados" && chatOn && (
          <div className="space-y-3">
            <button className="liga-btn liga-btn--coral w-full"
              onClick={() => setPokeState({ target: null, tipo: "recado" })}>
              📣 Novo recado pra liga
            </button>
            <LeagueMessagesBox leagueId={leagueId} leagueName={league.nome} />
          </div>
        )}

        {!isDefault && !isOwner && tab === "membros" && (
          <button className="liga-btn w-full mt-3" onClick={handleLeave}>
            <LogOut className="h-4 w-4" /> Sair da liga
          </button>
        )}
      </div>

      {pokeState && (
        <LeaguePokeComposer
          open={!!pokeState}
          onOpenChange={(o) => !o && setPokeState(null)}
          leagueId={league.id}
          leagueName={league.nome}
          target={pokeState.target}
          defaultTipo={pokeState.tipo}
          onSent={() => feed.reload()}
        />
      )}
    </div>
  );
}
