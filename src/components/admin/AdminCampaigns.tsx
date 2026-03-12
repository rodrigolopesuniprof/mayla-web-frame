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

interface Campaign {
  id: string;
  company_id: string;
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

export function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", emoji: "🏆", category: "challenge",
    bonus_points: "0", badge_name: "", badge_emoji: "", company_id: "",
    starts_at: "", ends_at: "",
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [c, co] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
    ]);
    setCampaigns((c.data as Campaign[]) || []);
    setCompanies((co.data as Company[]) || []);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", emoji: "🏆", category: "challenge", bonus_points: "0", badge_name: "", badge_emoji: "", company_id: companies[0]?.id || "", starts_at: "", ends_at: "" });
    setShowForm(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      title: c.title, description: c.description || "", emoji: c.emoji, category: c.category,
      bonus_points: String(c.bonus_points), badge_name: c.badge_name || "", badge_emoji: c.badge_emoji || "",
      company_id: c.company_id, starts_at: c.starts_at, ends_at: c.ends_at,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title || !form.company_id || !form.starts_at || !form.ends_at) {
      toast.error("Preencha todos os campos obrigatórios."); return;
    }
    const payload = {
      title: form.title, description: form.description || null, emoji: form.emoji,
      category: form.category, bonus_points: parseInt(form.bonus_points) || 0,
      badge_name: form.badge_name || null, badge_emoji: form.badge_emoji || null,
      company_id: form.company_id, starts_at: form.starts_at, ends_at: form.ends_at,
    };
    if (editing) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Campanha atualizada.");
    } else {
      const { error } = await supabase.from("campaigns").insert(payload);
      if (error) { toast.error("Erro ao criar: " + error.message); return; }
      toast.success("Campanha criada.");
    }
    setShowForm(false);
    load();
  };

  const toggle = async (c: Campaign) => {
    await supabase.from("campaigns").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">🏆 Campanhas</h2>
        <Button onClick={openNew}>+ Nova Campanha</Button>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma campanha cadastrada.</p>
      ) : (
        <div className="grid gap-3">
          {campaigns.map(c => (
            <Card key={c.id} className="cursor-pointer hover:bg-secondary/50 transition" onClick={() => openEdit(c)}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {companyName(c.company_id)} · {new Date(c.starts_at).toLocaleDateString("pt-BR")} — {new Date(c.ends_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge>
                {c.bonus_points > 0 && <Badge variant="outline">+{c.bonus_points} pts</Badge>}
                <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); toggle(c); }}>
                  {c.active ? "Desativar" : "Ativar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Campanha" : "Nova Campanha"}</DialogTitle></DialogHeader>
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
                <Label>Pontos bônus</Label>
                <Input type="number" value={form.bonus_points} onChange={e => setForm(f => ({ ...f, bonus_points: e.target.value }))} />
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
            <Button onClick={save} className="w-full">{editing ? "Salvar" : "Criar Campanha"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
