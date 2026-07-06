import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, Trophy } from "lucide-react";

interface League {
  id: string;
  nome: string;
  visibilidade: "publica" | "privada";
  invite_code: string;
  status: "ativa" | "arquivada";
  owner_id: string;
  marca_logo_url: string | null;
}

export default function Leagues() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nome: "", visibilidade: "privada" as "publica" | "privada" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user || !companyId) { setLoading(false); return; }
    setLoading(true);

    const { data: company } = await supabase
      .from("companies").select("leagues_enabled").eq("id", companyId).maybeSingle();
    setEnabled(!!(company as any)?.leagues_enabled);

    const { data: memberships } = await supabase
      .from("league_members" as any)
      .select("league_id, leagues:league_id (id, nome, visibilidade, invite_code, status, owner_id, marca_logo_url)")
      .eq("user_id", user.id);
    const mine = ((memberships || []) as any[])
      .map((m) => m.leagues)
      .filter((l) => l && l.status === "ativa") as League[];
    setMyLeagues(mine);

    const { data: publics } = await supabase
      .from("leagues" as any)
      .select("id, nome, visibilidade, invite_code, status, owner_id, marca_logo_url")
      .eq("company_id", companyId)
      .eq("visibilidade", "publica")
      .eq("status", "ativa")
      .limit(30);
    const mineIds = new Set(mine.map((l) => l.id));
    setPublicLeagues(((publics || []) as any[]).filter((l) => !mineIds.has(l.id)));

    setLoading(false);
  };

  useEffect(() => { load(); }, [user, companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("leagues" as any)
      .insert({
        company_id: companyId, owner_id: user.id,
        nome: form.nome.trim(), visibilidade: form.visibilidade,
      })
      .select("id").single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar liga", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Liga criada! 🏆" });
    setShowCreate(false);
    setForm({ nome: "", visibilidade: "privada" });
    nav(`/ligas/${(data as any).id}`);
  };

  const handleJoinPublic = async (leagueId: string) => {
    if (!user) return;
    const { error } = await supabase.from("league_members" as any).insert({ league_id: leagueId, user_id: user.id });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Você entrou na liga! 🎉" });
    nav(`/ligas/${leagueId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav("/")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-semibold flex-1">🏆 Ligas</h1>
          {enabled && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          )}
        </div>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!loading && enabled === false && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">
            O módulo de Ligas ainda não foi ativado pela sua empresa.
          </CardContent></Card>
        )}

        {!loading && enabled && myLeagues.length === 0 && publicLeagues.length === 0 && (
          <Card><CardContent className="p-6 text-center space-y-2">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma liga por aqui ainda.</p>
            <p className="text-xs text-muted-foreground">Crie a sua e convide colegas.</p>
          </CardContent></Card>
        )}

        {myLeagues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Minhas ligas</p>
            {myLeagues.map((l) => (
              <Card key={l.id} className="cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => nav(`/ligas/${l.id}`)}>
                <CardContent className="p-4 flex items-center gap-3">
                  {l.marca_logo_url
                    ? <img src={l.marca_logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    : <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">🏆</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.visibilidade === "publica" ? "Pública" : "Privada"}
                      {l.owner_id === user?.id && " · Você é dono"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {publicLeagues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Ligas públicas</p>
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
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Criar nova liga</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da liga</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Time da Diretoria" required maxLength={60} />
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
            <p className="text-xs text-muted-foreground">
              Você só pode ter <strong>1 liga ativa</strong> por vez.
            </p>
            <Button type="submit" className="w-full" disabled={saving || !form.nome.trim()}>
              {saving ? "Criando..." : "Criar liga"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
