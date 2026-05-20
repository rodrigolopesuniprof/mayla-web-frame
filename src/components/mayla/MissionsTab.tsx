import { useState, useEffect, useCallback } from "react";
import { TopBar } from "./TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "./QrScanner";
import { PhotoCapture } from "./PhotoCapture";
import { toast } from "@/hooks/use-toast";

interface UserMission {
  id: string;
  status: string;
  created_at: string;
  mission_id: string;
  mission: {
    title: string;
    description: string | null;
    emoji: string;
    points: number;
    tag: string;
    priority: number;
    validation_type: string;
    frequency: string;
    success_message: string | null;
    success_link_url: string | null;
    success_link_label: string | null;
  };
}

const TAG_LABELS: Record<string, string> = {
  TAG_GESTANTE: "🤰 Gestante",
  TAG_CRONICO: "💓 Crônico",
  TAG_MULHER_PREVENCAO: "🩺 Prevenção",
  TAG_RESPONSAVEL_VACINA: "💉 Vacinação",
  TAG_VULNERAVEL: "📋 Cadastro",
  GERAL: "🎯 Geral",
};

const VALIDATION_LABELS: Record<string, { label: string; icon: string }> = {
  self_report: { label: "Registrar ✓", icon: "" },
  qr_code: { label: "Escanear QR", icon: "📱 " },
  photo_proof: { label: "Enviar foto", icon: "📷 " },
  auto_rppg: { label: "Automática", icon: "🤖 " },
  auto_survey: { label: "Automática", icon: "🤖 " },
  auto_checkin: { label: "Automática", icon: "🤖 " },
};

const AUTO_CHECKS: Record<string, (ctx: { hasMeasurementToday: boolean; profile: any; hasCheckinThisWeek: boolean }) => boolean> = {
  auto_rppg: ({ hasMeasurementToday }) => hasMeasurementToday,
  auto_survey: ({ profile }) => !!profile?.health_survey_completed,
  auto_checkin: ({ hasCheckinThisWeek }) => hasCheckinThisWeek,
};

const getWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
};

export function MissionsTab({ onBack }: { onBack?: () => void } = {}) {
  const { user } = useAuth();
  const [missions, setMissions] = useState<UserMission[]>([]);
  const [profile, setProfile] = useState<{ points: number; level: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanningMission, setScanningMission] = useState<string | null>(null);
  const [photoMission, setPhotoMission] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [missionsRes, profileRes, measurementsRes, checkinsRes] = await Promise.all([
        supabase
          .from("user_missions")
          .select("id, status, created_at, mission_id, mission:missions(title, description, emoji, points, tag, priority, validation_type, frequency)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("points, level, health_survey_completed")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("health_measurements")
          .select("id")
          .eq("user_id", user.id)
          .gte("measured_at", new Date().toISOString().split("T")[0])
          .limit(1),
        supabase
          .from("wellbeing_checkins")
          .select("id")
          .eq("user_id", user.id)
          .gte("week_start", getWeekStart())
          .limit(1),
      ]);

      const hasMeasurementToday = (measurementsRes.data?.length ?? 0) > 0;
      const hasCheckinThisWeek = (checkinsRes.data?.length ?? 0) > 0;
      const profileData = profileRes.data;

      if (missionsRes.data) {
        const allMissions = (missionsRes.data as any[])
          .filter((m) => m.mission)
          .sort((a, b) => (b.mission.priority || 0) - (a.mission.priority || 0));

        const seen = new Map<string, typeof allMissions[0]>();
        for (const m of allMissions) {
          if (!seen.has(m.mission_id)) {
            seen.set(m.mission_id, m);
          }
        }
        const sorted = Array.from(seen.values());

        const toComplete: string[] = [];
        for (const m of sorted) {
          if (m.status !== "pending") continue;
          const vType = m.mission.validation_type || "self_report";
          const autoCheck = AUTO_CHECKS[vType];
          if (autoCheck && autoCheck({ hasMeasurementToday, profile: profileData, hasCheckinThisWeek })) {
            toComplete.push(m.id);
            m.status = "completed";
          }
        }

        if (toComplete.length > 0) {
          await supabase
            .from("user_missions")
            .update({ status: "completed", completed_at: new Date().toISOString() } as any)
            .in("id", toComplete);
        }

        setMissions(sorted);
      }
      if (profileData) setProfile({ points: profileData.points, level: profileData.level });
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const completedCount = missions.filter((m) => m.status === "completed").length;
  const pendingMissions = missions.filter((m) => m.status === "pending");
  const pendingReviewMissions = missions.filter((m) => m.status === "pending_review");
  const completedMissions = missions.filter((m) => m.status === "completed");

  const completeMission = async (missionId: string) => {
    await supabase
      .from("user_missions")
      .update({ status: "completed", completed_at: new Date().toISOString() } as any)
      .eq("id", missionId);
    setMissions((prev) =>
      prev.map((m) => (m.id === missionId ? { ...m, status: "completed" } : m))
    );
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("points, level")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile({ points: data.points, level: data.level });
    }
    toast({ title: "Missão concluída! 🎉" });
  };

  const handleAction = (mission: UserMission) => {
    const vType = mission.mission.validation_type || "self_report";
    switch (vType) {
      case "qr_code":
        setScanningMission(mission.id);
        break;
      case "photo_proof":
        setPhotoMission(mission.id);
        break;
      default:
        completeMission(mission.id);
    }
  };

  const handleQrScan = useCallback(async (code: string) => {
    if (!user || !scanningMission) return;
    const { data: unit } = await supabase
      .from("health_units")
      .select("id, name")
      .eq("qr_code", code)
      .eq("active", true)
      .maybeSingle();

    setScanningMission(null);

    if (!unit) {
      toast({ title: "QR Code inválido", description: "Este código não corresponde a nenhuma unidade de saúde cadastrada.", variant: "destructive" });
      return;
    }

    await supabase.from("mission_validations").insert({
      user_mission_id: scanningMission,
      user_id: user.id,
      validation_type: "qr_code",
      health_unit_id: unit.id,
      status: "approved",
      validated_at: new Date().toISOString(),
    } as any);

    await completeMission(scanningMission);
    toast({ title: `Validado na ${unit.name}! ✅` });
  }, [user, scanningMission]);

  const handlePhotoCaptured = useCallback(async (photoUrl: string) => {
    if (!user || !photoMission) return;
    await supabase.from("mission_validations").insert({
      user_mission_id: photoMission,
      user_id: user.id,
      validation_type: "photo_proof",
      photo_url: photoUrl,
      status: "pending",
    } as any);

    await supabase
      .from("user_missions")
      .update({ status: "pending_review" } as any)
      .eq("id", photoMission);

    setMissions((prev) =>
      prev.map((m) => (m.id === photoMission ? { ...m, status: "pending_review" } : m))
    );

    setPhotoMission(null);
    toast({ title: "Comprovante enviado! 📷", description: "Aguardando validação do agente de saúde." });
  }, [user, photoMission]);

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto pb-4">
      <TopBar title="Missões" onBack={onBack} />
      <div className="px-5 pt-5 pb-4">
        <h2 className="font-display text-2xl font-medium text-foreground mb-1">Missões</h2>
        <p className="text-sm text-muted-foreground">Complete missões e ganhe pontos de saúde</p>
      </div>

      {/* Points summary */}
      <div
        className="mx-5 mb-5 rounded-[18px] p-5 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg, hsl(var(--mayla-ink)), #3D2820)" }}
      >
        <div className="text-4xl">⭐</div>
        <div>
          <div className="font-display text-2xl font-bold" style={{ color: "#fff" }}>
            {profile?.points.toLocaleString() ?? 0} pontos
          </div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,.6)" }}>
            Nível: {profile?.level ?? "Cidadão"} · {completedCount}/{missions.length} missões
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando missões...</div>
      ) : missions.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-5xl">🎯</span>
          <p className="text-base text-muted-foreground text-center px-8">Complete o questionário de saúde para liberar suas missões.</p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-3">
          {/* Pending missions */}
          {pendingMissions.map((m) => {
            const vType = m.mission.validation_type || "self_report";
            const vLabel = VALIDATION_LABELS[vType] || VALIDATION_LABELS.self_report;
            const isAuto = vType.startsWith("auto_");
            return (
              <div key={m.id} className="bg-card rounded-2xl p-5 border border-border">
                <div className="flex items-start gap-3.5">
                  <span className="text-3xl">{m.mission.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[15px] font-semibold text-foreground">{m.mission.title}</span>
                      <span className="text-sm font-semibold text-accent">+{m.mission.points} pts</span>
                    </div>
                    {m.mission.description && (
                      <div className="text-sm text-muted-foreground mb-3">{m.mission.description}</div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 tracking-[.06em] uppercase bg-accent/10 text-accent">
                        {TAG_LABELS[m.mission.tag] || m.mission.tag}
                      </span>
                      {isAuto ? (
                        <span className="text-sm font-semibold text-muted-foreground px-3 py-1.5 rounded-lg bg-secondary">
                          🤖 Aguardando ação
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAction(m)}
                          className="text-sm font-semibold text-accent-foreground px-4 py-2 rounded-xl border-none cursor-pointer"
                          style={{ background: "linear-gradient(135deg, hsl(var(--mayla-green)), hsl(var(--mayla-teal)))" }}
                        >
                          {vLabel.icon}{vLabel.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pending review missions */}
          {pendingReviewMissions.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground tracking-[.1em] uppercase mt-2">
                Aguardando validação
              </p>
              {pendingReviewMissions.map((m) => (
                <div key={m.id} className="bg-card rounded-2xl p-5 border border-primary/20">
                  <div className="flex items-start gap-3.5">
                    <span className="text-3xl">{m.mission.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[15px] font-semibold text-foreground">{m.mission.title}</span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                          ⏳ Em análise
                        </span>
                      </div>
                      {m.mission.description && (
                        <div className="text-sm text-muted-foreground">{m.mission.description}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Completed missions */}
          {completedMissions.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground tracking-[.1em] uppercase mt-2">
                Concluídas
              </p>
              {completedMissions.map((m) => (
                <div key={m.id} className="bg-card rounded-2xl p-5 border border-border opacity-60">
                  <div className="flex items-start gap-3.5">
                    <span className="text-3xl">{m.mission.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[15px] font-semibold text-foreground">✅ {m.mission.title}</span>
                        <span className="text-sm font-semibold text-muted-foreground">+{m.mission.points} pts</span>
                      </div>
                      {m.mission.description && (
                        <div className="text-sm text-muted-foreground">{m.mission.description}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {scanningMission && (
        <QrScanner
          onScan={handleQrScan}
          onClose={() => setScanningMission(null)}
        />
      )}

      {photoMission && user && (
        <PhotoCapture
          userId={user.id}
          onCapture={handlePhotoCaptured}
          onClose={() => setPhotoMission(null)}
        />
      )}
    </div>
  );
}
