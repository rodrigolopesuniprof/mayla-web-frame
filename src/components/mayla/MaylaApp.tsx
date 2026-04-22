import { useState, useEffect } from "react";
import type { TabId } from "@/lib/mayla-config";
import { SplashScreen } from "./SplashScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { BottomNav } from "./BottomNav";
import { HomeTab } from "./HomeTab";
import { WellbeingTab } from "./WellbeingTab";
import { CampanhasTab } from "./CampanhasTab";
import { ServicosTab } from "./ServicosTab";
import { ProfileTab } from "./ProfileTab";
import { TelemedicineScreen } from "./TelemedicineScreen";
import { JitsiConsultationScreen } from "./JitsiConsultationScreen";
import { AppointmentBooking } from "./AppointmentBooking";
import { EsfLinkScreen } from "./EsfLinkScreen";
import { OnDemandFlow } from "./OnDemandFlow";
import { HealthAssistantChat } from "./HealthAssistantChat";
import { HealthMagazineArticle } from "./HealthMagazineArticle";
import { useAuth } from "@/contexts/AuthContext";

type AppPhase = "loading" | "splash" | "onboarding" | "main";

export function MaylaApp() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<AppPhase>("loading");
  const [activeTab, setActiveTab] = useState<TabId>("inicio");
  const [showTelemedicine, setShowTelemedicine] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [showEsfLink, setShowEsfLink] = useState(false);
  const [showOnDemand, setShowOnDemand] = useState(false);
  const [consultOnlineMode, setConsultOnlineMode] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [activeVideoCall, setActiveVideoCall] = useState<{ id: string; roomToken?: string; professionalName: string; professionalType: string; specialty: string } | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (hasChecked) return;
    // If logged in, go straight to main; otherwise show splash
    setPhase(user ? "main" : "splash");
    setHasChecked(true);
  }, [user, hasChecked]);

  const handleOnboardingDone = () => {
    setPhase("main");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-mayla-bg">
      <div
        className="flex flex-col bg-background overflow-hidden"
        style={{
          width: "100%",
          maxWidth: 430,
          height: "100dvh",
          maxHeight: 932,
          borderRadius: "clamp(0px, 2vw, 44px)",
          boxShadow: "0 25px 80px rgba(42,30,26,.15), 0 8px 24px rgba(42,30,26,.1)",
        }}
      >
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        )}
        {phase === "splash" && <SplashScreen onDone={() => setPhase("onboarding")} />}
        {phase === "onboarding" && <OnboardingScreen onDone={handleOnboardingDone} />}
        {phase === "main" && (
          <>
            {activeVideoCall ? (
              <JitsiConsultationScreen
                consultation={{ ...activeVideoCall, consultationMode: "online" }}
                onLeave={() => setActiveVideoCall(null)}
              />
            ) : showAssistant ? (
              <HealthAssistantChat onBack={() => setShowAssistant(false)} />
            ) : activeArticleId ? (
              <HealthMagazineArticle articleId={activeArticleId} onBack={() => setActiveArticleId(null)} />
            ) : showTelemedicine ? (
              <TelemedicineScreen onBack={() => setShowTelemedicine(false)} />
            ) : showAppointment ? (
              <AppointmentBooking onBack={() => setShowAppointment(false)} />
            ) : showOnDemand ? (
              <OnDemandFlow
                onBack={() => setShowOnDemand(false)}
                onStartCall={(c) => { setShowOnDemand(false); setActiveVideoCall(c); }}
              />
            ) : showEsfLink ? (
              <EsfLinkScreen onBack={() => setShowEsfLink(false)} onLinked={() => setShowEsfLink(false)} />
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab === "inicio" && (
                  <HomeTab
                    setTab={setActiveTab}
                    onOpenTelemedicine={() => setShowTelemedicine(true)}
                    onOpenAppointment={() => setShowAppointment(true)}
                    onOpenEsfLink={() => setShowEsfLink(true)}
                    onOpenVideoCall={(c) => setActiveVideoCall(c)}
                    onOpenOnDemand={() => setShowOnDemand(true)}
                    onOpenConsultationOnline={() => {
                      setActiveTab("servicos");
                      setConsultOnlineMode(true);
                    }}
                    onOpenAssistant={() => setShowAssistant(true)}
                    onOpenArticle={(id) => setActiveArticleId(id)}
                  />
                )}
                {activeTab === "bemestar" && <WellbeingTab />}
                {activeTab === "campanhas" && <CampanhasTab onNavigate={(tab) => setActiveTab(tab)} />}
                {activeTab === "servicos" && <ServicosTab startOnlineMode={consultOnlineMode} onClearOnlineMode={() => setConsultOnlineMode(false)} />}
                {activeTab === "perfil" && <ProfileTab />}
              </div>
            )}
            <BottomNav active={activeTab} setActive={(t) => { setShowTelemedicine(false); setShowAppointment(false); setShowEsfLink(false); setShowOnDemand(false); setConsultOnlineMode(false); setActiveVideoCall(null); setShowAssistant(false); setActiveArticleId(null); setActiveTab(t); }} />
          </>
        )}
      </div>
    </div>
  );
}
