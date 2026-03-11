import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMunicipality } from "@/contexts/MunicipalityContext";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Specialty {
  id: string;
  name: string;
  emoji: string;
}

interface Slot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
  health_unit_id: string | null;
  professional_name: string | null;
}

interface HealthUnit {
  id: string;
  name: string;
  address: string | null;
}

type Step = "specialty" | "calendar" | "confirm" | "done";

export function AppointmentBooking({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { municipality } = useMunicipality();
  const [step, setStep] = useState<Step>("specialty");
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [healthUnits, setHealthUnits] = useState<HealthUnit[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);

  // Load specialties
  useEffect(() => {
    if (!municipality) return;
    setLoading(true);
    supabase
      .from("specialties")
      .select("id, name, emoji")
      .eq("municipality_id", municipality.id)
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setSpecialties(data);
        setLoading(false);
      });
  }, [municipality]);

  // Load slots + health units when specialty selected
  useEffect(() => {
    if (!selectedSpecialty || !municipality) return;
    setLoading(true);
    
    const today = new Date().toISOString().split("T")[0];
    
    Promise.all([
      supabase
        .from("appointment_slots")
        .select("id, slot_date, start_time, end_time, max_bookings, current_bookings, health_unit_id, professional_name")
        .eq("specialty_id", selectedSpecialty.id)
        .eq("municipality_id", municipality.id)
        .eq("active", true)
        .gte("slot_date", today)
        .order("slot_date")
        .order("start_time"),
      supabase
        .from("health_units")
        .select("id, name, address")
        .eq("municipality_id", municipality.id)
        .eq("active", true),
    ]).then(([slotsRes, unitsRes]) => {
      if (slotsRes.data) setSlots(slotsRes.data.filter(s => s.current_bookings < s.max_bookings) as Slot[]);
      if (unitsRes.data) setHealthUnits(unitsRes.data);
      setLoading(false);
    });
  }, [selectedSpecialty, municipality]);

  // Dates that have available slots
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    slots.forEach(s => dates.add(s.slot_date));
    return dates;
  }, [slots]);

  // Slots for the selected date
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return slots.filter(s => s.slot_date === dateStr);
  }, [slots, selectedDate]);

  // Calendar days for current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPad = monthStart.getDay(); // 0=Sun
    return { days, startPad };
  }, [currentMonth]);

  const handleSelectSpecialty = (s: Specialty) => {
    setSelectedSpecialty(s);
    setSelectedSlot(null);
    setSelectedDate(null);
    setCurrentMonth(new Date());
    setStep("calendar");
  };

  const handleSelectDate = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    if (!availableDates.has(dateStr)) return;
    if (isBefore(day, startOfDay(new Date()))) return;
    setSelectedDate(day);
    setSelectedSlot(null);
  };

  const handleSelectSlot = (s: Slot) => {
    setSelectedSlot(s);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!user || !selectedSpecialty || !selectedSlot || !municipality) return;
    setBooking(true);

    const { error } = await supabase.from("appointments").insert({
      user_id: user.id,
      specialty: selectedSpecialty.name,
      appointment_date: `${selectedSlot.slot_date}T${selectedSlot.start_time}`,
      slot_id: selectedSlot.id,
      municipality_id: municipality.id,
      status: "pending",
    });

    setBooking(false);

    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Inscrição realizada! ✅", description: "Aguarde a confirmação da unidade de saúde." });
      setStep("done");
    }
  };

  const getUnitName = (id: string | null) => healthUnits.find(u => u.id === id)?.name || "";

  const formatSlotDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return format(new Date(y, m - 1, d), "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  const stepLabels = ["Especialidade", "Dia", "Confirmar"];
  const stepKeys: Step[] = ["specialty", "calendar", "confirm"];
  const stepIdx = stepKeys.indexOf(step);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-[22px] py-3 flex items-center gap-3 border-b border-border shrink-0">
        <button
          onClick={() => {
            if (step === "calendar") { setStep("specialty"); setSelectedSpecialty(null); }
            else if (step === "confirm") { setStep("calendar"); setSelectedSlot(null); }
            else onBack();
          }}
          className="bg-secondary border-none rounded-xl px-3 py-1.5 text-secondary-foreground text-[13px] font-medium cursor-pointer"
        >
          ← Voltar
        </button>
        <span className="font-display text-base font-medium text-foreground">Agendar Consulta</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {/* Step indicator */}
        {step !== "done" && (
          <div className="px-[22px] pt-4 pb-2 flex items-center gap-2">
            {stepLabels.map((label, i) => {
              const isActive = i <= stepIdx;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-[11px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                  {i < 2 && <div className={`flex-1 h-px ${isActive ? "bg-primary/30" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Step: Specialty */}
        {step === "specialty" && (
          <div className="px-[22px] pt-3">
            <h3 className="font-display text-lg font-medium text-foreground mb-1">Escolha a especialidade</h3>
            <p className="text-[12px] text-muted-foreground mb-4">Selecione o tipo de consulta desejada</p>

            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-secondary rounded-2xl animate-pulse" />)}
              </div>
            ) : specialties.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-3xl block mb-2">🏥</span>
                <p className="text-sm text-muted-foreground">Nenhuma especialidade disponível para seu município.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {specialties.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSpecialty(s)}
                    className="flex items-center gap-3 p-3.5 bg-card rounded-2xl border border-border hover:border-primary/40 transition-colors cursor-pointer text-left w-full"
                  >
                    <span className="text-xl shrink-0">{s.emoji}</span>
                    <span className="text-[13px] font-semibold text-foreground">{s.name}</span>
                    <span className="ml-auto text-muted-foreground">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Calendar */}
        {step === "calendar" && (
          <div className="px-[22px] pt-3">
            <h3 className="font-display text-lg font-medium text-foreground mb-1">
              {selectedSpecialty?.emoji} {selectedSpecialty?.name}
            </h3>
            <p className="text-[12px] text-muted-foreground mb-4">Selecione um dia com vagas disponíveis</p>

            {loading ? (
              <div className="h-64 bg-secondary rounded-2xl animate-pulse" />
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-3xl block mb-2">📅</span>
                <p className="text-sm text-muted-foreground">Sem vagas disponíveis no momento.</p>
                <p className="text-xs text-muted-foreground mt-1">Tente novamente mais tarde.</p>
              </div>
            ) : (
              <>
                {/* Calendar */}
                <div className="bg-card rounded-2xl border border-border p-3 mb-4">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-foreground border-none cursor-pointer text-sm">
                      ‹
                    </button>
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-foreground border-none cursor-pointer text-sm">
                      ›
                    </button>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                      <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for padding */}
                    {Array.from({ length: calendarDays.startPad }).map((_, i) => (
                      <div key={`pad-${i}`} />
                    ))}
                    {calendarDays.days.map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const hasSlots = availableDates.has(dateStr);
                      const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isTodayDay = isToday(day);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => !isPast && handleSelectDate(day)}
                          disabled={isPast || !hasSlots}
                          className={`
                            w-full aspect-square rounded-xl flex flex-col items-center justify-center text-[12px] border-none cursor-pointer transition-all
                            ${isSelected
                              ? "bg-primary text-primary-foreground font-bold"
                              : hasSlots && !isPast
                                ? "bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                                : isPast
                                  ? "text-muted-foreground/30 cursor-not-allowed"
                                  : "text-muted-foreground cursor-not-allowed bg-transparent"
                            }
                            ${isTodayDay && !isSelected ? "ring-1 ring-primary/40" : ""}
                          `}
                        >
                          {day.getDate()}
                          {hasSlots && !isPast && (
                            <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slots for selected date */}
                {selectedDate && (
                  <div>
                    <p className="text-[12px] font-semibold text-foreground mb-2 capitalize">
                      📅 {formatSlotDate(format(selectedDate, "yyyy-MM-dd"))}
                    </p>

                    {slotsForDate.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma vaga neste dia.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {slotsForDate.map(s => {
                          const remaining = s.max_bookings - s.current_bookings;
                          const unitName = getUnitName(s.health_unit_id);
                          return (
                            <button
                              key={s.id}
                              onClick={() => handleSelectSlot(s)}
                              className="flex items-start gap-3 p-3 bg-card rounded-2xl border border-border hover:border-primary/40 transition-colors cursor-pointer text-left w-full"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-semibold text-foreground">
                                    🕐 {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                                  </span>
                                </div>
                                {unitName && (
                                  <span className="text-[11px] text-muted-foreground block mt-0.5">📍 {unitName}</span>
                                )}
                                {s.professional_name && (
                                  <span className="text-[11px] text-muted-foreground block mt-0.5">👨‍⚕️ {s.professional_name}</span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[12px] font-semibold text-primary block">
                                  {remaining} vaga{remaining !== 1 ? "s" : ""}
                                </span>
                                <span className="text-[10px] text-muted-foreground">Reservar ›</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* UBS warning */}
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        ⚠️ <strong>Importante:</strong> Ao se inscrever, você está reservando presença no dia. 
                        A confirmação depende da Unidade Básica de Saúde. Você será notificado quando sua consulta for confirmada.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && selectedSpecialty && selectedSlot && (
          <div className="px-[22px] pt-3">
            <h3 className="font-display text-lg font-medium text-foreground mb-4">Confirme sua inscrição</h3>

            <div className="bg-secondary rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-foreground/10">
                <span className="text-2xl">{selectedSpecialty.emoji}</span>
                <div>
                  <span className="text-[13px] font-semibold text-foreground block">{selectedSpecialty.name}</span>
                  <span className="text-[11px] text-muted-foreground">Reserva de presença no dia</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">📅 Data</span>
                  <span className="text-foreground font-medium capitalize">{formatSlotDate(selectedSlot.slot_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">🕐 Período</span>
                  <span className="text-foreground font-medium">{selectedSlot.start_time.slice(0, 5)} – {selectedSlot.end_time.slice(0, 5)}</span>
                </div>
                {getUnitName(selectedSlot.health_unit_id) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">📍 Local</span>
                    <span className="text-foreground font-medium">{getUnitName(selectedSlot.health_unit_id)}</span>
                  </div>
                )}
                {selectedSlot.professional_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">👨‍⚕️ Profissional</span>
                    <span className="text-foreground font-medium">{selectedSlot.professional_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">📋 Status</span>
                  <span className="text-amber-600 font-medium">Pendente de confirmação</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-4">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                ⚠️ <strong>Atenção:</strong> Sua inscrição será analisada pela Unidade Básica de Saúde. 
                Você receberá uma notificação quando sua consulta for confirmada. 
                Também enviaremos lembretes antes da data.
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={booking}
              className="w-full py-3 rounded-xl border-none text-[13px] font-semibold text-primary-foreground cursor-pointer disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" }}
            >
              {booking ? "Inscrevendo..." : "✅ Confirmar inscrição"}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="px-[22px] pt-8 text-center">
            <span className="text-5xl block mb-4">🎉</span>
            <h3 className="font-display text-xl font-medium text-foreground mb-2">Inscrição realizada!</h3>
            <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">
              Sua inscrição para <strong>{selectedSpecialty?.name}</strong> foi registrada com sucesso.
            </p>
            <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 mb-6 mx-4">
              <p className="text-[11px] text-foreground leading-relaxed">
                📲 A Unidade Básica de Saúde analisará sua inscrição. 
                Você receberá uma <strong>notificação</strong> quando for confirmada, 
                e <strong>lembretes</strong> antes da data da consulta.
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-6 py-2.5 rounded-xl border-none bg-primary text-primary-foreground text-[13px] font-semibold cursor-pointer"
            >
              Voltar ao início
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
