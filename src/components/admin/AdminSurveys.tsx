import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";

interface Questionnaire {
  id: string;
  title: string;
  created_at: string;
  questions: { id: string; category: string; question_text: string; sort_order: number }[];
}

interface QuestionDraft {
  category: string;
  question_text: string;
}

export function AdminSurveys() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ category: "Geral", question_text: "" }]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Questionnaire | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: quests } = await supabase
      .from("questionnaires")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });

    if (!quests || quests.length === 0) {
      setQuestionnaires([]);
      setLoading(false);
      return;
    }

    const ids = quests.map(q => q.id);
    const { data: allQuestions } = await supabase
      .from("questionnaire_questions")
      .select("id, questionnaire_id, category, question_text, sort_order")
      .in("questionnaire_id", ids)
      .order("sort_order");

    const result: Questionnaire[] = quests.map(q => ({
      ...q,
      questions: (allQuestions || []).filter((qq: any) => qq.questionnaire_id === q.id),
    }));

    setQuestionnaires(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setQuestions([{ category: "Geral", question_text: "" }]);
    setShowForm(true);
  };

  const openEdit = (q: Questionnaire) => {
    setEditingId(q.id);
    setTitle(q.title);
    setQuestions(q.questions.map(qq => ({ category: qq.category, question_text: qq.question_text })));
    setShowForm(true);
  };

  const addQuestion = () => setQuestions([...questions, { category: "Geral", question_text: "" }]);
  const removeQuestion = (i: number) => setQuestions(questions.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, field: keyof QuestionDraft, value: string) => {
    const updated = [...questions];
    updated[i] = { ...updated[i], [field]: value };
    setQuestions(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    const validQuestions = questions.filter(q => q.question_text.trim());
    if (validQuestions.length === 0) { toast.error("Adicione pelo menos uma pergunta"); return; }

    setSaving(true);
    try {
      if (editingId) {
        await supabase.from("questionnaires").update({ title: title.trim() }).eq("id", editingId);
        await supabase.from("questionnaire_questions").delete().eq("questionnaire_id", editingId);
        await supabase.from("questionnaire_questions").insert(
          validQuestions.map((q, i) => ({
            questionnaire_id: editingId,
            category: q.category,
            question_text: q.question_text.trim(),
            sort_order: i,
          }))
        );
        toast.success("Questionário atualizado");
      } else {
        const { data: created, error } = await supabase
          .from("questionnaires")
          .insert({ title: title.trim() })
          .select("id")
          .single();
        if (error) throw error;
        await supabase.from("questionnaire_questions").insert(
          validQuestions.map((q, i) => ({
            questionnaire_id: created.id,
            category: q.category,
            question_text: q.question_text.trim(),
            sort_order: i,
          }))
        );
        toast.success("Questionário criado");
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("questionnaires").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Questionário excluído");
      load();
    }
    setDeleteTarget(null);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{questionnaires.length} questionário(s)</p>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Novo questionário</Button>
      </div>

      {questionnaires.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-10 text-center">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Pesquisas e Avaliações</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Crie questionários de autoavaliação com escala de emojis para engajar os colaboradores.
          </p>
          <Button size="sm" onClick={openCreate}>Criar primeiro questionário</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questionnaires.map(q => (
            <Card key={q.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">📋 {q.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.questions.length} pergunta(s) · Criado em {new Date(q.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="mt-2 space-y-1">
                      {q.questions.slice(0, 3).map((qq, i) => (
                        <p key={qq.id} className="text-xs text-muted-foreground">
                          {i + 1}. {qq.question_text}
                        </p>
                      ))}
                      {q.questions.length > 3 && (
                        <p className="text-xs text-muted-foreground italic">+{q.questions.length - 3} mais...</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(q)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(q)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar questionário" : "Novo questionário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Avaliação de Bem-estar Semanal" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Perguntas (escala 1-5 com emojis)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}><Plus className="w-3 h-3 mr-1" /> Pergunta</Button>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input
                      value={q.question_text}
                      onChange={e => updateQuestion(i, "question_text", e.target.value)}
                      placeholder={`Pergunta ${i + 1}`}
                    />
                    <Input
                      value={q.category}
                      onChange={e => updateQuestion(i, "category", e.target.value)}
                      placeholder="Categoria (ex: Sono, Estresse)"
                      className="text-xs h-8"
                    />
                  </div>
                  {questions.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(i)} className="mt-1">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Cada pergunta será respondida com emojis: 😢 Muito ruim → 😕 Ruim → 😐 Regular → 🙂 Bom → 😄 Muito bom
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir questionário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.title}</strong>? As perguntas e respostas vinculadas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
