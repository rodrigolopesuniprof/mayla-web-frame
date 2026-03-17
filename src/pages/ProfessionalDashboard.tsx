import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { OnlineStatusToggle } from "@/components/professional/OnlineStatusToggle";
import { WaitingQueue } from "@/components/professional/WaitingQueue";
import { TodayConsultations } from "@/components/professional/TodayConsultations";
import { ConsultationHistory } from "@/components/professional/ConsultationHistory";
import { OperationalAlerts } from "@/components/professional/OperationalAlerts";
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
  always_available: boolean;
}

export default function ProfessionalDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(true);
  const [activeCall, setActiveCall] = useState<{ id: string; patientName: string; specialty: string } | null>(null);
  const [queueCount, setQueueCount] = useState(0);

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

        const { data: statusData } = await supabase
          .from("professional_online_status")
          .select("online_now, accepts_on_demand, always_available")
          .eq("professional_id", data.id)
          .maybeSingle();

        if (statusData) {
          setOnlineStatus(statusData as OnlineStatus);
        } else {
          // Auto-create status record for first-time professionals
          const defaultStatus = { online_now: false, accepts_on_demand: false, always_available: false };
          await supabase
            .from("professional_online_status")
            .insert({
              professional_id: data.id,
              online_now: false,
              accepts_on_demand: false,
              always_available: false,
              last_seen_at: new Date().toISOString(),
            } as any);
          setOnlineStatus(defaultStatus);
        }
      }
      setLoadingPartner(false);
    };

    fetchPartner();
  }, [user]);

  if (authLoading || loadingPartner) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login-profissional" replace />;
  }

  if (!partner) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-sm px-6">
          <span className="text-5xl block mb-4">🔒</span>
          <h2 className="text-lg font-semibold text-foreground mb-2">Acesso profissional</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sua conta não está vinculada a um profissional aprovado. Solicite ao administrador que vincule seu e-mail.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate("/cadastro-parceiro")}>
              Cadastrar como profissional
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Sair
            </Button>
          </div>
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

  const isOnline = onlineStatus?.online_now || onlineStatus?.always_available;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0">
              {partner.partner_type === "doctor" ? "🩺" : "👩‍⚕️"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">{partner.name}</h1>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{partner.specialty || "Clínico Geral"}</span>
                {partner.crm && (
                  <Badge variant="outline" className="text-[10px] py-0">
                    CRM {partner.crm}/{partner.crm_state}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {queueCount > 0 && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                {queueCount} aguardando
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="text-xs">
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Operational Alerts */}
        <OperationalAlerts partnerId={partner.id} />

        {/* Online Status Controls */}
        {onlineStatus && (
          <OnlineStatusToggle
            partnerId={partner.id}
            initialOnline={onlineStatus.online_now}
            initialAcceptsOnDemand={onlineStatus.accepts_on_demand}
            alwaysAvailable={onlineStatus.always_available}
          />
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="queue">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="queue" className="text-xs sm:text-sm">
              🔔 Fila {queueCount > 0 && `(${queueCount})`}
            </TabsTrigger>
            <TabsTrigger value="today" className="text-xs sm:text-sm">
              📅 Hoje
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              📋 Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4">
            <WaitingQueue
              partnerId={partner.id}
              onStartCall={(c) => setActiveCall(c)}
              onQueueCountChange={setQueueCount}
            />
          </TabsContent>

          <TabsContent value="today" className="mt-4">
            <TodayConsultations
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
