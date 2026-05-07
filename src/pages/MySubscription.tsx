import { useNavigate } from "react-router-dom";
import { useHasAccess } from "@/hooks/useHasAccess";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function MySubscription() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = useHasAccess();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!access.subscription) return;
    supabase
      .from("subscription_invoices")
      .select("*")
      .eq("subscription_id", access.subscription.id)
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setInvoices(data ?? []));
  }, [access.subscription]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
      if (p?.company_id) {
        const { data: c } = await supabase.from("companies").select("slug").eq("id", p.company_id).maybeSingle();
        setCompanySlug(c?.slug ?? null);
      }
    })();
  }, [user]);

  async function handleCancel() {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura?")) return;
    setCanceling(true);
    try {
      const { error } = await supabase.functions.invoke("pagarme-cancel-subscription", {
        body: { subscription_id: access.subscription.id },
      });
      if (error) throw error;
      toast({ title: "Assinatura cancelada" });
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e.message, variant: "destructive" });
    } finally {
      setCanceling(false);
    }
  }

  if (access.loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  const sub = access.subscription;

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minha assinatura</h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>Voltar</Button>
      </div>

      {!access.hasAccess && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="font-medium text-destructive mb-2">
              {access.reason === "no_subscription" && "Você ainda não possui uma assinatura ativa."}
              {access.reason === "past_due" && "Sua assinatura está com pagamento pendente."}
              {access.reason === "canceled" && "Sua assinatura está cancelada."}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Para acessar todos os serviços da plataforma, regularize sua assinatura.
            </p>
            {companySlug && (
              <Button onClick={() => navigate(`/assinar/${companySlug}`)}>Assinar agora</Button>
            )}
          </CardContent>
        </Card>
      )}

      {sub && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{sub.plan?.name ?? "Assinatura"}</span>
              <Badge variant={access.hasAccess ? "default" : "destructive"}>{sub.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sub.plan && (
              <div>
                <strong>Valor:</strong> R$ {(sub.plan.price_cents / 100).toFixed(2)} /{" "}
                {sub.plan.billing_interval === "monthly" ? "mês" : "ano"}
              </div>
            )}
            <div><strong>Forma de pagamento:</strong> {sub.payment_method}</div>
            {sub.current_period_end && (
              <div>
                <strong>Próxima cobrança:</strong>{" "}
                {new Date(sub.current_period_end).toLocaleDateString("pt-BR")}
              </div>
            )}
            {access.hasAccess && (
              <Button variant="destructive" size="sm" className="mt-3" onClick={handleCancel} disabled={canceling}>
                {canceling ? "Cancelando..." : "Cancelar assinatura"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {invoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Histórico de faturas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                <div>
                  <div>R$ {(inv.amount_cents / 100).toFixed(2)} · {inv.payment_method}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.paid_at
                      ? `Pago em ${new Date(inv.paid_at).toLocaleDateString("pt-BR")}`
                      : inv.due_date
                      ? `Vence em ${new Date(inv.due_date).toLocaleDateString("pt-BR")}`
                      : new Date(inv.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge variant={inv.status === "paid" ? "default" : inv.status === "failed" ? "destructive" : "secondary"}>
                  {inv.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
