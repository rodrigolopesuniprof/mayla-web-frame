import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface PromptRow {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (rápido, recomendado)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (mais preciso, mais caro)" },
];

export function AdminAssistantPrompt() {
  const [active, setActive] = useState<PromptRow | null>(null);
  const [history, setHistory] = useState<PromptRow[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [temperature, setTemperature] = useState(0.7);
  const [name, setName] = useState("mayla_default");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("assistant_prompts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(10);
    if (!data) return;
    setHistory(data as PromptRow[]);
    const current = (data as PromptRow[]).find((r) => r.is_active) ?? data[0] as PromptRow;
    if (current) {
      setActive(current);
      setSystemPrompt(current.system_prompt);
      setModel(current.model);
      setTemperature(Number(current.temperature));
      setName(current.name);
    }
  };

  useEffect(() => { load(); }, []);

  const saveAndActivate = async () => {
    if (!systemPrompt.trim()) {
      toast({ title: "Prompt vazio", description: "Preencha o system prompt.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      // Desativa todos os anteriores
      await supabase.from("assistant_prompts").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      const { error } = await supabase.from("assistant_prompts").insert({
        name: name || "mayla_default",
        system_prompt: systemPrompt,
        model,
        temperature,
        is_active: true,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: "Prompt atualizado!", description: "Nova versão ativa para todos os usuários." });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const restore = (row: PromptRow) => {
    setSystemPrompt(row.system_prompt);
    setModel(row.model);
    setTemperature(Number(row.temperature));
    setName(row.name);
    toast({ title: "Versão carregada no editor", description: "Clique em \"Salvar e ativar\" para aplicar." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Prompt do Assistente Mayla</h3>
        <p className="text-sm text-muted-foreground">
          Edite as instruções enviadas ao Gemini. A versão ativa é usada por todos os usuários.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nome (interno)</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-secondary rounded-md px-3 py-2 text-sm border-none outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Modelo Gemini</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Temperature: {temperature.toFixed(2)}</Label>
          <Slider
            value={[temperature]}
            onValueChange={(v) => setTemperature(v[0])}
            min={0}
            max={1}
            step={0.05}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">0 = determinístico · 1 = mais criativo</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">System prompt (instruções do Gem)</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="mt-1 min-h-[320px] font-mono text-xs"
            placeholder="Cole aqui as instruções do seu Gem do Gemini..."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={saveAndActivate} disabled={saving}>
            {saving ? "Salvando..." : "Salvar e ativar nova versão"}
          </Button>
        </div>
      </Card>

      {history.length > 1 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Histórico (últimas {history.length} versões)</h4>
          <div className="space-y-2">
            {history.map((row) => (
              <Card key={row.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{row.name}</span>
                      {row.is_active && <span className="text-xs bg-primary/15 text-primary rounded-full px-2 py-0.5">ATIVO</span>}
                      <span className="text-xs text-muted-foreground">· {row.model} · t={Number(row.temperature).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {row.system_prompt.slice(0, 120)}…
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(row.updated_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => restore(row)}>Carregar</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
