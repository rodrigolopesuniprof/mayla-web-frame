import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DURATION_OPTIONS = [15, 20, 30, 45, 60];

const SPECIALTIES = [
  "Clínico Geral", "Cardiologia", "Dermatologia", "Endocrinologia", "Gastroenterologia",
  "Ginecologia e Obstetrícia", "Neurologia", "Nutrição", "Oftalmologia", "Ortopedia",
  "Pediatria", "Psiquiatria", "Urologia", "Cirurgia Geral",
];

interface Slot {
  id?: string;
  partner_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  consultation_mode: string;
  is_active: boolean;
  slot_duration_minutes: number;
  specialty: string | null;
}

interface Props {
  partnerId: string;
  partnerType?: string;
}

export function DoctorAvailabilityEditor({ partnerId, partnerType }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSlots();
  }, [partnerId]);

  const loadSlots = async () => {
    const { data } = await supabase
      .from("doctor_availability")
      .select("*")
      .eq("partner_id", partnerId)
      .order("weekday")
      .order("start_time");
    setSlots((data as Slot[]) || []);
    setLoading(false);
  };

  const addSlot = () => {
    setSlots(prev => [...prev, {
      partner_id: partnerId,
      weekday: 1,
      start_time: "08:00",
      end_time: "12:00",
      consultation_mode: "both",
      is_active: true,
      slot_duration_minutes: 30,
      specialty: null,
    }]);
  };

  const updateSlot = (idx: number, field: keyof Slot, val: unknown) => {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const saveSlot = async (idx: number) => {
    const slot = slots[idx];
    const payload = {
      partner_id: slot.partner_id,
      weekday: slot.weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
      consultation_mode: slot.consultation_mode,
      is_active: slot.is_active,
      slot_duration_minutes: slot.slot_duration_minutes,
      specialty: slot.specialty || null,
    };

    if (slot.id) {
      await supabase.from("doctor_availability").update(payload).eq("id", slot.id);
    } else {
      const { data } = await supabase.from("doctor_availability").insert(payload).select().single();
      if (data) updateSlot(idx, "id", data.id);
    }
    toast({ title: "Horário salvo" });
  };

  const deleteSlot = async (idx: number) => {
    const slot = slots[idx];
    if (slot.id) await supabase.from("doctor_availability").delete().eq("id", slot.id);
    setSlots(prev => prev.filter((_, i) => i !== idx));
    toast({ title: "Horário removido" });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando horários...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Disponibilidade semanal</h4>
        <Button type="button" size="sm" variant="outline" onClick={addSlot}>+ Adicionar horário</Button>
      </div>
      {slots.length === 0 && <p className="text-xs text-muted-foreground">Nenhum horário cadastrado.</p>}
      {slots.map((slot, idx) => (
        <div key={idx} className="border border-border rounded-xl p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1 w-32">
            <Label className="text-xs">Dia</Label>
            <Select value={String(slot.weekday)} onValueChange={v => updateSlot(idx, "weekday", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-28">
            <Label className="text-xs">Início</Label>
            <Input type="time" value={slot.start_time} onChange={e => updateSlot(idx, "start_time", e.target.value)} />
          </div>
          <div className="space-y-1 w-28">
            <Label className="text-xs">Fim</Label>
            <Input type="time" value={slot.end_time} onChange={e => updateSlot(idx, "end_time", e.target.value)} />
          </div>
          <div className="space-y-1 w-28">
            <Label className="text-xs">Duração (min)</Label>
            <Select value={String(slot.slot_duration_minutes)} onValueChange={v => updateSlot(idx, "slot_duration_minutes", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-32">
            <Label className="text-xs">Modo</Label>
            <Select value={slot.consultation_mode} onValueChange={v => updateSlot(idx, "consultation_mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={slot.is_active} onCheckedChange={v => updateSlot(idx, "is_active", v)} />
            <span className="text-xs text-muted-foreground">Ativo</span>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button type="button" size="sm" variant="outline" onClick={() => deleteSlot(idx)}>✕</Button>
            <Button type="button" size="sm" onClick={() => saveSlot(idx)}>Salvar</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
