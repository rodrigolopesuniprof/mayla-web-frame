import { useState } from "react";
import { useGamification } from "@/hooks/useGamification";
import { toast } from "@/hooks/use-toast";

export function DailyChallengeCard() {
  const { challenge, completeChallenge, loading } = useGamification();
  const [submitting, setSubmitting] = useState(false);

  if (loading || !challenge) return null;

  const handleComplete = async () => {
    if (challenge.completed || submitting) return;
    setSubmitting(true);
    try {
      const res: any = await completeChallenge();
      toast({ title: "Desafio concluído!", description: `+${res?.points ?? challenge.points} pontos 🎉` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Não foi possível concluir", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-5 mb-5 rounded-[18px] p-4 border border-accent/20 bg-gradient-to-br from-accent/5 via-card to-card">
      <div className="flex items-start gap-4">
        <div className="shrink-0 flex items-center justify-center text-2xl rounded-2xl" style={{ width: 50, height: 50, background: "hsl(var(--accent) / .15)" }}>
          {challenge.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold tracking-[.1em] uppercase text-accent">Desafio do dia</span>
            <span className="text-[10px] text-muted-foreground">· +{challenge.points} pts</span>
          </div>
          <div className="text-[15px] font-semibold text-foreground leading-snug">{challenge.title}</div>
          {challenge.description && <div className="text-sm text-muted-foreground leading-snug mt-1">{challenge.description}</div>}
        </div>
      </div>
      <button
        onClick={handleComplete}
        disabled={challenge.completed || submitting}
        className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold border-none cursor-pointer disabled:opacity-60 disabled:cursor-default"
        style={{
          background: challenge.completed ? "hsl(var(--secondary))" : "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
          color: challenge.completed ? "hsl(var(--muted-foreground))" : "hsl(var(--accent-foreground))",
        }}
      >
        {challenge.completed ? "✓ Concluído hoje" : submitting ? "Enviando..." : "Concluir desafio"}
      </button>
    </div>
  );
}
