import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_TAG_MAP } from "@/lib/program-categories";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [missions, setMissions] = useState<Record<string, Mission[]>>({});
  const [loadingMissions, setLoadingMissions] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("wellbeing_programs")
      .select("*")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPrograms((data as Program[]) || []);
        setLoading(false);
      });
  }, [companyId]);

  const toggleExpand = async (program: Program) => {
    if (expandedId === program.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(program.id);

    if (missions[program.id]) return;

    setLoadingMissions(program.id);

    // Try linked missions first
    const { data: pmData } = await supabase
      .from("program_missions")
      .select("mission_id, sort_order")
      .eq("program_id", program.id)
      .order("sort_order");

    if (pmData && pmData.length > 0) {
      const missionIds = pmData.map((pm: any) => pm.mission_id);
      const { data: missionData } = await supabase
        .from("missions")
        .select("id, title, emoji, points, tag")
        .in("id", missionIds)
        .eq("active", true);

      // Sort by original sort_order
      const sorted = missionIds
        .map(id => (missionData as Mission[] || []).find(m => m.id === id))
        .filter(Boolean) as Mission[];

      setMissions(prev => ({ ...prev, [program.id]: sorted }));
    } else {
      // Fallback: filter by category tags
      const tags = CATEGORY_TAG_MAP[program.category] || [];
      if (tags.length > 0) {
        const { data: missionData } = await supabase
          .from("missions")
          .select("id, title, emoji, points, tag")
          .eq("active", true);

        const filtered = (missionData as Mission[] || []).filter(m =>
          tags.some(t => m.tag.toLowerCase().includes(t))
        );
        setMissions(prev => ({ ...prev, [program.id]: filtered }));
      } else {
        setMissions(prev => ({ ...prev, [program.id]: [] }));
      }
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
        const isExpanded = expandedId === p.id;
        const programMissions = missions[p.id];
        const isLoading = loadingMissions === p.id;

        return (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-0">
              <button
                className="w-full p-4 flex items-start gap-3 text-left"
                onClick={() => toggleExpand(p)}
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
                  {isLoading ? (
                    <p className="text-xs text-muted-foreground">Carregando missões...</p>
                  ) : !programMissions || programMissions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma missão vinculada a este programa.</p>
                  ) : (
                    programMissions.map(m => (
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
