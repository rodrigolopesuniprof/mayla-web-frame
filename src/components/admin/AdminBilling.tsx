import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminBillingCredentials } from "./AdminBillingCredentials";
import { AdminBillingPlans } from "./AdminBillingPlans";
import { AdminBillingAffiliates } from "./AdminBillingAffiliates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const CHECKOUT_BASE = "https://saude.saudecomvc.com.br";

type Sub = "credentials" | "plans" | "links" | "affiliates" | "subscriptions";

interface Props { companyId: string }

export function AdminBilling({ companyId }: Props) {
  const [tab, setTab] = useState<Sub>("credentials");
  const tabs: { id: Sub; label: string }[] = [
    { id: "credentials", label: "🔑 Credenciais Pagar.me" },
    { id: "plans", label: "📦 Planos" },
    { id: "links", label: "🔗 Links de cobrança" },
    { id: "affiliates", label: "🤝 Afiliados" },
    { id: "subscriptions", label: "📋 Assinaturas" },
  ];
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border-none cursor-pointer ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "credentials" && <AdminBillingCredentials companyId={companyId} />}
      {tab === "plans" && <AdminBillingPlans companyId={companyId} />}
      {tab === "links" && <CheckoutLinks companyId={companyId} />}
      {tab === "affiliates" && <AdminBillingAffiliates companyId={companyId} />}
      {tab === "subscriptions" && <SubscriptionsView companyId={companyId} />}
    </div>
  );
}

function CheckoutLinks({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<{ slug: string } | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("companies").select("slug").eq("id", companyId).maybeSingle(),
        supabase.from("subscription_plans")
          .select("id, name, price_cents, billing_interval, active")
          .eq("company_id", companyId)
          .eq("active", true)
          .order("created_at", { ascending: false }),
      ]);
      setCompany(c.data ?? null);
      setPlans(p.data ?? []);
    })();
  }, [companyId]);

  function copyLink(planId: string) {
    if (!company?.slug) { toast({ title: "Empresa sem slug", variant: "destructive" }); return; }
    const url = `${CHECKOUT_BASE}/assinar/${company.slug}?plan=${planId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: url });
  }

  if (!plans.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhum plano ativo. Crie um plano na aba "📦 Planos" primeiro.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Links diretos de cobrança — sem afiliado, sem split.</p>
      {plans.map((p) => {
        const url = company?.slug ? `${CHECKOUT_BASE}/assinar/${company.slug}?plan=${p.id}` : "";
        return (
          <Card key={p.id}><CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{p.name}</div>
              <div className="text-xs text-muted-foreground">R$ {(p.price_cents / 100).toFixed(2)} / {p.billing_interval === "monthly" ? "mês" : "ano"}</div>
              <div className="text-xs font-mono text-muted-foreground truncate mt-1">{url}</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => copyLink(p.id)}>🔗 Copiar</Button>
              <Button size="sm" variant="ghost" onClick={() => window.open(url, "_blank")}>↗</Button>
            </div>
          </CardContent></Card>
        );
      })}
    </div>
  );
}

function SubscriptionsView({ companyId }: { companyId: string }) {
  const [subs, setSubs] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200);
      const list = (rows as any[]) ?? [];
      const userIds = Array.from(new Set(list.map((r: any) => r.user_id).filter(Boolean)));
      const affIds = Array.from(new Set(list.map((r: any) => r.affiliate_id).filter(Boolean)));
      const [{ data: profs }, { data: affs }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] as any }),
        affIds.length ? supabase.from("affiliates").select("id, name, referral_code").in("id", affIds) : Promise.resolve({ data: [] as any }),
      ]);
      const profileMap: Record<string, string | null> = {};
      (profs ?? []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      const affMap: Record<string, { name: string; referral_code: string }> = {};
      (affs ?? []).forEach((a: any) => { affMap[a.id] = { name: a.name, referral_code: a.referral_code }; });
      setSubs(list.map((r: any) => ({
        ...r,
        _buyer: profileMap[r.user_id] ?? null,
        affiliate: r.affiliate_id ? affMap[r.affiliate_id] ?? null : null,
      })));
    })();
  }, [companyId]);

  const filtered = statusFilter === "all" ? subs : subs.filter((s) => s.status === statusFilter);
  const labelStatus = (s: string) => ({ active: "🟢 Ativa", pending: "🟡 Pendente", canceled: "⚪ Cancelada", past_due: "🔴 Inadimplente" } as any)[s] ?? s;
  const labelMethod = (s: any) =>
    s.payment_method === "credit_card"
      ? `💳 Cartão${s.card_brand ? ` ${s.card_brand}` : ""}${s.card_last4 ? ` ····${s.card_last4}` : ""}`
      : s.payment_method === "pix" ? "🔶 PIX" : s.payment_method;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center text-sm">
        <span className="text-muted-foreground">Filtrar:</span>
        <select className="border border-input bg-background rounded-md h-9 px-2"
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todas ({subs.length})</option>
          <option value="active">Ativas</option>
          <option value="pending">Pendentes</option>
          <option value="canceled">Canceladas</option>
          <option value="past_due">Inadimplentes</option>
        </select>
      </div>
      {filtered.map((s) => (
        <Card key={s.id}><CardContent className="p-4 text-sm space-y-1">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{s._buyer ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{s.plan?.name}</div>
            </div>
            <div className="text-right">
              <div className="text-xs">{labelStatus(s.status)}</div>
              <div className="text-xs text-muted-foreground">{labelMethod(s)}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex justify-between pt-1 border-t border-border">
            <span>{new Date(s.created_at).toLocaleDateString("pt-BR")} → até {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("pt-BR") : "—"}</span>
            <span>{s.affiliate ? `🤝 ${s.affiliate.name} (${s.affiliate.referral_code})` : "sem afiliado"}</span>
          </div>
        </CardContent></Card>
      ))}
      {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma assinatura.</p>}
    </div>
  );
}
