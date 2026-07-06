import { useState, useEffect, useRef } from "react";
import type { CampanhasView } from "./CampanhasTab";
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
import { HealthMagazineList } from "./HealthMagazineList";
import { LeaderboardScreen } from "./LeaderboardScreen";
import { MaylaFloatingButton } from "./MaylaFloatingButton";
import { ProfileCompletionGate } from "./ProfileCompletionGate";

import { LevelUpNotifier } from "./LevelUpNotifier";


import { SelfAssessmentRunner } from "./SelfAssessmentRunner";
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
  const [showAllArticles, setShowAllArticles] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSelfAssessment, setShowSelfAssessment] = useState(false);
  const [assistantInitialMessage, setAssistantInitialMessage] = useState<string | null>(null);
  const [activeVideoCall, setActiveVideoCall] = useState<{ id: string; roomToken?: string; professionalName: string; professionalType: string; specialty: string } | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [campanhasInitialView, setCampanhasInitialView] = useState<CampanhasView | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Após aceitar convite em /liga/:code, o LeagueJoin salva o id da liga em
  // sessionStorage e redireciona para "/". Aqui abrimos direto o detalhe.
  useEffect(() => {
    const openId = sessionStorage.getItem("open_league_id");
    if (openId) {
      sessionStorage.removeItem("open_league_id");
      setActiveTab("campanhas");
      setCampanhasInitialView({ view: "league-detail", leagueId: openId });
    }
  }, []);

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
        ref={containerRef}
        className="flex flex-col bg-background overflow-hidden relative"
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
            {user && <ProfileCompletionGate onComplete={() => {}} />}
            {user && <LevelUpNotifier />}

            {showSelfAssessment && (
              <div className="absolute inset-0 z-40 bg-background">
                <SelfAssessmentRunner onBack={() => setShowSelfAssessment(false)} />
              </div>
            )}
            {activeVideoCall ? (
              <JitsiConsultationScreen
                consultation={{ ...activeVideoCall, consultationMode: "online" }}
                onLeave={() => setActiveVideoCall(null)}
              />
            ) : showAssistant ? (
              <HealthAssistantChat
                onBack={() => { setShowAssistant(false); setAssistantInitialMessage(null); }}
                initialMessage={assistantInitialMessage ?? undefined}
                onAction={(id) => {
                  if (id === "consulta") { setShowAssistant(false); setAssistantInitialMessage(null); setActiveTab("servicos"); setConsultOnlineMode(true); }
                  else if (id === "medicao") { setShowAssistant(false); setAssistantInitialMessage(null); setActiveTab("bemestar"); }
                  else if (id === "magazine") { setShowAssistant(false); setAssistantInitialMessage(null); setActiveTab("inicio"); }
                }}
              />
            ) : activeArticleId ? (
              <HealthMagazineArticle articleId={activeArticleId} onBack={() => setActiveArticleId(null)} />
            ) : showAllArticles ? (
              <HealthMagazineList
                onBack={() => setShowAllArticles(false)}
                onOpenArticle={(id) => { setShowAllArticles(false); setActiveArticleId(id); }}
              />
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
            ) : showLeaderboard ? (
              <LeaderboardScreen onBack={() => setShowLeaderboard(false)} />
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
                    onOpenAllArticles={() => setShowAllArticles(true)}
                    onOpenLeaderboard={() => setShowLeaderboard(true)}
                  />
                )}
                {activeTab === "bemestar" && <WellbeingTab />}
                {activeTab === "campanhas" && (
                  <CampanhasTab
                    onNavigate={(tab) => setActiveTab(tab)}
                    onOpenLeaderboard={() => setShowLeaderboard(true)}
                    initialView={campanhasInitialView}
                    onViewConsumed={() => setCampanhasInitialView(undefined)}
                  />
                )}
                {activeTab === "servicos" && <ServicosTab startOnlineMode={consultOnlineMode} onClearOnlineMode={() => setConsultOnlineMode(false)} />}
                {activeTab === "perfil" && <ProfileTab />}
              </div>
            )}
            <BottomNav active={activeTab} setActive={(t) => { setShowTelemedicine(false); setShowAppointment(false); setShowEsfLink(false); setShowOnDemand(false); setConsultOnlineMode(false); setActiveVideoCall(null); setShowAssistant(false); setAssistantInitialMessage(null); setActiveArticleId(null); setShowAllArticles(false); setActiveTab(t); }} />
            {!activeVideoCall && !showAssistant && (
              <MaylaFloatingButton
                containerRef={containerRef}
                onOpenAssistantWithMessage={(msg) => {
                  setShowTelemedicine(false);
                  setShowAppointment(false);
                  setShowOnDemand(false);
                  setShowEsfLink(false);
                  setActiveArticleId(null);
                  setShowAllArticles(false);
                  setAssistantInitialMessage(msg);
                  setShowAssistant(true);
                }}
                onAction={(action) => {
                  if (action === "consulta") { setShowTelemedicine(false); setShowAppointment(false); setShowOnDemand(false); setActiveTab("servicos"); setConsultOnlineMode(true); }
                  else if (action === "medicao") { setShowTelemedicine(false); setShowAppointment(false); setShowOnDemand(false); setActiveTab("bemestar"); }
                  else if (action === "magazine") { setShowTelemedicine(false); setShowAppointment(false); setShowOnDemand(false); setActiveTab("inicio"); }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
