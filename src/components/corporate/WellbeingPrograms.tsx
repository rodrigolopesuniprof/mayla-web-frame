import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/program-categories";
import { QrScanner } from "@/components/mayla/QrScanner";
import { PhotoCapture } from "@/components/mayla/PhotoCapture";
import { toast } from "sonner";

interface Program {
  id: string;
  title: string;
  description: string | null;
  category: string;
  emoji: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface Campaign {
  id: string;
  title: string;
  emoji: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  bonus_points: number;
}

interface Mission {
  id: string;
  title: string;
  emoji: string | null;
  points: number | null;
  tag: string;
  validation_type: string | null;
}

interface Props {
  companyId: string;
  primaryColor?: string;
  onNavigate?: (tab: string) => void;
}

export function WellbeingPrograms({ companyId, primaryColor, onNavigate }: Props) {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [programCampaigns, setProgramCampaigns] = useState<Record<string, Campaign[]>>({});
  const [campaignMissions, setCampaignMissions] = useState<Record<string, Mission[]>>({});
  const [loadingCampaigns, setLoadingCampaigns] = useState<string | null>(null);
  const [loadingMissions, setLoadingMissions] = useState<string | null>(null);

  // User mission status
  const [userMissionStatus, setUserMissionStatus] = useState<Record<string, { userMissionId: string; status: string }>>({});
  const [scanningMissionId, setScanningMissionId] = useState<string | null>(null);
  const [scanningUserMissionId, setScanningUserMissionId] = useState<string | null>(null);
  const [photoMissionId, setPhotoMissionId] = useState<string | null>(null);
  const [photoUserMissionId, setPhotoUserMissionId] = useState<string | null>(null);

  // Reset cache when companyId changes
  useEffect(() => {
    setProgramCampaigns({});
    setCampaignMissions({});
    setExpandedProgram(null);
    setExpandedCampaign(null);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let query = supabase
      .from("wellbeing_programs")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    
    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    
    query.then(({ data }) => {
      setPrograms((data as Program[]) || []);
      setLoading(false);
    });
  }, [companyId]);

  // Fetch user mission statuses
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_missions")
      .select("id, mission_id, status")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { userMissionId: string; status: string }> = {};
        for (const um of data) {
          // Keep the latest (or completed) status per mission
          if (!map[um.mission_id] || um.status === "completed") {
            map[um.mission_id] = { userMissionId: um.id, status: um.status || "pending" };
          }
        }
        setUserMissionStatus(map);
      });
  }, [user]);

  const toggleProgram = async (program: Program) => {
    if (expandedProgram === program.id) {
      setExpandedProgram(null);
      return;
    }
    setExpandedProgram(program.id);
    setExpandedCampaign(null);

    if (programCampaigns[program.id]) return;

    setLoadingCampaigns(program.id);
    const { data } = await supabase
      .from("campaigns")
      .select("id, title, emoji, description, starts_at, ends_at, bonus_points")
      .eq("program_id", program.id)
      .eq("active", true)
      .order("starts_at", { ascending: false });

    setProgramCampaigns(prev => ({ ...prev, [program.id]: (data as Campaign[]) || [] }));
    setLoadingCampaigns(null);
  };

  const toggleCampaign = async (campaign: Campaign) => {
    if (expandedCampaign === campaign.id) {
      setExpandedCampaign(null);
      return;
    }
    setExpandedCampaign(campaign.id);

    if (campaignMissions[campaign.id]) return;

    setLoadingMissions(campaign.id);
    const { data: cmData } = await supabase
      .from("campaign_missions")
      .select("mission_id, sort_order")
      .eq("campaign_id", campaign.id)
      .order("sort_order");

    if (cmData && cmData.length > 0) {
      const missionIds = cmData.map((cm: any) => cm.mission_id);
      const { data: missionData } = await supabase
        .from("missions")
        .select("id, title, emoji, points, tag, validation_type")
        .in("id", missionIds)
        .eq("active", true);

      const sorted = missionIds
        .map(id => (missionData as Mission[] || []).find(m => m.id === id))
        .filter(Boolean) as Mission[];

      setCampaignMissions(prev => ({ ...prev, [campaign.id]: sorted }));
    } else {
      setCampaignMissions(prev => ({ ...prev, [campaign.id]: [] }));
    }
    setLoadingMissions(null);
  };

  const handleMissionAction = async (mission: Mission) => {
    if (!user) return;
    const existing = userMissionStatus[mission.id];
    const vType = mission.validation_type || "self_report";

    // If no user_mission exists, create one
    let userMissionId = existing?.userMissionId;
    if (!userMissionId) {
      const { data, error } = await supabase
        .from("user_missions")
        .insert({ user_id: user.id, mission_id: mission.id, status: "pending" })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Erro ao registrar missão.");
        return;
      }
      userMissionId = data.id;
      setUserMissionStatus(prev => ({ ...prev, [mission.id]: { userMissionId: data.id, status: "pending" } }));
    }

    switch (vType) {
      case "qr_code":
        setScanningMissionId(mission.id);
        setScanningUserMissionId(userMissionId);
        break;
      case "photo_proof":
        setPhotoMissionId(mission.id);
        setPhotoUserMissionId(userMissionId);
        break;
      default:
        await completeMission(mission.id, userMissionId);
    }
  };

  const completeMission = async (missionId: string, userMissionId: string) => {
    await supabase
      .from("user_missions")
      .update({ status: "completed", completed_at: new Date().toISOString() } as any)
      .eq("id", userMissionId);
    setUserMissionStatus(prev => ({ ...prev, [missionId]: { userMissionId, status: "completed" } }));
    toast.success("Missão concluída! 🎉");
  };

  const handleQrScan = useCallback(async (code: string) => {
    if (!user || !scanningUserMissionId || !scanningMissionId) return;
    const { data: unit } = await supabase
      .from("health_units")
      .select("id, name")
      .eq("qr_code", code)
      .eq("active", true)
      .maybeSingle();

    setScanningMissionId(null);

    if (!unit) {
      toast.error("QR Code inválido");
      return;
    }

    await supabase.from("mission_validations").insert({
      user_mission_id: scanningUserMissionId,
      user_id: user.id,
      validation_type: "qr_code",
      health_unit_id: unit.id,
      status: "approved",
      validated_at: new Date().toISOString(),
    } as any);

    await completeMission(scanningMissionId, scanningUserMissionId);
    setScanningUserMissionId(null);
  }, [user, scanningMissionId, scanningUserMissionId]);

  const handlePhotoCaptured = useCallback(async (photoUrl: string) => {
    if (!user || !photoUserMissionId || !photoMissionId) return;
    await supabase.from("mission_validations").insert({
      user_mission_id: photoUserMissionId,
      user_id: user.id,
      validation_type: "photo_proof",
      photo_url: photoUrl,
      status: "pending",
    } as any);

    await supabase
      .from("user_missions")
      .update({ status: "pending_review" } as any)
      .eq("id", photoUserMissionId);

    setUserMissionStatus(prev => ({ ...prev, [photoMissionId]: { userMissionId: photoUserMissionId, status: "pending_review" } }));
    setPhotoMissionId(null);
    setPhotoUserMissionId(null);
    toast.success("Comprovante enviado! 📷 Aguardando validação.");
  }, [user, photoMissionId, photoUserMissionId]);

  const getActionLabel = (vType: string) => {
    switch (vType) {
      case "qr_code": return "📱 Escanear QR";
      case "photo_proof": return "📷 Enviar foto";
      default: return "Completar ✓";
    }
  };

  const getAutoLabel = (vType: string) => {
    switch (vType) {
      case "auto_rppg": return "💓 Medir sinais";
      case "auto_checkin": return "📋 Fazer check-in";
      case "auto_survey": return "📝 Questionário";
      default: return "🤖 Ir";
    }
  };

  const handleAutoNavigate = (vType: string) => {
    if (!onNavigate) return;
    switch (vType) {
      case "auto_rppg":
      case "auto_checkin":
        onNavigate("bemestar");
        break;
      case "auto_survey":
        onNavigate("perfil");
        break;
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-6">Carregando programas...</p>;

  if (programs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <span className="text-3xl block mb-2">🌿</span>
          <p className="text-muted-foreground text-sm">Nenhum programa ativo no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-foreground">Programas de Bem-estar</h3>
      {programs.map(p => {
        const isExpanded = expandedProgram === p.id;
        const campaigns = programCampaigns[p.id];
        const isLoadingCampaigns = loadingCampaigns === p.id;

        return (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-0">
              <button
                className="w-full p-4 flex items-start gap-3 text-left"
                onClick={() => toggleProgram(p)}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground">{p.title}</h4>
                  {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORY_LABELS[p.category] || p.category}
                    </Badge>
                    {p.ends_at && (
                      <Badge variant="outline" className="text-[10px]">
                        Até {new Date(p.ends_at).toLocaleDateString("pt-BR")}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 mt-1 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t pt-3 space-y-2">
                  {isLoadingCampaigns ? (
                    <p className="text-xs text-muted-foreground">Carregando campanhas...</p>
                  ) : !campaigns || campaigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma campanha vinculada a este programa.</p>
                  ) : (
                    campaigns.map(c => {
                      const isCampaignExpanded = expandedCampaign === c.id;
                      const missions = campaignMissions[c.id];
                      const isLoadingMissions = loadingMissions === c.id;

                      return (
                        <div key={c.id} className="border rounded-lg overflow-hidden">
                          <button
                            className="w-full p-3 flex items-center gap-2 text-left bg-secondary/20 hover:bg-secondary/40 transition"
                            onClick={() => toggleCampaign(c)}
                          >
                            <span className="text-lg">{c.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{c.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(c.starts_at).toLocaleDateString("pt-BR")} — {new Date(c.ends_at).toLocaleDateString("pt-BR")}
                                {c.bonus_points > 0 && ` · +${c.bonus_points} pts bônus`}
                              </p>
                            </div>
                            <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isCampaignExpanded ? "rotate-90" : ""}`} />
                          </button>

                          {isCampaignExpanded && (
                            <div className="p-3 space-y-1.5 bg-background">
                              {isLoadingMissions ? (
                                <p className="text-xs text-muted-foreground">Carregando missões...</p>
                              ) : !missions || missions.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhuma missão nesta campanha.</p>
                              ) : (
                                missions.map(m => {
                                  const status = userMissionStatus[m.id];
                                  const isCompleted = status?.status === "completed";
                                  const isPendingReview = status?.status === "pending_review";
                                  const vType = m.validation_type || "self_report";
                                  const isAuto = vType.startsWith("auto_");

                                  return (
                                    <div key={m.id} className={`flex items-center gap-2 rounded-md p-2 ${isCompleted ? "bg-green-500/10" : "bg-secondary/30"}`}>
                                      <span className="text-sm">{m.emoji || "🎯"}</span>
                                      <span className={`flex-1 text-sm ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>{m.title}</span>
                                      {m.points ? (
                                        <Badge variant="outline" className="text-[10px] shrink-0">{m.points} pts</Badge>
                                      ) : null}
                                      {isCompleted ? (
                                        <span className="text-xs text-green-600 font-semibold shrink-0">✅</span>
                                      ) : isPendingReview ? (
                                        <span className="text-[10px] text-primary font-semibold shrink-0">⏳ Análise</span>
                                      ) : isAuto ? (
                                        <button
                                          onClick={() => handleAutoNavigate(vType)}
                                          className="text-[10px] font-semibold px-2 py-1 rounded-md shrink-0 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition"
                                        >
                                          {getAutoLabel(vType)}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleMissionAction(m)}
                                          className="text-[10px] font-semibold px-2 py-1 rounded-md text-accent-foreground shrink-0"
                                          style={{ background: "hsl(var(--accent))" }}
                                        >
                                          {getActionLabel(vType)}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {scanningMissionId && (
        <QrScanner onScan={handleQrScan} onClose={() => { setScanningMissionId(null); setScanningUserMissionId(null); }} />
      )}

      {photoMissionId && user && (
        <PhotoCapture userId={user.id} onCapture={handlePhotoCaptured} onClose={() => { setPhotoMissionId(null); setPhotoUserMissionId(null); }} />
      )}
    </div>
  );
}
