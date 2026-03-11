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
import { toast } from "sonner";

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

const CATEGORIES = [
  { value: "burnout_prevention", label: "Prevenção de Burnout" },
  { value: "sleep_improvement", label: "Melhoria do Sono" },
  { value: "stress_reduction", label: "Redução de Estresse" },
  { value: "physical_activity", label: "Atividade Física" },
  { value: "general", label: "Geral" },
];

export function AdminPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "general", emoji: "🌿", company_id: "", starts_at: "", ends_at: "" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from("wellbeing_programs").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
    ]);
    setPrograms((p.data as Program[]) || []);
    setCompanies((c.data as Company[]) || []);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "general", emoji: "🌿", company_id: companies[0]?.id || "", starts_at: "", ends_at: "" });
    setShowForm(true);
  };

  const openEdit = (p: Program) => {
    setEditing(p);
    setForm({ title: p.title, description: p.description || "", category: p.category, emoji: p.emoji, company_id: p.company_id, starts_at: p.starts_at || "", ends_at: p.ends_at || "" });
    setShowForm(true);
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

  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "—";

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
        <DialogContent>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
