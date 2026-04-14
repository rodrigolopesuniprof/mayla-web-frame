import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { proxyCall } from "@/lib/prontuario-helpers";
import { useCompany } from "@/contexts/CompanyContext";
import { TopBar } from "./TopBar";
import { JitsiConsultationScreen } from "./JitsiConsultationScreen";
import { WaitingRoom } from "./WaitingRoom";
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
  partner_type: string;
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
  notification_email: string | null;
  email: string | null;
  specialties_offered: string[] | null;
  // Meddit source fields
  source?: "internal" | "meddit";
  meddit_id?: number;
  meddit_office_id?: number;
  meddit_office_name?: string;
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
  specialty: string | null;
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

type Step = "specialty" | "mode" | "doctors" | "schedule" | "confirm" | "done" | "video_call" | "waiting_room";
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

/* ── SpecialtyStep: loads specialties from internal DB + Meddit API ── */
function SpecialtyStep({ onSelect, user }: { onSelect: (s: string, medditId?: number) => void; user: any }) {
  const [dbSpecialties, setDbSpecialties] = useState<string[]>([]);
  const [medditSpecialties, setMedditSpecialties] = useState<{ id: number; name: string }[]>([]);
  const [featureFlags, setFeatureFlags] = useState<{ internos: boolean; externos: boolean }>({ internos: true, externos: true });
  const [loadingSpecs, setLoadingSpecs] = useState(true);

  useEffect(() => {
    const load = async () => {
      // 1. Check feature flags
      let internos = true, externos = true;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
        if (profile?.company_id) {
          const { data: features } = await supabase
            .from("company_features")
            .select("feature_key, enabled")
            .eq("company_id", profile.company_id)
            .in("feature_key", ["consulta_medicos_internos", "consulta_medicos_externos"]);
          if (features) {
            for (const f of features) {
              if (f.feature_key === "consulta_medicos_internos" && f.enabled === false) internos = false;
              if (f.feature_key === "consulta_medicos_externos" && f.enabled === false) externos = false;
            }
          }
        }
      }
      setFeatureFlags({ internos, externos });

      // 2. Load specialties in parallel
      const promises: Promise<any>[] = [];

      if (internos) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("partners")
              .select("specialty")
              .eq("active", true)
              .eq("approval_status", "approved")
              .not("specialty", "is", null);
            if (data) {
              const unique = [...new Set(data.map((p: any) => (p.specialty as string).trim()).filter(Boolean))];
              setDbSpecialties(unique);
            }
          })()
        );
      }

      if (externos && user) {
        promises.push(
          proxyCall("specialities")
            .then((data: any) => {
              if (Array.isArray(data)) {
                setMedditSpecialties(data.map((s: any) => ({ id: s.id, name: s.name })));
              }
            })
            .catch((err) => {
              console.warn("Failed to load Meddit specialties:", err);
            })
        );
      }

      await Promise.all(promises);
      setLoadingSpecs(false);
    };
    load();
  }, [user]);

  // Merge hardcoded + DB + Meddit specialties without duplicates
  const merged = useMemo(() => {
    const hardcodedMap = new Map(SPECIALTIES.map(s => [s.value.toLowerCase(), s]));
    const result: { value: string; emoji: string; medditId?: number }[] = [...SPECIALTIES];
    const seen = new Set(SPECIALTIES.map(s => s.value.toLowerCase()));

    // Add internal DB specialties
    if (featureFlags.internos) {
      for (const spec of dbSpecialties) {
        if (!seen.has(spec.toLowerCase())) {
          result.push({ value: spec, emoji: "🩺" });
          seen.add(spec.toLowerCase());
        }
      }
    }

    // Add Meddit specialties
    if (featureFlags.externos) {
      for (const ms of medditSpecialties) {
        const key = ms.name.toLowerCase();
        if (!seen.has(key)) {
          result.push({ value: ms.name, emoji: "🏥", medditId: ms.id });
          seen.add(key);
        } else {
          // attach medditId to existing entry
          const existing = result.find(r => r.value.toLowerCase() === key);
          if (existing && !existing.medditId) existing.medditId = ms.id;
        }
      }
    }

    return result;
  }, [dbSpecialties, medditSpecialties, featureFlags]);

  if (loadingSpecs) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-3">
      <h3 className="font-display text-lg font-medium text-foreground mb-1">Escolha a especialidade</h3>
      <p className="text-xs text-muted-foreground mb-4">Qual tipo de consulta você precisa?</p>
      <div className="grid grid-cols-2 gap-2">
        {merged.map((s) => (
          <button
            key={s.value}
            onClick={() => onSelect(s.value, s.medditId)}
            className="flex items-center gap-3 p-3.5 bg-card rounded-2xl border border-border hover:border-primary/40 transition-colors cursor-pointer text-left"
          >
            <span className="text-xl">{s.emoji}</span>
            <span className="text-[13px] font-semibold text-foreground">{s.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

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
export function ConsultationFlow({ onBack, initialMode }: { onBack: () => void; initialMode?: ConsultMode }) {
  const { user } = useAuth();
  const { company } = useCompany();

  const [step, setStep] = useState<Step>("mode");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [medditSpecialtyId, setMedditSpecialtyId] = useState<number | null>(null);
  const [consultMode, setConsultMode] = useState<ConsultMode | null>(initialMode || null);
  const [waitingConsultationId, setWaitingConsultationId] = useState<string | null>(null);
  const [waitingStatus, setWaitingStatus] = useState<string>("confirmed");
  const [waitingSeconds, setWaitingSeconds] = useState(0);
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
  const [expandedDoctorId, setExpandedDoctorId] = useState<string | null>(null);
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null);
  const [activeRoomToken, setActiveRoomToken] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

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

  // Load favorited doctor IDs
  useEffect(() => {
    if (!user) return;
    supabase
      .from("prontuario_connections")
      .select("internal_partner_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .not("internal_partner_id", "is", null)
      .then(({ data }) => {
        if (data) setFavoritedIds(new Set(data.map((d: any) => d.internal_partner_id)));
      });
  }, [user]);

  const handleFavoriteDoctor = async (doctor: Doctor) => {
    if (!user) return;
    if (favoritedIds.has(doctor.id)) {
      toast({ title: "Médico já favoritado", description: "Este médico já está na sua lista de favoritos." });
      return;
    }
    const reportToken = crypto.randomUUID();
    const { error } = await supabase.from("prontuario_connections").insert({
      user_id: user.id,
      external_system: "mayla",
      source_type: "mayla_partner",
      external_professional_id: doctor.id,
      external_professional_name: doctor.name,
      internal_partner_id: doctor.id,
      report_token: reportToken,
      company_id: (company as any)?.id || null,
    } as any);
    if (error) {
      toast({ title: "Erro ao favoritar", description: error.message, variant: "destructive" });
    } else {
      setFavoritedIds(prev => new Set([...prev, doctor.id]));
      toast({ title: "⭐ Médico favoritado!", description: `${doctor.name} agora pode acompanhar seus dados de saúde.` });
    }
  };

  // Fetch doctors + locations + availability when specialty + mode selected
  useEffect(() => {
    if (!selectedSpecialty || !consultMode) return;
    setLoading(true);

    const fetchData = async () => {
      // Check feature flags for internal/external
      let loadInternal = true, loadExternal = true;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
        if (profile?.company_id) {
          const { data: features } = await supabase
            .from("company_features")
            .select("feature_key, enabled")
            .eq("company_id", profile.company_id)
            .in("feature_key", ["consulta_medicos_internos", "consulta_medicos_externos"]);
          if (features) {
            for (const f of features) {
              if (f.feature_key === "consulta_medicos_internos" && f.enabled === false) loadInternal = false;
              if (f.feature_key === "consulta_medicos_externos" && f.enabled === false) loadExternal = false;
            }
          }
        }
      }

      let allProviders: Doctor[] = [];

      // Internal partners
      if (loadInternal) {
        let qDoctors = supabase
          .from("partners")
          .select("*")
          .eq("partner_type", "doctor")
          .eq("active", true)
          .eq("approval_status", "approved")
          .ilike("specialty", `%${selectedSpecialty}%`);

        if (consultMode === "online") {
          qDoctors = qDoctors.eq("online_consultation_enabled", true);
        }

        const qClinics = supabase
          .from("partners")
          .select("*")
          .eq("partner_type", "clinic")
          .eq("active", true)
          .eq("approval_status", "approved");

        const [{ data: docs }, { data: clinics }, { data: locs }, { data: avail }] = await Promise.all([
          qDoctors,
          qClinics,
          supabase.from("partner_locations").select("*"),
          supabase.from("doctor_availability").select("*").eq("is_active", true),
        ]);

        const clinicIds = new Set((avail || [])
          .filter(a => a.specialty && a.specialty.toLowerCase().includes(selectedSpecialty!.toLowerCase()))
          .map(a => a.partner_id));

        const matchingClinics = (clinics || []).filter(c => {
          if (clinicIds.has(c.id)) return true;
          const offered = c.specialties_offered as string[] | null;
          return offered?.some(s => s.toLowerCase().includes(selectedSpecialty!.toLowerCase()));
        });

        const internalDocs = [...(docs || []), ...matchingClinics].map(d => ({ ...d, source: "internal" as const }));
        allProviders.push(...(internalDocs as Doctor[]));
        setDoctorLocations((locs as DoctorLocation[]) || []);
        setAvailability((avail as AvailSlot[]) || []);
      }

      // External Meddit professionals
      if (loadExternal && user && medditSpecialtyId) {
        try {
          const profs = await proxyCall("professionals", { specialityId: String(medditSpecialtyId) });
          if (Array.isArray(profs)) {
            const medditDocs: Doctor[] = profs.map((p: any) => ({
              id: `meddit-${p.id}`,
              name: p.name,
              partner_type: "doctor",
              specialty: selectedSpecialty,
              consultation_type: null,
              consultation_price: null,
              online_consultation_enabled: false,
              city: null,
              state: null,
              full_address: p.officeName || null,
              latitude: null,
              longitude: null,
              crm: null,
              crm_state: null,
              contact_link: null,
              phone: null,
              description: null,
              logo_url: null,
              notification_email: null,
              email: null,
              specialties_offered: null,
              source: "meddit" as const,
              meddit_id: p.id,
              meddit_office_id: p.officeId,
              meddit_office_name: p.officeName,
            }));
            allProviders.push(...medditDocs);
          }
        } catch (err) {
          console.warn("Failed to load Meddit professionals:", err);
        }
      }

      setDoctors(allProviders);
      setLoading(false);
    };

    fetchData();
  }, [selectedSpecialty, consultMode, medditSpecialtyId, user]);

  // Enrich doctors with distance for presencial
  const enrichedDoctors = useMemo(() => {
    return doctors.map((d) => {
      const locs = doctorLocations.filter((l) => l.partner_id === d.id && l.latitude != null && l.longitude != null);
      let bestLat = d.latitude, bestLng = d.longitude, bestDist = Infinity;
      
      if (locs.length > 0 && userPos) {
        for (const loc of locs) {
          const dist = haversine(userPos[0], userPos[1], loc.latitude!, loc.longitude!);
          if (dist < bestDist) { bestDist = dist; bestLat = loc.latitude; bestLng = loc.longitude; }
        }
      } else if (bestLat != null && bestLng != null && userPos) {
        bestDist = haversine(userPos[0], userPos[1], bestLat, bestLng);
      }

      return { ...d, display_lat: bestLat ?? undefined, display_lng: bestLng ?? undefined, distance: bestDist };
    }).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  }, [doctors, doctorLocations, userPos]);

  // Doctor/clinic availability slots - for clinics, filter by selected specialty
  const doctorSlots = useMemo(() => {
    if (!selectedDoctor) return [];
    const partnerSlots = availability.filter((a) => a.partner_id === selectedDoctor.id);
    // For clinics, only show slots matching the selected specialty
    if (selectedDoctor.partner_type === "clinic" && selectedSpecialty) {
      const specLower = selectedSpecialty.toLowerCase();
      const filtered = partnerSlots.filter(s => s.specialty && s.specialty.toLowerCase().includes(specLower));
      return filtered.length > 0 ? filtered : partnerSlots; // fallback to all if no specialty-tagged slots
    }
    return partnerSlots;
  }, [selectedDoctor, availability, selectedSpecialty]);

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
  const handleSelectSpecialty = (s: string, medditId?: number) => {
    setSelectedSpecialty(s);
    setMedditSpecialtyId(medditId ?? null);
    setStep("doctors");
  };

  const handleSelectMode = (mode: ConsultMode) => {
    setConsultMode(mode);
    setStep("specialty");
  };

  const handleSelectDoctor = (d: Doctor) => {
    setSelectedDoctor(d);
    setSelectedDate(null);
    setSelectedSlotTime(null);
    setCurrentMonth(new Date());
    // Toggle expansion inline instead of going to schedule step
    setExpandedDoctorId(prev => prev === d.id ? null : d.id);
    setMapSelectedId(d.id);
  };

  /** Pick a time slot from the inline expanded card → go directly to confirm */
  const handleInlineSlotSelect = (doctor: Doctor, tw: TimeWindow, weekday: number) => {
    setSelectedDoctor(doctor);
    const nextDate = getNextDateForWeekday(weekday);
    setSelectedDate(nextDate);
    setSelectedSlotTime(`${tw.start} – ${tw.end}`);
    setStep("confirm");
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

  const handleFirstAvailable = async () => {
    if (!user || !selectedSpecialty) return;
    setLoading(true);

    // Find online professionals — check both on_demand AND just online
    const { data: onlineProfs } = await supabase
      .from("professional_online_status")
      .select("professional_id, estimated_response_minutes, max_parallel_waiting, accepts_on_demand, always_available")
      .or("online_now.eq.true,always_available.eq.true")
      .order("estimated_response_minutes", { ascending: true });

    console.log("[FirstAvailable] Online profs found:", onlineProfs?.length, onlineProfs);

    if (!onlineProfs || onlineProfs.length === 0) {
      setLoading(false);
      toast({ title: "Nenhum profissional online", description: "Nenhum médico está disponível agora. Tente novamente em alguns minutos ou escolha um horário agendado.", variant: "destructive" });
      return;
    }

    // Filter to those accepting on-demand or always available
    const acceptingProfs = onlineProfs.filter(p => p.accepts_on_demand || p.always_available);
    console.log("[FirstAvailable] Accepting on-demand:", acceptingProfs.length);

    if (acceptingProfs.length === 0) {
      setLoading(false);
      toast({ title: "Nenhum profissional aceitando atendimento imediato", description: "Profissionais estão online mas não aceitam atendimento imediato no momento.", variant: "destructive" });
      return;
    }

    const profIds = acceptingProfs.map((p) => p.professional_id);

    // Filter by specialty — match on specialty field OR specialties_offered array
    const { data: matchingPartners } = await supabase
      .from("partners")
      .select("id, name, specialty, partner_type, specialties_offered")
      .in("id", profIds)
      .eq("active", true)
      .eq("approval_status", "approved");

    console.log("[FirstAvailable] All active partners in online pool:", matchingPartners?.length, matchingPartners);

    // Client-side specialty filter (more flexible than ilike)
    const specLower = selectedSpecialty.toLowerCase();
    const filtered = (matchingPartners || []).filter(p => {
      if (p.specialty && p.specialty.toLowerCase().includes(specLower)) return true;
      const offered = p.specialties_offered as string[] | null;
      if (offered?.some(s => s.toLowerCase().includes(specLower))) return true;
      // Fallback: "Clínico Geral" matches any doctor
      if (specLower.includes("clínico") || specLower.includes("clinico")) return true;
      return false;
    });

    console.log("[FirstAvailable] After specialty filter:", filtered.length, filtered);

    if (filtered.length === 0) {
      setLoading(false);
      toast({ title: "Nenhum especialista online", description: `Nenhum profissional de ${selectedSpecialty} está online agora.`, variant: "destructive" });
      return;
    }

    // Count current queue per professional
    const { data: activeConsults } = await supabase
      .from("consultations")
      .select("professional_id")
      .in("status", ["waiting", "confirmed"] as any[])
      .eq("consultation_flow_type", "on_demand" as any)
      .in("professional_id", profIds);

    const queueMap: Record<string, number> = {};
    (activeConsults || []).forEach((c: any) => {
      queueMap[c.professional_id] = (queueMap[c.professional_id] || 0) + 1;
    });

    // Score and pick best
    const scored = filtered
      .map((p) => {
        const status = acceptingProfs.find((o) => o.professional_id === p.id);
        const queue = queueMap[p.id] || 0;
        const maxWaiting = status?.max_parallel_waiting || 3;
        if (queue >= maxWaiting) return null;
        return {
          ...p,
          queue,
          estimated_response_minutes: status?.estimated_response_minutes || 15,
          score: queue * 10 + (status?.estimated_response_minutes || 15),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score - b!.score);

    if (scored.length === 0) {
      setLoading(false);
      toast({ title: "Todos os profissionais ocupados", description: "Tente novamente em alguns minutos.", variant: "destructive" });
      return;
    }

    const best = scored[0]!;
    const queuePos = best.queue + 1;

    // Create on-demand consultation
    const insertPayload: any = {
      user_id: user.id,
      professional_id: best.id,
      professional_type: best.partner_type === "doctor" ? "doctor" : "nurse",
      specialty: selectedSpecialty,
      consultation_mode: "online",
      consultation_flow_type: "on_demand" as any,
      status: "waiting" as any,
      join_window_starts_at: new Date().toISOString(),
      queue_position: queuePos,
      triage_notes: patientNotes || "Primeiro disponível — atendimento imediato",
    };
    if ((company as any)?.id) insertPayload.company_id = (company as any).id;

    const { data: consultData, error } = await supabase
      .from("consultations")
      .insert(insertPayload)
      .select("id, room_token")
      .single();

    setLoading(false);

    if (error || !consultData?.id) {
      console.error("Erro ao criar consulta primeiro disponível:", error);
      toast({ title: "Erro ao criar consulta", description: error?.message || "Tente novamente.", variant: "destructive" });
      return;
    }

    // Go to waiting room
    setSelectedDoctor({ id: best.id, name: best.name, specialty: best.specialty } as Doctor);
    setWaitingConsultationId(consultData.id);
    setActiveRoomToken((consultData as any).room_token || null);
    setStep("waiting_room");
    toast({ title: "Profissional encontrado! ⚡", description: `${best.name} foi notificado e atenderá você em breve.` });
  };

  const handleConfirm = async () => {
    if (!user || !selectedDoctor || !selectedDate || !selectedSpecialty) return;
    setBooking(true);

    const appointmentDate = selectedSlotTime
      ? `${format(selectedDate, "yyyy-MM-dd")}T${selectedSlotTime.split(" – ")[0]}:00`
      : format(selectedDate, "yyyy-MM-dd'T'09:00:00");

    const clinicLabel = selectedDoctor.partner_type === "clinic"
      ? selectedDoctor.name
      : selectedDoctor.city ? `${selectedDoctor.city} - ${selectedDoctor.state}` : null;

    const isOnline = consultMode === "online" || consultMode === "first_available";

    const { data: apptData, error } = await supabase.from("appointments").insert({
      user_id: user.id,
      specialty: selectedSpecialty,
      appointment_date: appointmentDate,
      doctor_name: selectedDoctor.name,
      clinic_name: clinicLabel,
      company_id: (company as any)?.id || null,
      notes: patientNotes || null,
      status: "scheduled",
    }).select("id").single();

    if (error) {
      setBooking(false);
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
      return;
    }

    // For online consultations, also create a consultations record and go to video call
    if (isOnline) {
      // join_window_starts_at = 15 minutes before scheduled time
      const scheduledDate = new Date(appointmentDate);
      const joinWindowStart = new Date(scheduledDate.getTime() - 15 * 60 * 1000);

      const { data: consultData2, error: consultError } = await supabase
        .from("consultations")
        .insert({
          user_id: user.id,
          professional_id: selectedDoctor.id,
          professional_type: "doctor" as any,
          specialty: selectedSpecialty,
          consultation_mode: "online",
          consultation_flow_type: "scheduled" as any,
          status: "confirmed" as any,
          scheduled_at: appointmentDate,
          join_window_starts_at: joinWindowStart.toISOString(),
          triage_notes: patientNotes || null,
          company_id: (company as any)?.id || null,
        } as any)
        .select("id, room_token")
        .single();

      setBooking(false);

      if (consultError) {
        console.warn("Consultation record failed:", consultError.message);
        toast({ title: "Consulta agendada! ✅", description: "Mas houve um erro ao criar a sala de vídeo." });
        setStep("done");
      } else {
        // Go to waiting room instead of done
        setWaitingConsultationId(consultData2?.id || null);
        setActiveRoomToken((consultData2 as any)?.room_token || null);
        setWaitingStatus("confirmed");
        setWaitingSeconds(0);
        toast({ title: "Consulta online agendada! ✅" });
        setStep("waiting_room");
      }
    } else {
      setBooking(false);
      toast({ title: "Consulta agendada! ✅" });
      setStep("done");
    }

    // Send email notification (fire and forget)
    if (apptData?.id) {
      supabase.functions.invoke("notify-appointment", {
        body: { appointment_id: apptData.id },
      }).catch(err => console.warn("Email notification failed:", err));
    }
  };

  const goBack = () => {
    if (step === "specialty") { setStep("mode"); setConsultMode(null); }
    else if (step === "doctors") {
      if (expandedDoctorId) { setExpandedDoctorId(null); }
      else { setStep("specialty"); setSelectedSpecialty(null); }
    }
    else if (step === "schedule") { setStep("doctors"); setSelectedDoctor(null); }
    else if (step === "confirm") { setStep("doctors"); setSelectedSlotTime(null); setExpandedDoctorId(selectedDoctor?.id ?? null); }
    else if (step === "video_call") { setStep("done"); }
    else if (step === "waiting_room") { setStep("done"); }
    else if (step === "mode") onBack();
    else onBack();
  };

  const stepLabels = ["Modo", "Especialidade", "Médico", "Horário", "Confirmar"];
  const stepKeys: Step[] = ["mode", "specialty", "doctors", "schedule", "confirm"];
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

        {/* ── Step: Mode (now first) ── */}
        {step === "mode" && (
          <div className="px-5 pt-3">
            <h3 className="font-display text-lg font-medium text-foreground mb-1">Como deseja realizar a consulta?</h3>
            <p className="text-xs text-muted-foreground mb-4">Escolha o modo de atendimento</p>
            <div className="space-y-3">
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
            </div>
          </div>
        )}

        {/* ── Step: Specialty (now second) ── */}
        {step === "specialty" && (
          <SpecialtyStep onSelect={handleSelectSpecialty} user={user} />
        )}

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
                <Button variant="outline" size="sm" className="mt-4" onClick={goBack}>Voltar</Button>
              </div>
            ) : (
              <>
                {/* Map — always show when we have user position */}
                {userPos && (
                  <div className="h-[35vh] min-h-[200px] shrink-0">
                    <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-secondary"><p className="text-xs text-muted-foreground">Carregando mapa...</p></div>}>
                      <LazyMap
                        center={mapCenter}
                        userPos={userPos}
                        userIcon={userIcon}
                        doctors={enrichedDoctors.filter(d => d.display_lat != null && d.display_lng != null)}
                        mapSelectedId={mapSelectedId}
                        createDoctorIcon={createDoctorIcon}
                        onPinClick={(id) => {
                          const doc = enrichedDoctors.find(d => d.id === id);
                          if (doc) handleSelectDoctor(doc);
                          document.getElementById(`doc-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }}
                      />
                    </Suspense>
                  </div>
                )}

                {/* First available — immediate matching */}
                {consultMode === "first_available" && (
                  <div className="px-5 pt-3">
                    <button
                      onClick={handleFirstAvailable}
                      disabled={loading}
                      className="w-full rounded-2xl p-4 border-2 border-primary/30 bg-primary/5 flex items-center gap-4 cursor-pointer text-left mb-3 disabled:opacity-50"
                    >
                      <span className="text-3xl">{loading ? "⏳" : "⚡"}</span>
                      <div className="flex-1">
                        <div className="text-[15px] font-semibold text-foreground">
                          {loading ? "Buscando profissional..." : "Conectar com o primeiro disponível"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {loading ? "Procurando médicos online agora..." : "Conecta você imediatamente com um médico online"}
                        </div>
                      </div>
                    </button>
                    <p className="text-xs text-muted-foreground mb-2">Ou escolha um médico abaixo para agendar:</p>
                  </div>
                )}

                {/* Doctor list with expandable cards */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{enrichedDoctors.length} profissional(is) encontrado(s)</p>
                  {enrichedDoctors.map((d) => {
                    const isExpanded = expandedDoctorId === d.id;
                    const docSlots = availability.filter(a => a.partner_id === d.id && a.is_active);
                    // For clinics, filter by selected specialty
                    const filteredSlots = d.partner_type === "clinic" && selectedSpecialty
                      ? (() => {
                          const specLower = selectedSpecialty.toLowerCase();
                          const sf = docSlots.filter(s => s.specialty && s.specialty.toLowerCase().includes(specLower));
                          return sf.length > 0 ? sf : docSlots;
                        })()
                      : docSlots;
                    // Group slots by weekday for inline display
                    const slotsByWeekday = filteredSlots.reduce<Record<number, TimeWindow[]>>((acc, slot) => {
                      const windows = splitIntoWindows(slot);
                      if (!acc[slot.weekday]) acc[slot.weekday] = [];
                      acc[slot.weekday].push(...windows);
                      return acc;
                    }, {});
                    // Get next 3 available dates
                    const upcomingDays = Object.keys(slotsByWeekday)
                      .map(Number)
                      .sort((a, b) => {
                        const dA = getNextDateForWeekday(a);
                        const dB = getNextDateForWeekday(b);
                        return dA.getTime() - dB.getTime();
                      })
                      .slice(0, 3);

                    return (
                      <div
                        key={d.id}
                        id={`doc-card-${d.id}`}
                        className={`w-full text-left rounded-xl border transition-all ${
                          isExpanded
                            ? "border-primary bg-primary/5 shadow-md"
                            : mapSelectedId === d.id
                            ? "border-primary/50 bg-card shadow-sm"
                            : "border-border bg-card hover:border-primary/30"
                        }`}
                      >
                        {/* Card header — always visible */}
                        <button
                          onClick={() => handleSelectDoctor(d)}
                          className="w-full text-left p-3 cursor-pointer bg-transparent border-none"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                              {d.partner_type === "clinic" ? "🏥" : "🩺"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground truncate">{d.name}</span>
                                {d.source === "meddit" ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                                    🏥 Parceiro
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                                    ⭐ Novo
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {d.partner_type === "clinic" ? "Clínica" : d.specialty}
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {d.distance != null && d.distance < Infinity && (
                                  <span className="text-[10px] text-muted-foreground">📏 {formatDist(d.distance)}</span>
                                )}
                                {d.distance === Infinity && d.city && (
                                  <span className="text-[10px] text-muted-foreground">📍 {d.city}/{d.state}</span>
                                )}
                                {d.consultation_price != null && (
                                  <span className="text-xs font-semibold text-foreground">R$ {d.consultation_price.toFixed(0)}</span>
                                )}
                                {d.online_consultation_enabled && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Online</Badge>
                                )}
                              </div>
                            </div>
                            <span className={`text-muted-foreground text-sm shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>›</span>
                          </div>
                        </button>

                        {/* Expanded: inline time slots */}
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-3">
                            {/* Favorite button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleFavoriteDoctor(d); }}
                              className={`w-full py-2 rounded-xl text-[12px] font-semibold cursor-pointer transition-colors border ${
                                favoritedIds.has(d.id)
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                                  : "bg-card border-border hover:border-amber-500/40 text-foreground"
                              }`}
                            >
                              {favoritedIds.has(d.id) ? "⭐ Favoritado" : "☆ Favoritar médico"}
                            </button>
                            {upcomingDays.length === 0 ? (
                              <div className="text-center py-3">
                                <span className="text-2xl block mb-1">📅</span>
                                <p className="text-xs text-muted-foreground">Sem horários cadastrados.</p>
                                <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => { setSelectedDoctor(d); setStep("schedule"); }}>
                                  Ver agenda completa
                                </Button>
                              </div>
                            ) : (
                              <>
                                <p className="text-[11px] font-medium text-muted-foreground">Próximos horários disponíveis:</p>
                                {upcomingDays.map(weekday => {
                                  const nextDate = getNextDateForWeekday(weekday);
                                  const windows = slotsByWeekday[weekday] || [];
                                  return (
                                    <div key={weekday}>
                                      <p className="text-[11px] font-semibold text-foreground mb-1.5 capitalize">
                                        {WEEKDAY_NAMES[weekday]} ({format(nextDate, "dd/MMM", { locale: ptBR })})
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {windows.map((tw, i) => (
                                          <button
                                            key={i}
                                            onClick={() => handleInlineSlotSelect(d, tw, weekday)}
                                            className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/10 text-foreground transition-colors cursor-pointer"
                                          >
                                            {tw.start}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-primary w-full mt-1"
                                  onClick={() => { setSelectedDoctor(d); setStep("schedule"); }}
                                >
                                  Ver agenda completa →
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

        {/* ── Step: Video Call ── */}
        {step === "video_call" && activeConsultationId && selectedDoctor && selectedSpecialty && (
          <JitsiConsultationScreen
            consultation={{
              id: activeConsultationId,
              roomToken: activeRoomToken || undefined,
              professionalName: selectedDoctor.name,
              professionalType: selectedDoctor.partner_type === "clinic" ? "doctor" : "doctor",
              specialty: selectedSpecialty,
              consultationMode: "online",
            }}
            onLeave={() => setStep("done")}
          />
        )}

        {/* ── Step: Waiting Room ── */}
        {step === "waiting_room" && waitingConsultationId && selectedDoctor && (
          <WaitingRoom
            consultationId={waitingConsultationId}
            doctorName={selectedDoctor.name}
            specialty={selectedSpecialty || ""}
            scheduledAt={selectedDate && selectedSlotTime ? `${format(selectedDate, "yyyy-MM-dd")}T${selectedSlotTime.split(" – ")[0]}:00` : undefined}
            onEnterCall={() => {
              setActiveConsultationId(waitingConsultationId);
              setStep("video_call");
            }}
            onBack={() => setStep("done")}
          />
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
                📹 A teleconsulta foi registrada no seu histórico.
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
