import { useState, useEffect } from "react";
import type { TabId } from "@/lib/mayla-config";
import { SplashScreen } from "./SplashScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { HealthSurvey } from "./HealthSurvey";
import { BottomNav } from "./BottomNav";
import { HomeTab } from "./HomeTab";
import { WellbeingTab } from "./WellbeingTab";
import { CampanhasTab } from "./CampanhasTab";
import { ServicosTab } from "./ServicosTab";
import { ProfileTab } from "./ProfileTab";
import { TelemedicineScreen } from "./TelemedicineScreen";
import { AppointmentBooking } from "./AppointmentBooking";
import { EsfLinkScreen } from "./EsfLinkScreen";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type AppPhase = "loading" | "splash" | "onboarding" | "survey" | "main";

export function MaylaApp() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<AppPhase>("loading");
  const [activeTab, setActiveTab] = useState<TabId>("inicio");
  const [isRetake, setIsRetake] = useState(false);
  const [showTelemedicine, setShowTelemedicine] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [showEsfLink, setShowEsfLink] = useState(false);

  // On mount, check if user already completed the survey — skip splash/onboarding if so
  useEffect(() => {
    if (!user) {
      setPhase("splash");
      return;
    }

    supabase
      .from("profiles")
      .select("health_survey_completed, health_survey_completed_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const profile = data as any;
        if (profile?.health_survey_completed) {
          // Check 6-month expiration only if we have a timestamp
          if (profile.health_survey_completed_at) {
            const completedAt = new Date(profile.health_survey_completed_at);
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (completedAt > sixMonthsAgo) {
              setPhase("main");
              return;
            }
            // Expired — reset and require new survey
            supabase.from("profiles").update({ health_survey_completed: false }).eq("user_id", user.id).then(() => setPhase("splash"));
            return;
          }
          // Legacy: completed but no timestamp — go to main, backfill timestamp
          supabase.from("profiles").update({ health_survey_completed_at: new Date().toISOString() }).eq("user_id", user.id);
          setPhase("main");
        } else {
          setPhase("splash");
        }
      });
  }, [user]);

  const handleOnboardingDone = () => setPhase("survey");
  const handleSurveyDone = () => { setIsRetake(false); setPhase("main"); };

  const handleRetakeSurvey = async () => {
    if (user) {
      await supabase.from("profiles").update({ health_survey_completed: false }).eq("user_id", user.id);
    }
    setIsRetake(true);
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
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        )}
        {phase === "splash" && <SplashScreen onDone={() => setPhase("onboarding")} />}
        {phase === "onboarding" && <OnboardingScreen onDone={handleOnboardingDone} />}
        {phase === "survey" && <HealthSurvey onDone={handleSurveyDone} />}
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
                {activeTab === "bemestar" && <WellbeingTab />}
                {activeTab === "campanhas" && <CampanhasTab onNavigate={(tab) => setActiveTab(tab)} />}
                {activeTab === "servicos" && <ServicosTab />}
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
