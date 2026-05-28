import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Trash2, Mail, MessageCircle, Gift } from "lucide-react";

interface Reward {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cost_points: number | null;
  min_level: number | null;
  stock: number | null;
  active: boolean;
}

interface Grant {
  id: string;
  reward_id: string;
  user_id: string;
  granted_at: string;
  notified_email_at: string | null;
  notified_whatsapp_at: string | null;
  note: string | null;
}

interface Member { user_id: string; full_name: string | null; phone: string | null; email: string | null }

interface Props { companyId: string }

export function AdminRewards({ companyId }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Partial<Reward> | null>(null);
  const [granting, setGranting] = useState<Reward | null>(null);
  const [grantUser, setGrantUser] = useState<string>("");
  const [grantNote, setGrantNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [rRes, gRes, mRes] = await Promise.all([
      supabase.from("rewards" as any).select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("reward_grants" as any).select("*").eq("company_id", companyId).order("granted_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("user_id, full_name, phone").eq("company_id", companyId).order("full_name"),
    ]);
    setRewards((rRes.data as any) || []);
    setGrants((gRes.data as any) || []);
    setMembers(((mRes.data as any) || []).map((m: any) => ({ ...m, email: null })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const memberById = (id: string) => members.find(m => m.user_id === id);
  const rewardById = (id: string) => rewards.find(r => r.id === id);

  const saveReward = async () => {
    if (!editing) return;
    if (!editing.title) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    const payload: any = {
      company_id: companyId,
      title: editing.title,
      description: editing.description ?? null,
      image_url: editing.image_url ?? null,
      cost_points: editing.cost_points ?? null,
      min_level: editing.min_level ?? null,
      stock: editing.stock ?? null,
      active: editing.active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("rewards" as any).update(payload).eq("id", editing.id)
      : await supabase.from("rewards" as any).insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Prêmio salvo" });
    setEditing(null);
    load();
  };

  const deleteReward = async (id: string) => {
    if (!confirm("Remover este prêmio?")) return;
    const { error } = await supabase.from("rewards" as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const submitGrant = async () => {
    if (!granting || !grantUser) return;
    const { error } = await supabase.from("reward_grants" as any).insert({
      company_id: companyId,
      reward_id: granting.id,
      user_id: grantUser,
      note: grantNote || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Prêmio entregue!" });
    setGranting(null); setGrantUser(""); setGrantNote("");
    load();
  };

  const markNotified = async (g: Grant, field: "notified_email_at" | "notified_whatsapp_at") => {
    await supabase.from("reward_grants" as any).update({ [field]: new Date().toISOString() }).eq("id", g.id);
    load();
  };

  const sendEmail = async (g: Grant) => {
    const m = memberById(g.user_id);
    const r = rewardById(g.reward_id);
    const subject = encodeURIComponent(`Parabéns! Você ganhou ${r?.title || "um prêmio"} 🎁`);
    const body = encodeURIComponent(`Olá ${m?.full_name || ""}!\n\nVocê foi premiado: ${r?.title}\n${r?.description || ""}\n\nParabéns!`);
    // Try fetching email via auth.users via edge would require a function — open mailto without to:
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    markNotified(g, "notified_email_at");
  };

  const sendWhatsapp = async (g: Grant) => {
    const m = memberById(g.user_id);
    const r = rewardById(g.reward_id);
    const phone = (m?.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(`Olá ${m?.full_name || ""}! 🎉 Você ganhou um prêmio: ${r?.title}. ${r?.description || ""}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    markNotified(g, "notified_whatsapp_at");
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Cadastre prêmios da campanha e entregue manualmente aos ganhadores. Notificações são abertas no email/WhatsApp do navegador.</p>
        <Button onClick={() => setEditing({ active: true })}>+ Novo prêmio</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rewards.length === 0 && <p className="text-sm text-muted-foreground">Nenhum prêmio cadastrado ainda.</p>}
        {rewards.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4 flex gap-3">
              <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {r.image_url ? <img src={r.image_url} alt="" className="w-full h-full object-cover" /> : <Gift className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-foreground truncate">{r.title}</div>
                  {!r.active && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Inativo</span>}
                </div>
                {r.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</div>}
                <div className="text-[11px] text-muted-foreground mt-1">
                  {r.cost_points ? `${r.cost_points} pts` : "Sem custo"} · Estoque: {r.stock ?? "∞"}{r.min_level ? ` · Nível ${r.min_level}+` : ""}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Editar</Button>
                  <Button size="sm" onClick={() => setGranting(r)}>Entregar a usuário</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteReward(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="font-display text-lg text-foreground mb-3">Últimas entregas</h3>
        <div className="space-y-2">
          {grants.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma entrega registrada ainda.</p>}
          {grants.map(g => {
            const m = memberById(g.user_id);
            const r = rewardById(g.reward_id);
            return (
              <Card key={g.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Gift className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r?.title || "Prêmio"} → {m?.full_name || "Colaborador"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(g.granted_at).toLocaleString("pt-BR")}
                      {g.notified_email_at && " · ✉️ notificado"}
                      {g.notified_whatsapp_at && " · 💬 WhatsApp enviado"}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => sendEmail(g)}><Mail className="w-3.5 h-3.5 mr-1" />Email</Button>
                  <Button size="sm" variant="outline" onClick={() => sendWhatsapp(g)}><MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar prêmio" : "Novo prêmio"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><label className="text-xs">Título</label><Input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><label className="text-xs">Descrição</label><Textarea value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><label className="text-xs">URL da imagem</label><Input value={editing.image_url || ""} onChange={e => setEditing({ ...editing, image_url: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-xs">Custo (pts)</label><Input type="number" value={editing.cost_points ?? ""} onChange={e => setEditing({ ...editing, cost_points: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><label className="text-xs">Nível mínimo</label><Input type="number" value={editing.min_level ?? ""} onChange={e => setEditing({ ...editing, min_level: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><label className="text-xs">Estoque</label><Input type="number" value={editing.stock ?? ""} onChange={e => setEditing({ ...editing, stock: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <span className="text-sm">Ativo</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveReward}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant dialog */}
      <Dialog open={!!granting} onOpenChange={(v) => !v && setGranting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Entregar "{granting?.title}"</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs">Colaborador</label>
              <select className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm" value={grantUser} onChange={e => setGrantUser(e.target.value)}>
                <option value="">Selecione...</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name || m.user_id}</option>)}
              </select>
            </div>
            <div><label className="text-xs">Observação (opcional)</label><Textarea value={grantNote} onChange={e => setGrantNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGranting(null)}>Cancelar</Button>
            <Button onClick={submitGrant} disabled={!grantUser}>Entregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
