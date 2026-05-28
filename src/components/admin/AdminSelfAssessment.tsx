import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

interface Q {
  id: string;
  company_id: string | null;
  sort_order: number;
  question: string;
  qtype: "single" | "multi" | "scale" | "text";
  options: any;
  active: boolean;
}

interface Props { companyId: string }

const emptyQ = (companyId: string): Omit<Q, "id"> => ({
  company_id: companyId,
  sort_order: 999,
  question: "",
  qtype: "single",
  options: [],
  active: true,
});

export function AdminSelfAssessment({ companyId }: Props) {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<(Omit<Q, "id"> & { id?: string }) | null>(null);
  const [optionsText, setOptionsText] = useState("");

  const load = async () => {
    setLoading(true);
    // load company-specific OR global if none exists
    const { data: own } = await supabase
      .from("self_assessment_questions" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("sort_order");
    let list = (own as any) || [];
    if (list.length === 0) {
      const { data: glob } = await supabase
        .from("self_assessment_questions" as any)
        .select("*")
        .is("company_id", null)
        .order("sort_order");
      list = (glob as any) || [];
    }
    setQuestions(list);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const startEdit = (q: Q) => {
    setDraft({ ...q });
    setOptionsText(
      q.qtype === "scale"
        ? JSON.stringify(q.options)
        : Array.isArray(q.options) ? (q.options as string[]).join("\n") : ""
    );
  };

  const startNew = () => {
    setDraft(emptyQ(companyId));
    setOptionsText("");
  };

  const cloneGlobalToCompany = async () => {
    if (!confirm("Copiar as 8 perguntas padrão para esta empresa? Você poderá editá-las.")) return;
    const { data: glob } = await supabase
      .from("self_assessment_questions" as any)
      .select("sort_order,question,qtype,options")
      .is("company_id", null)
      .order("sort_order");
    if (!glob || glob.length === 0) return;
    const rows = (glob as any[]).map(g => ({ ...g, company_id: companyId, active: true }));
    const { error } = await supabase.from("self_assessment_questions" as any).insert(rows as any);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Perguntas copiadas" }); load(); }
  };

  const saveDraft = async () => {
    if (!draft) return;
    let options: any = [];
    if (draft.qtype === "scale") {
      try { options = JSON.parse(optionsText || "[]"); }
      catch { toast({ title: "JSON inválido", variant: "destructive" }); return; }
    } else if (draft.qtype === "single" || draft.qtype === "multi") {
      options = optionsText.split("\n").map(s => s.trim()).filter(Boolean);
    }
    const payload: any = {
      company_id: companyId,
      sort_order: draft.sort_order,
      question: draft.question,
      qtype: draft.qtype,
      options,
      active: draft.active,
    };
    if (draft.id) {
      const { error } = await supabase.from("self_assessment_questions" as any).update(payload).eq("id", draft.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("self_assessment_questions" as any).insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Pergunta salva" });
    setDraft(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta pergunta?")) return;
    await supabase.from("self_assessment_questions" as any).delete().eq("id", id);
    load();
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Perguntas que o colaborador responde na autoavaliação (vale +200 pts no primeiro envio).
        </p>
        <div className="flex gap-2">
          {questions[0]?.company_id == null && (
            <Button variant="outline" size="sm" onClick={cloneGlobalToCompany}>Personalizar para empresa</Button>
          )}
          <Button size="sm" onClick={startNew}>+ Nova pergunta</Button>
        </div>
      </div>

      {questions[0]?.company_id == null && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          Esta empresa está usando as perguntas padrão. Clique em "Personalizar" para editar.
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q) => (
          <Card key={q.id}>
            <CardContent className="p-3 flex items-start gap-3">
              <div className="text-xs font-mono text-muted-foreground w-6 pt-1">{q.sort_order}</div>
              <div className="flex-1">
                <div className="font-medium text-foreground">{q.question}</div>
                <div className="text-[11px] text-muted-foreground">
                  {q.qtype} · {Array.isArray(q.options) ? q.options.length : 0} opções · {q.active ? "ativa" : "inativa"}
                </div>
              </div>
              {q.company_id === companyId && (
                <>
                  <Button variant="outline" size="sm" onClick={() => startEdit(q)}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(q.id)}>✕</Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {draft && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">{draft.id ? "Editar pergunta" : "Nova pergunta"}</h3>
            <div>
              <label className="text-xs text-muted-foreground">Pergunta</label>
              <Input value={draft.question} onChange={e => setDraft({ ...draft, question: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={draft.qtype}
                  onChange={e => setDraft({ ...draft, qtype: e.target.value as any })}
                >
                  <option value="single">Escolha única</option>
                  <option value="multi">Múltipla escolha</option>
                  <option value="scale">Escala</option>
                  <option value="text">Texto livre</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ordem</label>
                <Input type="number" value={draft.sort_order} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>
            {(draft.qtype === "single" || draft.qtype === "multi") && (
              <div>
                <label className="text-xs text-muted-foreground">Opções (uma por linha)</label>
                <textarea
                  rows={5}
                  className="w-full p-2 border border-input rounded-md text-sm bg-background"
                  value={optionsText}
                  onChange={e => setOptionsText(e.target.value)}
                  placeholder={"Opção 1\nOpção 2"}
                />
              </div>
            )}
            {draft.qtype === "scale" && (
              <div>
                <label className="text-xs text-muted-foreground">JSON da escala</label>
                <textarea
                  rows={3}
                  className="w-full p-2 border border-input rounded-md text-sm bg-background font-mono text-xs"
                  value={optionsText}
                  onChange={e => setOptionsText(e.target.value)}
                  placeholder={'[{"value":1,"label":"Baixo"},{"value":5,"label":"Alto"}]'}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
              <span className="text-sm">Ativa</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
              <Button onClick={saveDraft}>Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
