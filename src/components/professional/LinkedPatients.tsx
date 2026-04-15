import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ProfessionalReport = lazy(() => import("@/components/report/ProfessionalReport"));

interface LinkedPatient {
  id: string;
  user_id: string;
  report_token: string;
  external_professional_name: string | null;
  external_clinic_name: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export function LinkedPatients({ partnerId }: { partnerId: string }) {
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingToken, setViewingToken] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("prontuario_connections")
        .select("id, user_id, report_token, external_professional_name, external_clinic_name, created_at")
        .eq("internal_partner_id", partnerId)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        const userIds = [...new Set((data as any[]).map((d: any) => d.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

        setPatients((data as any[]).map((d: any) => ({
          ...d,
          profiles: { full_name: profileMap.get(d.user_id) || null },
        })));
      }
      setLoading(false);
    };
    fetch();
  }, [partnerId]);

  // Inline report view
  if (viewingToken) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setViewingToken(null)}>
          ← Voltar à lista de pacientes
        </Button>
        <Suspense fallback={
          <div className="py-10 text-center">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Carregando relatório...</p>
          </div>
        }>
          <ProfessionalReport tokenOverride={viewingToken} embedMode onBack={() => setViewingToken(null)} />
        </Suspense>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">Carregando pacientes...</div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 gap-3">
        <span className="text-4xl">👥</span>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Nenhum paciente vinculado. Quando um paciente favoritar seu perfil, ele aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pacientes que compartilharam acesso permanente ao relatório de saúde.
      </p>
      {patients.map((p) => (
        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium shrink-0">
            {(p.profiles?.full_name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {p.profiles?.full_name || "Paciente"}
            </div>
            <div className="text-xs text-muted-foreground">
              Vinculado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">Ativo</Badge>
          <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => setViewingToken(p.report_token)}>
            Ver relatório
          </Button>
        </div>
      ))}
    </div>
  );
}
