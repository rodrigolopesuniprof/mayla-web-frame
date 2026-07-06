import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function LeagueJoin() {
  const nav = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "found" | "not_found" | "joined">("loading");
  const [league, setLeague] = useState<{ id: string; nome: string; visibilidade: string; owner_id: string } | null>(null);

  useEffect(() => {
    // Capture affiliate ref from URL (?ref=CODE) so it can be attributed later.
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) sessionStorage.setItem("pending_affiliate_ref", ref);

    if (authLoading) return;
    if (!user) {
      const suffix = ref ? `?ref=${ref}` : "";
      sessionStorage.setItem("post_login_redirect", `/liga/${code}${suffix}`);
      nav("/login");
      return;
    }
    if (!code) return;
    (async () => {
      const { data } = await supabase
        .from("leagues" as any)
        .select("id, nome, visibilidade, owner_id, status")
        .eq("invite_code", code)
        .maybeSingle();
      if (!data || (data as any).status !== "ativa") { setStatus("not_found"); return; }
      const l = data as any;
      setLeague({ id: l.id, nome: l.nome, visibilidade: l.visibilidade, owner_id: l.owner_id });

      const { data: existing } = await supabase
        .from("league_members" as any)
        .select("id").eq("league_id", l.id).eq("user_id", user.id).maybeSingle();
      if (existing) { setStatus("joined"); return; }
      setStatus("found");
    })();
  }, [code, user, authLoading, nav]);

  const handleJoin = async () => {
    if (!league || !user) return;
    if (league.visibilidade === "privada") {
      toast({
        title: "Liga privada",
        description: "Peça ao dono da liga para te adicionar.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("league_members" as any)
      .insert({ league_id: league.id, user_id: user.id });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você entrou na liga! 🎉" });
    sessionStorage.setItem("open_league_id", league.id);
    nav("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-4 text-center">
          {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {status === "not_found" && (
            <>
              <div className="text-4xl">😕</div>
              <p className="text-sm">Convite inválido ou liga arquivada.</p>
              <Button onClick={() => nav("/")} className="w-full">Voltar ao app</Button>
            </>
          )}
          {status === "joined" && league && (
            <>
              <div className="text-4xl">✅</div>
              <p className="text-sm">Você já é membro de <strong>{league.nome}</strong>.</p>
              <Button onClick={() => { sessionStorage.setItem("open_league_id", league.id); nav("/"); }} className="w-full">Abrir liga</Button>
            </>
          )}
          {status === "found" && league && (
            <>
              <div className="text-4xl">🏆</div>
              <p className="text-sm">Você foi convidado para</p>
              <p className="text-xl font-semibold">{league.nome}</p>
              {league.visibilidade === "privada" ? (
                <p className="text-xs text-muted-foreground">
                  Esta liga é privada. Peça ao dono da liga para adicionar você.
                </p>
              ) : (
                <Button onClick={handleJoin} className="w-full">Entrar na liga</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => nav("/")} className="w-full">
                Voltar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
