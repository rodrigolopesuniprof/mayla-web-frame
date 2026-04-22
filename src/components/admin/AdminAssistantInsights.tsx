import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export function AdminAssistantInsights() {
  const [stats, setStats] = useState({ conversations: 0, messages: 0, users: 0, up: 0, down: 0 });
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: conversations }, { count: messages }, { data: convUsers }, { data: feedback }, { data: flagsData }] = await Promise.all([
        supabase.from("assistant_conversations").select("*", { count: "exact", head: true }),
        supabase.from("assistant_messages").select("*", { count: "exact", head: true }),
        supabase.from("assistant_conversations").select("user_id"),
        supabase.from("assistant_feedback").select("rating"),
        supabase.from("assistant_safety_flags").select("id, flag_type, details, created_at, reviewed").eq("reviewed", false).order("created_at", { ascending: false }).limit(20),
      ]);
      const uniqueUsers = new Set((convUsers || []).map((c: any) => c.user_id)).size;
      const up = (feedback || []).filter((f: any) => f.rating === "up").length;
      const down = (feedback || []).filter((f: any) => f.rating === "down").length;
      setStats({ conversations: conversations || 0, messages: messages || 0, users: uniqueUsers, up, down });
      setFlags(flagsData || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-semibold text-foreground">Assistente — Insights</h2>
        <p className="text-sm text-muted-foreground">Métricas de uso e qualidade do Assistente Mayla</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Conversas</div><div className="text-2xl font-semibold">{stats.conversations}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Mensagens</div><div className="text-2xl font-semibold">{stats.messages}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Usuários ativos</div><div className="text-2xl font-semibold">{stats.users}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">👍 Positivos</div><div className="text-2xl font-semibold text-primary">{stats.up}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">👎 Negativos</div><div className="text-2xl font-semibold text-destructive">{stats.down}</div></Card>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Safety flags pendentes ({flags.length})</h3>
        <div className="space-y-2">
          {flags.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma flag pendente.</p>}
          {flags.map((f) => (
            <Card key={f.id} className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-destructive">{f.flag_type}</span>
                <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <pre className="text-xs mt-2 whitespace-pre-wrap text-muted-foreground">{JSON.stringify(f.details, null, 2)}</pre>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
