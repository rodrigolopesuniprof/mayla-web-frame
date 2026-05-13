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
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      const list = (rows as any[]) ?? [];
      const userIds = Array.from(new Set(list.map((r: any) => r.user_id).filter(Boolean)));
      const compIds = Array.from(new Set(list.map((r: any) => r.company_id).filter(Boolean)));
      const affIds = Array.from(new Set(list.map((r: any) => r.affiliate_id).filter(Boolean)));
      const [{ data: profs }, { data: comps }, { data: affs }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] as any }),
        compIds.length ? supabase.from("companies").select("id, name").in("id", compIds) : Promise.resolve({ data: [] as any }),
        affIds.length ? supabase.from("affiliates").select("id, name, referral_code").in("id", affIds) : Promise.resolve({ data: [] as any }),
      ]);
      const profileMap: Record<string, string | null> = {};
      (profs ?? []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      const compMap: Record<string, string> = {};
      (comps ?? []).forEach((c: any) => { compMap[c.id] = c.name; });
      const affMap: Record<string, { name: string; referral_code: string }> = {};
      (affs ?? []).forEach((a: any) => { affMap[a.id] = { name: a.name, referral_code: a.referral_code }; });
      setSubs(list.map((r: any) => ({
        ...r,
        _buyer: profileMap[r.user_id] ?? null,
        company: r.company_id ? { name: compMap[r.company_id] ?? "—" } : null,
        affiliate: r.affiliate_id ? affMap[r.affiliate_id] ?? null : null,
      })));
    })();
  }, []);

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
              <div className="text-xs text-muted-foreground">{s.plan?.name} · {s.company?.name ?? "—"}</div>
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
