import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Trash2, X, Plus } from "lucide-react";

interface Campaign {
  id: string;
  company_id: string;
  program_id: string | null;
  title: string;
  description: string | null;
  emoji: string;
  category: string;
  bonus_points: number;
  badge_name: string | null;
  badge_emoji: string | null;
  active: boolean;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

interface Company { id: string; name: string; }
interface Program { id: string; title: string; emoji: string; company_id: string; }
interface Mission { id: string; title: string; emoji: string | null; points: number | null; tag: string; }
interface LinkedMission extends Mission { campaign_mission_id: string; sort_order: number; }

export function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", emoji: "🏆", category: "challenge",
    bonus_points: "0", badge_name: "", badge_emoji: "", company_id: "",
    program_id: "", starts_at: "", ends_at: "",
  });

  // Mission linking
  const [linkedMissions, setLinkedMissions] = useState<LinkedMission[]>([]);
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [c, co, pr] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("wellbeing_programs").select("id, title, emoji, company_id").eq("active", true).order("title"),
    ]);
    setCampaigns((c.data as Campaign[]) || []);
    setCompanies((co.data as Company[]) || []);
    setPrograms((pr.data as Program[]) || []);
  };

  const loadCampaignMissions = async (campaignId: string) => {
    setLoadingMissions(true);
    const [linked, all] = await Promise.all([
      supabase.from("campaign_missions").select("id, mission_id, sort_order").eq("campaign_id", campaignId).order("sort_order"),
      supabase.from("missions").select("id, title, emoji, points, tag").eq("active", true).order("title"),
    ]);
    const allData = (all.data as Mission[]) || [];
    setAllMissions(allData);
    const linkedData = (linked.data || []).map((cm: any) => {
      const mission = allData.find(m => m.id === cm.mission_id);
      return mission ? { ...mission, campaign_mission_id: cm.id, sort_order: cm.sort_order ?? 0 } : null;
    }).filter(Boolean) as LinkedMission[];
    setLinkedMissions(linkedData);
    setLoadingMissions(false);
  };

  const openNew = () => {
    setEditing(null);
    setLinkedMissions([]);
    setAllMissions([]);
    setForm({ title: "", description: "", emoji: "🏆", category: "challenge", bonus_points: "0", badge_name: "", badge_emoji: "", company_id: companies[0]?.id || "", program_id: "", starts_at: "", ends_at: "" });
    setShowForm(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      title: c.title, description: c.description || "", emoji: c.emoji, category: c.category,
      bonus_points: String(c.bonus_points), badge_name: c.badge_name || "", badge_emoji: c.badge_emoji || "",
      company_id: c.company_id, program_id: c.program_id || "", starts_at: c.starts_at, ends_at: c.ends_at,
    });
    setShowForm(true);
    loadCampaignMissions(c.id);
  };

  const save = async () => {
    if (!form.title || !form.company_id || !form.starts_at || !form.ends_at) {
      toast.error("Preencha todos os campos obrigatórios."); return;
    }
    const payload = {
      title: form.title, description: form.description || null, emoji: form.emoji,
      category: form.category, bonus_points: parseInt(form.bonus_points) || 0,
      badge_name: form.badge_name || null, badge_emoji: form.badge_emoji || null,
      company_id: form.company_id, program_id: form.program_id || null,
      starts_at: form.starts_at, ends_at: form.ends_at,
    };
    if (editing) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Desafio atualizado.");
    } else {
      const { error } = await supabase.from("campaigns").insert(payload);
      if (error) { toast.error("Erro ao criar: " + error.message); return; }
      toast.success("Desafio criado.");
    }
    setShowForm(false);
    load();
  };

  const toggle = async (c: Campaign) => {
    await supabase.from("campaigns").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Desafio excluído.");
    setDeleteTarget(null);
    load();
  };

  const addMission = async (missionId: string) => {
    if (!editing) return;
    const { error } = await supabase.from("campaign_missions").insert({
      campaign_id: editing.id, mission_id: missionId, sort_order: linkedMissions.length,
    });
    if (error) { toast.error("Erro ao vincular missão."); return; }
    toast.success("Missão vinculada.");
    loadCampaignMissions(editing.id);
  };

  const removeMission = async (campaignMissionId: string) => {
    if (!editing) return;
    await supabase.from("campaign_missions").delete().eq("id", campaignMissionId);
    toast.success("Missão desvinculada.");
    loadCampaignMissions(editing.id);
  };

  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "—";
  const programName = (id: string | null) => {
    if (!id) return null;
    const p = programs.find(pr => pr.id === id);
    return p ? `${p.emoji} ${p.title}` : null;
  };

  const filteredPrograms = programs.filter(p => p.company_id === form.company_id);
  const linkedIds = new Set(linkedMissions.map(m => m.id));
  const availableMissions = allMissions.filter(m => !linkedIds.has(m.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">🏆 Desafios</h2>
        <Button onClick={openNew}>+ Novo Desafio</Button>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum desafio cadastrado.</p>
      ) : (
        <div className="grid gap-3">
          {campaigns.map(c => (
            <Card key={c.id} className="cursor-pointer hover:bg-secondary/50 transition" onClick={() => openEdit(c)}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {companyName(c.company_id)}
                    {programName(c.program_id) && <> · {programName(c.program_id)}</>}
                    {" · "}
                    {new Date(c.starts_at).toLocaleDateString("pt-BR")} — {new Date(c.ends_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge>
                {c.bonus_points > 0 && <Badge variant="outline">+{c.bonus_points} pts</Badge>}
                <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); toggle(c); }}>
                  {c.active ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Desafio" : "Novo Desafio"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-1">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Título</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v, program_id: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Programa (opcional)</Label>
                <Select value={form.program_id} onValueChange={v => setForm(f => ({ ...f, program_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sem programa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem programa</SelectItem>
                    {filteredPrograms.map(p => <SelectItem key={p.id} value={p.id}>{p.emoji} {p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Pontos bônus</Label>
                <Input type="number" value={form.bonus_points} onChange={e => setForm(f => ({ ...f, bonus_points: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input type="date" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fim</Label>
                <Input type="date" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome do badge</Label>
                <Input value={form.badge_name} onChange={e => setForm(f => ({ ...f, badge_name: e.target.value }))} placeholder="Ex: Campeão do Sono" />
              </div>
              <div className="space-y-1">
                <Label>Emoji do badge</Label>
                <Input value={form.badge_emoji} onChange={e => setForm(f => ({ ...f, badge_emoji: e.target.value }))} placeholder="🏅" />
              </div>
            </div>
            <Button onClick={save} className="w-full">{editing ? "Salvar" : "Criar Desafio"}</Button>

            {/* Mission linking - only when editing */}
            {editing && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Missões do Desafio</h4>
                  {loadingMissions ? (
                    <p className="text-sm text-muted-foreground">Carregando missões...</p>
                  ) : (
                    <>
                      {linkedMissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma missão vinculada a este desafio.</p>
                      ) : (
                        <div className="space-y-2">
                          {linkedMissions.map(m => (
                            <div key={m.campaign_mission_id} className="flex items-center gap-2 bg-secondary/50 rounded-md p-2">
                              <span>{m.emoji || "🎯"}</span>
                              <span className="flex-1 text-sm font-medium text-foreground">{m.title}</span>
                              <Badge variant="outline" className="text-[10px]">{m.points || 0} pts</Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMission(m.campaign_mission_id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {availableMissions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Missões disponíveis</p>
                          {availableMissions.map(m => (
                            <div key={m.id} className="flex items-center gap-2 border rounded-md p-2">
                              <span>{m.emoji || "🎯"}</span>
                              <span className="flex-1 text-sm text-foreground">{m.title}</span>
                              <Badge variant="outline" className="text-[10px]">{m.tag}</Badge>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addMission(m.id)}>
                                <Plus className="h-3 w-3 mr-1" /> Vincular
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir desafio?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.title}"? Participantes e missões vinculadas serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
