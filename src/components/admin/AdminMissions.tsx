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

interface Mission {
  id: string;
  title: string;
  description: string | null;
  tag: string;
  emoji: string;
  points: number;
  frequency: string;
  validation_type: string;
  active: boolean;
  priority: number;
}

const FREQUENCIES = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "once", label: "Única" },
];

const VALIDATION_TYPES = [
  { value: "self_report", label: "Auto-relato" },
  { value: "photo", label: "Foto" },
  { value: "qr_code", label: "QR Code" },
  { value: "automatic", label: "Automática" },
];

export function AdminMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", tag: "saude", emoji: "🎯",
    points: "50", frequency: "monthly", validation_type: "self_report", priority: "0",
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("missions").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
    setMissions((data as Mission[]) || []);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", tag: "saude", emoji: "🎯", points: "50", frequency: "monthly", validation_type: "self_report", priority: "0" });
    setShowForm(true);
  };

  const openEdit = (m: Mission) => {
    setEditing(m);
    setForm({
      title: m.title, description: m.description || "", tag: m.tag, emoji: m.emoji,
      points: String(m.points), frequency: m.frequency, validation_type: m.validation_type,
      priority: String(m.priority),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title || !form.tag) { toast.error("Preencha título e tag."); return; }
    const payload = {
      title: form.title, description: form.description || null, tag: form.tag, emoji: form.emoji,
      points: parseInt(form.points) || 0, frequency: form.frequency,
      validation_type: form.validation_type, priority: parseInt(form.priority) || 0,
    };
    if (editing) {
      await supabase.from("missions").update(payload).eq("id", editing.id);
      toast.success("Missão atualizada.");
    } else {
      await supabase.from("missions").insert(payload);
      toast.success("Missão criada.");
    }
    setShowForm(false);
    load();
  };

  const toggle = async (m: Mission) => {
    await supabase.from("missions").update({ active: !m.active }).eq("id", m.id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">🎯 Missões</h2>
        <Button onClick={openNew}>+ Nova Missão</Button>
      </div>

      {missions.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma missão cadastrada.</p>
      ) : (
        <div className="grid gap-3">
          {missions.map(m => (
            <Card key={m.id} className="cursor-pointer hover:bg-secondary/50 transition" onClick={() => openEdit(m)}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-2xl">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{m.title}</p>
                  <p className="text-sm text-muted-foreground">{m.tag} · {m.points} pts · {FREQUENCIES.find(f => f.value === m.frequency)?.label}</p>
                </div>
                <Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Ativa" : "Inativa"}</Badge>
                <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); toggle(m); }}>
                  {m.active ? "Desativar" : "Ativar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Missão" : "Nova Missão"}</DialogTitle></DialogHeader>
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
                <Label>Tag</Label>
                <Input value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="saude, exercicio..." />
              </div>
              <div className="space-y-1">
                <Label>Pontos</Label>
                <Input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Frequência</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Validação</Label>
                <Select value={form.validation_type} onValueChange={v => setForm(f => ({ ...f, validation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VALIDATION_TYPES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Prioridade (maior = aparece primeiro)</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
            </div>
            <Button onClick={save} className="w-full">{editing ? "Salvar" : "Criar Missão"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
