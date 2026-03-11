import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Specialty {
  id: string;
  name: string;
  emoji: string;
  active: boolean;
  municipality_id: string;
}

interface Slot {
  id: string;
  specialty_id: string;
  municipality_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
  active: boolean;
  health_unit_id: string | null;
  professional_name: string | null;
}

interface Municipality {
  id: string;
  name: string;
}

interface HealthUnit {
  id: string;
  name: string;
}

export function AdminSpecialties() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMuni, setSelectedMuni] = useState<string>("");
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [healthUnits, setHealthUnits] = useState<HealthUnit[]>([]);

  // Specialty form
  const [showSpecForm, setShowSpecForm] = useState(false);
  const [specForm, setSpecForm] = useState({ name: "", emoji: "🩺" });
  const [editingSpec, setEditingSpec] = useState<Specialty | null>(null);

  // Slot form
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotMode, setSlotMode] = useState<"single" | "batch">("single");
  const [slotForm, setSlotForm] = useState({
    slot_date: "", start_time: "08:00", end_time: "17:00", max_bookings: "10",
    health_unit_id: "", professional_name: "",
    // batch fields
    date_start: "", date_end: "",
    weekdays: [1, 2, 3, 4, 5] as number[], // Mon-Fri
  });

  const [saving, setSaving] = useState(false);

  // Load municipalities
  useEffect(() => {
    supabase.from("municipalities").select("id, name").order("name").then(({ data }) => {
      if (data) {
        setMunicipalities(data);
        if (data.length > 0 && !selectedMuni) setSelectedMuni(data[0].id);
      }
    });
  }, []);

  // Load health units for selected municipality
  useEffect(() => {
    if (!selectedMuni) return;
    supabase.from("health_units").select("id, name").eq("municipality_id", selectedMuni).eq("active", true).order("name")
      .then(({ data }) => { if (data) setHealthUnits(data); });
  }, [selectedMuni]);

  // Load specialties when municipality changes
  const loadSpecialties = useCallback(async () => {
    if (!selectedMuni) return;
    const { data } = await supabase
      .from("specialties").select("*").eq("municipality_id", selectedMuni).order("name");
    if (data) setSpecialties(data as Specialty[]);
  }, [selectedMuni]);

  useEffect(() => { loadSpecialties(); }, [loadSpecialties]);

  // Load slots when specialty selected
  const loadSlots = useCallback(async () => {
    if (!selectedSpecialty) { setSlots([]); return; }
    const { data } = await supabase
      .from("appointment_slots").select("*")
      .eq("specialty_id", selectedSpecialty).order("slot_date").order("start_time");
    if (data) setSlots(data as Slot[]);
  }, [selectedSpecialty]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Save specialty
  const handleSaveSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSpec) {
        const { error } = await supabase.from("specialties").update({ name: specForm.name, emoji: specForm.emoji }).eq("id", editingSpec.id);
        if (error) throw error;
        toast({ title: "Especialidade atualizada!" });
      } else {
        const { error } = await supabase.from("specialties").insert({ name: specForm.name, emoji: specForm.emoji, municipality_id: selectedMuni });
        if (error) throw error;
        toast({ title: "Especialidade criada!" });
      }
      setShowSpecForm(false);
      setEditingSpec(null);
      setSpecForm({ name: "", emoji: "🩺" });
      loadSpecialties();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteSpec = async (id: string) => {
    if (!confirm("Remover especialidade? Todas as vagas serão removidas também.")) return;
    const { error } = await supabase.from("specialties").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Especialidade removida" }); loadSpecialties(); if (selectedSpecialty === id) setSelectedSpecialty(""); }
  };

  const handleToggleSpec = async (spec: Specialty) => {
    await supabase.from("specialties").update({ active: !spec.active }).eq("id", spec.id);
    loadSpecialties();
  };

  const toggleWeekday = (day: number) => {
    setSlotForm(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day].sort(),
    }));
  };

  // Save slot(s)
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const baseSlot = {
        specialty_id: selectedSpecialty,
        municipality_id: selectedMuni,
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
        max_bookings: parseInt(slotForm.max_bookings),
        health_unit_id: slotForm.health_unit_id || null,
        professional_name: slotForm.professional_name || null,
      };

      if (slotMode === "single") {
        const { error } = await supabase.from("appointment_slots").insert({ ...baseSlot, slot_date: slotForm.slot_date });
        if (error) throw error;
        toast({ title: "Vaga criada!" });
      } else {
        // Batch: generate slots for each matching weekday in range
        const start = new Date(slotForm.date_start + "T12:00");
        const end = new Date(slotForm.date_end + "T12:00");
        if (start > end) throw new Error("Data início deve ser antes da data fim");

        const slotsToInsert = [];
        const current = new Date(start);
        while (current <= end) {
          const dow = current.getDay(); // 0=Sun
          if (slotForm.weekdays.includes(dow === 0 ? 7 : dow)) {
            slotsToInsert.push({
              ...baseSlot,
              slot_date: current.toISOString().split("T")[0],
            });
          }
          current.setDate(current.getDate() + 1);
        }

        if (slotsToInsert.length === 0) throw new Error("Nenhum dia corresponde aos dias da semana selecionados");

        const { error } = await supabase.from("appointment_slots").insert(slotsToInsert);
        if (error) throw error;
        toast({ title: `${slotsToInsert.length} vagas criadas!` });
      }

      setShowSlotForm(false);
      setSlotForm({ slot_date: "", start_time: "08:00", end_time: "17:00", max_bookings: "10", health_unit_id: "", professional_name: "", date_start: "", date_end: "", weekdays: [1, 2, 3, 4, 5] });
      loadSlots();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm("Remover esta vaga?")) return;
    const { error } = await supabase.from("appointment_slots").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Vaga removida" }); loadSlots(); }
  };

  const weekdayLabels = [
    { day: 1, label: "Seg" }, { day: 2, label: "Ter" }, { day: 3, label: "Qua" },
    { day: 4, label: "Qui" }, { day: 5, label: "Sex" }, { day: 6, label: "Sáb" }, { day: 7, label: "Dom" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-foreground">Especialidades & Vagas</h2>
      </div>

      {/* Municipality selector */}
      <div className="mb-4">
        <Label className="text-sm">Município</Label>
        <select
          value={selectedMuni}
          onChange={(e) => { setSelectedMuni(e.target.value); setSelectedSpecialty(""); }}
          className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        >
          {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Specialties Column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Especialidades ({specialties.length})</h3>
            <Button size="sm" onClick={() => { setEditingSpec(null); setSpecForm({ name: "", emoji: "🩺" }); setShowSpecForm(true); }}>
              + Nova
            </Button>
          </div>

          {showSpecForm && (
            <Card className="mb-3">
              <CardContent className="pt-4">
                <form onSubmit={handleSaveSpec} className="flex gap-2 items-end">
                  <div className="space-y-1 w-16">
                    <Label className="text-xs">Emoji</Label>
                    <Input value={specForm.emoji} onChange={e => setSpecForm({ ...specForm, emoji: e.target.value })} className="text-center" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={specForm.name} onChange={e => setSpecForm({ ...specForm, name: e.target.value })} placeholder="Clínica Geral" required />
                  </div>
                  <Button type="submit" size="sm" disabled={saving}>{saving ? "..." : "Salvar"}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowSpecForm(false)}>✕</Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            {specialties.map(s => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedSpecialty === s.id ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
                onClick={() => setSelectedSpecialty(s.id)}
              >
                <span className="text-lg">{s.emoji}</span>
                <span className={`text-sm font-medium flex-1 ${s.active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {s.name}
                </span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); handleToggleSpec(s); }}>
                  {s.active ? "✅" : "⬜"}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => {
                  e.stopPropagation();
                  setEditingSpec(s);
                  setSpecForm({ name: s.name, emoji: s.emoji });
                  setShowSpecForm(true);
                }}>
                  ✏️
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSpec(s.id); }}>
                  🗑️
                </Button>
              </div>
            ))}
            {specialties.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhuma especialidade cadastrada.</p>
            )}
          </div>
        </div>

        {/* Slots Column */}
        <div>
          {selectedSpecialty ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Vagas — {specialties.find(s => s.id === selectedSpecialty)?.name} ({slots.length})
                </h3>
                <Button size="sm" onClick={() => { setShowSlotForm(true); setSlotMode("single"); }}>+ Nova Vaga</Button>
              </div>

              {showSlotForm && (
                <Card className="mb-3">
                  <CardContent className="pt-4">
                    {/* Mode toggle */}
                    <div className="flex gap-2 mb-3">
                      <Button type="button" size="sm" variant={slotMode === "single" ? "default" : "outline"}
                        onClick={() => setSlotMode("single")}>Vaga única</Button>
                      <Button type="button" size="sm" variant={slotMode === "batch" ? "default" : "outline"}
                        onClick={() => setSlotMode("batch")}>Gerar em lote</Button>
                    </div>

                    <form onSubmit={handleSaveSlot} className="grid grid-cols-2 gap-2">
                      {/* Health unit */}
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Unidade de Saúde</Label>
                        <select
                          value={slotForm.health_unit_id}
                          onChange={e => setSlotForm({ ...slotForm, health_unit_id: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        >
                          <option value="">— Nenhuma (geral) —</option>
                          {healthUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>

                      {/* Professional */}
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Profissional</Label>
                        <Input
                          value={slotForm.professional_name}
                          onChange={e => setSlotForm({ ...slotForm, professional_name: e.target.value })}
                          placeholder="Dr. João Silva (opcional)"
                        />
                      </div>

                      {slotMode === "single" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Data *</Label>
                          <Input type="date" value={slotForm.slot_date} onChange={e => setSlotForm({ ...slotForm, slot_date: e.target.value })} required />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Data início *</Label>
                            <Input type="date" value={slotForm.date_start} onChange={e => setSlotForm({ ...slotForm, date_start: e.target.value })} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Data fim *</Label>
                            <Input type="date" value={slotForm.date_end} onChange={e => setSlotForm({ ...slotForm, date_end: e.target.value })} required />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs">Dias da semana</Label>
                            <div className="flex gap-1">
                              {weekdayLabels.map(({ day, label }) => (
                                <button
                                  key={day} type="button"
                                  onClick={() => toggleWeekday(day)}
                                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                    slotForm.weekdays.includes(day)
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-input"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs">Vagas/dia *</Label>
                        <Input type="number" min="1" value={slotForm.max_bookings} onChange={e => setSlotForm({ ...slotForm, max_bookings: e.target.value })} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Início *</Label>
                        <Input type="time" value={slotForm.start_time} onChange={e => setSlotForm({ ...slotForm, start_time: e.target.value })} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fim *</Label>
                        <Input type="time" value={slotForm.end_time} onChange={e => setSlotForm({ ...slotForm, end_time: e.target.value })} required />
                      </div>

                      <div className="col-span-2 flex gap-2 pt-1">
                        <Button type="submit" size="sm" disabled={saving}>
                          {saving ? "..." : slotMode === "batch" ? "Gerar vagas" : "Criar vaga"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowSlotForm(false)}>Cancelar</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col gap-2">
                {slots.map(s => {
                  const unit = healthUnits.find(u => u.id === s.health_unit_id);
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            📅 {new Date(s.slot_date + "T12:00").toLocaleDateString("pt-BR")}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                          </span>
                        </div>
                        {(unit || s.professional_name) && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {unit && <span>📍 {unit.name}</span>}
                            {unit && s.professional_name && <span> · </span>}
                            {s.professional_name && <span>👨‍⚕️ {s.professional_name}</span>}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium shrink-0 ${
                        s.current_bookings >= s.max_bookings
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {s.current_bookings}/{s.max_bookings}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive shrink-0" onClick={() => handleDeleteSlot(s.id)}>
                        🗑️
                      </Button>
                    </div>
                  );
                })}
                {slots.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhuma vaga cadastrada para esta especialidade.</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">← Selecione uma especialidade para gerenciar as vagas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
