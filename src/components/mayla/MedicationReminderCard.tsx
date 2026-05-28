import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { usePointRule } from "@/hooks/usePointRule";

interface Med {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string;
  reminder_time: string | null;
}

/**
 * Card exibido na Home quando o usuário tem medicamento ativo
 * e ainda não fez check-in hoje.
 */
export function MedicationReminderCard() {
  const { user } = useAuth();
  const { rule } = usePointRule("medication_adherence");
  const [med, setMed] = useState<Med | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: meds } = await supabase
      .from("user_medications" as any)
      .select("id,name,dosage,frequency,reminder_time")
      .eq("user_id", user.id)
      .eq("active", true);
    if (!meds || (meds as any).length === 0) { setMed(null); return; }

    // first med without log today
    for (const m of meds as any[]) {
      const { count } = await supabase
        .from("medication_logs" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("medication_id", m.id)
        .gte("taken_at", `${today}T00:00:00`);
      if (!count) { setMed(m as Med); return; }
    }
    setMed(null);
  };

  useEffect(() => { load(); }, [user]);

  const checkIn = async () => {
    if (!med || !user) return;
    setSubmitting(true);
    const points = rule?.points ?? 100;
    const { error } = await supabase.from("medication_logs" as any).insert({
      user_id: user.id,
      medication_id: med.id,
      points_awarded: points,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `+${points} pts creditados! 💊` });
    setMed(null);
  };

  if (!med) return null;
  const points = rule?.points ?? 100;

  return (
    <div className="mx-5 mb-5 rounded-[18px] p-4 flex items-center gap-3 border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="shrink-0 flex items-center justify-center text-2xl rounded-2xl bg-emerald-100" style={{ width: 50, height: 50 }}>
        💊
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-foreground">Tomou seu {med.name}?</div>
        <div className="text-[11px] text-muted-foreground">
          {med.dosage && `${med.dosage} · `}Ganhe +{points} pts ao confirmar
        </div>
      </div>
      <button
        disabled={submitting}
        onClick={checkIn}
        className="shrink-0 border-none rounded-xl px-3 py-2 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 bg-emerald-600"
      >
        {submitting ? "..." : `✓ Tomei`}
      </button>
    </div>
  );
}
