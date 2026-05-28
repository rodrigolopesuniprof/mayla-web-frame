import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Copy, Trash2, ExternalLink } from "lucide-react";

interface Token {
  id: string;
  token: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface Props { companyId: string }

export function AdminPublicDashboard({ companyId }: Props) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("public_dashboard_tokens" as any)
      .select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    setTokens((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const create = async () => {
    const { error } = await supabase.from("public_dashboard_tokens" as any).insert({ company_id: companyId });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Token criado" });
    load();
  };

  const toggle = async (t: Token) => {
    await supabase.from("public_dashboard_tokens" as any).update({ active: !t.active }).eq("id", t.id);
    load();
  };

  const remove = async (t: Token) => {
    if (!confirm("Revogar este token? O link parará de funcionar.")) return;
    await supabase.from("public_dashboard_tokens" as any).delete().eq("id", t.id);
    load();
  };

  const urlFor = (t: Token) => `${window.location.origin}/painel/${t.token}`;
  const copy = (t: Token) => {
    navigator.clipboard.writeText(urlFor(t));
    toast({ title: "Link copiado" });
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gere um link público para projetar/compartilhar o ranking, prêmios e progresso da empresa. Não exige login.
        </p>
        <Button onClick={create}>+ Gerar novo link</Button>
      </div>

      <div className="grid gap-2">
        {tokens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link gerado.</p>}
        {tokens.map(t => (
          <Card key={t.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <code className="text-xs text-foreground break-all">{urlFor(t)}</code>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Criado em {new Date(t.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <Switch checked={t.active} onCheckedChange={() => toggle(t)} />
              <Button size="sm" variant="outline" onClick={() => copy(t)}><Copy className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" asChild><a href={urlFor(t)} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
