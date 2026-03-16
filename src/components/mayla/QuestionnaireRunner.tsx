import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check } from "lucide-react";

interface Question {
  id: string;
  category: string;
  question_text: string;
  options: { emoji: string; label: string }[];
  sort_order: number;
}

interface QuestionnaireRunnerProps {
  questionnaireId: string;
  questionnaireTitle: string;
  userMissionId?: string | null;
  onClose: () => void;
  onComplete: () => void;
}

const DEFAULT_OPTIONS = [
  { emoji: "😢", label: "Muito ruim" },
  { emoji: "😕", label: "Ruim" },
  { emoji: "😐", label: "Regular" },
  { emoji: "🙂", label: "Bom" },
  { emoji: "😄", label: "Muito bom" },
];

export function QuestionnaireRunner({ questionnaireId, questionnaireTitle, userMissionId, onClose, onComplete }: QuestionnaireRunnerProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("questionnaire_questions")
      .select("id, category, question_text, options, sort_order")
      .eq("questionnaire_id", questionnaireId)
      .order("sort_order")
      .then(({ data }) => {
        setQuestions(
          (data || []).map((q: any) => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : DEFAULT_OPTIONS,
          }))
        );
        setLoading(false);
      });
  }, [questionnaireId]);

  const current = questions[step];
  const total = questions.length;
  const allAnswered = total > 0 && Object.keys(answers).length === total;

  const handleSelect = (value: number) => {
    if (!current) return;
    setAnswers({ ...answers, [current.id]: value });
    // auto-advance after short delay
    setTimeout(() => {
      if (step < total - 1) {
        setStep(step + 1);
      }
    }, 300);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("questionnaire_responses").insert({
      questionnaire_id: questionnaireId,
      user_id: user.id,
      user_mission_id: userMissionId || null,
      answers,
    } as any);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      // Auto-complete linked mission if exists
      if (userMissionId) {
        await supabase
          .from("user_missions")
          .update({ status: "completed", completed_at: new Date().toISOString() } as any)
          .eq("id", userMissionId);
      }
      toast({ title: "✅ Respostas salvas!", description: "Obrigado pela sua avaliação." });
      onComplete();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-sm text-muted-foreground">Este questionário ainda não possui perguntas.</p>
        <button onClick={onClose} className="mt-4 text-sm font-medium text-primary underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{questionnaireTitle}</h2>
          <p className="text-[11px] text-muted-foreground">Pergunta {step + 1} de {total}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-6">
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((step + 1) / total) * 100}%`,
              background: "hsl(var(--primary))",
            }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-5 flex flex-col">
        {current && (
          <>
            {current.category && (
              <span className="text-[10px] font-semibold uppercase tracking-[.15em] text-primary mb-2">
                {current.category}
              </span>
            )}
            <h3 className="text-lg font-semibold text-foreground mb-6 leading-snug">
              {current.question_text}
            </h3>

            <div className="flex gap-2.5 mb-8">
              {current.options.map((opt, i) => {
                const value = i + 1;
                const selected = answers[current.id] === value;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-4 px-1 rounded-2xl border-2 transition-all cursor-pointer min-w-0",
                      selected
                        ? "border-primary bg-primary/10 scale-105 shadow-md"
                        : "border-border bg-card hover:border-primary/30"
                    )}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className={cn(
                      "text-[10px] leading-tight text-center font-medium",
                      selected ? "text-primary" : "text-muted-foreground"
                    )}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="mt-auto pb-8 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 rounded-2xl py-3.5 border-2 border-border text-sm font-medium text-foreground"
            >
              Anterior
            </button>
          )}
          {step < total - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!answers[current?.id]}
              className={cn(
                "flex-1 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all",
                answers[current?.id]
                  ? "bg-primary shadow-md"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Próxima
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!allAnswered || saving}
              className={cn(
                "flex-1 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2",
                allAnswered && !saving
                  ? "bg-primary shadow-md"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Check className="w-4 h-4" />
              {saving ? "Salvando..." : "Concluir"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
