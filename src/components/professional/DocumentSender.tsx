import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const DOC_TYPES = [
  { value: "prescription", label: "📋 Receita médica", emoji: "📋" },
  { value: "certificate", label: "📄 Atestado", emoji: "📄" },
  { value: "exam_request", label: "🔬 Pedido de exame", emoji: "🔬" },
];

interface Props {
  consultationId: string;
  professionalId: string;
  patientUserId: string;
  patientName?: string;
}

export function DocumentSender({ consultationId, professionalId, patientUserId, patientName }: Props) {
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState("prescription");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("consultation_documents").insert({
        consultation_id: consultationId,
        professional_id: professionalId,
        user_id: patientUserId,
        document_type: docType,
        title: title.trim(),
        content: content.trim(),
      } as any);

      if (error) throw error;

      toast({ title: "Documento enviado!", description: "O paciente receberá o documento por email." });
      setTitle("");
      setContent("");
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedType = DOC_TYPES.find((d) => d.value === docType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer">
          📄 Enviar documento
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Enviar documento para {patientName || "paciente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de documento</Label>
            <div className="flex gap-2">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  onClick={() => setDocType(dt.value)}
                  className={`text-xs px-3 py-2 rounded-lg border cursor-pointer transition-colors flex-1 text-center ${
                    docType === dt.value ? "bg-primary/10 border-primary/30 text-primary font-semibold" : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {dt.emoji}<br />{dt.label.split(" ").slice(1).join(" ")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={docType === "prescription" ? "Ex: Receita médica" : docType === "certificate" ? "Ex: Atestado médico" : "Ex: Pedido de hemograma"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conteúdo</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={docType === "prescription" ? "Medicamentos, dosagens e orientações..." : docType === "certificate" ? "Texto do atestado..." : "Exames solicitados..."}
              rows={6}
            />
          </div>
          <Button onClick={handleSend} disabled={saving} className="w-full">
            {saving ? "Enviando..." : `${selectedType?.emoji} Enviar ${selectedType?.label.split(" ").slice(1).join(" ")}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
