import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { X, Plus, Sparkles } from "lucide-react";
import { CATEGORIES, CATEGORY_TAG_MAP } from "@/lib/program-categories";

interface Program {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  category: string;
  emoji: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface Mission {
  id: string;
  title: string;
  emoji: string | null;
  tag: string;
  points: number | null;
}

interface LinkedMission extends Mission {
  program_mission_id: string;
  sort_order: number;
}

export function AdminPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "general", emoji: "🌿", company_id: "", starts_at: "", ends_at: "" });

  // Mission linking state
  const [linkedMissions, setLinkedMissions] = useState<LinkedMission[]>([]);
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from("wellbeing_programs").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
    ]);
    setPrograms((p.data as Program[]) || []);
    setCompanies((c.data as Company[]) || []);
  };

  const loadMissions = async (programId: string) => {
    setLoadingMissions(true);
    const [linked, all] = await Promise.all([
      supabase
        .from("program_missions")
        .select("id, mission_id, sort_order")
        .eq("program_id", programId)
        .order("sort_order"),
      supabase.from("missions").select("id, title, emoji, tag, points").eq("active", true).order("title"),
    ]);

    const allMissionsData = (all.data as Mission[]) || [];
    setAllMissions(allMissionsData);

    const linkedData = (linked.data || []).map((pm: any) => {
      const mission = allMissionsData.find(m => m.id === pm.mission_id);
      return mission ? { ...mission, program_mission_id: pm.id, sort_order: pm.sort_order ?? 0 } : null;
    }).filter(Boolean) as LinkedMission[];

    setLinkedMissions(linkedData);
    setLoadingMissions(false);
  };

  const openNew = () => {
    setEditing(null);
    setLinkedMissions([]);
    setAllMissions([]);
    setForm({ title: "", description: "", category: "general", emoji: "🌿", company_id: companies[0]?.id || "", starts_at: "", ends_at: "" });
    setShowForm(true);
  };

  const openEdit = (p: Program) => {
    setEditing(p);
    setForm({ title: p.title, description: p.description || "", category: p.category, emoji: p.emoji, company_id: p.company_id, starts_at: p.starts_at || "", ends_at: p.ends_at || "" });
    setShowForm(true);
    loadMissions(p.id);
  };

  const save = async () => {
    if (!form.title || !form.company_id) { toast.error("Preencha título e empresa."); return; }
    const payload = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      emoji: form.emoji,
      company_id: form.company_id,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    if (editing) {
      await supabase.from("wellbeing_programs").update(payload).eq("id", editing.id);
      toast.success("Programa atualizado.");
    } else {
      await supabase.from("wellbeing_programs").insert(payload);
      toast.success("Programa criado.");
    }
    setShowForm(false);
    load();
  };

  const toggle = async (p: Program) => {
    await supabase.from("wellbeing_programs").update({ active: !p.active }).eq("id", p.id);
    load();
  };

  const addMission = async (missionId: string) => {
    if (!editing) return;
    const nextOrder = linkedMissions.length;
    const { error } = await supabase.from("program_missions").insert({
      program_id: editing.id,
      mission_id: missionId,
      sort_order: nextOrder,
    });
    if (error) { toast.error("Erro ao vincular missão."); return; }
    toast.success("Missão vinculada.");
    loadMissions(editing.id);
  };

  const removeMission = async (programMissionId: string) => {
    if (!editing) return;
    await supabase.from("program_missions").delete().eq("id", programMissionId);
    toast.success("Missão desvinculada.");
    loadMissions(editing.id);
  };

  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "—";

  const linkedIds = new Set(linkedMissions.map(m => m.id));
  const suggestedTags = CATEGORY_TAG_MAP[form.category] || [];
  const availableMissions = allMissions.filter(m => !linkedIds.has(m.id));
  const suggestedMissions = suggestedTags.length > 0
    ? availableMissions.filter(m => suggestedTags.some(t => m.tag.toLowerCase().includes(t)))
    : [];
  const otherMissions = availableMissions.filter(m => !suggestedMissions.some(s => s.id === m.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">🌿 Programas de Bem-estar</h2>
        <Button onClick={openNew}>+ Novo Programa</Button>
      </div>

      {programs.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum programa cadastrado.</p>
      ) : (
        <div className="grid gap-3">
          {programs.map(p => (
            <Card key={p.id} className="cursor-pointer hover:bg-secondary/50 transition" onClick={() => openEdit(p)}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-2xl">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{companyName(p.company_id)}</p>
                </div>
                <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                <Badge variant="outline">{CATEGORIES.find(c => c.value === p.category)?.label || p.category}</Badge>
                <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); toggle(p); }}>
                  {p.active ? "Desativar" : "Ativar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Programa" : "Novo Programa"}</DialogTitle></DialogHeader>
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
                <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
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
            <Button onClick={save} className="w-full">{editing ? "Salvar" : "Criar Programa"}</Button>

            {/* Mission linking section - only when editing */}
            {editing && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Missões do Programa</h4>

                  {loadingMissions ? (
                    <p className="text-sm text-muted-foreground">Carregando missões...</p>
                  ) : (
                    <>
                      {/* Linked missions */}
                      {linkedMissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma missão vinculada a este programa.</p>
                      ) : (
                        <div className="space-y-2">
                          {linkedMissions.map(m => (
                            <div key={m.program_mission_id} className="flex items-center gap-2 bg-secondary/50 rounded-md p-2">
                              <span>{m.emoji || "🎯"}</span>
                              <span className="flex-1 text-sm font-medium text-foreground">{m.title}</span>
                              <Badge variant="outline" className="text-[10px]">{m.points || 0} pts</Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMission(m.program_mission_id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suggested missions by category */}
                      {suggestedMissions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Sugestões por categoria
                          </p>
                          {suggestedMissions.map(m => (
                            <div key={m.id} className="flex items-center gap-2 border border-primary/20 bg-primary/5 rounded-md p-2">
                              <span>{m.emoji || "🎯"}</span>
                              <span className="flex-1 text-sm text-foreground">{m.title}</span>
                              <Badge variant="outline" className="text-[10px]">{m.tag}</Badge>
                              <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => addMission(m.id)}>
                                <Plus className="h-3 w-3 mr-1" /> Vincular
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Other available missions */}
                      {otherMissions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Outras missões disponíveis</p>
                          {otherMissions.map(m => (
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
    </div>
  );
}
