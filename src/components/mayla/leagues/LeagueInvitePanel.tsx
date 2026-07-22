import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Copy, Send } from "lucide-react";
import { TopBar } from "../TopBar";
import { PROD_URL } from "@/lib/production-url";

interface League {
  id: string;
  nome: string;
  invite_code: string;
}

interface InviteRow {
  id: string;
  invitee_contato: string | null;
  status: string;
  created_at: string;
}

interface RewardRow {
  id: string;
  status: string;
  valor: number | null;
  carencia_ate: string | null;
  invite_id: string | null;
}

interface Props {
  league: League;
  onBack: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  enviado: "Enviado",
  cadastrado: "Cadastrado",
  assinou: "Assinou",
};

const REWARD_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  em_carencia: { label: "Em carência (30 dias)", variant: "secondary" },
  elegivel: { label: "Elegível", variant: "default" },
  pago: { label: "Pago ✓", variant: "default" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

export function LeagueInvitePanel({ league, onBack }: Props) {
  const { user } = useAuth();
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);

  const inviteUrl = `${PROD_URL}/liga/${league.invite_code}${affiliateCode ? `?ref=${affiliateCode}` : ""}`;

  const load = async () => {
    if (!user) return;
    const [{ data: aff }, { data: inv }, { data: rw }] = await Promise.all([
      supabase.from("affiliates").select("referral_code").eq("user_id", user.id).eq("active", true).maybeSingle(),
      supabase.from("league_invites" as any).select("id, invitee_contato, status, created_at")
        .eq("league_id", league.id).eq("inviter_id", user.id).order("created_at", { ascending: false }),
      supabase.from("referral_rewards").select("id, status, valor, carencia_ate, invite_id")
        .eq("inviter_id", user.id),
    ]);
    setAffiliateCode((aff as any)?.referral_code ?? null);
    setInvites((inv || []) as any[]);
    setRewards((rw || []) as any[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [league.id, user]);

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast({ title: "Link copiado!" });
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !consent || !contact.trim()) return;
    if (!affiliateCode) {
      toast({
        title: "Vire afiliado primeiro",
        description: "Você ainda não tem código de afiliado. Peça ao admin para ativar seu perfil de afiliado.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("league_invites" as any).insert({
      league_id: league.id,
      inviter_id: user.id,
      invitee_contato: contact.trim(),
      affiliate_code: affiliateCode,
      status: "enviado",
    });
    setSending(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Convite registrado. Compartilhe o link com o convidado." });
    setContact("");
    setConsent(false);
    load();
  };

  const rewardByInvite = new Map<string, RewardRow>();
  rewards.forEach((r) => { if (r.invite_id) rewardByInvite.set(r.invite_id, r); });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title={`Convidar · ${league.nome}`} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3 flex flex-col items-center">
            <div className="bg-white p-3 rounded-lg">
              <QRCodeCanvas value={inviteUrl} size={160} />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all">{inviteUrl}</p>
            <Button variant="outline" size="sm" onClick={copyLink} className="w-full">
              <Copy className="h-4 w-4 mr-2" /> Copiar link
            </Button>
            {!affiliateCode && (
              <p className="text-[11px] text-muted-foreground text-center">
                Ative seu perfil de afiliado para receber R$10 por adesão.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <form onSubmit={sendInvite} className="space-y-3">
              <div className="space-y-2">
                <Label>Convidar por contato (e-mail ou telefone)</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)}
                  placeholder="convidado@exemplo.com" />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <span>
                  Confirmo que tenho consentimento (LGPD) para compartilhar este contato.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={!consent || !contact.trim() || sending}>
                <Send className="h-4 w-4 mr-1" /> {sending ? "Registrando..." : "Registrar convite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-2">Convites enviados</p>
          {invites.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">Nenhum convite ainda.</p>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {invites.map((inv) => {
                  const reward = rewardByInvite.get(inv.id);
                  const rw = reward ? REWARD_LABEL[reward.status] : null;
                  return (
                    <div key={inv.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{inv.invitee_contato || "Sem contato"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {STATUS_LABEL[inv.status] || inv.status}
                        </p>
                      </div>
                      {rw && (
                        <Badge variant={rw.variant} className="text-[10px]">
                          R$10 · {rw.label}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 px-1">
            R$10 liberados após o convidado assinar e passar 30 dias de carência.
          </p>
        </div>
      </div>
    </div>
  );
}
