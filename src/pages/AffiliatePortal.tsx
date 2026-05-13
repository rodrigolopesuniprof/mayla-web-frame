import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const SITE_BASE = "https://saude.saudecomvc.com.br";

interface Affiliate {
  id: string; name: string; email: string; referral_code: string;
  commission_percent: number; company_id: string | null;
}
interface Sub {
  id: string; user_id: string; status: string; payment_method: string;
  card_brand: string | null; card_last4: string | null;
  created_at: string; current_period_end: string | null;
  plan: { name: string; price_cents: number } | null;
  company: { name: string; slug: string } | null;
  _buyer?: string | null;
}
interface Commission {
  id: string; amount_cents: number; status: string; created_at: string; paid_at: string | null;
  commission_percent: number;
}

export default function AffiliatePortal() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [linkCompanyByAff, setLinkCompanyByAff] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login?next=/afiliado"); return; }
    (async () => {
      const { data: affs } = await supabase.from("affiliates")
        .select("id, name, email, referral_code, commission_percent, company_id");
      const list = (affs as Affiliate[]) ?? [];
      setAffiliates(list);
      if (list.length === 0) { setLoading(false); return; }
      const ids = list.map((a) => a.id);
      const [{ data: s }, { data: c }, { data: comp }] = await Promise.all([
        supabase.from("subscriptions")
          .select("id, user_id, company_id, status, payment_method, card_brand, card_last4, created_at, current_period_end, plan:subscription_plans(name, price_cents)")
          .in("affiliate_id", ids).order("created_at", { ascending: false }),
        supabase.from("affiliate_commissions")
          .select("id, amount_cents, status, created_at, paid_at, commission_percent")
          .in("affiliate_id", ids).order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name, slug").order("name"),
      ]);
      const subRows = ((s as any[]) ?? []);
      const userIds = Array.from(new Set(subRows.map((r) => r.user_id).filter(Boolean)));
      const buyerMap: Record<string, string | null> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        (profs ?? []).forEach((p: any) => { buyerMap[p.user_id] = p.full_name; });
      }
      const compMap: Record<string, { name: string; slug: string }> = {};
      ((comp as any[]) ?? []).forEach((co: any) => { compMap[co.id] = { name: co.name, slug: co.slug }; });
      setSubs(subRows.map((r: any) => ({
        ...r,
        company: r.company_id ? compMap[r.company_id] ?? null : null,
        _buyer: buyerMap[r.user_id] ?? null,
      })) as Sub[]);
      setCommissions((c as Commission[]) ?? []);
      setCompanies((comp as any) ?? []);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  if (affiliates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
        <h1 className="font-display text-2xl mb-2">Acesso não autorizado</h1>
        <p className="text-muted-foreground mb-4">Sua conta ({user?.email}) não está vinculada a nenhum afiliado.</p>
        <Button variant="outline" onClick={() => signOut().then(() => navigate("/login"))}>Sair</Button>
      </div>
    );
  }

  const totalActive = subs.filter((s) => s.status === "active").length;
  const mrrCents = subs.filter((s) => s.status === "active").reduce((acc, s) => acc + (s.plan?.price_cents ?? 0), 0);
  const earnedCents = commissions.filter((c) => c.status === "paid").reduce((a, c) => a + c.amount_cents, 0);
  const pendingCents = commissions.filter((c) => c.status === "pending").reduce((a, c) => a + c.amount_cents, 0);

  const labelStatus = (s: string) => ({ active: "🟢 Ativa", pending: "🟡 Pendente", canceled: "⚪ Cancelada", past_due: "🔴 Inadimplente" } as any)[s] ?? s;
  const labelMethod = (s: Sub) =>
    s.payment_method === "credit_card"
      ? `💳 Cartão${s.card_brand ? ` ${s.card_brand}` : ""}${s.card_last4 ? ` ····${s.card_last4}` : ""}`
      : s.payment_method === "pix" ? "🔶 PIX" : s.payment_method;

  function getLink(a: Affiliate) {
    const slug = companies.find((c) => c.id === (linkCompanyByAff[a.id] || a.company_id))?.slug;
    if (!slug) return "";
    return `${SITE_BASE}/assinar/${slug}?ref=${a.referral_code}`;
  }
  async function copy(link: string) {
    if (!link) { toast({ title: "Selecione uma empresa", variant: "destructive" }); return; }
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="font-display text-xl text-foreground">Portal do Afiliado</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/login"))}>Sair</Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {affiliates.map((a) => {
          const link = getLink(a);
          return (
            <Card key={a.id}>
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="text-lg font-medium text-foreground">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Código: <code className="bg-muted px-1 rounded">{a.referral_code}</code> · Comissão: {a.commission_percent}%
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Seu link de venda</label>
                  <div className="flex gap-2">
                    <select
                      className="border border-input bg-background rounded-md h-9 px-2 text-sm"
                      value={linkCompanyByAff[a.id] || a.company_id || ""}
                      onChange={(e) => setLinkCompanyByAff({ ...linkCompanyByAff, [a.id]: e.target.value })}
                    >
                      <option value="">— Selecione empresa —</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Input value={link} readOnly className="font-mono text-xs flex-1" placeholder="Selecione uma empresa" />
                    <Button size="sm" variant="outline" onClick={() => copy(link)} disabled={!link}>Copiar</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Assinantes ativos</div>
            <div className="text-2xl font-display text-foreground">{totalActive}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">MRR indicado</div>
            <div className="text-2xl font-display text-foreground">R$ {(mrrCents / 100).toFixed(2)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Comissão paga</div>
            <div className="text-2xl font-display text-foreground">R$ {(earnedCents / 100).toFixed(2)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Comissão pendente</div>
            <div className="text-2xl font-display text-foreground">R$ {(pendingCents / 100).toFixed(2)}</div>
          </CardContent></Card>
        </div>

        <div>
          <h2 className="font-display text-lg mb-3 text-foreground">Assinaturas indicadas ({subs.length})</h2>
          <div className="space-y-2">
            {subs.map((s) => (
              <Card key={s.id}><CardContent className="p-3 text-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{s._buyer ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.plan?.name} · {s.company?.name ?? "—"}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div>{labelStatus(s.status)}</div>
                    <div className="text-muted-foreground">{labelMethod(s)}</div>
                    <div className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                </div>
              </CardContent></Card>
            ))}
            {subs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma indicação ainda. Compartilhe seu link!</p>}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg mb-3 text-foreground">Comissões ({commissions.length})</h2>
          <div className="space-y-2">
            {commissions.map((c) => (
              <Card key={c.id}><CardContent className="p-3 text-sm flex justify-between items-center">
                <div>
                  <div className="font-medium text-foreground">R$ {(c.amount_cents / 100).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{c.commission_percent}% · {new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="text-xs">
                  {c.status === "paid" ? `🟢 Paga ${c.paid_at ? new Date(c.paid_at).toLocaleDateString("pt-BR") : ""}` : "🟡 Pendente"}
                </div>
              </CardContent></Card>
            ))}
            {commissions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sem comissões registradas.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
