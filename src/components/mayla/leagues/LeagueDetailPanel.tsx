import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Copy, LogOut, Trash2, Crown, Settings, ShieldPlus, ShieldOff } from "lucide-react";
import { TopBar } from "../TopBar";
import { PROD_URL } from "@/lib/production-url";

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
}

interface Member {
  user_id: string;
  papel: "dono" | "coadmin" | "membro";
  joined_at: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface RankingRow {
  user_id: string;
  pontos_semana: number;
  posicao: number;
}

interface PointRule {
  event_key: string;
  label: string;
  emoji: string | null;
}

interface Props {
  leagueId: string;
  onBack: () => void;
  onLeft: () => void;
}

export function LeagueDetailPanel({ leagueId, onBack, onLeft }: Props) {
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ranking, setRanking] = useState<Record<string, RankingRow>>({});
  const [rules, setRules] = useState<PointRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivities, setShowActivities] = useState(false);
  const [editingKeys, setEditingKeys] = useState<string[]>([]);
  const [savingActs, setSavingActs] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);

  const load = async () => {
    if (!leagueId || !user) return;
    setLoading(true);

    const { data: l } = await supabase
      .from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, company_id, marca_logo_url, scoring_event_keys")
      .eq("id", leagueId).maybeSingle();
    if (!l) { setLoading(false); return; }
    const lg = l as unknown as League;
    setLeague(lg);

    const { data: mems } = await supabase
      .from("league_members" as any)
      .select("user_id, papel, joined_at, profiles:user_id (full_name, avatar_url)")
      .eq("league_id", leagueId);
    const mappedMems: Member[] = ((mems || []) as any[]).map((m) => ({
      user_id: m.user_id,
      papel: m.papel,
      joined_at: m.joined_at,
      full_name: m.profiles?.full_name ?? null,
      avatar_url: m.profiles?.avatar_url ?? null,
    }));
    setMembers(mappedMems);

    const { data: rank } = await supabase.rpc("league_ranking" as any, { p_league_id: leagueId });
    const rankMap: Record<string, RankingRow> = {};
    ((rank || []) as RankingRow[]).forEach((r) => { rankMap[r.user_id] = r; });
    setRanking(rankMap);

    const { data: pr } = await supabase
      .from("point_rules")
      .select("event_key, label, emoji, active")
      .eq("company_id", lg.company_id)
      .eq("active", true)
      .order("label");
    setRules(((pr || []) as any[]).map((r) => ({ event_key: r.event_key, label: r.label, emoji: r.emoji })));

    // If the current user is the owner, look up their affiliate referral_code (if any)
    if (lg.owner_id === user.id) {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("referral_code")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      setAffiliateCode((aff as any)?.referral_code ?? null);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [leagueId, user]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Liga" onBack={onBack} />
        <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  if (!league) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Liga" onBack={onBack} />
        <div className="p-4 text-sm text-muted-foreground">Liga não encontrada.</div>
      </div>
    );
  }

  const isOwner = league.owner_id === user?.id;
  const sortedMembers = [...members].sort((a, b) => {
    const pa = ranking[a.user_id]?.pontos_semana ?? 0;
    const pb = ranking[b.user_id]?.pontos_semana ?? 0;
    return pb - pa;
  });

  const buildInviteUrl = () => {
    const base = `${PROD_URL}/liga/${league.invite_code}`;
    return affiliateCode ? `${base}?ref=${affiliateCode}` : base;
  };

  const copyInvite = () => {
    const url = buildInviteUrl();
    navigator.clipboard.writeText(url);
    toast({ title: "Link de convite copiado!", description: url });
  };

  const handleLeave = async () => {
    if (!user) return;
    if (!confirm("Sair desta liga?")) return;
    const { error } = await supabase.from("league_members" as any)
      .delete().eq("league_id", league.id).eq("user_id", user.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você saiu da liga." });
    onLeft();
  };

  const handleArchive = async () => {
    if (!confirm("Arquivar esta liga? Ela sairá da lista ativa.")) return;
    const { error } = await supabase.from("leagues" as any)
      .update({ status: "arquivada" }).eq("id", league.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Liga arquivada." });
    onLeft();
  };

  const openActivitiesDialog = () => {
    setEditingKeys(league.scoring_event_keys || []);
    setShowActivities(true);
  };

  const toggleEditKey = (key: string) => {
    setEditingKeys((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
    );
  };

  const saveActivities = async () => {
    setSavingActs(true);
    const { error } = await supabase.from("leagues" as any)
      .update({ scoring_event_keys: editingKeys } as any).eq("id", league.id);
    setSavingActs(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Atividades atualizadas!" });
    setShowActivities(false);
    load();
  };

  const setPapel = async (targetUserId: string, papel: "coadmin" | "membro") => {
    const { error } = await supabase.from("league_members" as any)
      .update({ papel } as any)
      .eq("league_id", league.id)
      .eq("user_id", targetUserId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: papel === "coadmin" ? "Coadmin adicionado" : "Coadmin removido" });
    load();
  };

  const activitiesLabel = (() => {
    const keys = league.scoring_event_keys || [];
    if (keys.length === 0) return "Todas as atividades pontuam";
    return `${keys.length} atividade${keys.length === 1 ? "" : "s"} selecionada${keys.length === 1 ? "" : "s"}`;
  })();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title={league.nome} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {league.marca_logo_url
                ? <img src={league.marca_logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                : <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">🏆</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  {league.visibilidade === "publica" ? "🌍 Pública" : "🔒 Privada"} · {members.length} {members.length === 1 ? "membro" : "membros"}
                </p>
                <p className="text-xs text-muted-foreground">Código: <span className="font-mono">{league.invite_code}</span></p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={copyInvite}>
              <Copy className="h-4 w-4 mr-2" /> Copiar link de convite
            </Button>
            {isOwner && !affiliateCode && (
              <p className="text-[11px] text-muted-foreground">
                Dica: vire afiliado para que convites feitos por você sejam rastreados.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Atividades que pontuam</p>
              <p className="text-xs text-muted-foreground truncate">{activitiesLabel}</p>
            </div>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={openActivitiesDialog}>
                <Settings className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
          </CardContent>
        </Card>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-2">Placar da semana</p>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {sortedMembers.map((m, i) => {
                const r = ranking[m.user_id];
                const pts = r?.pontos_semana ?? 0;
                const canManage = isOwner && m.user_id !== league.owner_id;
                return (
                  <div key={m.user_id} className="flex items-center gap-3 p-3">
                    <div className="w-6 text-center font-bold text-sm text-muted-foreground">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </div>
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
                    <div className="text-sm font-semibold">{pts} pts</div>
                    {canManage && m.papel === "membro" && (
                      <Button variant="ghost" size="icon" title="Tornar coadmin"
                        onClick={() => setPapel(m.user_id, "coadmin")}>
                        <ShieldPlus className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && m.papel === "coadmin" && (
                      <Button variant="ghost" size="icon" title="Remover coadmin"
                        onClick={() => setPapel(m.user_id, "membro")}>
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            O placar zera na virada da semana. Pontos vitalícios (nível) continuam contando.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          {!isOwner && (
            <Button variant="outline" size="sm" className="flex-1" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-1" /> Sair da liga
            </Button>
          )}
          {isOwner && (
            <Button variant="outline" size="sm" className="flex-1" onClick={handleArchive}>
              <Trash2 className="h-4 w-4 mr-1" /> Arquivar liga
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showActivities} onOpenChange={setShowActivities}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Atividades que pontuam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Escolha o que vale pontos nesta liga. Se não marcar nada, <strong>todas</strong> as atividades contam.
            </p>
            <div className="max-h-72 overflow-y-auto space-y-1 rounded-md border p-2">
              {rules.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">Nenhuma regra configurada.</p>
              )}
              {rules.map((r) => (
                <label key={r.event_key} className="flex items-center gap-2 p-2 rounded hover:bg-accent/10 cursor-pointer">
                  <Checkbox
                    checked={editingKeys.includes(r.event_key)}
                    onCheckedChange={() => toggleEditKey(r.event_key)}
                  />
                  <span className="text-sm flex-1">
                    {r.emoji && <span className="mr-1">{r.emoji}</span>}
                    {r.label}
                  </span>
                </label>
              ))}
            </div>
            <Button className="w-full" onClick={saveActivities} disabled={savingActs}>
              {savingActs ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
