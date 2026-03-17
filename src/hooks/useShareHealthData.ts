import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export function useShareHealthData() {
  const { user } = useAuth();
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareWithProfessional = async (consultationId: string) => {
    if (!user || sharing || shared) return;
    setSharing(true);
    try {
      // Fetch professional_id from consultation
      const { data: consultation } = await supabase
        .from("consultations")
        .select("professional_id")
        .eq("id", consultationId)
        .single();

      if (!consultation?.professional_id) throw new Error("Profissional não encontrado");

      const token = crypto.randomUUID();
      const expires = new Date();
      expires.setHours(expires.getHours() + 48);

      const { error } = await supabase.from("report_shares").insert({
        user_id: user.id,
        professional_id: consultation.professional_id,
        token,
        expires_at: expires.toISOString(),
      } as any);

      if (error) throw error;

      setShared(true);
      toast({
        title: "Dados compartilhados!",
        description: "O profissional poderá visualizar seu relatório de saúde.",
      });
    } catch {
      toast({ title: "Erro ao compartilhar dados", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  return { shared, sharing, shareWithProfessional };
}
