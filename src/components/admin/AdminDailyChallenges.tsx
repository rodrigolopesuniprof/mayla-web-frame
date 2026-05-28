import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  points: number;
  active: boolean;
  sort_order: number;
}

interface Assignment {
  id: string;
  assigned_date: string;
  daily_challenges: { title: string; emoji: string } | null;
}

interface Props { companyId: string; }

export function AdminDailyChallenges({ companyId }: Props) {
  const [items, setItems] = useState<Challenge[]>([]);
  const [today, setToday] = useState<Assignment | null>(null);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", emoji: "🎯", points: "50", active: true, sort_order: "0" });

  const load = async () => {
    const [{ data: pool }, ensureRes] = await Promise.all([
      supabase.from("daily_challenges" as any).select("*").eq("company_id", companyId).order("sort_order").order("created_at"),
      supabase.rpc("ensure_daily_challenge" as any, { _company_id: companyId }),
    ]);
    setItems((pool as Challenge[]) || []);
    if (ensureRes.data) {
      const { data: asg } = await supabase
        .from("daily_challenge_assignments" as any)
        .select("id, assigned_date, daily_challenges:challenge_id (title, emoji)")
        .eq("id", ensureRes.data as any)
        .maybeSingle();
      setToday((asg as any) || null);
    } else {
      setToday(null);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", emoji: "🎯", points: "50", active: true, sort_order: String(items.length) });
    setShowForm(true);
  };
  const openEdit = (c: Challenge) => {
    setEditing(c);
    setForm({ title: c.title, description: c.description || "", emoji: c.emoji, points: String(c.points), active: c.active, sort_order: String(c.sort_order) });
    setShowForm(true);
  };

  const save = async () => {
    const payload = {
      company_id: companyId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      emoji: form.emoji || "🎯",
      points: parseInt(form.points) || 50,
      active: form.active,
      sort_order: parseInt(form.sort_order) || 0,
      validation_type: "self_report",
    };
    if (!payload.title) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    const { error } = editing
      ? await supabase.from("daily_challenges" as any).update(payload).eq("id", editing.id)
      : await supabase.from("daily_challenges" as any).insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Desafio atualizado" : "Desafio criado" });
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este desafio?")) return;
    const { error } = await supabase.from("daily_challenges" as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Cadastre um pool de desafios diários para os colaboradores. Todos os dias o sistema escolhe automaticamente um do pool ativo
          (rotação determinística — todos da empresa veem o mesmo desafio no mesmo dia). Os colaboradores ganham pontos ao concluir.
        </p>
        {today?.daily_challenges && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 flex items-center gap-3 mb-4">
            <div className="text-2xl">{today.daily_challenges.emoji}</div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">Desafio de hoje</div>
              <div className="text-sm font-semibold text-foreground">{today.daily_challenges.title}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-foreground">Pool ({items.length})</h3>
        <Button size="sm" onClick={openNew}>+ Novo desafio</Button>
      </div>

      <div className="grid gap-3">
        {items.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="text-2xl">{c.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{c.title}</div>
                {c.description && <div className="text-xs text-muted-foreground truncate">{c.description}</div>}
                <div className="text-[11px] text-muted-foreground mt-1">+{c.points} pts · ordem {c.sort_order} · {c.active ? "Ativo" : "Inativo"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Editar</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum desafio cadastrado ainda.</p>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar desafio" : "Novo desafio"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div>
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} />
              </div>
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pontos</Label>
                <Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
