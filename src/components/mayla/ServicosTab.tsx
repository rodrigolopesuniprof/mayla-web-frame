import { useState, useEffect } from "react";
import { TopBar } from "./TopBar";
import { TelemedicineScreen } from "./TelemedicineScreen";
import { AppointmentBooking } from "./AppointmentBooking";
import { HealthPartnersMap } from "./HealthPartnersMap";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type SubView = "menu" | "telemedicine" | "appointment" | "history" | "partners";

interface Appointment {
  id: string;
  specialty: string;
  appointment_date: string;
  status: string;
  doctor_name: string | null;
  clinic_name: string | null;
}

export function ServicosTab() {
  const { user } = useAuth();
  const [subView, setSubView] = useState<SubView>("menu");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (subView === "history" && user) {
      setLoading(true);
      supabase
        .from("appointments")
        .select("id, specialty, appointment_date, status, doctor_name, clinic_name")
        .eq("user_id", user.id)
        .order("appointment_date", { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setAppointments((data as Appointment[]) || []);
          setLoading(false);
        });
    }
  }, [subView, user]);

  if (subView === "telemedicine") {
    return <TelemedicineScreen onBack={() => setSubView("menu")} />;
  }

  if (subView === "appointment") {
    return <AppointmentBooking onBack={() => setSubView("menu")} />;
  }

  if (subView === "partners") {
    return <HealthPartnersMap onBack={() => setSubView("menu")} />;
  }

  if (subView === "history") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Histórico de Consultas" onBack={() => setSubView("menu")} />
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <span className="text-5xl">📋</span>
              <p className="text-sm text-muted-foreground text-center">Nenhuma consulta agendada ainda.</p>
            </div>
          ) : (
            appointments.map((a) => {
              const statusMap: Record<string, { label: string; color: string }> = {
                scheduled: { label: "Agendada", color: "hsl(var(--primary))" },
                confirmed: { label: "Confirmada", color: "hsl(var(--mayla-green, 142 71% 45%))" },
                cancelled: { label: "Cancelada", color: "hsl(var(--destructive))" },
                completed: { label: "Realizada", color: "hsl(var(--muted-foreground))" },
              };
              const st = statusMap[a.status] || statusMap.scheduled;
              return (
                <div key={a.id} className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[15px] font-semibold text-foreground">{a.specialty}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${st.color}15`, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(a.appointment_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {a.doctor_name && <div className="text-sm text-muted-foreground mt-0.5">Dr(a). {a.doctor_name}</div>}
                  {a.clinic_name && <div className="text-sm text-muted-foreground">{a.clinic_name}</div>}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Serviços" />
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground tracking-[.08em] uppercase mb-2">Consultas</h3>

        <button
          onClick={() => setSubView("telemedicine")}
          className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left"
        >
          <span className="text-3xl">📹</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Consulta Online</div>
            <div className="text-sm text-muted-foreground">Teleconsulta por vídeo</div>
          </div>
          <span className="text-muted-foreground text-lg">›</span>
        </button>

        <button
          onClick={() => setSubView("appointment")}
          className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left"
        >
          <span className="text-3xl">🏥</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Consulta Presencial</div>
            <div className="text-sm text-muted-foreground">Agende uma consulta na unidade</div>
          </div>
          <span className="text-muted-foreground text-lg">›</span>
        </button>

        <button
          onClick={() => setSubView("history")}
          className="w-full rounded-2xl p-4 border border-border bg-card flex items-center gap-4 cursor-pointer text-left"
        >
          <span className="text-3xl">📋</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Histórico de Consultas</div>
            <div className="text-sm text-muted-foreground">Consultas agendadas e realizadas</div>
          </div>
          <span className="text-muted-foreground text-lg">›</span>
        </button>

        <h3 className="text-sm font-semibold text-muted-foreground tracking-[.08em] uppercase mt-6 mb-2">Em breve</h3>

        <div className="w-full rounded-2xl p-4 border border-dashed border-border bg-card/50 flex items-center gap-4 opacity-60">
          <span className="text-3xl">💊</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Farmácia Digital</div>
            <div className="text-sm text-muted-foreground">Gerenciamento de medicamentos</div>
          </div>
        </div>

        <div className="w-full rounded-2xl p-4 border border-dashed border-border bg-card/50 flex items-center gap-4 opacity-60">
          <span className="text-3xl">🧑‍⚕️</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-foreground">Marketplace de Especialistas</div>
            <div className="text-sm text-muted-foreground">Encontre profissionais de saúde</div>
          </div>
        </div>
      </div>
    </div>
  );
}
