import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Plan {
  id: string; name: string; description: string | null;
  price_cents: number; billing_interval: "monthly" | "yearly";
  payment_methods: string[]; trial_days: number; active: boolean;
}

interface Props { companyId: string }

export function AdminBillingPlans({ companyId }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);

  useEffect(() => { load(); }, [companyId]);
  async function load() {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setPlans((data as Plan[]) ?? []);
  }

  async function save() {
    if (!editing?.name || !editing.price_cents) {
      toast({ title: "Preencha nome e preço", variant: "destructive" }); return;
    }
    const cents = Number(editing.price_cents);
    if (!Number.isFinite(cents) || cents < 1) {
      toast({ title: "Preço inválido", description: "Informe um valor em reais (ex: 29,90)", variant: "destructive" }); return;
    }
    const payload = {
      name: editing.name,
      description: editing.description ?? null,
      price_cents: Math.round(cents),
      billing_interval: editing.billing_interval ?? "monthly",
      payment_methods: (editing.payment_methods ?? ["credit_card", "pix"]) as ("credit_card" | "pix")[],
      trial_days: Number(editing.trial_days ?? 0),
      active: editing.active ?? true,
      company_id: companyId,
    };
    const { data: saved, error } = editing.id
      ? await supabase.from("subscription_plans").update(payload).eq("id", editing.id).select("id").maybeSingle()
      : await supabase.from("subscription_plans").insert(payload).select("id").maybeSingle();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    // Mantém company_plan_assignments em sincronia para compat com Subscribe.tsx
    const planId = saved?.id ?? editing.id;
    if (planId) {
      const { data: existing } = await supabase
        .from("company_plan_assignments")
        .select("id").eq("company_id", companyId).eq("plan_id", planId).maybeSingle();
      if (existing) {
        await supabase.from("company_plan_assignments").update({ active: payload.active }).eq("id", existing.id);
      } else {
        await supabase.from("company_plan_assignments").insert({ company_id: companyId, plan_id: planId, active: payload.active });
      }
    }
    toast({ title: "Plano salvo" });
    setEditing(null); load();
  }

  async function remove(id: string) {
    if (!confirm("Remover plano?")) return;
    await supabase.from("subscription_plans").delete().eq("id", id);
    load();
  }

  function togglePm(pm: string) {
    const cur = editing?.payment_methods ?? ["credit_card", "pix"];
    const next = cur.includes(pm) ? cur.filter((x) => x !== pm) : [...cur, pm];
    setEditing({ ...editing!, payment_methods: next });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-display text-lg">Catálogo de planos</h3>
        <Button onClick={() => setEditing({ active: true, billing_interval: "monthly", payment_methods: ["credit_card", "pix"], trial_days: 0 })}>+ Novo plano</Button>
      </div>
      {plans.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-foreground">{p.name} {!p.active && <span className="text-xs text-muted-foreground">(inativo)</span>}</div>
              <div className="text-xs text-muted-foreground">
                R$ {(p.price_cents / 100).toFixed(2)} / {p.billing_interval === "monthly" ? "mês" : "ano"} · {p.payment_methods.join(", ")} · trial {p.trial_days}d
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Editar</Button>
              <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>Remover</Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="29,90"
                  value={editing?.price_cents ? (editing.price_cents / 100).toFixed(2).replace(".", ",") : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d,.]/g, "").replace(",", ".");
                    const reais = parseFloat(raw);
                    setEditing({ ...editing, price_cents: Number.isFinite(reais) ? Math.round(reais * 100) : 0 });
                  }}
                />
                {editing?.price_cents ? <p className="text-xs text-muted-foreground mt-1">= {editing.price_cents} centavos</p> : null}
              </div>
              <div>
                <Label>Recorrência</Label>
                <select className="w-full border border-input bg-background rounded-md h-10 px-3 text-sm" value={editing?.billing_interval ?? "monthly"} onChange={(e) => setEditing({ ...editing, billing_interval: e.target.value as any })}>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Métodos de pagamento</Label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(editing?.payment_methods ?? []).includes("credit_card")} onChange={() => togglePm("credit_card")} /> Cartão</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(editing?.payment_methods ?? []).includes("pix")} onChange={() => togglePm("pix")} /> PIX</label>
              </div>
            </div>
            <div><Label>Dias de trial</Label><Input type="number" value={editing?.trial_days ?? 0} onChange={(e) => setEditing({ ...editing, trial_days: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={editing?.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></div>
            <Button onClick={save} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
