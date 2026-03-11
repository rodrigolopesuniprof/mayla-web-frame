import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  category: string;
  bonus_points: number;
  badge_name: string | null;
  badge_emoji: string | null;
  starts_at: string;
  ends_at: string;
}

interface Props {
  companyId: string;
  primaryColor?: string;
}

export function CampaignsList({ companyId, primaryColor }: Props) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [companyId, user]);

  const loadData = async () => {
    const [campaignsRes, participationsRes] = await Promise.all([
      supabase
        .from("campaigns")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .gte("ends_at", new Date().toISOString().split("T")[0])
        .order("starts_at"),
      user
        ? supabase
            .from("campaign_participants")
            .select("campaign_id")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

    setCampaigns((campaignsRes.data as Campaign[]) || []);
    setJoined(new Set((participationsRes.data || []).map((p: any) => p.campaign_id)));
    setLoading(false);
  };

  const handleJoin = async (campaignId: string) => {
    if (!user) return;
    const { error } = await supabase.from("campaign_participants").insert({
      campaign_id: campaignId,
      user_id: user.id,
    });
    if (error) {
      toast.error("Erro ao participar da campanha.");
      return;
    }
    toast.success("Você entrou na campanha! 🎉");
    setJoined(prev => new Set([...prev, campaignId]));
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-6">Carregando campanhas...</p>;

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <span className="text-3xl block mb-2">🏆</span>
          <p className="text-muted-foreground text-sm">Nenhuma campanha ativa no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-foreground">Campanhas</h3>
      {campaigns.map(c => {
        const isJoined = joined.has(c.id);
        return (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground">{c.title}</h4>
                  {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {c.bonus_points > 0 && (
                      <Badge variant="secondary" className="text-[10px]">+{c.bonus_points} pts</Badge>
                    )}
                    {c.badge_name && (
                      <Badge variant="outline" className="text-[10px]">{c.badge_emoji} {c.badge_name}</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(c.starts_at).toLocaleDateString("pt-BR")} — {new Date(c.ends_at).toLocaleDateString("pt-BR")}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                {isJoined ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">✅ Participando</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleJoin(c.id)}
                    style={primaryColor ? { backgroundColor: `hsl(${primaryColor})` } : undefined}
                  >
                    Participar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
