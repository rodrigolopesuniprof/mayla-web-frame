import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { LogOut, Trophy, Settings, UserPlus, Crown } from "lucide-react";
import { TopBar } from "../TopBar";
import { isMaylaLeague } from "./constants";
import { LeagueManagePanel } from "./LeagueManagePanel";
import { LeagueInvitePanel } from "./LeagueInvitePanel";

interface League {
  id: string;
  nome: string;
  visibilidade: "publica" | "privada";
  invite_code: string;
  status: string;
  owner_id: string;
  company_id: string;
  marca_logo_url: string | null;
  scoring_event_keys: string[];
  created_at: string;
}

interface Member {
  user_id: string;
  papel: "dono" | "coadmin" | "membro";
  full_name: string | null;
  avatar_url: string | null;
}

interface RankingRow {
  user_id: string;
  pontos_semana: number;
  posicao: number;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface Challenge {
  id: string;
  titulo: string;
  metrica: string;
  alvo: number;
  premio: string | null;
  week_id: string;
}

interface Props {
  leagueId: string;
  onBack: () => void;
  onLeft: () => void;
}

type SubView = "detail" | "manage" | "invite";

export function LeagueDetailPanel({ leagueId, onBack, onLeft }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const isMayla = isMaylaLeague(leagueId);

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [prizeInfo, setPrizeInfo] = useState<{ membros: number; elegivel: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<SubView>("detail");
  const [maylaMembers, setMaylaMembers] = useState<number>(0);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    if (isMayla) {
      if (!companyId) { setLoading(false); return; }

      // Ranking Mayla + count membros
      const [{ data: rk }, { count }, { data: profs }] = await Promise.all([
        supabase.rpc("mayla_ranking" as any, { p_company_id: companyId }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("profiles").select("user_id, full_name, avatar_url").eq("company_id", companyId).limit(500),
      ]);
      setMaylaMembers(count || 0);
      const nameMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      ((profs || []) as any[]).forEach((p) => nameMap.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }));
      const rows = ((rk || []) as any[]).map((r) => ({
        user_id: r.user_id,
        pontos_semana: Number(r.pontos_semana) || 0,
        posicao: Number(r.posicao) || 0,
        full_name: nameMap.get(r.user_id)?.full_name || null,
        avatar_url: nameMap.get(r.user_id)?.avatar_url || null,
      }));
      setRanking(rows);
      setLeague(null);
      setChallenges([]);
      setLoading(false);
      return;
    }

    const { data: l } = await supabase
      .from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, company_id, marca_logo_url, scoring_event_keys, created_at")
      .eq("id", leagueId).maybeSingle();
    if (!l) { setLoading(false); return; }
    const lg = l as unknown as League;
    setLeague(lg);

    const [{ data: mems }, { data: rk }, { data: ch }, { data: pe }] = await Promise.all([
      supabase.from("league_members" as any)
        .select("user_id, papel, profiles:user_id (full_name, avatar_url)")
        .eq("league_id", leagueId),
      supabase.rpc("league_ranking" as any, { p_league_id: leagueId }),
      supabase.from("league_challenges" as any)
        .select("id, titulo, metrica, alvo, premio, week_id")
        .eq("league_id", leagueId)
        .order("week_id", { ascending: false }).limit(10),
      supabase.from("league_prize_eligible" as any)
        .select("membros, elegivel_premio_mayla").eq("league_id", leagueId).maybeSingle(),
    ]);

    const mappedMems: Member[] = ((mems || []) as any[]).map((m) => ({
      user_id: m.user_id,
      papel: m.papel,
      full_name: m.profiles?.full_name ?? null,
      avatar_url: m.profiles?.avatar_url ?? null,
    }));
    setMembers(mappedMems);

    const nameMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    mappedMems.forEach((m) => nameMap.set(m.user_id, { full_name: m.full_name, avatar_url: m.avatar_url }));
    const rows = ((rk || []) as any[]).map((r) => ({
      user_id: r.user_id,
      pontos_semana: Number(r.pontos_semana) || 0,
      posicao: Number(r.posicao) || 0,
      full_name: nameMap.get(r.user_id)?.full_name || null,
      avatar_url: nameMap.get(r.user_id)?.avatar_url || null,
    }));
    setRanking(rows);

    setChallenges(((ch || []) as any[]));
    setPrizeInfo(pe ? { membros: Number((pe as any).membros) || 0, elegivel: !!(pe as any).elegivel_premio_mayla } : null);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leagueId, user, companyId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Liga" onBack={onBack} />
        <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isMayla && !league) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Liga" onBack={onBack} />
        <div className="p-4 text-sm text-muted-foreground">Liga não encontrada.</div>
      </div>
    );
  }

  // Sub-views
  if (!isMayla && league && subView === "manage") {
    return <LeagueManagePanel league={league} members={members} onBack={() => { setSubView("detail"); load(); }} onArchived={onLeft} />;
  }
  if (!isMayla && league && subView === "invite") {
    return <LeagueInvitePanel league={league} onBack={() => setSubView("detail")} />;
  }

  const isOwner = !isMayla && league?.owner_id === user?.id;
  const isCoadmin = !isMayla && members.find((m) => m.user_id === user?.id)?.papel === "coadmin";
  const canManage = isOwner || isCoadmin;

  const displayName = isMayla ? "Liga Mayla" : (league?.nome || "");
  const memberCount = isMayla ? maylaMembers : members.length;
  const createdAtLabel = !isMayla && league
    ? new Date(league.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  const missing = prizeInfo && !prizeInfo.elegivel ? Math.max(0, 10 - prizeInfo.membros) : 0;

  const handleLeave = async () => {
    if (!user || !league) return;
    if (!confirm("Sair desta liga?")) return;
    const { error } = await supabase.from("league_members" as any)
      .delete().eq("league_id", league.id).eq("user_id", user.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você saiu da liga." });
    onLeft();
  };

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title={displayName} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {isMayla ? (
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
              ) : league?.marca_logo_url ? (
                <img src={league.marca_logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">🏆</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {isMayla
                    ? "Ranking geral da empresa"
                    : `${league?.visibilidade === "publica" ? "🌍 Pública" : "🔒 Privada"} · ${memberCount} ${memberCount === 1 ? "membro" : "membros"}`}
                </p>
                {createdAtLabel && (
                  <p className="text-xs text-muted-foreground">Criada em {createdAtLabel}</p>
                )}
                {isMayla && (
                  <p className="text-xs text-muted-foreground">{memberCount} {memberCount === 1 ? "participante" : "participantes"}</p>
                )}
              </div>
              {!isMayla && (
                prizeInfo?.elegivel
                  ? <Badge variant="default">Prêmio Mayla ativo</Badge>
                  : <Badge variant="secondary">Faltam {missing} membros</Badge>
              )}
            </div>

            {!isMayla && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setSubView("invite")}>
                  <UserPlus className="h-4 w-4 mr-1" /> Convidar
                </Button>
                {canManage && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSubView("manage")}>
                    <Settings className="h-4 w-4 mr-1" /> Gerir
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="ranking" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="desafios" disabled={isMayla}>Desafios</TabsTrigger>
            <TabsTrigger value="membros">Membros</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="space-y-3 mt-3">
            {top3.length > 0 && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
                <CardContent className="p-4 grid grid-cols-3 gap-2 text-center">
                  {top3.map((r, i) => (
                    <div key={r.user_id} className={i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3"}>
                      <div className="text-2xl mb-1">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                      {r.avatar_url
                        ? <img src={r.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover mx-auto" />
                        : <div className="h-10 w-10 rounded-full bg-secondary mx-auto" />}
                      <p className="text-xs font-medium truncate mt-1">{r.full_name || "Colaborador"}</p>
                      <p className="text-sm font-bold text-primary">{r.pontos_semana} pts</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {rest.length > 0 && (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {rest.map((r) => (
                    <div key={r.user_id} className="flex items-center gap-3 p-3">
                      <div className="w-6 text-center font-bold text-sm text-muted-foreground">{r.posicao}</div>
                      {r.avatar_url
                        ? <img src={r.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : <div className="h-8 w-8 rounded-full bg-secondary" />}
                      <p className="flex-1 min-w-0 text-sm font-medium truncate">{r.full_name || "Colaborador"}</p>
                      <span className="text-sm font-semibold">{r.pontos_semana} pts</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {ranking.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Ninguém pontuou esta semana ainda.
              </p>
            )}
            <p className="text-xs text-muted-foreground px-1">
              O placar zera na virada da semana. Pontos vitalícios (Nível) continuam contando.
            </p>
          </TabsContent>

          <TabsContent value="desafios" className="space-y-2 mt-3">
            {challenges.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum desafio criado nesta liga.
              </p>
            )}
            {challenges.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    Meta: {c.alvo} · {c.metrica}
                  </p>
                  {c.premio && <p className="text-xs text-accent mt-1">🎁 {c.premio}</p>}
                </CardContent>
              </Card>
            ))}
            <p className="text-[11px] text-muted-foreground px-1">
              Missões de liga dão badges/prêmios, não pontos — o placar vem só de atividades de saúde.
            </p>
          </TabsContent>

          <TabsContent value="membros" className="space-y-2 mt-3">
            {isMayla ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos os colaboradores da empresa participam automaticamente.
              </p>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 p-3">
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : <div className="h-8 w-8 rounded-full bg-secondary" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1">
                          {m.full_name || "Colaborador"}
                          {m.papel === "dono" && <Crown className="h-3 w-3 text-accent" />}
                        </p>
                        {m.papel === "coadmin" && <p className="text-xs text-muted-foreground">Coadmin</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {!isMayla && !isOwner && (
          <Button variant="outline" size="sm" className="w-full" onClick={handleLeave}>
            <LogOut className="h-4 w-4 mr-1" /> Sair da liga
          </Button>
        )}
      </div>
    </div>
  );
}
