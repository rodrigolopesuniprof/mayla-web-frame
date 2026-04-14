import { useState, useEffect, useCallback } from "react";
import { TopBar } from "./TopBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, Calendar, Search, Clock, CheckCircle, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type Step = "specialities" | "professionals" | "calendar" | "confirm" | "done";

interface Speciality {
  id: number;
  name: string;
}

interface Office {
  id: number;
  name: string;
}

interface Professional {
  id: number;
  name: string;
  speciality?: string;
  officeName?: string;
  officeId?: number;
}

interface Slot {
  date: string;
  time: string;
  available: boolean;
  raw?: any;
}

interface Connection {
  id: string;
  external_professional_id: string;
  external_professional_name: string | null;
  external_clinic_name: string | null;
  report_token: string;
  active: boolean;
}

async function proxyCall(action: string, params: Record<string, string> = {}, method = "GET", body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const qs = new URLSearchParams({ action, ...params }).toString();
  const url = `https://${projectId}.supabase.co/functions/v1/prontuario-proxy?${qs}`;

  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

export function ProntuarioConveniado({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("specialities");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Data
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [allProfessionalsRaw, setAllProfessionalsRaw] = useState<any[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<Speciality | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProf, setSelectedProf] = useState<Professional | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load specialities + offices on mount
  useEffect(() => {
    loadSpecialities();
    loadOffices();
    loadConnections();
    loadPatientId();
  }, []);

  const loadSpecialities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await proxyCall("specialities");
      const rawList = Array.isArray(data) ? data : (Array.isArray(data?.result) ? data.result : []);
      // Deduplicate by specialization_id
      const specMap = new Map<number, Speciality>();
      rawList.forEach((item: any) => {
        const id = item.specialization_id ?? item.id;
        const name = item.specialization_name ?? item.name;
        if (id != null && name && !specMap.has(id)) {
          specMap.set(id, { id, name });
        }
      });
      setSpecialities(Array.from(specMap.values()));
      setAllProfessionalsRaw(rawList);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadOffices = async () => {
    try {
      const data = await proxyCall("offices");
      const rawList = Array.isArray(data) ? data : (Array.isArray(data?.result) ? data.result : []);
      const mapped: Office[] = rawList.map((o: any) => ({ id: o.id, name: o.name || `Office ${o.id}` }));
      setOffices(mapped);
    } catch { /* offices may fail silently */ }
  };

  const loadConnections = async () => {
    try {
      const data = await proxyCall("my_connections");
      setConnections(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  const loadPatientId = async () => {
    try {
      const data = await proxyCall("patient");
      const result = data?.result ?? data;
      const patient = Array.isArray(result) ? result[0] : result;
      if (patient?.id) setPatientId(String(patient.id));
    } catch { /* patient may not exist yet */ }
  };

  const searchProfessionals = (spec: Speciality) => {
    setSelectedSpec(spec);
    setStep("professionals");
    setError(null);

    // Filter from cached data instead of calling the timeout-prone API
    const filtered = allProfessionalsRaw.filter((p: any) => {
      const specId = p.specialization_id ?? p.id;
      return specId === spec.id;
    });

    const mapped: Professional[] = filtered.map((p: any) => ({
      id: p.user_id ?? p.id,
      name: p.full_name ?? p.name ?? "",
      speciality: p.specialization_name ?? p.speciality ?? "",
      officeName: p.office_name ?? p.officeName ?? "",
      officeId: p.office_id ?? p.officeId,
    }));

    setProfessionals(mapped);
  };

  const loadCalendar = async (prof: Professional) => {
    setSelectedProf(prof);
    setStep("calendar");
    setLoading(true);
    setError(null);
    try {
      const parsed: Slot[] = [];
      // Use real office IDs; if prof has one use it, otherwise try all loaded offices
      const officeIds = prof.officeId ? [prof.officeId] : offices.map(o => o.id);
      if (officeIds.length === 0) officeIds.push(1); // ultimate fallback

      for (const oid of officeIds) {
        try {
          const data = await proxyCall("calendar", { professionalId: String(prof.id), officeId: String(oid) });
          const calList = Array.isArray(data) ? data : (Array.isArray(data?.result) ? data.result : []);
          const officeName = offices.find(o => o.id === oid)?.name || "";
          calList.forEach((day: any) => {
            if (day.slots && Array.isArray(day.slots)) {
              day.slots.forEach((s: any) => {
                parsed.push({ date: day.date || "", time: s.time || s.startTime || "", available: s.available !== false, raw: { ...s, officeName } });
              });
            } else if (day.date && day.time) {
              parsed.push({ date: day.date, time: day.time, available: true, raw: { ...day, officeName } });
            }
          });
        } catch { /* skip this office */ }
      }
      setSlots(parsed);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const confirmAppointment = async () => {
    if (!selectedProf || !selectedSlot) return;
    setLoading(true);
    setError(null);
    try {
      // Register on Meddit
      await proxyCall("register", {}, "POST", {
        professionalId: selectedProf.id,
        patientId: patientId,
        date: selectedSlot.date,
        time: selectedSlot.time,
        ...(selectedSlot.raw || {}),
      });

      // Also save locally in appointments table
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
        await supabase.from("appointments").insert({
          user_id: user.id,
          specialty: selectedSpec?.name || "Prontuário Conveniado",
          appointment_date: `${selectedSlot.date}T${selectedSlot.time}:00`,
          doctor_name: selectedProf.name,
          clinic_name: selectedProf.officeName || null,
          status: "scheduled",
          company_id: profile?.company_id || null,
          notes: "Agendamento via Prontuário Conveniado (Meddit)",
        });
      }

      setStep("done");
      toast({ title: "Consulta agendada com sucesso!" });
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Erro ao agendar", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const toggleFavorite = async (prof: Professional) => {
    const existing = connections.find(c => c.external_professional_id === String(prof.id));
    try {
      if (existing) {
        await proxyCall("unfavorite", {}, "POST", { external_professional_id: prof.id });
        setConnections(prev => prev.filter(c => c.external_professional_id !== String(prof.id)));
        toast({ title: "Autorização removida" });
      } else {
        const data = await proxyCall("favorite", {}, "POST", {
          external_professional_id: prof.id,
          external_professional_name: prof.name,
          external_clinic_name: prof.officeName || null,
          external_patient_id: patientId,
        });
        if (data?.connection) {
          setConnections(prev => [...prev, data.connection]);
        }
        toast({ title: "Médico autorizado!", description: "Relatório de saúde compartilhado permanentemente." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const isFavorited = useCallback((profId: number) => {
    return connections.some(c => c.external_professional_id === String(profId) && c.active);
  }, [connections]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar
        title={step === "specialities" ? "Prontuário Conveniado" : step === "professionals" ? (selectedSpec?.name || "Profissionais") : step === "calendar" ? (selectedProf?.name || "Agenda") : step === "confirm" ? "Confirmar" : "Agendado!"}
        onBack={step === "specialities" ? onBack : () => {
          if (step === "professionals") setStep("specialities");
          else if (step === "calendar") setStep("professionals");
          else if (step === "confirm") setStep("calendar");
          else onBack();
        }}
      />

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* STEP: Specialities */}
        {step === "specialities" && !loading && (
          <>
            <p className="text-sm text-muted-foreground">Escolha uma especialidade para buscar profissionais conveniados.</p>
            {specialities.length === 0 && !error && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma especialidade disponível.</p>
            )}
            {specialities.map(spec => (
              <button
                key={spec.id}
                onClick={() => searchProfessionals(spec)}
                className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left hover:bg-secondary/50 transition-colors"
              >
                <span className="text-2xl">🩺</span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-foreground">{spec.name}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </>
        )}

        {/* STEP: Professionals */}
        {step === "professionals" && !loading && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && selectedSpec) searchProfessionals(selectedSpec); }}
                className="pl-10"
              />
            </div>
            {professionals.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && !error && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum profissional encontrado.</p>
            )}
            {professionals.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(prof => (
              <div
                key={prof.id}
                className="rounded-2xl p-4 border border-border bg-card flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {prof.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadCalendar(prof)}>
                  <div className="text-[15px] font-semibold text-foreground truncate">{prof.name}</div>
                  {prof.speciality && <div className="text-xs text-muted-foreground">{prof.speciality}</div>}
                  {prof.officeName && <div className="text-xs text-muted-foreground">{prof.officeName}</div>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(prof); }}
                  className="p-2 rounded-full bg-transparent border-none cursor-pointer"
                >
                  <Heart className={`w-5 h-5 ${isFavorited(prof.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                </button>
                <button
                  onClick={() => loadCalendar(prof)}
                  className="p-2 rounded-full bg-transparent border-none cursor-pointer"
                >
                  <Calendar className="w-5 h-5 text-primary" />
                </button>
              </div>
            ))}
          </>
        )}

        {/* STEP: Calendar */}
        {step === "calendar" && !loading && (
          <>
            <p className="text-sm text-muted-foreground">Horários disponíveis para {selectedProf?.name}:</p>
            {slots.length === 0 && !error && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum horário disponível no momento.</p>
            )}
            {slots.filter(s => s.available).map((slot, i) => (
              <button
                key={i}
                onClick={() => { setSelectedSlot(slot); setStep("confirm"); }}
                className={`w-full rounded-2xl p-4 border bg-card flex items-center gap-4 cursor-pointer text-left hover:bg-secondary/50 transition-colors ${selectedSlot === slot ? "border-primary" : "border-border"}`}
              >
                <Clock className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <div className="text-[15px] font-semibold text-foreground">
                    {slot.date ? new Date(slot.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) : "Data"}
                  </div>
                  <div className="text-sm text-muted-foreground">{slot.time}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </>
        )}

        {/* STEP: Confirm */}
        {step === "confirm" && !loading && selectedProf && selectedSlot && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 border-2 border-primary/20 bg-primary/5 space-y-3">
              <h3 className="text-base font-semibold text-foreground">Confirmar agendamento</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profissional</span>
                  <span className="font-medium text-foreground">{selectedProf.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Especialidade</span>
                  <span className="font-medium text-foreground">{selectedSpec?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <span className="font-medium text-foreground">
                    {selectedSlot.date ? new Date(selectedSlot.date).toLocaleDateString("pt-BR") : "--"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horário</span>
                  <span className="font-medium text-foreground">{selectedSlot.time}</span>
                </div>
              </div>
            </div>
            <Button className="w-full h-12 text-base" onClick={confirmAppointment}>
              Confirmar consulta
            </Button>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center py-12 gap-4">
            <CheckCircle className="w-16 h-16 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Consulta agendada!</h3>
            <p className="text-sm text-muted-foreground text-center">
              Sua consulta com {selectedProf?.name} foi registrada com sucesso.
            </p>
            <Button variant="outline" onClick={onBack} className="mt-4">
              Voltar aos serviços
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
