import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Info } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  how_to_participate: string | null;
  completion_criteria: string | null;
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
  const [selected, setSelected] = useState<Campaign | null>(null);

  useEffect(() => {
    setCampaigns([]);
    setJoined(new Set());
    setLoading(true);
    loadData();
  }, [companyId, user]);

  const loadData = async () => {
    let campaignQuery = supabase
      .from("campaigns")
      .select("*")
      .eq("active", true)
      .gte("ends_at", new Date().toISOString().split("T")[0])
      .order("starts_at");

    if (companyId) {
      campaignQuery = campaignQuery.eq("company_id", companyId);
    }

    const [campaignsRes, participationsRes] = await Promise.all([
      campaignQuery,
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
      toast.error("Erro ao participar do desafio.");
      return;
    }
    toast.success("Você entrou no desafio! 🎉");
    setJoined(prev => new Set([...prev, campaignId]));
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-6">Carregando desafios...</p>;

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <span className="text-3xl block mb-2">🏆</span>
          <p className="text-muted-foreground text-sm">Nenhum desafio ativo no momento.</p>
        </CardContent>
      </Card>
    );
  }

  const isSelectedJoined = selected ? joined.has(selected.id) : false;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-foreground">Desafios</h3>
      {campaigns.map(c => {
        const isJoined = joined.has(c.id);
        return (
          <Card
            key={c.id}
            className="cursor-pointer transition hover:bg-secondary/30 active:scale-[0.99]"
            onClick={() => setSelected(c)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(c); }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h4 className="font-semibold text-foreground flex-1">{c.title}</h4>
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-label="Toque para detalhes" />
                  </div>
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
                    onClick={e => { e.stopPropagation(); handleJoin(c.id); }}
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

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-left">
                  <span className="text-2xl">{selected.emoji}</span>
                  <span className="flex-1">{selected.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {selected.bonus_points > 0 && (
                    <Badge variant="secondary" className="text-[11px]">+{selected.bonus_points} pts</Badge>
                  )}
                  {selected.badge_name && (
                    <Badge variant="outline" className="text-[11px]">{selected.badge_emoji} {selected.badge_name}</Badge>
                  )}
                  <Badge variant="outline" className="text-[11px]">
                    {new Date(selected.starts_at).toLocaleDateString("pt-BR")} — {new Date(selected.ends_at).toLocaleDateString("pt-BR")}
                  </Badge>
                </div>

                {selected.description && (
                  <section className="space-y-1">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sobre</h5>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{selected.description}</p>
                  </section>
                )}

                <section className="space-y-1">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Como participar</h5>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {selected.how_to_participate?.trim()
                      ? selected.how_to_participate
                      : "Toque em \"Participar\" para entrar no desafio. Depois, acompanhe as missões e ações sugeridas ao longo do período para registrar seu progresso."}
                  </p>
                </section>

                <section className="space-y-1">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Como cumprir</h5>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {selected.completion_criteria?.trim()
                      ? selected.completion_criteria
                      : "Realize as ações descritas no desafio dentro do período indicado. Ao concluir, os pontos bônus e o badge (se houver) são creditados automaticamente."}
                  </p>
                </section>

                <div className="pt-2">
                  {isSelectedJoined ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">✅ Você já está participando</Badge>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => { handleJoin(selected.id); setSelected(null); }}
                      style={primaryColor ? { backgroundColor: `hsl(${primaryColor})` } : undefined}
                    >
                      Participar do desafio
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
