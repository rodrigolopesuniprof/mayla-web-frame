import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const INVITE_BASE = "https://saude.saudecomvc.com.br/cadastro";

interface InviteToken {
  id: string;
  token: string;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
}

interface Props {
  companyId: string;
  companySlug: string;
  onTokenChanged?: () => void;
}

export function InviteLinkPanel({ companyId, companySlug, onTokenChanged }: Props) {
  const [token, setToken] = useState<InviteToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");
  const qrRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company_invite_tokens")
      .select("id, token, active, expires_at, max_uses, uses_count")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const t = data as InviteToken;
      setToken(t);
      setExpiresAt(t.expires_at ? t.expires_at.slice(0, 10) : "");
      setMaxUses(t.max_uses != null ? String(t.max_uses) : "");
    } else {
      setToken(null);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const ensureToken = async (): Promise<InviteToken | null> => {
    if (token) return token;
    const { data, error } = await supabase
      .from("company_invite_tokens")
      .insert({ company_id: companyId, active: true })
      .select("id, token, active, expires_at, max_uses, uses_count")
      .single();
    if (error || !data) {
      toast({ title: "Erro ao gerar token", description: error?.message, variant: "destructive" });
      return null;
    }
    return data as InviteToken;
  };

  const link = token ? `${INVITE_BASE}/${token.token}` : "";

  const copyLink = async () => {
    const t = await ensureToken();
    if (!t) return;
    const url = `${INVITE_BASE}/${t.token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
    if (!token) { setToken(t); onTokenChanged?.(); }
  };

  const saveLimits = async () => {
    if (!token) return;
    setSaving(true);
    const exp = expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null;
    const mu = maxUses.trim() === "" ? null : Math.max(1, parseInt(maxUses, 10) || 0);
    const { error } = await supabase
      .from("company_invite_tokens")
      .update({ expires_at: exp, max_uses: mu })
      .eq("id", token.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Configuração salva!" });
    load();
  };

  const regenerate = async () => {
    if (!confirm("Gerar um novo link? O link atual será desativado e não aceitará mais cadastros.")) return;
    if (token) {
      await supabase.from("company_invite_tokens").update({ active: false }).eq("id", token.id);
    }
    const { error } = await supabase.from("company_invite_tokens").insert({ company_id: companyId, active: true });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Novo link gerado!" });
    load();
    onTokenChanged?.();
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `convite-${companySlug}.png`;
    a.click();
  };

  const status = (() => {
    if (!token) return null;
    if (!token.active) return { label: "Desativado", color: "text-muted-foreground" };
    if (token.expires_at && new Date(token.expires_at) < new Date()) return { label: "Expirado", color: "text-destructive" };
    if (token.max_uses != null && token.uses_count >= token.max_uses) return { label: "Limite atingido", color: "text-destructive" };
    return { label: "Ativo", color: "text-emerald-600" };
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">🔗 Link de Cadastro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={copyLink}>📋 Copiar link</Button>
              <Button variant="outline" size="sm" disabled={!token} onClick={() => setShowQr(true)}>📱 QR Code</Button>
              <Button variant="ghost" size="sm" onClick={regenerate}>🔄 Gerar novo link</Button>
              {status && <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>}
            </div>

            {token && (
              <p className="text-xs text-muted-foreground font-mono bg-secondary rounded-lg px-3 py-2 break-all">
                {link}
              </p>
            )}

            {token && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Validade (opcional)</Label>
                  <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Limite de cadastros (opcional)</Label>
                  <Input type="number" min={1} placeholder="Ilimitado" value={maxUses} onChange={e => setMaxUses(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cadastros realizados</Label>
                  <p className="text-sm font-medium pt-2">
                    {token.uses_count}{token.max_uses != null ? ` / ${token.max_uses}` : " (sem limite)"}
                  </p>
                </div>
                <div className="md:col-span-3">
                  <Button size="sm" onClick={saveLimits} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar configuração"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={showQr} onOpenChange={setShowQr}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>QR Code do convite</DialogTitle>
            </DialogHeader>
            <div ref={qrRef} className="flex flex-col items-center gap-4 py-2">
              {token && (
                <QRCodeCanvas value={link} size={256} includeMargin level="M" />
              )}
              <p className="text-xs text-muted-foreground text-center break-all">{link}</p>
              <Button onClick={downloadQr} className="w-full">Baixar PNG</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
