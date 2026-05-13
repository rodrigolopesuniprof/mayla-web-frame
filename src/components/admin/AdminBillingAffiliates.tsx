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
  register_info: any;
}
interface Company { id: string; name: string; slug: string; }

const SITE_BASE = "https://saude.saudecomvc.com.br";

const bankNameHints: Record<string, string> = {
  itau: "341",
  bradesco: "237",
  santander: "033",
  bancodobrasil: "001",
  bb: "001",
  caixa: "104",
  nubank: "260",
  inter: "077",
  sicoob: "756",
  sicredi: "748",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeBankInput(value: string) {
  const digits = onlyDigits(value);
  if (digits) return digits.slice(0, 3).padStart(3, "0");
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return bankNameHints[key] ?? value.trim();
}

interface Props { companyId: string }

export function AdminBillingAffiliates({ companyId }: Props) {
  const [list, setList] = useState<Affiliate[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [editing, setEditing] = useState<Partial<Affiliate> | null>(null);
  const [bankBank, setBankBank] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountDigit, setBankAccountDigit] = useState("");
  const [bankType, setBankType] = useState<"checking" | "savings">("checking");

  // Dados extras Pagar.me
  const [birthdate, setBirthdate] = useState(""); // YYYY-MM-DD
  const [phoneArea, setPhoneArea] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [complement, setComplement] = useState("");

  useEffect(() => { load(); }, [companyId]);
  async function load() {
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from("affiliates").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name, slug").eq("id", companyId).maybeSingle(),
    ]);
    setList((a as Affiliate[]) ?? []);
    setCompany((c as Company) ?? null);
  }

  function open(a?: Affiliate) {
    if (a) {
      setEditing(a);
      const ba = a.bank_account || {};
      setBankBank(ba.bank ?? ""); setBankAgency(ba.branch_number ?? "");
      setBankAccount(ba.account_number ?? ""); setBankAccountDigit(ba.account_check_digit ?? "");
      setBankType(ba.type ?? "checking");
      const ri = a.register_info || {};
      setBirthdate(ri.birthdate ?? "");
      setPhoneArea(ri.phone?.ddd ?? ri.phone?.area_code ?? "");
      setPhoneNumber(ri.phone?.number ?? "");
      const ad = ri.address || {};
      setZip(ad.zip_code ?? ""); setStreet(ad.street ?? ""); setNumber(ad.street_number ?? "");
      setNeighborhood(ad.neighborhood ?? ""); setCity(ad.city ?? ""); setStateUf(ad.state ?? "");
      setComplement(ad.complement ?? "");
    } else {
      setEditing({ active: true, commission_percent: 10, kyc_status: "pending" });
      setBankBank(""); setBankAgency(""); setBankAccount(""); setBankAccountDigit(""); setBankType("checking");
      setBirthdate(""); setPhoneArea(""); setPhoneNumber("");
      setZip(""); setStreet(""); setNumber(""); setNeighborhood(""); setCity(""); setStateUf(""); setComplement("");
    }
  }

  async function save() {
    if (!editing?.name || !editing.email || !editing.cpf_cnpj) {
      toast({ title: "Preencha nome, email e CPF/CNPJ", variant: "destructive" }); return;
    }
    const bankCode = normalizeBankInput(bankBank);
    if (bankBank && !/^\d{3}$/.test(bankCode)) {
      toast({ title: "Código do banco inválido", description: "Use o código de 3 dígitos do banco. Ex.: Itaú 341, Bradesco 237.", variant: "destructive" }); return;
    }
    const bank_account = bankBank ? {
      holder_name: editing.name,
      holder_type: onlyDigits(editing.cpf_cnpj).length === 14 ? "company" : "individual",
      holder_document: onlyDigits(editing.cpf_cnpj),
      bank: bankCode,
      branch_number: onlyDigits(bankAgency).slice(0, 4),
      account_number: onlyDigits(bankAccount),
      account_check_digit: onlyDigits(bankAccountDigit).slice(0, 1),
      type: bankType,
    } : null;
    const register_info = {
      birthdate: birthdate || null,
      phone: phoneArea && phoneNumber ? { country_code: "55", ddd: phoneArea, number: phoneNumber, type: "mobile" } : null,
      address: zip ? {
        zip_code: onlyDigits(zip),
        street, street_number: number, neighborhood, city, state: stateUf, complement,
        country: "BR",
      } : null,
    };
    const payload: any = {
      name: editing.name, email: editing.email,
      phone: phoneArea && phoneNumber ? `(${phoneArea}) ${phoneNumber}` : (editing.phone ?? null),
      cpf_cnpj: editing.cpf_cnpj, commission_percent: Number(editing.commission_percent ?? 10),
      active: editing.active ?? true, company_id: companyId,
      bank_account, register_info,
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
    const bankCode = normalizeBankInput(String(a.bank_account.bank ?? ""));
    if (!/^\d{3}$/.test(bankCode)) {
      toast({ title: "Código do banco inválido", description: "Edite o afiliado e informe o código de 3 dígitos do banco. Ex.: Itaú 341.", variant: "destructive" }); return;
    }
    const savedPhoneArea = a.register_info?.phone?.ddd ?? a.register_info?.phone?.area_code;
    if (!savedPhoneArea || !a.register_info?.phone?.number) {
      toast({ title: "Telefone incompleto", description: "Edite o afiliado e salve o DDD e o celular novamente.", variant: "destructive" }); return;
    }
    if (!a.register_info?.address || !a.register_info?.phone || (a.cpf_cnpj.replace(/\D/g, "").length !== 14 && !a.register_info?.birthdate)) {
      toast({ title: "Faltam dados", description: "Preencha endereço, telefone e data de nascimento (PF) antes de criar o recipient.", variant: "destructive" }); return;
    }
    const company_id = companyId;
    if (!company_id) { toast({ title: "Empresa sem Pagar.me configurado", variant: "destructive" }); return; }
    const { data, error } = await supabase.functions.invoke("pagarme-create-affiliate-recipient", {
      body: { affiliate_id: a.id, company_id },
    });
    if (error || (data as any)?.error) {
      const detail = (data as any)?.details?.message || (data as any)?.details?.errors || (data as any)?.error || error?.message;
      toast({ title: "Erro Pagar.me", description: typeof detail === "string" ? detail : JSON.stringify(detail), variant: "destructive" });
      return;
    }
    toast({ title: "Recipient criado no Pagar.me" });
    load();
  }

  function getLink(a: Affiliate) {
    const slug = companies.find((c) => c.id === (linkCompany[a.id] || a.company_id))?.slug;
    if (!slug) return null;
    return `${SITE_BASE}/assinar/${slug}?ref=${a.referral_code}`;
  }

  async function copyLink(a: Affiliate) {
    const link = getLink(a);
    if (!link) { toast({ title: "Selecione uma empresa", variant: "destructive" }); return; }
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!", description: link });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-display text-lg">Afiliados / Revendedores</h3>
        <Button onClick={() => open()}>+ Novo afiliado</Button>
      </div>
      {list.map((a) => {
        const link = getLink(a);
        return (
          <Card key={a.id}>
            <CardContent className="p-4 space-y-3">
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

              <div className="border-t pt-3">
                <Label className="text-xs">Link de venda do afiliado</Label>
                <div className="flex gap-2 mt-1">
                  <select
                    className="border border-input bg-background rounded-md h-9 px-2 text-sm"
                    value={linkCompany[a.id] || a.company_id || ""}
                    onChange={(e) => setLinkCompany({ ...linkCompany, [a.id]: e.target.value })}
                  >
                    <option value="">— Selecione empresa —</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Input value={link ?? ""} readOnly className="font-mono text-xs flex-1" placeholder="Selecione uma empresa para gerar o link" />
                  <Button size="sm" variant="outline" onClick={() => copyLink(a)} disabled={!link}>Copiar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar afiliado" : "Novo afiliado"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={editing?.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div><Label>CPF/CNPJ</Label><Input value={editing?.cpf_cnpj ?? ""} onChange={(e) => setEditing({ ...editing, cpf_cnpj: e.target.value })} /></div>
              <div><Label>Data de nascimento</Label><Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} /></div>
              <div><Label>DDD</Label><Input value={phoneArea} onChange={(e) => setPhoneArea(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="11" /></div>
              <div><Label>Telefone</Label><Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="912345678" /></div>
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
              <div className="font-medium text-sm mb-2">Endereço (obrigatório no Pagar.me)</div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">CEP</Label><Input value={zip} onChange={(e) => setZip(e.target.value)} /></div>
                <div className="col-span-2"><Label className="text-xs">Rua</Label><Input value={street} onChange={(e) => setStreet(e.target.value)} /></div>
                <div><Label className="text-xs">Número</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
                <div className="col-span-2"><Label className="text-xs">Bairro</Label><Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} /></div>
                <div className="col-span-2"><Label className="text-xs">Cidade</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <div><Label className="text-xs">UF</Label><Input maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))} /></div>
                <div className="col-span-3"><Label className="text-xs">Complemento</Label><Input value={complement} onChange={(e) => setComplement(e.target.value)} /></div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="font-medium text-sm mb-2">Dados bancários (para split)</div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Banco</Label><Input value={bankBank} onChange={(e) => setBankBank(e.target.value)} placeholder="341" /></div>
                <div><Label className="text-xs">Agência (até 4)</Label><Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} /></div>
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
