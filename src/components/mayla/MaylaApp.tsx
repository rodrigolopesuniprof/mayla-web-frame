import { useState, useEffect } from "react";
import type { TabId } from "@/lib/mayla-config";
import { SplashScreen } from "./SplashScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { HealthSurvey } from "./HealthSurvey";
import { BottomNav } from "./BottomNav";
import { HomeTab } from "./HomeTab";
import { HealthTab } from "./HealthTab";
import { ServicesTab } from "./ServicesTab";
import { MissionsTab } from "./MissionsTab";
import { ProfileTab } from "./ProfileTab";
import { TelemedicineScreen } from "./TelemedicineScreen";
import { AppointmentBooking } from "./AppointmentBooking";
import { EsfLinkScreen } from "./EsfLinkScreen";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type AppPhase = "splash" | "onboarding" | "survey" | "main";

export function MaylaApp() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [activeTab, setActiveTab] = useState<TabId>("inicio");
  const [surveyChecked, setSurveyChecked] = useState(false);
  const [isRetake, setIsRetake] = useState(false);
  const [showTelemedicine, setShowTelemedicine] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [showEsfLink, setShowEsfLink] = useState(false);

  // Check if health survey is completed (skip when retaking)
  useEffect(() => {
    if (!user || phase !== "survey" || isRetake) {
      if (isRetake) setSurveyChecked(true);
      return;
    }
    supabase
      .from("profiles")
      .select("health_survey_completed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if ((data as any)?.health_survey_completed) {
          setPhase("main");
        }
        setSurveyChecked(true);
      });
  }, [user, phase, isRetake]);

  const handleOnboardingDone = () => {
    setPhase("survey");
  };

  const handleSurveyDone = () => {
    setIsRetake(false);
    setPhase("main");
  };

  const handleRetakeSurvey = async () => {
    if (user) {
      await supabase
        .from("profiles")
        .update({ health_survey_completed: false })
        .eq("user_id", user.id);
    }
    setIsRetake(true);
    setSurveyChecked(true);
    setPhase("survey");
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
        {phase === "splash" && (
          <SplashScreen onDone={() => setPhase("onboarding")} />
        )}
        {phase === "onboarding" && (
          <OnboardingScreen onDone={handleOnboardingDone} />
        )}
        {phase === "survey" && surveyChecked && (
          <HealthSurvey onDone={handleSurveyDone} />
        )}
        {phase === "main" && (
          <>
            {showTelemedicine ? (
              <TelemedicineScreen onBack={() => setShowTelemedicine(false)} />
            ) : showAppointment ? (
              <AppointmentBooking onBack={() => setShowAppointment(false)} />
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
                  />
                )}
                {activeTab === "saude" && <HealthTab />}
                {activeTab === "servicos" && (
                  <ServicesTab
                    onOpenTelemedicine={() => setShowTelemedicine(true)}
                    onOpenAppointment={() => setShowAppointment(true)}
                  />
                )}
                {activeTab === "missoes" && <MissionsTab />}
                {activeTab === "perfil" && <ProfileTab onRetakeSurvey={handleRetakeSurvey} />}
              </div>
            )}
            <BottomNav active={activeTab} setActive={(t) => { setShowTelemedicine(false); setShowAppointment(false); setShowEsfLink(false); setActiveTab(t); }} />
          </>
        )}
      </div>
    </div>
  );
}
