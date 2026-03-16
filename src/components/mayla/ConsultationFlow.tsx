import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { TopBar } from "./TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Future: integrate with electronic medical records API */
// interface MedicalRecord {
//   appointment_id: string;
//   patient_id: string;
//   doctor_id: string;
//   diagnosis: string;
//   prescription: string;
//   notes: string;
//   created_at: string;
// }

/* ─── types ─── */
interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
  consultation_type: string | null;
  consultation_price: number | null;
  online_consultation_enabled: boolean;
  city: string | null;
  state: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  crm: string | null;
  crm_state: string | null;
  contact_link: string | null;
  phone: string | null;
  description: string | null;
  logo_url: string | null;
  // computed
  distance?: number;
  display_lat?: number;
  display_lng?: number;
}

interface AvailSlot {
  id: string;
  partner_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  consultation_mode: string;
  is_active: boolean;
  slot_duration_minutes: number;
}

interface DoctorLocation {
  id: string;
  partner_id: string;
  location_name: string | null;
  full_address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_main: boolean | null;
}

/** A computed individual time window from an availability block */
interface TimeWindow {
  slotId: string;
  start: string; // "08:00"
  end: string;   // "08:30"
  consultation_mode: string;
  duration: number;
}

type Step = "specialty" | "mode" | "doctors" | "schedule" | "confirm" | "done";
type ConsultMode = "online" | "presencial" | "first_available";

const SPECIALTIES = [
  { value: "Clínico Geral", emoji: "🩺" },
  { value: "Cardiologia", emoji: "❤️" },
  { value: "Dermatologia", emoji: "🧴" },
  { value: "Ortopedia", emoji: "🦴" },
  { value: "Ginecologia", emoji: "🌸" },
  { value: "Pediatria", emoji: "👶" },
  { value: "Psiquiatria", emoji: "🧠" },
  { value: "Nutrição", emoji: "🥗" },
  { value: "Endocrinologia", emoji: "⚡" },
  { value: "Oftalmologia", emoji: "👁️" },
];

const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const DEFAULT_CENTER: [number, number] = [-20.315, -40.312];

/* ─── helpers ─── */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Split an availability block into individual time windows */
function splitIntoWindows(slot: AvailSlot): TimeWindow[] {
  const duration = slot.slot_duration_minutes || 30;
  const [startH, startM] = slot.start_time.split(":").map(Number);
  const [endH, endM] = slot.end_time.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const windows: TimeWindow[] = [];

  for (let t = startMin; t + duration <= endMin; t += duration) {
    const sh = String(Math.floor(t / 60)).padStart(2, "0");
    const sm = String(t % 60).padStart(2, "0");
    const eh = String(Math.floor((t + duration) / 60)).padStart(2, "0");
    const em = String((t + duration) % 60).padStart(2, "0");
    windows.push({
      slotId: slot.id,
      start: `${sh}:${sm}`,
      end: `${eh}:${em}`,
      consultation_mode: slot.consultation_mode || "both",
      duration,
    });
  }
  return windows;
}

function createDoctorIcon(selected: boolean) {
  const size = selected ? 40 : 30;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#3b82f6;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:${size * 0.45}px;box-shadow:0 2px 8px rgba(0,0,0,.3);${selected ? 'transform:scale(1.2);' : ''}">🩺</div>`,
  });
}

const userIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,.3);"></div>`,
});

/* ─── Next available date for a weekday ─── */
function getNextDateForWeekday(weekday: number, fromDate: Date = new Date()): Date {
  const d = new Date(fromDate);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

/* ─── Lazy-loaded Map component ─── */
const LazyMap = lazy(() => import("./ConsultationMap"));

/* ─── Main Component ─── */
export function ConsultationFlow({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { company } = useCompany();

  const [step, setStep] = useState<Step>("specialty");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [consultMode, setConsultMode] = useState<ConsultMode | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorLocations, setDoctorLocations] = useState<DoctorLocation[]>([]);
  const [availability, setAvailability] = useState<AvailSlot[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState("");
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);

  // Geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
        () => setUserPos(DEFAULT_CENTER),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setUserPos(DEFAULT_CENTER);
    }
  }, []);

  // Fetch doctors + locations + availability when specialty + mode selected
  useEffect(() => {
    if (!selectedSpecialty || !consultMode) return;
    setLoading(true);

    const fetchData = async () => {
      let q = supabase
        .from("partners")
        .select("*")
        .eq("partner_type", "doctor")
        .eq("active", true)
        .eq("approval_status", "approved")
        .ilike("specialty", `%${selectedSpecialty}%`);

      if (consultMode === "online") {
        q = q.eq("online_consultation_enabled", true);
      }

      const [{ data: docs }, { data: locs }, { data: avail }] = await Promise.all([
        q,
        supabase.from("partner_locations").select("*"),
        supabase.from("doctor_availability").select("*").eq("is_active", true),
      ]);

      setDoctors((docs as Doctor[]) || []);
      setDoctorLocations((locs as DoctorLocation[]) || []);
      setAvailability((avail as AvailSlot[]) || []);
      setLoading(false);
    };

    fetchData();
  }, [selectedSpecialty, consultMode]);

  // Enrich doctors with distance for presencial
  const enrichedDoctors = useMemo(() => {
    if (!userPos) return doctors;
    return doctors.map((d) => {
      const locs = doctorLocations.filter((l) => l.partner_id === d.id && l.latitude && l.longitude);
      let bestLat = d.latitude, bestLng = d.longitude, bestDist = Infinity;
      
      if (locs.length > 0) {
        for (const loc of locs) {
          const dist = haversine(userPos[0], userPos[1], loc.latitude!, loc.longitude!);
          if (dist < bestDist) { bestDist = dist; bestLat = loc.latitude; bestLng = loc.longitude; }
        }
      } else if (bestLat && bestLng) {
        bestDist = haversine(userPos[0], userPos[1], bestLat, bestLng);
      }

      return { ...d, display_lat: bestLat ?? undefined, display_lng: bestLng ?? undefined, distance: bestDist };
    }).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  }, [doctors, doctorLocations, userPos]);

  // Doctor availability slots
  const doctorSlots = useMemo(() => {
    if (!selectedDoctor) return [];
    return availability.filter((a) => a.partner_id === selectedDoctor.id);
  }, [selectedDoctor, availability]);

  // Available weekdays for calendar highlighting
  const availableWeekdays = useMemo(() => new Set(doctorSlots.map((s) => s.weekday)), [doctorSlots]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return { days, startPad: monthStart.getDay() };
  }, [currentMonth]);

  // Time windows for selected date (split by duration)
  const windowsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const weekday = selectedDate.getDay();
    const slotsForDay = doctorSlots.filter((s) => s.weekday === weekday);
    return slotsForDay.flatMap(splitIntoWindows);
  }, [selectedDate, doctorSlots]);

  /* ─── Handlers ─── */
  const handleSelectSpecialty = (s: string) => {
    setSelectedSpecialty(s);
    setStep("mode");
  };

  const handleSelectMode = (mode: ConsultMode) => {
    setConsultMode(mode);
    setStep("doctors");
  };

  const handleSelectDoctor = (d: Doctor) => {
    setSelectedDoctor(d);
    setSelectedDate(null);
    setSelectedSlotTime(null);
    setCurrentMonth(new Date());
    setStep("schedule");
  };

  const handleSelectDate = (day: Date) => {
    if (isBefore(day, startOfDay(new Date())) && !isToday(day)) return;
    if (!availableWeekdays.has(day.getDay())) return;
    setSelectedDate(day);
    setSelectedSlotTime(null);
  };

  const handleSelectTime = (tw: TimeWindow) => {
    setSelectedSlotTime(`${tw.start} – ${tw.end}`);
    setStep("confirm");
  };

  const handleFirstAvailable = () => {
    const now = new Date();
    const todayWeekday = now.getDay();
    
    for (const doc of enrichedDoctors) {
      const docSlots = availability.filter((a) => a.partner_id === doc.id);
      if (docSlots.length > 0) {
        const sorted = [...docSlots].sort((a, b) => {
          const diffA = (a.weekday - todayWeekday + 7) % 7;
          const diffB = (b.weekday - todayWeekday + 7) % 7;
          return diffA - diffB;
        });
        const best = sorted[0];
        const windows = splitIntoWindows(best);
        const firstWindow = windows[0];
        setSelectedDoctor(doc);
        const nextDate = getNextDateForWeekday(best.weekday);
        setSelectedDate(nextDate);
        setSelectedSlotTime(firstWindow ? `${firstWindow.start} – ${firstWindow.end}` : `${best.start_time.slice(0, 5)} – ${best.end_time.slice(0, 5)}`);
        setStep("confirm");
        return;
      }
    }
    toast({ title: "Nenhum médico disponível", description: "Tente outra especialidade.", variant: "destructive" });
  };

  const handleConfirm = async () => {
    if (!user || !selectedDoctor || !selectedDate || !selectedSpecialty) return;
    setBooking(true);

    const appointmentDate = selectedSlotTime
      ? `${format(selectedDate, "yyyy-MM-dd")}T${selectedSlotTime.split(" – ")[0]}:00`
      : format(selectedDate, "yyyy-MM-dd'T'09:00:00");

    const { error } = await supabase.from("appointments").insert({
      user_id: user.id,
      specialty: selectedSpecialty,
      appointment_date: appointmentDate,
      doctor_name: selectedDoctor.name,
      clinic_name: selectedDoctor.city ? `${selectedDoctor.city} - ${selectedDoctor.state}` : null,
      company_id: (company as any)?.id || null,
      notes: patientNotes || null,
      status: "scheduled",
    });

    setBooking(false);
    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Consulta agendada! ✅" });
      setStep("done");
    }
  };

  const goBack = () => {
    if (step === "mode") { setStep("specialty"); setSelectedSpecialty(null); }
    else if (step === "doctors") { setStep("mode"); setConsultMode(null); }
    else if (step === "schedule") { setStep("doctors"); setSelectedDoctor(null); }
    else if (step === "confirm") { setStep("schedule"); setSelectedSlotTime(null); }
    else onBack();
  };

  const stepLabels = ["Especialidade", "Modo", "Médico", "Horário", "Confirmar"];
  const stepKeys: Step[] = ["specialty", "mode", "doctors", "schedule", "confirm"];
  const stepIdx = stepKeys.indexOf(step);

  const mapCenter: [number, number] = userPos || DEFAULT_CENTER;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Realizar Consulta" onBack={goBack} />

      <div className="flex-1 overflow-y-auto">
        {/* Progress */}
        {step !== "done" && (
          <div className="px-5 pt-3 pb-1 flex items-center gap-1">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  i <= stepIdx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}>{i + 1}</div>
                <span className={`text-[9px] hidden sm:inline ${i <= stepIdx ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {i < stepLabels.length - 1 && <div className={`flex-1 h-px ${i < stepIdx ? "bg-primary/30" : "bg-border"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Step: Specialty ── */}
        {step === "specialty" && (
          <div className="px-5 pt-3">
            <h3 className="font-display text-lg font-medium text-foreground mb-1">Escolha a especialidade</h3>
            <p className="text-xs text-muted-foreground mb-4">Qual tipo de consulta você precisa?</p>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleSelectSpecialty(s.value)}
                  className="flex items-center gap-3 p-3.5 bg-card rounded-2xl border border-border hover:border-primary/40 transition-colors cursor-pointer text-left"
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span className="text-[13px] font-semibold text-foreground">{s.value}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step: Mode ── */}
        {step === "mode" && (
          <div className="px-5 pt-3">
            <h3 className="font-display text-lg font-medium text-foreground mb-1">
              {SPECIALTIES.find((s) => s.value === selectedSpecialty)?.emoji} {selectedSpecialty}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Como deseja realizar a consulta?</p>
            <div className="space-y-3">
              <button
                onClick={() => handleSelectMode("online")}
                className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left hover:border-primary/40 transition-colors"
              >
                <span className="text-3xl">📹</span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-foreground">Online (Vídeo)</div>
                  <div className="text-xs text-muted-foreground">Teleconsulta via Jitsi Meet</div>
                </div>
                <span className="text-muted-foreground">›</span>
              </button>
              <button
                onClick={() => handleSelectMode("presencial")}
                className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left hover:border-primary/40 transition-colors"
              >
                <span className="text-3xl">🏥</span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-foreground">Presencial</div>
                  <div className="text-xs text-muted-foreground">Encontre médicos próximos no mapa</div>
                </div>
                <span className="text-muted-foreground">›</span>
              </button>
              <button
                onClick={() => handleSelectMode("first_available")}
                className="w-full rounded-2xl p-4 border-2 border-primary/20 bg-primary/5 flex items-center gap-4 cursor-pointer text-left hover:border-primary/40 transition-colors"
              >
                <span className="text-3xl">⚡</span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-foreground">Primeiro disponível</div>
                  <div className="text-xs text-muted-foreground">A forma mais rápida de conseguir uma consulta</div>
                </div>
                <span className="text-muted-foreground">›</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Doctors ── */}
        {step === "doctors" && (
          <div className="flex flex-col">
            {loading ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">Buscando médicos...</p>
              </div>
            ) : enrichedDoctors.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <span className="text-4xl block mb-2">🔍</span>
                <p className="text-sm text-muted-foreground">Nenhum médico disponível para esta especialidade e modo.</p>
                <p className="text-xs text-muted-foreground mt-2">Novos médicos podem estar em processo de aprovação. Tente novamente em breve ou escolha outra especialidade.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={goBack}>Voltar</Button>
              </div>
            ) : (
              <>
                {/* Map for presencial mode */}
                {consultMode === "presencial" && userPos && (
                  <div className="h-[35vh] min-h-[200px] shrink-0">
                    <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-secondary"><p className="text-xs text-muted-foreground">Carregando mapa...</p></div>}>
                      <LazyMap
                        center={mapCenter}
                        userPos={userPos}
                        userIcon={userIcon}
                        doctors={enrichedDoctors}
                        mapSelectedId={mapSelectedId}
                        createDoctorIcon={createDoctorIcon}
                        onPinClick={(id) => {
                          setMapSelectedId(id);
                          document.getElementById(`doc-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }}
                      />
                    </Suspense>
                  </div>
                )}

                {/* First available shortcut */}
                {consultMode === "first_available" && (
                  <div className="px-5 pt-3">
                    <button
                      onClick={handleFirstAvailable}
                      className="w-full rounded-2xl p-4 border-2 border-primary/30 bg-primary/5 flex items-center gap-4 cursor-pointer text-left mb-3"
                    >
                      <span className="text-3xl">⚡</span>
                      <div className="flex-1">
                        <div className="text-[15px] font-semibold text-foreground">Agendar com o primeiro disponível</div>
                        <div className="text-xs text-muted-foreground">Seleciona automaticamente o médico mais próximo com horário livre</div>
                      </div>
                    </button>
                    <p className="text-xs text-muted-foreground mb-2">Ou escolha um médico abaixo:</p>
                  </div>
                )}

                {/* Doctor list */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{enrichedDoctors.length} médico(s) encontrado(s)</p>
                  {enrichedDoctors.map((d) => (
                    <button
                      key={d.id}
                      id={`doc-card-${d.id}`}
                      onClick={() => { setMapSelectedId(d.id); handleSelectDoctor(d); }}
                      className={`w-full text-left rounded-xl p-3 border cursor-pointer transition-all ${
                        mapSelectedId === d.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">🩺</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.specialty}</div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {d.crm && <span className="text-[10px] text-muted-foreground">CRM {d.crm}/{d.crm_state}</span>}
                            {d.distance != null && d.distance < Infinity && (
                              <span className="text-[10px] text-muted-foreground">📏 {formatDist(d.distance)}</span>
                            )}
                            {d.consultation_price != null && (
                              <span className="text-xs font-semibold text-foreground">R$ {d.consultation_price.toFixed(0)}</span>
                            )}
                            {d.online_consultation_enabled && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Online</span>
                            )}
                          </div>
                        </div>
                        <span className="text-muted-foreground text-sm shrink-0">›</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step: Schedule ── */}
        {step === "schedule" && selectedDoctor && (
          <div className="px-5 pt-3">
            {/* Doctor info */}
            <div className="bg-card rounded-2xl p-4 border border-border mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">🩺</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{selectedDoctor.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedDoctor.specialty}</div>
                  {selectedDoctor.consultation_price != null && (
                    <div className="text-xs font-semibold text-foreground mt-0.5">R$ {selectedDoctor.consultation_price.toFixed(2)}</div>
                  )}
                </div>
              </div>
            </div>

            <h3 className="font-display text-base font-medium text-foreground mb-1">Escolha o dia</h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Dias disponíveis: {Array.from(availableWeekdays).map((w) => WEEKDAY_NAMES[w]).join(", ") || "Nenhum"}
            </p>

            {doctorSlots.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-3xl block mb-2">📅</span>
                <p className="text-sm text-muted-foreground">Este médico não possui horários cadastrados ainda.</p>
              </div>
            ) : (
              <>
                {/* Calendar */}
                <div className="bg-card rounded-2xl border border-border p-3 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-foreground border-none cursor-pointer text-sm">‹</button>
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-foreground border-none cursor-pointer text-sm">›</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                      <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: calendarDays.startPad }).map((_, i) => <div key={`p-${i}`} />)}
                    {calendarDays.days.map((day) => {
                      const hasSlots = availableWeekdays.has(day.getDay());
                      const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => handleSelectDate(day)}
                          disabled={isPast || !hasSlots}
                          className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center text-[12px] border-none cursor-pointer transition-all ${
                            isSelected ? "bg-primary text-primary-foreground font-bold"
                            : hasSlots && !isPast ? "bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                            : "text-muted-foreground/30 cursor-not-allowed bg-transparent"
                          } ${isToday(day) && !isSelected ? "ring-1 ring-primary/40" : ""}`}
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

                {/* Time windows */}
                {selectedDate && (
                  <div>
                    <p className="text-[12px] font-semibold text-foreground mb-2">
                      📅 {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    {windowsForDate.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem horários neste dia.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {windowsForDate.map((tw, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelectTime(tw)}
                            className="flex flex-col items-center p-3 bg-card rounded-xl border border-border hover:border-primary/40 transition-colors cursor-pointer"
                          >
                            <span className="text-[13px] font-semibold text-foreground">
                              {tw.start} – {tw.end}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{tw.duration} min</span>
                            <Badge variant="outline" className="text-[9px] mt-1">
                              {tw.consultation_mode === "online" ? "Online" : tw.consultation_mode === "presencial" ? "Presencial" : "Ambos"}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step: Confirm ── */}
        {step === "confirm" && selectedDoctor && selectedDate && (
          <div className="px-5 pt-3">
            <h3 className="font-display text-lg font-medium text-foreground mb-4">Confirme sua consulta</h3>
            <div className="bg-secondary rounded-2xl p-4 mb-4 space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-foreground/10">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">🩺</div>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{selectedDoctor.name}</div>
                  <div className="text-[11px] text-muted-foreground">{selectedSpecialty}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">📅 Data</span>
                  <span className="text-foreground font-medium capitalize">{format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
                </div>
                {selectedSlotTime && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">🕐 Horário</span>
                    <span className="text-foreground font-medium">{selectedSlotTime}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">📞 Modo</span>
                  <span className="text-foreground font-medium">{consultMode === "online" ? "Online (Vídeo)" : consultMode === "presencial" ? "Presencial" : "Primeiro disponível"}</span>
                </div>
                {selectedDoctor.consultation_price != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💰 Valor</span>
                    <span className="text-foreground font-semibold">R$ {selectedDoctor.consultation_price.toFixed(2)}</span>
                  </div>
                )}
                {selectedDoctor.full_address && consultMode === "presencial" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">📍 Local</span>
                    <span className="text-foreground font-medium text-right max-w-[60%]">{selectedDoctor.full_address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Patient notes */}
            <div className="mb-4 space-y-1">
              <Label className="text-xs text-muted-foreground">📝 Descreva seus sintomas (opcional)</Label>
              <Textarea
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                placeholder="Ex: Dor de cabeça há 3 dias, febre baixa..."
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 mb-4">
              <p className="text-[11px] text-foreground leading-relaxed">
                {consultMode === "online"
                  ? "📹 Você receberá um link para a teleconsulta via Jitsi Meet no horário agendado."
                  : "📍 Compareça ao endereço no dia e horário agendados. Leve um documento de identificação."
                }
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={booking}
              className="w-full py-3 rounded-xl border-none text-[13px] font-semibold text-primary-foreground cursor-pointer disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" }}
            >
              {booking ? "Agendando..." : "✅ Confirmar agendamento"}
            </button>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === "done" && (
          <div className="px-5 pt-8 text-center">
            <span className="text-5xl block mb-4">🎉</span>
            <h3 className="font-display text-xl font-medium text-foreground mb-2">Consulta agendada!</h3>
            <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">
              Sua consulta com <strong>{selectedDoctor?.name}</strong> em <strong>{selectedSpecialty}</strong> foi registrada.
            </p>
            {consultMode === "online" && (
              <p className="text-xs text-muted-foreground mb-2">
                📹 O link da teleconsulta será enviado antes do horário agendado.
              </p>
            )}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 mx-auto max-w-sm text-left">
              <p className="text-[11px] text-foreground font-medium mb-1">📋 Prontuário digital</p>
              <p className="text-[10px] text-muted-foreground">O registro desta consulta ficará disponível no seu histórico de saúde após o atendimento.</p>
            </div>
            <button onClick={onBack} className="px-6 py-2.5 rounded-xl border-none bg-primary text-primary-foreground text-[13px] font-semibold cursor-pointer">
              Voltar ao início
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
