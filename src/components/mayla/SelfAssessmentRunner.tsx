import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Question {
  id: string;
  sort_order: number;
  question: string;
  qtype: "single" | "multi" | "scale" | "text";
  options: any;
}

interface Props {
  onBack: () => void;
  onComplete?: () => void;
}

export function SelfAssessmentRunner({ onBack, onComplete }: Props) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const cid = (profile as any)?.company_id ?? null;
      setCompanyId(cid);

      // load company questions OR global fallback
      let qs: any[] = [];
      if (cid) {
        const { data } = await supabase
          .from("self_assessment_questions" as any)
          .select("*")
          .eq("company_id", cid)
          .eq("active", true)
          .order("sort_order");
        qs = data || [];
      }
      if (qs.length === 0) {
        const { data } = await supabase
          .from("self_assessment_questions" as any)
          .select("*")
          .is("company_id", null)
          .eq("active", true)
          .order("sort_order");
        qs = data || [];
      }
      setQuestions(qs as any);

      // existing response?
      const { data: prev } = await supabase
        .from("self_assessment_responses" as any)
        .select("answers")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev) {
        setAlreadyDone(true);
        setAnswers(((prev as any).answers as any) || {});
      }
      setLoading(false);
    })();
  }, [user]);

  const setAnswer = (qid: string, value: any) => setAnswers(p => ({ ...p, [qid]: value }));

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("self_assessment_responses" as any).insert({
      user_id: user.id,
      company_id: companyId,
      answers,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: alreadyDone ? "Autoavaliação atualizada!" : "+200 pts creditados! 🎉" });
    onComplete?.();
    onBack();
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (questions.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Nenhuma pergunta configurada para sua empresa.
      </div>
    );
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const canAdvance = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== "";

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
        <button onClick={onBack} className="text-sm text-primary bg-transparent border-none cursor-pointer">← Voltar</button>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">{idx + 1} / {questions.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {!alreadyDone && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-[12px] text-amber-900">🏆 Complete e ganhe <strong>+200 pts</strong></p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pergunta {idx + 1}</p>
          <h2 className="font-display text-xl text-foreground leading-tight">{q.question}</h2>
        </div>

        <QuestionField q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
      </div>

      <div className="px-5 pb-6 pt-3 border-t border-border flex gap-2">
        {idx > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setIdx(i => i - 1)}>Anterior</Button>
        )}
        {!isLast ? (
          <Button className="flex-1" disabled={!canAdvance} onClick={() => setIdx(i => i + 1)}>
            Próxima
          </Button>
        ) : (
          <Button className="flex-1" disabled={!canAdvance || saving} onClick={submit}>
            {saving ? "Salvando..." : alreadyDone ? "Atualizar" : "Concluir (+200 pts)"}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionField({ q, value, onChange }: { q: Question; value: any; onChange: (v: any) => void }) {
  if (q.qtype === "scale") {
    const opts = Array.isArray(q.options) ? q.options : [];
    const min = opts[0]?.value ?? 1;
    const max = opts[opts.length - 1]?.value ?? 5;
    const minL = opts[0]?.label ?? "Baixo";
    const maxL = opts[opts.length - 1]?.label ?? "Alto";
    return (
      <div className="space-y-3">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{minL}</span><span>{maxL}</span>
        </div>
        <div className="flex gap-2 justify-between">
          {Array.from({ length: max - min + 1 }).map((_, i) => {
            const v = min + i;
            return (
              <button
                key={v}
                onClick={() => onChange(v)}
                className={`flex-1 h-14 rounded-xl text-base font-semibold border-2 cursor-pointer transition-all ${
                  value === v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (q.qtype === "single") {
    return (
      <div className="space-y-2">
        {(q.options as string[]).map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-[14px] cursor-pointer transition-colors ${
              value === opt ? "bg-primary/10 border-primary text-primary font-semibold" : "bg-card border-border text-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (q.qtype === "multi") {
    const arr: string[] = Array.isArray(value) ? value : [];
    const toggle = (opt: string) => onChange(arr.includes(opt) ? arr.filter(o => o !== opt) : [...arr, opt]);
    return (
      <div className="space-y-2">
        {(q.options as string[]).map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-[14px] cursor-pointer transition-colors ${
              arr.includes(opt) ? "bg-primary/10 border-primary text-primary font-semibold" : "bg-card border-border text-foreground"
            }`}
          >
            <span className="mr-2">{arr.includes(opt) ? "☑" : "☐"}</span>{opt}
          </button>
        ))}
      </div>
    );
  }
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="w-full p-3 bg-card border border-border rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40"
      placeholder="Digite sua resposta..."
    />
  );
}
