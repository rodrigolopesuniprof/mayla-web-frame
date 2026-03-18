import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface AvailabilityBlock {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  specialty: string | null;
  slot_duration_minutes: number;
  consultation_mode: string | null;
  is_active: boolean | null;
}

const WEEKDAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const DURATIONS = [15, 20, 30, 45, 60];
const MODES = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "Presencial" },
  { value: "both", label: "Ambos" },
];

export function AvailabilityEditor({ partnerId, specialties }: { partnerId: string; specialties: string[] }) {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    weekday: 1,
    start_time: "08:00",
    end_time: "12:00",
    specialty: specialties[0] || "",
    slot_duration_minutes: 30,
    consultation_mode: "both",
  });
  const [saving, setSaving] = useState(false);

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase
      .from("doctor_availability")
      .select("*")
      .eq("partner_id", partnerId)
      .order("weekday")
      .order("start_time");
    setBlocks((data as any) || []);
    setLoading(false);
  }, [partnerId]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const handleAdd = async () => {
    setSaving(true);
    const { error } = await supabase.from("doctor_availability").insert({
      partner_id: partnerId,
      weekday: form.weekday,
      start_time: form.start_time,
      end_time: form.end_time,
      specialty: form.specialty || null,
      slot_duration_minutes: form.slot_duration_minutes,
      consultation_mode: form.consultation_mode,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bloco adicionado!" });
      setShowAdd(false);
      fetchBlocks();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("doctor_availability").delete().eq("id", id);
    fetchBlocks();
  };

  const toggleActive = async (block: AvailabilityBlock) => {
    await supabase.from("doctor_availability").update({ is_active: !block.is_active } as any).eq("id", block.id);
    fetchBlocks();
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;

  const grouped = WEEKDAYS.map((wd) => ({
    ...wd,
    blocks: blocks.filter((b) => b.weekday === wd.value),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Disponibilidade</h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancelar" : "+ Novo bloco"}
        </Button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dia</Label>
              <select
                value={form.weekday}
                onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {WEEKDAYS.map((wd) => <option key={wd.value} value={wd.value}>{wd.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Especialidade</Label>
              <select
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="">Geral</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Duração do slot</Label>
              <select
                value={form.slot_duration_minutes}
                onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modo</Label>
              <select
                value={form.consultation_mode}
                onChange={(e) => setForm({ ...form, consultation_mode: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Adicionar bloco"}
          </Button>
        </div>
      )}

      {grouped.map((wd) => (
        <div key={wd.value}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{wd.label}</p>
          {wd.blocks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 mb-3">Sem horários configurados</p>
          ) : (
            <div className="space-y-2 mb-3">
              {wd.blocks.map((b) => (
                <div key={b.id} className={`flex items-center justify-between bg-card border rounded-lg px-3 py-2 ${b.is_active ? "border-border" : "border-border/50 opacity-50"}`}>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono font-medium text-foreground">{b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</span>
                    <span className="text-muted-foreground text-xs">{b.specialty || "Geral"}</span>
                    <span className="text-muted-foreground text-[10px]">{b.slot_duration_minutes}min</span>
                    <span className="text-[10px] text-muted-foreground">
                      {b.consultation_mode === "online" ? "🌐" : b.consultation_mode === "in_person" ? "🏥" : "🌐🏥"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(b)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${
                        b.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      {b.is_active ? "Ativo" : "Inativo"}
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="text-destructive text-xs bg-transparent border-none cursor-pointer ml-1">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
