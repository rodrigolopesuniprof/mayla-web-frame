import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Crown, ShieldPlus, ShieldOff, UserMinus, Settings, Trash2 } from "lucide-react";
import { TopBar } from "../TopBar";
import { useEffect } from "react";

interface League {
  id: string;
  nome: string;
  owner_id: string;
  company_id: string;
  marca_logo_url: string | null;
  scoring_event_keys: string[];
}

interface Member {
  user_id: string;
  papel: "dono" | "coadmin" | "membro";
  full_name: string | null;
  avatar_url: string | null;
}

interface PointRule { event_key: string; label: string; emoji: string | null }

interface Props {
  league: League;
  members: Member[];
  onBack: () => void;
  onArchived: () => void;
}

export function LeagueManagePanel({ league, members, onBack, onArchived }: Props) {
  const { user } = useAuth();
  const isOwner = league.owner_id === user?.id;
  const [rules, setRules] = useState<PointRule[]>([]);
  const [showActivities, setShowActivities] = useState(false);
  const [editingKeys, setEditingKeys] = useState<string[]>(league.scoring_event_keys || []);
  const [savingActs, setSavingActs] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    supabase.from("point_rules").select("event_key, label, emoji, active")
      .eq("company_id", league.company_id).eq("active", true).order("label")
      .then(({ data }) => {
        setRules(((data || []) as any[]).map((r) => ({ event_key: r.event_key, label: r.label, emoji: r.emoji })));
      });
  }, [league.company_id]);

  const setPapel = async (targetUserId: string, papel: "coadmin" | "membro") => {
    const { error } = await supabase.from("league_members" as any)
      .update({ papel } as any)
      .eq("league_id", league.id)
      .eq("user_id", targetUserId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: papel === "coadmin" ? "Coadmin adicionado" : "Coadmin removido" });
    setRefreshTick((t) => t + 1);
  };

  const kickMember = async (targetUserId: string, name: string | null) => {
    if (!confirm(`Expulsar ${name || "membro"} da liga?`)) return;
    const { error } = await supabase.from("league_members" as any)
      .delete().eq("league_id", league.id).eq("user_id", targetUserId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Membro removido." });
    setRefreshTick((t) => t + 1);
  };

  const toggleEditKey = (key: string) => {
    setEditingKeys((keys) => keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
  };

  const saveActivities = async () => {
    setSavingActs(true);
    const { error } = await supabase.from("leagues" as any)
      .update({ scoring_event_keys: editingKeys } as any).eq("id", league.id);
    setSavingActs(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Atividades atualizadas!" });
    setShowActivities(false);
    league.scoring_event_keys = editingKeys;
  };

  const uploadLogo = async () => {
    if (!logoFile || !user) return;
    setSavingLogo(true);
    const ext = logoFile.name.split(".").pop() || "png";
    const path = `leagues/${league.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("company-logos").upload(path, logoFile, { upsert: true });
    if (upErr) { setSavingLogo(false); toast({ title: "Erro no upload", description: upErr.message, variant: "destructive" }); return; }
    const { data: pub } = supabase.storage.from("company-logos").getPublicUrl(path);
    const { error } = await supabase.from("leagues" as any)
      .update({ marca_logo_url: pub.publicUrl }).eq("id", league.id);
    setSavingLogo(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Logo atualizada!" });
    league.marca_logo_url = pub.publicUrl;
    setLogoFile(null);
  };

  const archive = async () => {
    if (!confirm("Arquivar esta liga? Ela sairá da lista ativa.")) return;
    const { error } = await supabase.from("leagues" as any)
      .update({ status: "arquivada" }).eq("id", league.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Liga arquivada." });
    onArchived();
  };

  const actLabel = editingKeys.length === 0
    ? "Todas as atividades pontuam"
    : `${editingKeys.length} selecionada${editingKeys.length === 1 ? "" : "s"}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title={`Gerir · ${league.nome}`} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4" key={refreshTick}>
        {/* Marca */}
        {isOwner && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Marca / logo</p>
              <div className="flex items-center gap-3">
                {league.marca_logo_url
                  ? <img src={league.marca_logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  : <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">🏆</div>}
                <div className="flex-1 space-y-2">
                  <Input type="file" accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                  <Button size="sm" onClick={uploadLogo} disabled={!logoFile || savingLogo}>
                    {savingLogo ? "Enviando..." : "Salvar logo"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Atividades */}
        {isOwner && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Atividades que pontuam</p>
                <p className="text-xs text-muted-foreground truncate">{actLabel}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowActivities(true)}>
                <Settings className="h-4 w-4 mr-1" /> Editar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Membros */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-2">Membros</p>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {members.map((m) => {
                const isSelf = m.user_id === user?.id;
                const isTheOwner = m.user_id === league.owner_id;
                return (
                  <div key={m.user_id} className="flex items-center gap-3 p-3">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      : <div className="h-8 w-8 rounded-full bg-secondary" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {m.full_name || "Colaborador"}
                        {isTheOwner && <Crown className="h-3 w-3 text-accent" />}
                      </p>
                      {m.papel === "coadmin" && <p className="text-xs text-muted-foreground">Coadmin</p>}
                    </div>
                    {isOwner && !isTheOwner && m.papel === "membro" && (
                      <Button variant="ghost" size="icon" title="Tornar coadmin" onClick={() => setPapel(m.user_id, "coadmin")}>
                        <ShieldPlus className="h-4 w-4" />
                      </Button>
                    )}
                    {isOwner && !isTheOwner && m.papel === "coadmin" && (
                      <Button variant="ghost" size="icon" title="Remover coadmin" onClick={() => setPapel(m.user_id, "membro")}>
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    )}
                    {!isTheOwner && !isSelf && (
                      <Button variant="ghost" size="icon" title="Expulsar" onClick={() => kickMember(m.user_id, m.full_name)}>
                        <UserMinus className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Arquivar */}
        {isOwner && (
          <Button variant="outline" className="w-full" onClick={archive}>
            <Trash2 className="h-4 w-4 mr-1" /> Arquivar liga
          </Button>
        )}
      </div>

      <Dialog open={showActivities} onOpenChange={setShowActivities}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Atividades que pontuam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Escolha o que vale pontos nesta liga. Se não marcar nada, <strong>todas</strong> as atividades contam.
            </p>
            <div className="max-h-72 overflow-y-auto space-y-1 rounded-md border p-2">
              {rules.map((r) => (
                <label key={r.event_key} className="flex items-center gap-2 p-2 rounded hover:bg-accent/10 cursor-pointer">
                  <Checkbox checked={editingKeys.includes(r.event_key)} onCheckedChange={() => toggleEditKey(r.event_key)} />
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
