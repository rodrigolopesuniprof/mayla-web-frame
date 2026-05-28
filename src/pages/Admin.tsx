import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { AdminCorporateDashboard } from "@/components/admin/AdminCorporateDashboard";
import { AdminCompanyDetail } from "@/components/admin/AdminCompanyDetail";
import { AdminAssistantInsights } from "@/components/admin/AdminAssistantInsights";
import { AdminMagazine } from "@/components/admin/AdminMagazine";
import { AdminBranding } from "@/components/admin/AdminBranding";
import { toast } from "@/hooks/use-toast";
import maylaLogo from "@/assets/mayla-avatar.png";

interface Company {
  id: string;
  name: string;
  slug: string;
  state: string;
  cnpj: string | null;
  logo_url: string | null;
  primary_color: string;
}

type Tab = "dashboard" | "empresas" | "assistente" | "magazine-global";

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase.from("companies").select("id, name, slug, state, cnpj, logo_url, primary_color").order("name");
    if (data) setCompanies(data as Company[]);
  }, []);

  useEffect(() => { if (isAdmin) loadCompanies(); }, [isAdmin, loadCompanies]);

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl text-foreground mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão de administrador.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar ao app</Button>
        </div>
      </div>
    );
  }

  // Company detail view
  if (selectedCompanyId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={maylaLogo} alt="Mayla" className="w-8 h-8 rounded-lg" />
              <h1 className="font-display text-xl font-medium text-foreground">Admin</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>Logout</Button>
          </div>
        </div>
        <AdminCompanyDetail
          companyId={selectedCompanyId}
          onBack={() => { setSelectedCompanyId(null); loadCompanies(); }}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "empresas", label: "🏢 Empresas" },
    { id: "assistente", label: "👩‍⚕️ Assistente" },
    { id: "magazine-global", label: "📰 Magazine Global" },
  ];

  const handleNewCompany = async () => {
    const name = prompt("Nome da nova empresa:");
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data, error } = await supabase.from("companies").insert({ name, slug }).select("id").single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (data) {
      await supabase.from("company_invite_tokens").insert({ company_id: data.id });
      toast({ title: "Empresa criada!" });
      loadCompanies();
      setSelectedCompanyId(data.id);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover a empresa "${name}"? Esta ação é irreversível.`)) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Empresa removida" }); loadCompanies(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={maylaLogo} alt="Mayla" className="w-8 h-8 rounded-lg" />
            <h1 className="font-display text-xl font-medium text-foreground">Admin</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>Logout</Button>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-2">
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border-none cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "dashboard" && <AdminCorporateDashboard />}
        {activeTab === "assistente" && <AdminAssistantInsights />}
        {activeTab === "magazine-global" && <AdminMagazine />}
        {activeTab === "empresas" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl text-foreground">Empresas ({companies.length})</h2>
              <Button onClick={handleNewCompany}>+ Nova Empresa</Button>
            </div>

            <div className="grid gap-3">
              {companies.map(c => (
                <Card key={c.id} className="overflow-hidden">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-primary-foreground"
                      style={{
                        background: c.logo_url
                          ? `url(${c.logo_url}) center/cover`
                          : `linear-gradient(135deg, hsl(${c.primary_color}), hsl(${c.primary_color} / 0.7))`,
                      }}
                    >
                      {!c.logo_url && c.name.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.state || "ES"} · /{c.slug}
                        {c.cnpj && ` · CNPJ: ${c.cnpj}`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setSelectedCompanyId(c.id)}>Acessar conta</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id, c.name)}>Remover</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {companies.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhuma empresa cadastrada.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
