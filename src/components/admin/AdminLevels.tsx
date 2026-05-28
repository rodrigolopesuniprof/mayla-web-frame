import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface Level {
  id?: string;
  level_number: number;
  name: string;
  emoji: string;
  min_points: number;
  bonus_points: number;
  badge_title: string;
}

const DEFAULT_LEVELS: Omit<Level, "id">[] = [
  { level_number: 1, name: "Iniciante",  emoji: "🌱", min_points: 0,    bonus_points: 0,   badge_title: "Primeiros Passos" },
  { level_number: 2, name: "Engajado",   emoji: "💪", min_points: 500,  bonus_points: 50,  badge_title: "Engajado" },
  { level_number: 3, name: "Atleta",     emoji: "🏃", min_points: 1500, bonus_points: 100, badge_title: "Atleta" },
  { level_number: 4, name: "Campeão",    emoji: "🏆", min_points: 3500, bonus_points: 200, badge_title: "Campeão" },
  { level_number: 5, name: "Lendário",   emoji: "👑", min_points: 7500, bonus_points: 500, badge_title: "Lendário" },
];

interface Props { companyId: string; }

export function AdminLevels({ companyId }: Props) {
  const [items, setItems] = useState<Level[]>([]);
  const [usingDefault, setUsingDefault] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("levels" as any)
      .select("id, level_number, name, emoji, min_points, bonus_points, badge_title")
      .eq("company_id", companyId)
      .order("level_number");
    if (data && data.length > 0) {
      setItems((data as unknown) as Level[]);
      setUsingDefault(false);
    } else {
      setItems(DEFAULT_LEVELS);
      setUsingDefault(true);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const updateItem = (idx: number, patch: Partial<Level>) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addLevel = () => {
    const next = items.length + 1;
    const last = items[items.length - 1];
    setItems([...items, {
      level_number: next,
      name: `Nível ${next}`,
      emoji: "⭐",
      min_points: (last?.min_points ?? 0) + 1000,
      bonus_points: 100,
      badge_title: "",
    }]);
  };

  const removeLevel = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, level_number: i + 1 })));
  };

  const saveAll = async () => {
    // Validate ascending min_points
    for (let i = 1; i < items.length; i++) {
      if (items[i].min_points <= items[i - 1].min_points) {
        toast({ title: "Erro de validação", description: `Pontos mínimos devem ser crescentes (nível ${i + 1})`, variant: "destructive" });
        return;
      }
    }
    // Replace strategy: delete + insert (simple & safe for small lists)
    await supabase.from("levels" as any).delete().eq("company_id", companyId);
    const payload = items.map((it, i) => ({
      company_id: companyId,
      level_number: i + 1,
      name: it.name,
      emoji: it.emoji || "⭐",
      min_points: it.min_points,
      bonus_points: it.bonus_points,
      badge_title: it.badge_title || null,
    }));
    const { error } = await supabase.from("levels" as any).insert(payload);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Escala de níveis salva" });
    load();
  };

  const resetDefaults = async () => {
    if (!confirm("Voltar para a escala padrão? Isso remove a configuração customizada da empresa.")) return;
    await supabase.from("levels" as any).delete().eq("company_id", companyId);
    toast({ title: "Escala restaurada para o padrão global" });
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Defina a escala de níveis dos colaboradores da empresa. Colaboradores sobem de nível automaticamente ao atingir os pontos mínimos e recebem o bônus como pontos extras.
        {usingDefault && <span className="block mt-1 text-amber-600">Atualmente usando a escala padrão global. Salve para personalizar.</span>}
      </p>

      <div className="space-y-2">
        {items.map((it, idx) => (
          <Card key={idx}>
            <CardContent className="p-3 grid grid-cols-[40px_60px_1fr_100px_100px_1fr_40px] gap-2 items-end">
              <div className="text-center font-bold text-muted-foreground text-sm">{idx + 1}</div>
              <div>
                <Label className="text-[10px]">Emoji</Label>
                <Input value={it.emoji} onChange={(e) => updateItem(idx, { emoji: e.target.value })} maxLength={4} className="h-8" />
              </div>
              <div>
                <Label className="text-[10px]">Nome</Label>
                <Input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-[10px]">Min. pts</Label>
                <Input type="number" value={it.min_points} onChange={(e) => updateItem(idx, { min_points: parseInt(e.target.value) || 0 })} className="h-8" />
              </div>
              <div>
                <Label className="text-[10px]">Bônus</Label>
                <Input type="number" value={it.bonus_points} onChange={(e) => updateItem(idx, { bonus_points: parseInt(e.target.value) || 0 })} className="h-8" />
              </div>
              <div>
                <Label className="text-[10px]">Título do badge</Label>
                <Input value={it.badge_title} onChange={(e) => updateItem(idx, { badge_title: e.target.value })} className="h-8" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeLevel(idx)} disabled={items.length <= 1}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addLevel}>+ Adicionar nível</Button>
        <div className="flex gap-2">
          {!usingDefault && <Button variant="ghost" size="sm" onClick={resetDefaults}>Restaurar padrão</Button>}
          <Button onClick={saveAll}>Salvar escala</Button>
        </div>
      </div>
    </div>
  );
}
