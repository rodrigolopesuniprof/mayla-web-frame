import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AdminMunicipalities } from "@/components/admin/AdminMunicipalities";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { AdminHealthUnits } from "@/components/admin/AdminHealthUnits";
import { AdminSpecialties } from "@/components/admin/AdminSpecialties";
import { AdminAppointments } from "@/components/admin/AdminAppointments";
import { AdminESF } from "@/components/admin/AdminESF";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import maylaLogo from "@/assets/mayla-avatar.png";

type Tab = "dashboard" | "municipios" | "usuarios" | "avisos" | "unidades" | "especialidades" | "agendamentos" | "esf";

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

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

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="font-display text-xl font-medium text-foreground">🛡️ Painel Admin</h1>
            <nav className="flex gap-1">
              {[
                { id: "dashboard" as Tab, label: "📊 Dashboard" },
                { id: "municipios" as Tab, label: "🏛️ Municípios" },
                { id: "esf" as Tab, label: "🏠 ESF" },
                { id: "especialidades" as Tab, label: "🩺 Especialidades" },
                { id: "agendamentos" as Tab, label: "📋 Agendamentos" },
                { id: "usuarios" as Tab, label: "👥 Usuários" },
                { id: "avisos" as Tab, label: "📢 Avisos" },
                { id: "unidades" as Tab, label: "🏥 Unidades" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border-none cursor-pointer ${
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
          <div className="flex items-center gap-3">
            <img src={maylaLogo} alt="Mayla" className="w-8 h-8 rounded-lg" />
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>← Sair</Button>
            <Button variant="ghost" size="sm" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === "dashboard" && <AdminDashboard />}
        {activeTab === "municipios" && <AdminMunicipalities />}
        {activeTab === "esf" && <AdminESF />}
        {activeTab === "especialidades" && <AdminSpecialties />}
        {activeTab === "agendamentos" && <AdminAppointments />}
        {activeTab === "usuarios" && <AdminUsers />}
        {activeTab === "avisos" && <AdminNotifications />}
        {activeTab === "unidades" && <AdminHealthUnits />}
      </div>
    </div>
  );
}
