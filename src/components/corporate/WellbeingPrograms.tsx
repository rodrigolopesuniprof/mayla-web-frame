import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface Props {
  companyId: string;
  primaryColor?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  burnout_prevention: "Prevenção de Burnout",
  sleep_improvement: "Melhoria do Sono",
  stress_reduction: "Redução de Estresse",
  physical_activity: "Atividade Física",
  general: "Geral",
};

export function WellbeingPrograms({ companyId, primaryColor }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

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
      {programs.map(p => (
        <Card key={p.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
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
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
