import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { MAYLA_LEAGUE_ID, useDefaultLeague } from "./constants";
import { useLeagueFeed, useWeekCountdown } from "./useLeagueFeed";
import { LeaguePokeComposer } from "./LeaguePokeComposer";
import "./leagues.css";

interface League {
  id: string;
  nome: string;
  visibilidade: "publica" | "privada";
  invite_code: string;
  status: "ativa" | "arquivada";
  owner_id: string;
  marca_logo_url: string | null;
}

interface Props {
  onBack: () => void;
  onOpen: (id: string) => void;
}

const firstName = (n?: string | null) => (n || "Você").split(" ")[0];

export function LeaguesPanel({ onOpen }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { streak } = useDailyStreak();
  const countdown = useWeekCountdown();
  const { league: defaultLeague } = useDefaultLeague(companyId);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<League[]>([]);
  const [selectedId, setSelectedId] = useState<string>(MAYLA_LEAGUE_ID);
  const [weekGoal, setWeekGoal] = useState<number>(200);
  const [userXp, setUserXp] = useState<number>(0);
  const [userLevel, setUserLevel] = useState<string>("Nível 1");
  const [ownedActive, setOwnedActive] = useState<number>(0);
  const [prevPos, setPrevPos] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [pokeState, setPokeState] = useState<{ target: { user_id: string; full_name: string | null } | null; tipo: "cutucar" | "torcer" | "provocar" | "recado" } | null>(null);
  const [rules, setRules] = useState<Array<{ event_key: string; label: string; emoji: string | null }>>([]);
  const [form, setForm] = useState({ nome: "", visibilidade: "privada" as "publica" | "privada", scoring_event_keys: [] as string[], logo_file: null as File | null });
  const [saving, setSaving] = useState(false);

  // Resolve the "Mayla" sentinel to the real per-company default league id.
  const isDefaultSelected = selectedId === MAYLA_LEAGUE_ID;
  const effectiveSelectedId = isDefaultSelected ? (defaultLeague?.id || MAYLA_LEAGUE_ID) : selectedId;
  const feed = useLeagueFeed(effectiveSelectedId, companyId);
  const leagueSel = isDefaultSelected
    ? (defaultLeague ? { id: defaultLeague.id, nome: defaultLeague.nome, visibilidade: "publica" as const, invite_code: "", status: "ativa" as const, owner_id: defaultLeague.owner_id, marca_logo_url: defaultLeague.marca_logo_url } : null)
    : (myLeagues.find((l) => l.id === selectedId) || null);
  const leagueSelName = isDefaultSelected ? (defaultLeague?.nome || "sua liga") : leagueSel?.nome || "sua liga";

  useEffect(() => {
    if (!user || !companyId) return;
    supabase.from("companies").select("leagues_enabled").eq("id", companyId).maybeSingle()
      .then(({ data }) => setEnabled(!!(data as any)?.leagues_enabled));

    Promise.all([
      supabase.rpc("get_effective_goals" as any, { _company_id: companyId }),
      supabase.rpc("user_xp" as any, { p_user: user.id }),
      supabase.from("profiles").select("level").eq("user_id", user.id).maybeSingle(),
    ]).then(([gl, xp, prof]) => {
      const gRow = Array.isArray(gl.data) ? (gl.data[0] as any) : (gl.data as any);
      if (gRow?.weekly_goal) setWeekGoal(gRow.weekly_goal);
      setUserXp(Number((xp.data as any) || 0));
      if ((prof.data as any)?.level) setUserLevel((prof.data as any).level);
    });

    supabase.from("league_members" as any)
      .select("league_id, leagues:league_id (id, nome, visibilidade, invite_code, status, owner_id, marca_logo_url)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const mine = ((data || []) as any[]).map((m) => m.leagues).filter((l) => l && l.status === "ativa") as League[];
        setMyLeagues(mine);
        setOwnedActive(mine.filter((l) => l.owner_id === user.id).length);
      });

    supabase.from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, marca_logo_url")
      .eq("company_id", companyId).eq("visibilidade", "publica").eq("status", "ativa").limit(20)
      .then(({ data }) => setPublicLeagues(((data || []) as any[])));

    supabase.from("point_rules").select("event_key, label, emoji, active")
      .eq("company_id", companyId).eq("active", true).order("label")
      .then(({ data }) => setRules(((data || []) as any[]).map((r) => ({ event_key: r.event_key, label: r.label, emoji: r.emoji }))));
  }, [user, companyId]);

  // "posição anterior" para calcular delta do dia — snapshot local em sessionStorage
  useEffect(() => {
    const me = feed.members.find((m) => m.user_id === user?.id);
    if (!me?.posicao) return;
    const key = `liga_prev_pos_${selectedId}`;
    const stored = sessionStorage.getItem(key);
    if (stored && Number(stored) !== me.posicao) {
      setPrevPos(Number(stored));
    } else if (!stored) {
      setPrevPos(null);
    }
    sessionStorage.setItem(key, String(me.posicao));
  }, [feed.members, selectedId, user]);

  const me = feed.members.find((m) => m.user_id === user?.id);
  const myPts = me?.pontos_semana ?? 0;
  const myPos = me?.posicao ?? null;
  const totalMembers = feed.members.length;
  const pct = Math.min(100, Math.round((myPts / Math.max(1, weekGoal)) * 100));
  const posDelta = prevPos && myPos ? prevPos - myPos : 0; // positivo = subiu

  const nextAheadPts = myPos && myPos > 1
    ? feed.members.find((m) => m.posicao === myPos - 1)?.pontos_semana ?? null
    : null;
  const gap = nextAheadPts !== null ? Math.max(0, nextAheadPts - myPts) : null;

  const parado = feed.members.find((m) => {
    if (!m.last_point_at) return true;
    return Date.now() - +new Date(m.last_point_at) > 1000 * 60 * 60 * 48;
  });
  const leader = feed.members.find((m) => m.posicao === 1 && m.user_id !== user?.id);

  const streakColetivo = totalMembers > 0 ? Math.round((feed.memberCountWithPointsToday / totalMembers) * 100) : 0;
  const missingForPrize = feed.prize && !feed.prize.elegivel ? Math.max(0, 10 - feed.prize.membros) : 0;

  const toggleKey = (k: string) =>
    setForm((f) => ({ ...f, scoring_event_keys: f.scoring_event_keys.includes(k) ? f.scoring_event_keys.filter((x) => x !== k) : [...f.scoring_event_keys, k] }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyId) return;
    if (ownedActive >= 1) { toast({ title: "Você já tem 1 liga ativa", variant: "destructive" }); return; }
    setSaving(true);
    let logoUrl: string | null = null;
    if (form.logo_file) {
      const ext = form.logo_file.name.split(".").pop() || "png";
      const path = `leagues/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("company-logos").upload(path, form.logo_file, { upsert: true });
      if (!upErr) logoUrl = supabase.storage.from("company-logos").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await supabase.from("leagues" as any).insert({
      company_id: companyId, owner_id: user.id, nome: form.nome.trim(),
      visibilidade: form.visibilidade, scoring_event_keys: form.scoring_event_keys, marca_logo_url: logoUrl,
    } as any).select("id").single();
    setSaving(false);
    if (error) { toast({ title: "Erro ao criar liga", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Liga criada! 🏆" });
    setShowCreate(false);
    setForm({ nome: "", visibilidade: "privada", scoring_event_keys: [], logo_file: null });
    onOpen((data as any).id);
  };

  const handleJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;
    const { data: lg } = await supabase.from("leagues" as any)
      .select("id, visibilidade, status").eq("invite_code", joinCode.trim()).maybeSingle();
    if (!lg || (lg as any).status !== "ativa") { toast({ title: "Código inválido", variant: "destructive" }); return; }
    if ((lg as any).visibilidade === "privada") { toast({ title: "Liga privada", description: "Peça ao dono para adicionar você.", variant: "destructive" }); return; }
    const { error } = await supabase.from("league_members" as any).insert({ league_id: (lg as any).id, user_id: user.id });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você entrou na liga! 🎉" });
    setShowJoin(false); setJoinCode("");
    onOpen((lg as any).id);
  };

  const cannotCreate = ownedActive >= 1;
  const initials = firstName(me?.full_name)[0]?.toUpperCase() || "A";

  return (
    <div className="liga-scope flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <h1 className="liga-h1">Ligas</h1>
        <div className="relative">
          <div className="liga-avatar-coral" style={{ height: 40, width: 40, fontSize: 15 }}>{initials}</div>
          {streak > 0 && (
            <span className="absolute -top-1 -right-2 liga-pill liga-pill--coral"
              style={{ padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>
              🔥{streak}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        {/* Faixa de estado */}
        <div className="liga-dark-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="liga-caps" style={{ color: "var(--liga-on-dark)", opacity: .65 }}>Sua semana</div>
              <div className="liga-serif" style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>
                {myPos ? `${myPos}º` : "—"} na {leagueSelName}
              </div>
              <div className="text-xs mt-1" style={{ opacity: .8 }}>
                {posDelta > 0 && <><span style={{ color: "var(--liga-green)" }}>↑ subiu {posDelta} posiç{posDelta === 1 ? "ão" : "ões"} hoje</span> · de {totalMembers}</>}
                {posDelta < 0 && <><span style={{ color: "var(--liga-coral)" }}>↓ caiu {Math.abs(posDelta)}</span> · de {totalMembers}</>}
                {posDelta === 0 && <>de {totalMembers} participantes</>}
              </div>
            </div>
            <div className="text-right">
              <div className="liga-caps" style={{ color: "var(--liga-on-dark)", opacity: .65 }}>Zera em</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{countdown}</div>
            </div>
          </div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px]" style={{ opacity: .75 }}>Placar da semana</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{myPts} / {weekGoal} pts</span>
          </div>
          <div className="liga-bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="mt-3 pt-3 flex items-center justify-between text-[11px]"
            style={{ borderTop: "1px solid rgba(255,255,255,.1)", opacity: .8 }}>
            <span>{userLevel} · {userXp.toLocaleString("pt-BR")} XP vitalício ∞</span>
            <span className="liga-pill" style={{ background: "rgba(255,255,255,.1)", color: "var(--liga-on-dark)", borderColor: "transparent", padding: "3px 8px", fontSize: 10 }}>não zera</span>
          </div>
        </div>

        {/* Foco da semana */}
        <div className="liga-gold-card flex items-center gap-3">
          <div style={{ fontSize: 26 }}>🚶</div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Caminhada rende 2× essa semana</div>
            <div className="text-xs mt-0.5" style={{ opacity: .85 }}>
              {feed.events.length > 0 ? `A liga já somou ${feed.events.reduce((a, e) => a + e.points, 0).toLocaleString("pt-BR")} pts hoje` : "Registre agora e acelere o placar"}
            </div>
          </div>
          <button className="liga-btn liga-btn--gold liga-btn--sm">Registrar</button>
        </div>

        {/* Switcher */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setSelectedId(MAYLA_LEAGUE_ID)}
            className={`liga-pill ${isDefaultSelected ? "liga-pill--active" : ""}`}
          >
            🏆 {defaultLeague?.nome || "Sua empresa"}
          </button>
          {myLeagues.map((l) => (
            <button key={l.id}
              onClick={() => setSelectedId(l.id)}
              onDoubleClick={() => onOpen(l.id)}
              className={`liga-pill ${selectedId === l.id ? "liga-pill--active" : ""}`}
            >
              {l.nome} <span style={{ opacity: .5 }}>•</span>
            </button>
          ))}
          <button onClick={() => setShowJoin(true)} className="liga-pill">+ código</button>
        </div>

        {/* Feed ao vivo */}
        <div className="liga-caps flex items-center px-1 pt-2">
          <span className="liga-dot-live" /> AO VIVO NA {leagueSelName.toUpperCase()}
        </div>

        {/* Alerta de queda */}
        {gap !== null && gap > 0 && gap <= 50 && myPos && myPos > 1 && (
          <div className="liga-dark-card">
            <div className="text-sm mb-2">
              ⚠ Você tá {gap} pts atrás do {myPos - 1}º. Um empurrão te devolve a posição.
            </div>
            <button className="liga-btn liga-btn--coral w-full">Bater meta agora → caminhada 2×</button>
          </div>
        )}

        {/* Desafio relâmpago */}
        {feed.currentChallenge && (
          <div className="liga-gold-card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>⚡ {feed.currentChallenge.titulo}</div>
                <div className="text-[11px] mt-0.5" style={{ opacity: .8 }}>
                  Meta: {feed.currentChallenge.alvo} · {feed.currentChallenge.metrica}
                </div>
              </div>
              <button
                className="liga-btn liga-btn--gold liga-btn--sm"
                onClick={() => leagueSel && onOpen(leagueSel.id)}
              >
                Entrar
              </button>
            </div>
          </div>
        )}

        {/* Evento de pontuação (primeiro) */}
        {feed.events.slice(0, 2).map((e) => (
          <div key={`${e.user_id}-${e.created_at}`} className="liga-card flex items-center gap-3">
            <div className="liga-avatar-coral h-9 w-9" style={{ fontSize: 14, background: "var(--liga-ink-mute)" }}>
              {firstName(e.full_name)[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                <strong>{firstName(e.full_name)}</strong> bateu {e.points} pts 🔥
              </div>
            </div>
            <button
              className="liga-btn liga-btn--sm liga-btn--steel"
              onClick={() => setPokeState({ target: { user_id: e.user_id, full_name: e.full_name }, tipo: "torcer" })}
            >
              👏 Torcer
            </button>
          </div>
        ))}

        {/* Cutucar parado */}
        {parado && parado.user_id !== user?.id && (
          <div className="liga-card liga-row--warn" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="liga-avatar-coral h-9 w-9" style={{ fontSize: 14, background: "var(--liga-ink-mute)" }}>
              {firstName(parado.full_name)[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                <strong>{firstName(parado.full_name)}</strong> tá parad{parado.full_name?.match(/a$/) ? "a" : "o"} há 2+ dias 😴
              </div>
            </div>
            <button
              className="liga-btn liga-btn--sm liga-btn--coral"
              onClick={() => setPokeState({ target: { user_id: parado.user_id, full_name: parado.full_name }, tipo: "cutucar" })}
            >
              👉 Cutucar
            </button>
          </div>
        )}

        {/* Streak coletivo */}
        {totalMembers > 0 && (
          <div className="liga-coral-card">
            <div className="text-sm mb-1">
              🔥 Streak coletivo: {feed.memberCountWithPointsToday}/{totalMembers} pontuaram hoje
            </div>
            <div className="liga-bar liga-bar--light"><i style={{ width: `${streakColetivo}%` }} /></div>
          </div>
        )}

        {/* Convite viral */}
        {leagueSel && missingForPrize > 0 && (
          <div className="liga-dark-card">
            <div className="text-sm mb-2">
              🎁 Chame um colega, ganhe R$10 · faltam {missingForPrize} p/ desbloquear prêmios · {feed.prize?.membros}/10
            </div>
            <div className="liga-bar mb-3"><i style={{ width: `${((feed.prize?.membros || 0) / 10) * 100}%` }} /></div>
            <button className="liga-btn liga-btn--coral w-full" onClick={() => onOpen(leagueSel.id)}>
              Convidar · copiar link
            </button>
          </div>
        )}

        {/* CTA para abrir a liga selecionada em detalhe */}
        {leagueSel && (
          <button className="liga-btn w-full" onClick={() => onOpen(leagueSel.id)}>
            Abrir {leagueSel.nome} →
          </button>
        )}
        {isDefaultSelected && defaultLeague && (
          <button className="liga-btn w-full" onClick={() => onOpen(defaultLeague.id)}>
            Abrir {defaultLeague.nome} →
          </button>
        )}
      </div>

      {/* Rodapé fixo */}
      {enabled && (
        <div className="px-5 py-3 space-y-2 border-t" style={{ background: "var(--liga-canvas)", borderColor: "var(--liga-hairline)" }}>
          <div className="flex gap-2">
            <button className="liga-btn flex-1"
              onClick={() => !cannotCreate && setShowCreate(true)}
              disabled={cannotCreate}
              title={cannotCreate ? "Você já tem 1 liga ativa" : undefined}>
              + Criar liga
            </button>
            <button className="liga-btn liga-btn--steel flex-1" onClick={() => setShowJoin(true)}>
              Entrar por código
            </button>
          </div>
          <p className="text-[11px] text-center" style={{ color: "var(--liga-ink-mute)" }}>
            {cannotCreate
              ? `Você já tem 1 liga ativa (${myLeagues.find((l) => l.owner_id === user?.id)?.nome}) · participa de quantas quiser`
              : "Você pode criar 1 liga · participar de quantas quiser"}
          </p>
        </div>
      )}

      {/* Cutucadas do hub */}
      {leagueSel && pokeState && (
        <LeaguePokeComposer
          open={!!pokeState}
          onOpenChange={(o) => !o && setPokeState(null)}
          leagueId={leagueSel.id}
          leagueName={leagueSel.nome}
          target={pokeState.target}
          defaultTipo={pokeState.tipo}
          onSent={() => feed.reload()}
        />
      )}

      {/* Ligas públicas para entrar (rolagem inferior) — só se houver */}
      {publicLeagues.filter((p) => !myLeagues.some((m) => m.id === p.id)).length > 0 && enabled && (
        <Dialog open={false} onOpenChange={() => {}}><DialogContent /></Dialog>
      )}

      {/* Criar */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="liga-scope max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="liga-serif">Criar nova liga</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="liga-caps block mb-1">Nome</label>
              <input required maxLength={60} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Time da diretoria"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid var(--liga-hairline)", background: "var(--liga-canvas)" }} />
            </div>
            <div>
              <label className="liga-caps block mb-1">Marca / logo (opcional)</label>
              <input type="file" accept="image/*"
                onChange={(e) => setForm({ ...form, logo_file: e.target.files?.[0] ?? null })}
                className="text-xs" />
            </div>
            <div>
              <label className="liga-caps block mb-1">Visibilidade</label>
              <div className="flex gap-2">
                <button type="button" className={`liga-btn flex-1 ${form.visibilidade === "privada" ? "liga-btn--coral" : ""}`}
                  onClick={() => setForm({ ...form, visibilidade: "privada" })}>🔒 Privada</button>
                <button type="button" className={`liga-btn flex-1 ${form.visibilidade === "publica" ? "liga-btn--coral" : ""}`}
                  onClick={() => setForm({ ...form, visibilidade: "publica" })}>🌍 Pública</button>
              </div>
            </div>
            <div>
              <label className="liga-caps block mb-1">Atividades que pontuam</label>
              <p className="text-[11px] mb-1" style={{ color: "var(--liga-ink-soft)" }}>
                Vazio = <strong>todas</strong> as atividades contam.
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl p-2"
                style={{ border: "1px solid var(--liga-hairline)" }}>
                {rules.map((r) => (
                  <label key={r.event_key} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer">
                    <Checkbox checked={form.scoring_event_keys.includes(r.event_key)} onCheckedChange={() => toggleKey(r.event_key)} />
                    <span className="text-sm flex-1">{r.emoji && <span className="mr-1">{r.emoji}</span>}{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="liga-btn liga-btn--coral w-full" disabled={saving || !form.nome.trim()}>
              {saving ? "Criando…" : "Criar liga"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Entrar por código */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="liga-scope max-w-sm">
          <DialogHeader><DialogTitle className="liga-serif">Entrar por código</DialogTitle></DialogHeader>
          <form onSubmit={handleJoinCode} className="space-y-3">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Ex: 7202cdbdb0" required autoFocus
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--liga-hairline)", background: "var(--liga-canvas)" }} />
            <p className="text-[11px]" style={{ color: "var(--liga-ink-soft)" }}>
              Ligas privadas exigem convite direto do dono.
            </p>
            <button type="submit" className="liga-btn liga-btn--coral w-full" disabled={!joinCode.trim()}>Entrar</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
