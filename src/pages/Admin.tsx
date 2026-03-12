import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AdminCompanies } from "@/components/admin/AdminCompanies";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { AdminLocations } from "@/components/admin/AdminLocations";
import { AdminSpecialties } from "@/components/admin/AdminSpecialties";
import { AdminAppointments } from "@/components/admin/AdminAppointments";
import { AdminSupportTeams } from "@/components/admin/AdminSupportTeams";
import { AdminPrograms } from "@/components/admin/AdminPrograms";
import { AdminCorporateDashboard } from "@/components/admin/AdminCorporateDashboard";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import maylaLogo from "@/assets/mayla-avatar.png";

type Tab = "corp_dashboard" | "empresas" | "usuarios" | "programas" | "avisos" | "locais" | "especialidades" | "agendamentos" | "equipes";

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("corp_dashboard");

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

  const tabs: { id: Tab; label: string }[] = [
    { id: "corp_dashboard", label: "📊 Dashboard" },
    { id: "empresas", label: "🏢 Empresas" },
    { id: "usuarios", label: "👤 Colaboradores" },
    { id: "programas", label: "🌿 Programas" },
    { id: "avisos", label: "📢 Notificações" },
    { id: "equipes", label: "👥 Equipes" },
    { id: "locais", label: "📍 Locais" },
    { id: "especialidades", label: "🩺 Especialidades" },
    { id: "agendamentos", label: "📋 Agendamentos" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={maylaLogo} alt="Mayla" className="w-8 h-8 rounded-lg" />
            <h1 className="font-display text-xl font-medium text-foreground">Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>← Sair</Button>
            <Button variant="ghost" size="sm" onClick={signOut}>Logout</Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-2">
          <nav className="flex gap-1 overflow-x-auto">
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
        {activeTab === "corp_dashboard" && <AdminCorporateDashboard />}
        {activeTab === "empresas" && <AdminCompanies />}
        {activeTab === "usuarios" && <AdminUsers />}
        {activeTab === "programas" && <AdminPrograms />}
        {activeTab === "avisos" && <AdminNotifications />}
        {activeTab === "equipes" && <AdminSupportTeams />}
        {activeTab === "locais" && <AdminLocations />}
        {activeTab === "especialidades" && <AdminSpecialties />}
        {activeTab === "agendamentos" && <AdminAppointments />}
      </div>
    </div>
  );
}
