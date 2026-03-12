import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/program-categories";

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
}

interface Props {
  companyId: string;
  primaryColor?: string;
}

export function WellbeingPrograms({ companyId, primaryColor }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [programCampaigns, setProgramCampaigns] = useState<Record<string, Campaign[]>>({});
  const [campaignMissions, setCampaignMissions] = useState<Record<string, Mission[]>>({});
  const [loadingCampaigns, setLoadingCampaigns] = useState<string | null>(null);
  const [loadingMissions, setLoadingMissions] = useState<string | null>(null);

  useEffect(() => {
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
        .select("id, title, emoji, points, tag")
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
                                missions.map(m => (
                                  <div key={m.id} className="flex items-center gap-2 bg-secondary/30 rounded-md p-2">
                                    <span className="text-sm">{m.emoji || "🎯"}</span>
                                    <span className="flex-1 text-sm text-foreground">{m.title}</span>
                                    {m.points ? (
                                      <Badge variant="outline" className="text-[10px]">{m.points} pts</Badge>
                                    ) : null}
                                  </div>
                                ))
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
    </div>
  );
}
