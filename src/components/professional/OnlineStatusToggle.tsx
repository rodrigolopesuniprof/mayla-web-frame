import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface Props {
  partnerId: string;
  initialOnline: boolean;
  initialAcceptsOnDemand: boolean;
  alwaysAvailable?: boolean;
}

export function OnlineStatusToggle({ partnerId, initialOnline, initialAcceptsOnDemand, alwaysAvailable }: Props) {
  const [online, setOnline] = useState(initialOnline);
  const [acceptsOnDemand, setAcceptsOnDemand] = useState(initialAcceptsOnDemand);
  const [saving, setSaving] = useState(false);

  const updateStatus = async (field: string, value: boolean) => {
    setSaving(true);

    const newOnline = field === "online_now" ? value : online;
    const newAccepts = field === "accepts_on_demand" ? value : acceptsOnDemand;

    // Always upsert to handle missing rows
    const { error } = await supabase
      .from("professional_online_status")
      .upsert({
        professional_id: partnerId,
        online_now: newOnline,
        accepts_on_demand: newAccepts,
        last_seen_at: new Date().toISOString(),
      } as any, { onConflict: "professional_id" });

    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    if (field === "online_now") setOnline(value);
    if (field === "accepts_on_demand") setAcceptsOnDemand(value);
    setSaving(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Status Online</h3>

      {alwaysAvailable && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">🟢 Disponível 24/7 — configurado pelo administrador</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="online-toggle" className="text-sm text-foreground flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground"}`} />
          {online ? "Online" : "Offline"}
        </Label>
        <Switch
          id="online-toggle"
          checked={online}
          onCheckedChange={(v) => updateStatus("online_now", v)}
          disabled={saving || alwaysAvailable}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="ondemand-toggle" className="text-sm text-foreground flex items-center gap-2">
          ⚡ Aceita atendimento imediato
        </Label>
        <Switch
          id="ondemand-toggle"
          checked={acceptsOnDemand}
          onCheckedChange={(v) => updateStatus("accepts_on_demand", v)}
          disabled={saving || !online || alwaysAvailable}
        />
      </div>
    </div>
  );
}
