import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, LogOut, Trash2, Crown } from "lucide-react";

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

export default function LeagueDetail() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ranking, setRanking] = useState<Record<string, RankingRow>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);

    const { data: l } = await supabase
      .from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, company_id, marca_logo_url")
      .eq("id", id).maybeSingle();
    if (!l) { setLoading(false); return; }
    setLeague(l as unknown as League);

    const { data: mems } = await supabase
      .from("league_members" as any)
      .select("user_id, papel, joined_at, profiles:user_id (full_name, avatar_url)")
      .eq("league_id", id);
    const mappedMems: Member[] = ((mems || []) as any[]).map((m) => ({
      user_id: m.user_id,
      papel: m.papel,
      joined_at: m.joined_at,
      full_name: m.profiles?.full_name ?? null,
      avatar_url: m.profiles?.avatar_url ?? null,
    }));
    setMembers(mappedMems);

    const { data: rank } = await supabase.rpc("league_ranking" as any, { p_league_id: id });
    const rankMap: Record<string, RankingRow> = {};
    ((rank || []) as RankingRow[]).forEach((r) => { rankMap[r.user_id] = r; });
    setRanking(rankMap);

    setLoading(false);
  };

  useEffect(() => { load(); }, [id, user]);

  if (loading) return <div className="p-4 text-sm">Carregando...</div>;
  if (!league) return (
    <div className="p-4 space-y-3">
      <Button variant="ghost" size="sm" onClick={() => nav("/ligas")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <p className="text-sm text-muted-foreground">Liga não encontrada.</p>
    </div>
  );

  const isOwner = league.owner_id === user?.id;
  const sortedMembers = [...members].sort((a, b) => {
    const pa = ranking[a.user_id]?.pontos_semana ?? 0;
    const pb = ranking[b.user_id]?.pontos_semana ?? 0;
    return pb - pa;
  });

  const copyInvite = () => {
    const url = `${window.location.origin}/liga/${league.invite_code}`;
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
    nav("/ligas");
  };

  const handleArchive = async () => {
    if (!confirm("Arquivar esta liga? Ela sairá da lista ativa.")) return;
    const { error } = await supabase.from("leagues" as any)
      .update({ status: "arquivada" }).eq("id", league.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Liga arquivada." });
    nav("/ligas");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav("/ligas")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-semibold flex-1 truncate">{league.nome}</h1>
        </div>

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
