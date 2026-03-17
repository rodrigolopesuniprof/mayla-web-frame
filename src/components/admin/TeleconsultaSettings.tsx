import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Props {
  partnerId: string;
}

export function TeleconsultaSettings({ partnerId }: Props) {
  const [alwaysAvailable, setAlwaysAvailable] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [maxParallel, setMaxParallel] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("professional_online_status")
        .select("always_available, estimated_response_minutes, max_parallel_waiting")
        .eq("professional_id", partnerId)
        .maybeSingle();

      if (data) {
        setAlwaysAvailable((data as any).always_available ?? false);
        setEstimatedMinutes((data as any).estimated_response_minutes ?? 15);
        setMaxParallel((data as any).max_parallel_waiting ?? 3);
      }
      setLoading(false);
    };
    fetch();
  }, [partnerId]);

  const handleSave = async () => {
    setSaving(true);
    const payload: any = {
      professional_id: partnerId,
      always_available: alwaysAvailable,
      online_now: alwaysAvailable ? true : undefined,
      accepts_on_demand: alwaysAvailable ? true : undefined,
      estimated_response_minutes: estimatedMinutes,
      max_parallel_waiting: maxParallel,
      last_seen_at: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const { error } = await supabase
      .from("professional_online_status")
      .upsert(payload, { onConflict: "professional_id" });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações de teleconsulta salvas" });
    }
    setSaving(false);
  };

  if (loading) return <p className="text-xs text-muted-foreground">Carregando teleconsulta...</p>;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">📹 Teleconsulta</h4>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Disponível 24/7</Label>
        <Switch checked={alwaysAvailable} onCheckedChange={setAlwaysAvailable} />
      </div>
      {alwaysAvailable && (
        <p className="text-xs text-muted-foreground">
          O profissional ficará sempre online e aceitando atendimento imediato, mesmo sem acessar o painel.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Tempo estimado de resposta (min)</Label>
          <Input
            type="number"
            min={1}
            value={estimatedMinutes}
            onChange={e => setEstimatedMinutes(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Máx. pacientes simultâneos</Label>
          <Input
            type="number"
            min={1}
            value={maxParallel}
            onChange={e => setMaxParallel(Number(e.target.value))}
          />
        </div>
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar teleconsulta"}
      </Button>
    </div>
  );
}
