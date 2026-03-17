import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { OnlineStatusToggle } from "@/components/professional/OnlineStatusToggle";
import { WaitingQueue } from "@/components/professional/WaitingQueue";
import { ConsultationHistory } from "@/components/professional/ConsultationHistory";
import { JitsiConsultationScreen } from "@/components/mayla/JitsiConsultationScreen";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PartnerProfile {
  id: string;
  name: string;
  specialty: string | null;
  crm: string | null;
  crm_state: string | null;
  partner_type: string;
}

interface OnlineStatus {
  online_now: boolean;
  accepts_on_demand: boolean;
}

export default function ProfessionalDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(true);
  const [activeCall, setActiveCall] = useState<{ id: string; patientName: string; specialty: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchPartner = async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, name, specialty, crm, crm_state, partner_type")
        .eq("user_id", user.id)
        .eq("active", true)
        .eq("approval_status", "approved")
        .maybeSingle();

      if (data) {
        setPartner(data as PartnerProfile);

        // Fetch online status
        const { data: statusData } = await supabase
          .from("professional_online_status")
          .select("online_now, accepts_on_demand")
          .eq("professional_id", data.id)
          .maybeSingle();

        setOnlineStatus(statusData as OnlineStatus || { online_now: false, accepts_on_demand: false });
      }
      setLoadingPartner(false);
    };

    fetchPartner();
  }, [user]);

  if (authLoading || loadingPartner) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!partner) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-sm px-6">
          <span className="text-5xl block mb-4">🔒</span>
          <h2 className="text-lg font-semibold text-foreground mb-2">Acesso profissional</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sua conta não está vinculada a um profissional aprovado. Faça seu cadastro como parceiro primeiro.
          </p>
          <Button variant="outline" onClick={() => navigate("/cadastro-parceiro")}>
            Cadastrar como profissional
          </Button>
          <Button variant="ghost" className="ml-2" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  // Active video call overlay
  if (activeCall) {
    return (
      <div className="min-h-screen bg-background">
        <JitsiConsultationScreen
          consultation={{
            id: activeCall.id,
            professionalName: partner.name,
            professionalType: partner.partner_type === "doctor" ? "doctor" : "nurse",
            specialty: activeCall.specialty,
            consultationMode: "online",
          }}
          onLeave={() => setActiveCall(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
            {partner.partner_type === "doctor" ? "🩺" : "👩‍⚕️"}
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">{partner.name}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{partner.specialty}</span>
              {partner.crm && (
                <Badge variant="outline" className="text-[10px]">
                  CRM {partner.crm}/{partner.crm_state}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>Sair</Button>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Online Status */}
        {onlineStatus && (
          <OnlineStatusToggle
            partnerId={partner.id}
            initialOnline={onlineStatus.online_now}
            initialAcceptsOnDemand={onlineStatus.accepts_on_demand}
          />
        )}

        {/* Tabs: Queue + History */}
        <Tabs defaultValue="queue">
          <TabsList className="w-full">
            <TabsTrigger value="queue" className="flex-1">🔔 Fila de espera</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">📋 Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="queue" className="mt-4">
            <WaitingQueue
              partnerId={partner.id}
              onStartCall={(c) => setActiveCall(c)}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <ConsultationHistory partnerId={partner.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
