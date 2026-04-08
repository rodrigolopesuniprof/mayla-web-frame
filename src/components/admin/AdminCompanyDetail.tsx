import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AdminCompanySettings } from "./AdminCompanySettings";
import { AdminUsers } from "./AdminUsers";
import { AdminPrograms } from "./AdminPrograms";
import { AdminNotifications } from "./AdminNotifications";
import { AdminPartners } from "./AdminPartners";
import { AdminSurveys } from "./AdminSurveys";
import { AdminSupportTeams } from "./AdminSupportTeams";
import { AdminIntegrations } from "./AdminIntegrations";
import { ArrowLeft } from "lucide-react";

interface Company {
  id: string;
  name: string;
  slug: string;
  state: string;
  cnpj: string | null;
  cnae: string | null;
  rppg_url: string | null;
  telemedicine_url: string | null;
  hr_contact_email: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  secondary_color: string;
}

type Section = "dados" | "usuarios" | "pesquisas" | "programas" | "servicos-medicos" | "servicos-gerais" | "integracoes" | "notificacoes";

const SECTIONS: { id: Section; label: string; emoji: string }[] = [
  { id: "dados", label: "Dados da Conta", emoji: "🏢" },
  { id: "usuarios", label: "Usuários Vinculados", emoji: "👥" },
  { id: "pesquisas", label: "Pesquisas", emoji: "📋" },
  { id: "programas", label: "Programas de Saúde", emoji: "🌿" },
  { id: "servicos-medicos", label: "Serviços Médicos", emoji: "🩺" },
  { id: "servicos-gerais", label: "Serviços Gerais", emoji: "🏪" },
  { id: "integracoes", label: "Integrações", emoji: "🔌" },
  { id: "notificacoes", label: "Notificações", emoji: "📢" },
];

interface Props {
  companyId: string;
  onBack: () => void;
}

export function AdminCompanyDetail({ companyId, onBack }: Props) {
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("dados");
  const [loading, setLoading] = useState(true);

  const loadCompany = useCallback(async () => {
    const [compRes, tokenRes] = await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).single(),
      supabase.from("company_invite_tokens").select("token").eq("company_id", companyId).maybeSingle(),
    ]);
    if (compRes.data) setCompany(compRes.data as unknown as Company);
    if (tokenRes.data) setToken(tokenRes.data.token);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { loadCompany(); }, [loadCompany]);

  if (loading || !company) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-0 min-h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-border bg-card/50 p-4 space-y-1">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0"
            style={{
              background: company.logo_url
                ? `url(${company.logo_url}) center/cover`
                : `linear-gradient(135deg, hsl(${company.primary_color}), hsl(${company.primary_color} / 0.7))`,
            }}
          >
            {!company.logo_url && company.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
            <p className="text-[11px] text-muted-foreground">/{company.slug}</p>
          </div>
        </div>

        {SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border-none cursor-pointer ${
              activeSection === section.id
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {section.emoji} {section.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="font-display text-xl font-medium text-foreground mb-6">
          {SECTIONS.find(s => s.id === activeSection)?.emoji}{" "}
          {SECTIONS.find(s => s.id === activeSection)?.label}
        </h2>

        {activeSection === "dados" && (
          <AdminCompanySettings company={company} token={token} onCompanyUpdated={loadCompany} />
        )}

        {activeSection === "usuarios" && (
          <AdminUsers companyId={company.id} companyName={company.name} />
        )}

        {activeSection === "pesquisas" && (
          <AdminSurveys />
        )}

        {activeSection === "programas" && (
          <AdminPrograms companyId={company.id} />
        )}

        {activeSection === "servicos-medicos" && (
          <AdminPartners filterTypes={["doctor", "clinic"]} />
        )}

        {activeSection === "servicos-gerais" && (
          <AdminPartners filterTypes={["gym", "laboratory", "pharmacy"]} />
        )}

        {activeSection === "notificacoes" && (
          <AdminNotifications companyId={company.id} />
        )}
      </div>
    </div>
  );
}

