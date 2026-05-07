import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Affiliate {
  id: string; name: string; email: string; phone: string | null;
  cpf_cnpj: string; commission_percent: number; referral_code: string;
  active: boolean; kyc_status: "pending" | "approved" | "rejected";
  pagarme_recipient_id: string | null;
  bank_account: any; company_id: string | null;
}
interface Company { id: string; name: string; }

export function AdminBillingAffiliates() {
  const [list, setList] = useState<Affiliate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<Partial<Affiliate> | null>(null);
  const [bankBank, setBankBank] = useState(""); // codigo banco
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountDigit, setBankAccountDigit] = useState("");
  const [bankType, setBankType] = useState<"checking" | "savings">("checking");

  useEffect(() => { load(); }, []);
  async function load() {
    const { data: a } = await supabase.from("affiliates").select("*").order("created_at", { ascending: false });
    const { data: c } = await supabase.from("companies").select("id, name").order("name");
    setList((a as Affiliate[]) ?? []);
    setCompanies((c as Company[]) ?? []);
  }

  function open(a?: Affiliate) {
    if (a) {
      setEditing(a);
      const ba = a.bank_account || {};
      setBankBank(ba.bank ?? ""); setBankAgency(ba.branch_number ?? "");
      setBankAccount(ba.account_number ?? ""); setBankAccountDigit(ba.account_check_digit ?? "");
      setBankType(ba.type ?? "checking");
    } else {
      setEditing({ active: true, commission_percent: 10, kyc_status: "pending" });
      setBankBank(""); setBankAgency(""); setBankAccount(""); setBankAccountDigit(""); setBankType("checking");
    }
  }

  async function save() {
    if (!editing?.name || !editing.email || !editing.cpf_cnpj) {
      toast({ title: "Preencha nome, email e CPF/CNPJ", variant: "destructive" }); return;
    }
    const bank_account = bankBank ? {
      holder_name: editing.name,
      holder_type: editing.cpf_cnpj.replace(/\D/g, "").length === 14 ? "company" : "individual",
      holder_document: editing.cpf_cnpj.replace(/\D/g, ""),
      bank: bankBank,
      branch_number: bankAgency,
      account_number: bankAccount,
      account_check_digit: bankAccountDigit,
      type: bankType,
    } : null;
    const payload: any = {
      name: editing.name, email: editing.email, phone: editing.phone ?? null,
      cpf_cnpj: editing.cpf_cnpj, commission_percent: Number(editing.commission_percent ?? 10),
      active: editing.active ?? true, company_id: editing.company_id ?? null,
      bank_account,
    };
    if (!editing.id) {
      const { data: code } = await supabase.rpc("generate_referral_code");
      payload.referral_code = code;
    }
    const { error } = editing.id
      ? await supabase.from("affiliates").update(payload).eq("id", editing.id)
      : await supabase.from("affiliates").insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Afiliado salvo" });
    setEditing(null); load();
  }

  async function createRecipient(a: Affiliate) {
    if (!a.bank_account) { toast({ title: "Configure dados bancários antes", variant: "destructive" }); return; }
    const company_id = a.company_id ?? companies[0]?.id;
    if (!company_id) { toast({ title: "Vincule a uma empresa com Pagar.me", variant: "destructive" }); return; }
    const { error } = await supabase.functions.invoke("pagarme-create-affiliate-recipient", {
      body: { affiliate_id: a.id, company_id },
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Recipient criado no Pagar.me" });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-display text-lg">Afiliados / Revendedores</h3>
        <Button onClick={() => open()}>+ Novo afiliado</Button>
      </div>
      {list.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{a.name} <span className="text-xs text-muted-foreground">{a.commission_percent}%</span></div>
                <div className="text-xs text-muted-foreground">
                  {a.email} · código <code className="bg-muted px-1 rounded">{a.referral_code}</code>
                  {a.pagarme_recipient_id ? " · 🟢 KYC " + a.kyc_status : " · ⚠️ sem recipient"}
                </div>
              </div>
              <div className="flex gap-2">
                {!a.pagarme_recipient_id && <Button size="sm" onClick={() => createRecipient(a)}>Criar Recipient</Button>}
                <Button size="sm" variant="outline" onClick={() => open(a)}>Editar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar afiliado" : "Novo afiliado"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={editing?.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div><Label>CPF/CNPJ</Label><Input value={editing?.cpf_cnpj ?? ""} onChange={(e) => setEditing({ ...editing, cpf_cnpj: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={editing?.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div><Label>Comissão (%)</Label><Input type="number" step="0.5" value={editing?.commission_percent ?? 10} onChange={(e) => setEditing({ ...editing, commission_percent: Number(e.target.value) })} /></div>
              <div>
                <Label>Empresa vinculada</Label>
                <select className="w-full border border-input bg-background rounded-md h-10 px-3 text-sm" value={editing?.company_id ?? ""} onChange={(e) => setEditing({ ...editing, company_id: e.target.value || null })}>
                  <option value="">— Global —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="font-medium text-sm mb-2">Dados bancários (para split)</div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Banco</Label><Input value={bankBank} onChange={(e) => setBankBank(e.target.value)} placeholder="237" /></div>
                <div><Label className="text-xs">Agência</Label><Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} /></div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select className="w-full border border-input bg-background rounded-md h-10 px-3 text-sm" value={bankType} onChange={(e) => setBankType(e.target.value as any)}>
                    <option value="checking">Corrente</option>
                    <option value="savings">Poupança</option>
                  </select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Conta</Label><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} /></div>
                <div><Label className="text-xs">Dígito</Label><Input value={bankAccountDigit} onChange={(e) => setBankAccountDigit(e.target.value)} /></div>
              </div>
            </div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={editing?.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></div>
            <Button onClick={save} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
