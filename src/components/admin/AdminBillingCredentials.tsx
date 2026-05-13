import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Cred {
  company_id: string;
  pagarme_recipient_id: string | null;
  pagarme_public_key: string | null;
  webhook_secret: string | null;
  environment: "test" | "live";
  enabled: boolean;
  require_paid_subscription: boolean;
}

interface Props { companyId: string }

export function AdminBillingCredentials({ companyId }: Props) {
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [cred, setCred] = useState<Cred | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // form
  const [apiKey, setApiKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [enabled, setEnabled] = useState(false);
  const [requirePaid, setRequirePaid] = useState(false);

  useEffect(() => { load(); }, [companyId]);

  async function load() {
    const [{ data: c }, { data: cr }] = await Promise.all([
      supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle(),
      supabase.from("company_payment_credentials").select("*").eq("company_id", companyId).maybeSingle(),
    ]);
    setCompany(c ?? null);
    setCred((cr as Cred) ?? null);
  }

  function openDialog() {
    setApiKey("");
    setPublicKey(cred?.pagarme_public_key ?? "");
    setRecipientId(cred?.pagarme_recipient_id ?? "");
    setWebhookSecret(cred?.webhook_secret ?? "");
    setEnvironment(cred?.environment ?? "test");
    setEnabled(cred?.enabled ?? false);
    setRequirePaid(cred?.require_paid_subscription ?? false);
    setOpen(true);
  }

  async function save() {
    setLoading(true);
    const { error } = await supabase.functions.invoke("pagarme-save-credentials", {
      body: {
        company_id: companyId,
        api_key: apiKey || undefined,
        public_key: publicKey,
        recipient_id: recipientId,
        webhook_secret: webhookSecret,
        environment, enabled, require_paid_subscription: requirePaid,
      },
    });
    setLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Credenciais salvas" });
    setOpen(false);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        URL do webhook Pagar.me: <code className="bg-muted px-1.5 py-0.5 rounded">
          {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pagarme-webhook`}
        </code>
      </div>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="font-medium text-foreground">{company?.name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {cred ? `${cred.enabled ? "🟢 Ativo" : "⚪ Inativo"} · ${cred.environment} · ${cred.require_paid_subscription ? "Exige assinatura" : "Acesso livre"}` : "Sem integração"}
            </div>
          </div>
          <Button size="sm" onClick={openDialog}>Configurar</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pagar.me — {company?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>API Secret Key {cred?.pagarme_recipient_id ? "(deixe vazio para manter)" : ""}</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk_test_..." />
            </div>
            <div>
              <Label>Public Key (pk_test_... ou pk_live_...)</Label>
              <Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="pk_test_..." />
            </div>
            <div>
              <Label>Recipient ID (conta da empresa)</Label>
              <Input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} placeholder="rp_..." />
            </div>
            <div>
              <Label>Webhook Secret (opcional)</Label>
              <Input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
            </div>
            <div>
              <Label>Ambiente</Label>
              <select className="w-full border border-input bg-background rounded-md h-10 px-3 text-sm" value={environment} onChange={(e) => setEnvironment(e.target.value as "test" | "live")}>
                <option value="test">Teste</option>
                <option value="live">Produção</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="en">Integração ativa</Label>
              <Switch id="en" checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rp">Exigir assinatura paga para acesso</Label>
              <Switch id="rp" checked={requirePaid} onCheckedChange={setRequirePaid} />
            </div>
            <Button onClick={save} disabled={loading} className="w-full">{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

