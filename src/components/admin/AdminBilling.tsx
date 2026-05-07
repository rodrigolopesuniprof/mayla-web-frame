import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminBillingCredentials } from "./AdminBillingCredentials";
import { AdminBillingPlans } from "./AdminBillingPlans";
import { AdminBillingAffiliates } from "./AdminBillingAffiliates";
import { Card, CardContent } from "@/components/ui/card";

type Sub = "credentials" | "plans" | "assignments" | "affiliates" | "subscriptions";

export function AdminBilling() {
  const [tab, setTab] = useState<Sub>("credentials");
  const tabs: { id: Sub; label: string }[] = [
    { id: "credentials", label: "🔑 Credenciais" },
    { id: "plans", label: "📦 Planos" },
    { id: "assignments", label: "🏢 Planos por empresa" },
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
      {tab === "credentials" && <AdminBillingCredentials />}
      {tab === "plans" && <AdminBillingPlans />}
      {tab === "assignments" && <CompanyPlanAssignments />}
      {tab === "affiliates" && <AdminBillingAffiliates />}
      {tab === "subscriptions" && <SubscriptionsView />}
    </div>
  );
}

function CompanyPlanAssignments() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [c, p, a] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("subscription_plans").select("id, name, price_cents, billing_interval").eq("active", true),
        supabase.from("company_plan_assignments").select("*"),
      ]);
      setCompanies(c.data ?? []); setPlans(p.data ?? []); setAssignments(a.data ?? []);
    })();
  }, []);
  async function toggle(companyId: string, planId: string, active: boolean) {
    const exists = assignments.find((a) => a.company_id === companyId && a.plan_id === planId);
    if (exists) {
      await supabase.from("company_plan_assignments").update({ active }).eq("id", exists.id);
    } else {
      await supabase.from("company_plan_assignments").insert({ company_id: companyId, plan_id: planId, active });
    }
    const { data } = await supabase.from("company_plan_assignments").select("*");
    setAssignments(data ?? []);
  }
  return (
    <div className="space-y-3">
      {companies.map((c) => (
        <Card key={c.id}><CardContent className="p-4">
          <div className="font-medium mb-2 text-foreground">{c.name}</div>
          <div className="space-y-1">
            {plans.map((p) => {
              const a = assignments.find((x) => x.company_id === c.id && x.plan_id === p.id);
              const active = a?.active ?? false;
              return (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={active} onChange={(e) => toggle(c.id, p.id, e.target.checked)} />
                  {p.name} — R$ {(p.price_cents / 100).toFixed(2)} / {p.billing_interval === "monthly" ? "mês" : "ano"}
                </label>
              );
            })}
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

function SubscriptionsView() {
  const [subs, setSubs] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("subscriptions").select("*, plan:subscription_plans(name)").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setSubs(data ?? []));
  }, []);
  return (
    <div className="space-y-2">
      {subs.map((s) => (
        <Card key={s.id}><CardContent className="p-3 flex justify-between items-center text-sm">
          <div>
            <div className="font-medium">{s.plan?.name}</div>
            <div className="text-xs text-muted-foreground">{s.payment_method} · {s.status} · até {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
          <code className="text-xs">{s.id.slice(0, 8)}</code>
        </CardContent></Card>
      ))}
      {subs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma assinatura ainda.</p>}
    </div>
  );
}
