import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, KeyRound, Trophy, Users, Gift } from "lucide-react";
import { TopBar } from "../TopBar";
import { MAYLA_LEAGUE_ID } from "./constants";

interface League {
  id: string;
  nome: string;
  visibilidade: "publica" | "privada";
  invite_code: string;
  status: "ativa" | "arquivada";
  owner_id: string;
  marca_logo_url: string | null;
}

interface PointRule {
  event_key: string;
  label: string;
  emoji: string | null;
}

interface RankRow { user_id: string; pontos_semana: number; posicao: number }

interface Props {
  onBack: () => void;
  onOpen: (id: string) => void;
}

export function LeaguesPanel({ onBack, onOpen }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<League[]>([]);
  const [maylaMembers, setMaylaMembers] = useState<number>(0);
  const [maylaRanking, setMaylaRanking] = useState<Record<string, RankRow>>({});
  const [leagueRanks, setLeagueRanks] = useState<Record<string, RankRow>>({});
  const [leagueMemberCount, setLeagueMemberCount] = useState<Record<string, number>>({});
  const [leaguePrize, setLeaguePrize] = useState<Record<string, { membros: number; elegivel: boolean }>>({});
  const [weekGoal, setWeekGoal] = useState<number>(200);
  const [userXp, setUserXp] = useState<number>(0);
  const [ownedActive, setOwnedActive] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    visibilidade: "privada" as "publica" | "privada",
    scoring_event_keys: [] as string[],
    logo_file: null as File | null,
  });
  const [rules, setRules] = useState<PointRule[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user || !companyId) { setLoading(false); return; }
    setLoading(true);

    const { data: company } = await supabase
      .from("companies").select("leagues_enabled").eq("id", companyId).maybeSingle();
    setEnabled(!!(company as any)?.leagues_enabled);

    // Liga Mayla — total members = colaboradores da empresa
    const { count: memCount } = await supabase.from("profiles")
      .select("user_id", { count: "exact", head: true }).eq("company_id", companyId);
    setMaylaMembers(memCount || 0);

    // Ranking geral (Liga Mayla) + weekly goal + XP
    const [rk, gl, xp] = await Promise.all([
      supabase.rpc("mayla_ranking" as any, { p_company_id: companyId }),
      supabase.rpc("get_effective_goals" as any, { _company_id: companyId }),
      supabase.rpc("user_xp" as any, { p_user: user.id }),
    ]);
    const rkMap: Record<string, RankRow> = {};
    ((rk.data || []) as RankRow[]).forEach((r) => { rkMap[r.user_id] = r; });
    setMaylaRanking(rkMap);
    const gRow = Array.isArray(gl.data) ? (gl.data[0] as any) : (gl.data as any);
    if (gRow?.weekly_goal) setWeekGoal(gRow.weekly_goal);
    setUserXp(Number((xp.data as any) || 0));

    // Minhas ligas (via membership)
    const { data: memberships } = await supabase
      .from("league_members" as any)
      .select("league_id, leagues:league_id (id, nome, visibilidade, invite_code, status, owner_id, marca_logo_url)")
      .eq("user_id", user.id);
    const mine = ((memberships || []) as any[])
      .map((m) => m.leagues)
      .filter((l) => l && l.status === "ativa") as League[];
    setMyLeagues(mine);

    setOwnedActive(mine.filter((l) => l.owner_id === user.id).length);

    // Public leagues in company
    const { data: publics } = await supabase
      .from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, marca_logo_url")
      .eq("company_id", companyId)
      .eq("visibilidade", "publica")
      .eq("status", "ativa")
      .limit(30);
    const mineIds = new Set(mine.map((l) => l.id));
    setPublicLeagues(((publics || []) as any[]).filter((l) => !mineIds.has(l.id)));

    // Ranking + member counts + prize eligibility for each of mine
    if (mine.length > 0) {
      const ids = mine.map((l) => l.id);
      const ranksMap: Record<string, RankRow> = {};
      await Promise.all(mine.map(async (l) => {
        const { data } = await supabase.rpc("league_ranking" as any, { p_league_id: l.id });
        const mineRow = ((data || []) as RankRow[]).find((r) => r.user_id === user.id);
        if (mineRow) ranksMap[l.id] = mineRow;
      }));
      setLeagueRanks(ranksMap);

      const { data: pe } = await supabase
        .from("league_prize_eligible" as any)
        .select("league_id, membros, elegivel_premio_mayla")
        .in("league_id", ids);
      const peMap: Record<string, { membros: number; elegivel: boolean }> = {};
      const memMap: Record<string, number> = {};
      ((pe || []) as any[]).forEach((r) => {
        peMap[r.league_id] = { membros: Number(r.membros) || 0, elegivel: !!r.elegivel_premio_mayla };
        memMap[r.league_id] = Number(r.membros) || 0;
      });
      setLeaguePrize(peMap);
      setLeagueMemberCount(memMap);
    }

    // Regras de pontuação para o form de criação
    const { data: pr } = await supabase
      .from("point_rules")
      .select("event_key, label, emoji, active")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("label");
    setRules(((pr || []) as any[]).map((r) => ({ event_key: r.event_key, label: r.label, emoji: r.emoji })));

    setLoading(false);
  };

  useEffect(() => { load(); }, [user, companyId]);

  const toggleKey = (key: string) => {
    setForm((f) => ({
      ...f,
      scoring_event_keys: f.scoring_event_keys.includes(key)
        ? f.scoring_event_keys.filter((k) => k !== key)
        : [...f.scoring_event_keys, key],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyId) return;
    if (ownedActive >= 1) {
      toast({ title: "Você já tem uma liga ativa", description: "Arquive a atual para criar outra.", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Upload logo (opcional)
    let logoUrl: string | null = null;
    if (form.logo_file) {
      const ext = form.logo_file.name.split(".").pop() || "png";
      const path = `leagues/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("company-logos").upload(path, form.logo_file, { upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("company-logos").getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }
    }

    const { data, error } = await supabase
      .from("leagues" as any)
      .insert({
        company_id: companyId, owner_id: user.id,
        nome: form.nome.trim(), visibilidade: form.visibilidade,
        scoring_event_keys: form.scoring_event_keys,
        marca_logo_url: logoUrl,
      } as any)
      .select("id").single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar liga", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Liga criada! 🏆" });
    setShowCreate(false);
    setForm({ nome: "", visibilidade: "privada", scoring_event_keys: [], logo_file: null });
    onOpen((data as any).id);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;
    setJoining(true);
    const code = joinCode.trim();
    const { data: lg } = await supabase
      .from("leagues" as any)
      .select("id, nome, visibilidade, status")
      .eq("invite_code", code).maybeSingle();
    if (!lg || (lg as any).status !== "ativa") {
      setJoining(false);
      toast({ title: "Código inválido", description: "Confira e tente novamente.", variant: "destructive" });
      return;
    }
    if ((lg as any).visibilidade === "privada") {
      setJoining(false);
      toast({ title: "Liga privada", description: "Peça ao dono para adicionar você.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("league_members" as any)
      .insert({ league_id: (lg as any).id, user_id: user.id });
    setJoining(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você entrou na liga! 🎉" });
    setShowJoin(false);
    setJoinCode("");
    onOpen((lg as any).id);
  };

  const handleJoinPublic = async (leagueId: string) => {
    if (!user) return;
    const { error } = await supabase.from("league_members" as any).insert({ league_id: leagueId, user_id: user.id });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você entrou na liga! 🎉" });
    onOpen(leagueId);
  };

  const myMaylaRow = user ? maylaRanking[user.id] : undefined;
  const maylaPts = myMaylaRow?.pontos_semana ?? 0;
  const maylaPos = myMaylaRow?.posicao ? Number(myMaylaRow.posicao) : null;
  const maylaPct = Math.min(100, Math.round((maylaPts / Math.max(1, weekGoal)) * 100));
  const cannotCreate = ownedActive >= 1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Minhas ligas" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* Banner recompensa */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-accent/15 via-card to-card border border-accent/20">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Gift className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Convide e ganhe R$10 por adesão</p>
              <p className="text-xs text-muted-foreground">Top 3 ganham prêmios toda semana.</p>
            </div>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {/* Liga Mayla — fixa no topo */}
        {!loading && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Minhas ligas</p>
            <Card className="cursor-pointer hover:bg-accent/5 transition-colors border-primary/30"
              onClick={() => onOpen(MAYLA_LEAGUE_ID)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">Liga Mayla</p>
                    <p className="text-xs text-muted-foreground">
                      Geral · {maylaMembers} {maylaMembers === 1 ? "participante" : "participantes"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {maylaPos ? `${maylaPos}º` : "—"}
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">Meta da semana</span>
                    <span className="text-[11px] font-medium">{maylaPts} / {weekGoal} pts</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${maylaPct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Nível (vitalício): {userXp} XP</p>
                </div>
              </CardContent>
            </Card>

            {/* Ligas privadas */}
            {myLeagues.map((l) => {
              const rk = leagueRanks[l.id];
              const pts = rk?.pontos_semana ?? 0;
              const pos = rk?.posicao ? Number(rk.posicao) : null;
              const pct = Math.min(100, Math.round((pts / Math.max(1, weekGoal)) * 100));
              const memc = leagueMemberCount[l.id] ?? 0;
              const prize = leaguePrize[l.id];
              const missing = prize && !prize.elegivel ? Math.max(0, 10 - prize.membros) : 0;
              return (
                <Card key={l.id} className="cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => onOpen(l.id)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {l.marca_logo_url
                        ? <img src={l.marca_logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        : <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">🏆</div>}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{l.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.visibilidade === "publica" ? "Pública" : "Privada"} · {memc} {memc === 1 ? "participante" : "participantes"}
                          {l.owner_id === user?.id && " · Você é dono"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">
                        {pos ? `${pos}º` : "—"}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground">Meta da semana</span>
                        <span className="text-[11px] font-medium">{pts} / {weekGoal} pts</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {missing > 0 && (
                      <p className="text-[11px] text-accent-foreground bg-accent/10 rounded-md px-2 py-1">
                        Faltam {missing} {missing === 1 ? "membro" : "membros"} para desbloquear prêmios Mayla.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Ligas públicas para entrar */}
        {publicLeagues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Ligas públicas da empresa</p>
            {publicLeagues.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">Pública</p>
                  </div>
                  <Button size="sm" onClick={() => handleJoinPublic(l.id)}>Entrar</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && enabled === false && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">
            O módulo de Ligas privadas ainda não foi ativado pela sua empresa. Você continua na Liga Mayla.
          </CardContent></Card>
        )}
      </div>

      {/* Rodapé fixo */}
      {enabled && (
        <div className="border-t border-border px-5 py-3 space-y-2 bg-background">
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setShowCreate(true)} disabled={cannotCreate}
              title={cannotCreate ? "Você já tem 1 liga ativa. Arquive antes de criar outra." : undefined}>
              <Plus className="h-4 w-4 mr-1" /> Criar liga
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowJoin(true)}>
              <KeyRound className="h-4 w-4 mr-1" /> Entrar por código
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Você pode criar 1 liga · participar de quantas quiser
          </p>
        </div>
      )}

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Criar nova liga</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da liga</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Time da diretoria" required maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label>Marca / logo (opcional)</Label>
              <Input type="file" accept="image/*"
                onChange={(e) => setForm({ ...form, logo_file: e.target.files?.[0] ?? null })} />
            </div>
            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <div className="flex gap-2">
                <Button type="button" variant={form.visibilidade === "privada" ? "default" : "outline"}
                  size="sm" className="flex-1" onClick={() => setForm({ ...form, visibilidade: "privada" })}>
                  🔒 Privada
                </Button>
                <Button type="button" variant={form.visibilidade === "publica" ? "default" : "outline"}
                  size="sm" className="flex-1" onClick={() => setForm({ ...form, visibilidade: "publica" })}>
                  🌍 Pública
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.visibilidade === "privada"
                  ? "Só quem tem o código de convite entra."
                  : "Qualquer pessoa da empresa pode entrar."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Atividades que pontuam</Label>
              <p className="text-xs text-muted-foreground">
                Se não marcar nada, <strong>todas</strong> as atividades contam.
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1 rounded-md border p-2">
                {rules.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">Nenhuma regra configurada.</p>
                )}
                {rules.map((r) => (
                  <label key={r.event_key} className="flex items-center gap-2 p-2 rounded hover:bg-accent/10 cursor-pointer">
                    <Checkbox
                      checked={form.scoring_event_keys.includes(r.event_key)}
                      onCheckedChange={() => toggleKey(r.event_key)}
                    />
                    <span className="text-sm flex-1">
                      {r.emoji && <span className="mr-1">{r.emoji}</span>}
                      {r.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Você só pode ter <strong>1 liga ativa</strong> por vez.
            </p>
            <Button type="submit" className="w-full" disabled={saving || !form.nome.trim()}>
              {saving ? "Criando..." : "Criar liga"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Entrar por código */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Entrar por código</DialogTitle></DialogHeader>
          <form onSubmit={handleJoinByCode} className="space-y-4">
            <div className="space-y-2">
              <Label>Código da liga</Label>
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Ex: 7202cdbdb0" required autoFocus />
              <p className="text-xs text-muted-foreground">
                Ligas privadas exigem aprovação do dono.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={joining || !joinCode.trim()}>
              {joining ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
