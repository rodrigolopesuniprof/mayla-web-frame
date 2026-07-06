import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Copy, LogOut, Trash2, Crown } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!leagueId || !user) return;
    setLoading(true);

    const { data: l } = await supabase
      .from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, company_id, marca_logo_url")
      .eq("id", leagueId).maybeSingle();
    if (!l) { setLoading(false); return; }
    setLeague(l as unknown as League);

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

  const copyInvite = () => {
    const url = `${PROD_URL}/liga/${league.invite_code}`;
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
          </CardContent>
        </Card>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-2">Placar da semana</p>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {sortedMembers.map((m, i) => {
                const r = ranking[m.user_id];
                const pts = r?.pontos_semana ?? 0;
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
    </div>
  );
}
