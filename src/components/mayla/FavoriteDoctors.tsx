import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Connection {
  id: string;
  external_professional_id: string;
  external_professional_name: string | null;
  external_clinic_name: string | null;
  external_system: string;
  source_type: string;
  report_token: string;
  active: boolean;
}

export function FavoriteDoctors({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("prontuario_connections")
      .select("id, external_professional_id, external_professional_name, external_clinic_name, external_system, source_type, report_token, active")
      .eq("user_id", user.id)
      .eq("active", true);
    setConnections((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  const handleCopyLink = async (reportToken: string) => {
    const url = `${window.location.origin}/relatorio/medico/${reportToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "Compartilhe com seu médico. O acesso é permanente enquanto ativo." });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleRevoke = async (conn: Connection) => {
    if (revoking) return;
    setRevoking(conn.id);
    try {
      const { error } = await supabase
        .from("prontuario_connections")
        .update({ active: false } as any)
        .eq("id", conn.id);
      if (error) throw error;
      setConnections((prev) => prev.filter((c) => c.id !== conn.id));
      toast({ title: "Acesso revogado", description: `${conn.external_professional_name || "Médico"} não poderá mais acessar seus dados.` });
    } catch {
      toast({ title: "Erro ao revogar acesso", variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  const getSourceLabel = (conn: Connection) => {
    if (conn.source_type === "mayla_partner" || conn.external_system === "mayla") return "Mayla";
    if (conn.external_system === "meddit") return "Meddit";
    return conn.external_system;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-sm text-primary bg-transparent border-none cursor-pointer">
          ← Voltar
        </button>
        <h3 className="font-display text-lg font-medium text-foreground">Meus Médicos</h3>
      </div>

      <p className="text-[13px] text-muted-foreground -mt-2">
        Médicos favoritados têm acesso permanente ao seu relatório de saúde. Você pode revogar o acesso a qualquer momento.
      </p>

      {loading && (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
      )}

      {!loading && connections.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-3">
          <span className="text-4xl">👨‍⚕️</span>
          <p className="text-sm text-muted-foreground text-center">
            Nenhum médico favoritado ainda. Ao favoritar um médico no prontuário ou marketplace, ele aparecerá aqui.
          </p>
        </div>
      )}

      {connections.map((conn) => (
        <div key={conn.id} className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
              👨‍⚕️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-foreground truncate">
                  {conn.external_professional_name || "Profissional"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold shrink-0">
                  {getSourceLabel(conn)}
                </span>
              </div>
              {conn.external_clinic_name && (
                <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                  {conn.external_clinic_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleRevoke(conn)}
              disabled={revoking === conn.id}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-[12px] font-medium cursor-pointer border-none hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              {revoking === conn.id ? "..." : "🚫 Revogar acesso"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
