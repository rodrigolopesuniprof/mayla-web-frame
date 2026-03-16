import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
}

interface CollaborativeTeam {
  id: string;
  company_id: string;
  name: string;
  emoji: string;
  is_default: boolean;
  created_at: string;
  member_count: number;
  total_points: number;
}

export function AdminSupportTeams() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [teams, setTeams] = useState<CollaborativeTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "🏃" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Load companies
    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");
    if (companiesData) {
      setCompanies(companiesData);
      if (companiesData.length > 0 && !selectedCompany) {
        setSelectedCompany(companiesData[0].id);
        setLoading(false);
        return; // Will re-trigger via useEffect
      }
    }

    if (!selectedCompany) { setLoading(false); return; }

    // Load teams for selected company
    const { data: teamsData } = await supabase
      .from("collaborative_teams")
      .select("*")
      .eq("company_id", selectedCompany)
      .order("is_default", { ascending: false })
      .order("name");

    if (teamsData) {
      // Get member counts and points
      const teamIds = teamsData.map(t => t.id);
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds);

      // Get points for all members
      const userIds = [...new Set(members?.map(m => m.user_id) || [])];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, points").in("user_id", userIds)
        : { data: [] };

      const pointsMap = new Map(profiles?.map(p => [p.user_id, p.points]) || []);

      const enriched: CollaborativeTeam[] = teamsData.map(t => {
        const teamMembers = members?.filter(m => m.team_id === t.id) || [];
        const totalPoints = teamMembers.reduce((sum, m) => sum + (pointsMap.get(m.user_id) || 0), 0);
        return {
          ...t,
          emoji: t.emoji || "🏃",
          is_default: t.is_default || false,
          member_count: teamMembers.length,
          total_points: totalPoints,
        };
      });

      // Sort by total_points desc (default team always first)
      enriched.sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return b.total_points - a.total_points;
      });

      setTeams(enriched);
    }

    setLoading(false);
  }, [selectedCompany]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !form.name.trim()) return;
    setSaving(true);

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;
    if (!userId) { toast.error("Não autenticado"); setSaving(false); return; }

    const { error } = await supabase.from("collaborative_teams").insert({
      company_id: selectedCompany,
      name: form.name.trim(),
      emoji: form.emoji || "🏃",
      created_by: userId,
    });

    if (error) {
      toast.error(`Erro: ${error.message}`);
    } else {
      toast.success("Time criado!");
      setShowForm(false);
      setForm({ name: "", emoji: "🏃" });
      loadData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir o time "${name}"? Os membros serão desvinculados.`)) return;
    const { error } = await supabase.from("collaborative_teams").delete().eq("id", id);
    if (error) toast.error(`Erro: ${error.message}`);
    else { toast.success("Time excluído"); loadData(); }
  };

  const filtered = teams.filter(t => {
    if (!search) return true;
    return t.name.toLowerCase().includes(search.toLowerCase());
  });

  const emojiOptions = ["🏃", "⚽", "🏋️", "🧘", "🚴", "🏊", "💪", "🌟", "🔥", "🎯", "🏆", "🦅"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl text-foreground">Times Colaborativos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ranking por pontuação: Empresa → Time → Membros
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Selecione empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} disabled={!selectedCompany}>
            ➕ Criar Time
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">Criar novo time</h3>
            <form onSubmit={handleCreate} className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Nome do time *"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-1">
                {emojiOptions.slice(0, 6).map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setForm({ ...form, emoji: em })}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center cursor-pointer border-none transition-colors ${
                      form.emoji === em ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Criando..." : "Criar"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Buscar time..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground self-center">
          {filtered.length} time{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {selectedCompany ? "Nenhum time encontrado." : "Selecione uma empresa."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((t, index) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl font-bold text-muted-foreground">
                    {t.is_default ? "—" : `#${index + 1}`}
                  </div>
                  <div className="shrink-0 text-2xl">{t.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm text-foreground">{t.name}</span>
                      {t.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold">
                          PADRÃO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>👥 {t.member_count} membro{t.member_count !== 1 ? "s" : ""}</span>
                      <span>⭐ {t.total_points.toLocaleString()} pts</span>
                    </div>
                  </div>
                  {!t.is_default && (
                    <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleDelete(t.id, t.name)}>
                      Excluir
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
