import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  emoji: string;
  color: string;
  external_url: string | null;
  scope: string;
  municipality_id: string | null;
  target_user_id: string | null;
  priority: number;
  active: boolean;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

interface Municipality {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  cpf: string | null;
}

const COLOR_PRESETS = [
  { label: "Âmbar", value: "38 92% 50%" },
  { label: "Rosa", value: "5 75% 60%" },
  { label: "Teal", value: "174 58% 39%" },
  { label: "Verde", value: "142 55% 42%" },
  { label: "Azul", value: "204 67% 32%" },
];

const EMOJI_PRESETS = ["📢", "💉", "🦟", "📋", "💊", "🏥", "⚠️", "🔔", "📌", "🩺", "🧪", "💧"];

const emptyForm = {
  title: "",
  body: "",
  emoji: "📢",
  color: "204 67% 32%",
  external_url: "",
  scope: "company",
  municipality_id: "",
  company_id: "",
  target_user_id: "",
  priority: 0,
  active: true,
  expires_at: "",
};

export function AdminNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterMunicipality, setFilterMunicipality] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [notifRes, munRes, compRes, usersRes] = await Promise.all([
      supabase.from("notifications").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("municipalities").select("id, name").order("name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("profiles").select("user_id, full_name, cpf"),
    ]);
    if (notifRes.data) setNotifications(notifRes.data);
    if (munRes.data) setMunicipalities(munRes.data);
    if (compRes.data) setCompanies(compRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(n: Notification) {
    setEditingId(n.id);
    setForm({
      title: n.title,
      body: n.body || "",
      emoji: n.emoji,
      color: n.color,
      external_url: n.external_url || "",
      scope: n.scope,
      municipality_id: n.municipality_id || "",
      company_id: (n as any).company_id || "",
      target_user_id: n.target_user_id || "",
      priority: n.priority,
      active: n.active,
      expires_at: n.expires_at ? n.expires_at.slice(0, 16) : "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (form.scope === "municipal" && !form.municipality_id) {
      toast.error("Selecione um município");
      return;
    }
    if (form.scope === "company" && !form.company_id) {
      toast.error("Selecione uma empresa");
      return;
    }
    if (form.scope === "personal" && !form.target_user_id) {
      toast.error("Selecione um usuário alvo");
      return;
    }

    const payload = {
      title: form.title.trim(),
      body: form.body.trim() || null,
      emoji: form.emoji,
      color: form.color,
      external_url: form.external_url.trim() || null,
      scope: form.scope,
      municipality_id: form.scope === "municipal" ? form.municipality_id : null,
      company_id: form.scope === "company" ? form.company_id : null,
      target_user_id: form.scope === "personal" ? form.target_user_id : null,
      priority: form.priority,
      active: form.active,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      created_by: user!.id,
    };

    if (editingId) {
      const { error } = await supabase.from("notifications").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Aviso atualizado");
    } else {
      const { error } = await supabase.from("notifications").insert(payload);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Aviso criado");
    }
    setDialogOpen(false);
    loadData();
  }

  async function handleToggleActive(id: string, active: boolean) {
    await supabase.from("notifications").update({ active: !active }).eq("id", id);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este aviso?")) return;
    await supabase.from("notifications").delete().eq("id", id);
    toast.success("Aviso excluído");
    loadData();
  }

  const filtered = filterMunicipality === "all"
    ? notifications
    : notifications.filter(n => n.municipality_id === filterMunicipality || (n as any).company_id === filterMunicipality || n.scope === "personal");

  const getMunName = (id: string | null) => municipalities.find(m => m.id === id)?.name || "—";
  const getCompanyName = (id: string | null) => companies.find(c => c.id === id)?.name || "—";
  const getUserName = (id: string | null) => {
    const u = users.find(u => u.user_id === id);
    return u ? (u.full_name || u.cpf || u.user_id.slice(0, 8)) : "—";
  };

  if (loading) return <p className="text-muted-foreground py-8 text-center">Carregando avisos...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-lg font-medium text-foreground">Avisos / Informações</h2>
          <Select value={filterMunicipality} onValueChange={setFilterMunicipality}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>🏢 {c.name}</SelectItem>
              ))}
              {municipalities.map(m => (
                <SelectItem key={m.id} value={m.id}>🏛 {m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openCreate}>+ Novo aviso</Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">Nenhum aviso cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(n => (
            <div
              key={n.id}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
              style={{ borderLeftWidth: 4, borderLeftColor: `hsl(${n.color})` }}
            >
              <span className="text-xl mt-0.5">{n.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm text-foreground">{n.title}</span>
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${n.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {n.active ? "Ativo" : "Inativo"}
                  </span>
                  <span className="text-[10px] rounded px-1.5 py-0.5 bg-secondary text-secondary-foreground">
                    {n.scope === "municipal" ? `🏛 ${getMunName(n.municipality_id)}` : n.scope === "company" ? `🏢 ${getCompanyName((n as any).company_id)}` : `👤 ${getUserName(n.target_user_id)}`}
                  </span>
                </div>
                {n.body && <p className="text-xs text-muted-foreground mb-1">{n.body}</p>}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {n.external_url && <span>🔗 Link externo</span>}
                  {n.expires_at && <span>⏰ Expira: {new Date(n.expires_at).toLocaleDateString("pt-BR")}</span>}
                  <span>Prioridade: {n.priority}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(n)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(n.id, n.active)}>
                  {n.active ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(n.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar aviso" : "Novo aviso"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Campanha vacina da gripe" />
            </div>
            <div>
              <Label>Corpo (até 144 caracteres)</Label>
              <Textarea
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value.slice(0, 144) })}
                placeholder="Texto expandido ao clicar no aviso..."
                rows={3}
              />
              <span className="text-[11px] text-muted-foreground">{form.body.length}/144</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Emoji</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {EMOJI_PRESETS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm({ ...form, emoji: e })}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border cursor-pointer transition-colors ${form.emoji === e ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Cor da borda</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, color: c.value })}
                      className={`w-8 h-8 rounded-lg border cursor-pointer transition-all ${form.color === c.value ? "ring-2 ring-primary ring-offset-2" : "border-border"}`}
                      style={{ background: `hsl(${c.value})` }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>Escopo</Label>
              <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v, target_user_id: "", municipality_id: "", company_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">🏢 Empresa (todos da empresa)</SelectItem>
                  <SelectItem value="municipal">🏛 Municipal (todos do município)</SelectItem>
                  <SelectItem value="personal">👤 Pessoal (usuário específico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === "company" && (
              <div>
                <Label>Empresa *</Label>
                <Select value={form.company_id} onValueChange={v => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "municipal" && (
              <div>
                <Label>Município *</Label>
                <Select value={form.municipality_id} onValueChange={v => setForm({ ...form, municipality_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {municipalities.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "personal" && (
              <div>
                <Label>Usuário alvo *</Label>
                <Select value={form.target_user_id} onValueChange={v => setForm({ ...form, target_user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name || u.cpf || u.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Link externo (opcional)</Label>
              <Input value={form.external_url} onChange={e => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Expira em</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Salvar" : "Criar aviso"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
