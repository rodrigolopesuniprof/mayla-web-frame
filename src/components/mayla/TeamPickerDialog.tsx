import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TeamInfo {
  id: string;
  name: string;
  emoji: string | null;
  is_default: boolean | null;
}

export function TeamPickerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [myTeam, setMyTeam] = useState<TeamInfo | null>(null);
  const [availableTeams, setAvailableTeams] = useState<TeamInfo[]>([]);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("🏃");

  const fetchMyTeam = async () => {
    if (!user) return;
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id, collaborative_teams(id, name, emoji, is_default)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membership && (membership as any).collaborative_teams) {
      const t = (membership as any).collaborative_teams;
      setMyTeam({ id: t.id, name: t.name, emoji: t.emoji, is_default: t.is_default });
    } else {
      setMyTeam(null);
    }
  };

  const fetchAvailableTeams = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("collaborative_teams")
      .select("id, name, emoji, is_default")
      .eq("company_id", companyId)
      .order("name");
    setAvailableTeams((data || []) as TeamInfo[]);
  };

  useEffect(() => {
    if (open) {
      setMode("list");
      fetchMyTeam();
      fetchAvailableTeams();
    }
  }, [open, user, companyId]);

  const handleJoinTeam = async (teamId: string) => {
    if (!user) return;
    await supabase.from("team_members").delete().eq("user_id", user.id);
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: user.id });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Time atualizado! 🎉" });
      fetchMyTeam();
      onOpenChange(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!user || !companyId || !newTeamName.trim()) return;
    const { data, error } = await supabase.from("collaborative_teams").insert({
      company_id: companyId,
      name: newTeamName.trim(),
      emoji: newTeamEmoji || "🏃",
      created_by: user.id,
    }).select("id").single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      await handleJoinTeam(data.id);
      setNewTeamName("");
      setNewTeamEmoji("🏃");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">👥</span>
            <span>Times Colaborativos</span>
          </DialogTitle>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3">
            {myTeam && (
              <div className="bg-accent/10 rounded-2xl p-4 border border-accent/20">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Seu time atual</div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{myTeam.emoji}</span>
                  <span className="text-base font-semibold text-foreground">{myTeam.name}</span>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground uppercase tracking-wider">Times disponíveis</div>
            {availableTeams.map((team) => (
              <div key={team.id} className="bg-secondary rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => handleJoinTeam(team.id)}>
                <span className="text-xl">{team.emoji}</span>
                <span className="text-sm font-medium text-foreground flex-1">{team.name}</span>
                {myTeam?.id === team.id && <span className="text-xs text-accent font-semibold">Atual</span>}
                {myTeam?.id !== team.id && <span className="text-xs text-primary font-medium">Entrar</span>}
              </div>
            ))}

            <Button variant="outline" className="w-full" onClick={() => setMode("create")}>
              ✨ Criar novo time
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do time</label>
              <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Ex: Runners, Wellness Squad..." />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Emoji</label>
              <div className="flex gap-2 flex-wrap">
                {["🏃", "💪", "🧘", "🚴", "⚡", "🌟", "🎯", "🔥"].map((e) => (
                  <button key={e} onClick={() => setNewTeamEmoji(e)} className={`text-2xl p-2 rounded-xl cursor-pointer transition-colors ${newTeamEmoji === e ? "bg-accent/20 ring-2 ring-accent" : "bg-secondary"}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setMode("list")}>Voltar</Button>
              <Button className="flex-1" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Criar time</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
