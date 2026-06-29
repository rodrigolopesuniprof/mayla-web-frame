import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const LABELS: Record<string, { emoji: string; label: string; options: string[] }> = {
  mood: { emoji: "😊", label: "Como você está se sentindo?", options: ["Muito mal", "Mal", "Neutro", "Bem", "Muito bem"] },
  stress_level: { emoji: "🧠", label: "Nível de estresse", options: ["Muito baixo", "Baixo", "Moderado", "Alto", "Muito alto"] },
  sleep_quality: { emoji: "😴", label: "Qualidade do sono", options: ["Péssima", "Ruim", "Regular", "Boa", "Ótima"] },
  workload: { emoji: "💼", label: "Carga de trabalho", options: ["Muito leve", "Leve", "Adequada", "Pesada", "Muito pesada"] },
};

const FIELDS = ["mood", "stress_level", "sleep_quality", "workload"] as const;

interface Props {
  companyId: string;
  primaryColor?: string;
  onComplete?: () => void;
}

export function WellbeingCheckin({ companyId, primaryColor, onComplete }: Props) {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    const weekStart = getWeekStart();
    supabase
      .from("wellbeing_checkins")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAlreadyDone(true);
      });
  }, [user]);

  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (FIELDS.some(f => !values[f])) {
      toast.error("Por favor, responda todas as perguntas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("wellbeing_checkins").insert({
      user_id: user.id,
      company_id: companyId,
      mood: values.mood,
      stress_level: values.stress_level,
      sleep_quality: values.sleep_quality,
      workload: values.workload,
      notes: notes || null,
      week_start: getWeekStart(),
    });
    setLoading(false);
    if (error) {
      if (error.code === "23505") {
        toast.info("Você já fez o check-in desta semana!");
        setAlreadyDone(true);
      } else {
        toast.error("Erro ao salvar check-in.");
      }
      return;
    }
    toast.success("Check-in semanal registrado! 🎉");
    setAlreadyDone(true);

    // Credita pontos do check-in semanal (regra: weekly_checkin, cap_per_week=1)
    try {
      const { data: award } = await supabase.rpc("award_event" as any, {
        _user_id: user.id,
        _event_key: "weekly_checkin",
        _description: "Check-in semanal de bem-estar",
      });
      const ok = (award as any)?.ok;
      const pts = (award as any)?.points ?? 0;
      if (ok && pts > 0) {
        window.dispatchEvent(new CustomEvent("points-awarded", { detail: { points: pts, source: "weekly_checkin" } }));
      }
    } catch (e) {
      console.warn("weekly_checkin award failed:", e);
    }

    onComplete?.();
  };

  if (alreadyDone) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <span className="text-4xl block mb-3">✅</span>
          <p className="text-foreground font-semibold">Check-in semanal concluído!</p>
          <p className="text-sm text-muted-foreground mt-1">Volte na próxima semana.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-lg font-bold text-foreground">Check-in Semanal de Bem-estar</h3>
        <p className="text-sm text-muted-foreground">Como foi sua semana? Responda de forma rápida e anônima.</p>
      </div>

      {FIELDS.map(field => {
        const cfg = LABELS[field];
        return (
          <Card key={field}>
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                {cfg.emoji} {cfg.label}
              </p>
              <div className="flex gap-2">
                {cfg.options.map((opt, i) => {
                  const val = i + 1;
                  const selected = values[field] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setValues(prev => ({ ...prev, [field]: val }))}
                      className={`flex-1 py-2 px-1 text-xs rounded-lg border transition-all ${
                        selected
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                      style={selected && primaryColor ? { borderColor: `hsl(${primaryColor})`, color: `hsl(${primaryColor})`, backgroundColor: `hsl(${primaryColor} / 0.1)` } : undefined}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-2">💬 Observações (opcional)</p>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Algo que queira compartilhar..."
            className="resize-none"
            rows={2}
          />
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full"
        style={primaryColor ? { backgroundColor: `hsl(${primaryColor})` } : undefined}
      >
        {loading ? "Enviando..." : "Enviar Check-in · +50 pts"}
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">
        Ganhe +50 pontos ao concluir o check-in da semana.
      </p>
    </div>
  );
}
