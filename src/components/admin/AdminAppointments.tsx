import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Company {
  id: string;
  name: string;
}

interface AppointmentRow {
  id: string;
  specialty: string;
  appointment_date: string;
  status: string;
  doctor_name: string | null;
  company_id: string | null;
  company_name?: string;
}

export function AdminAppointments() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");
    if (companiesData) setCompanies(companiesData);

    let query = supabase
      .from("appointments")
      .select("id, specialty, appointment_date, status, doctor_name, company_id")
      .order("appointment_date", { ascending: false })
      .limit(200);

    if (selectedCompany !== "all") {
      query = query.eq("company_id", selectedCompany);
    }

    const { data } = await query;

    if (data && companiesData) {
      const companyMap = new Map(companiesData.map(c => [c.id, c.name]));
      setAppointments(data.map(a => ({
        ...a,
        company_name: a.company_id ? companyMap.get(a.company_id) || "—" : "—",
      })));
    }

    setLoading(false);
  }, [selectedCompany]);

  useEffect(() => { load(); }, [load]);

  const statusLabel: Record<string, { text: string; color: string }> = {
    pending: { text: "Pendente", color: "bg-amber-100 text-amber-800" },
    confirmed: { text: "Confirmado", color: "bg-green-100 text-green-800" },
    scheduled: { text: "Agendado", color: "bg-blue-100 text-blue-800" },
    cancelled: { text: "Cancelado", color: "bg-red-100 text-red-800" },
    completed: { text: "Concluído", color: "bg-emerald-100 text-emerald-800" },
  };

  // Stats
  const total = appointments.length;
  const byStatus = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});
  const bySpecialty = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.specialty] = (acc[a.specialty] || 0) + 1;
    return acc;
  }, {});
  const topSpecialties = Object.entries(bySpecialty).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl text-foreground">Relatório de Agendamentos</h2>
          <p className="text-sm text-muted-foreground mt-1">Visão geral das consultas realizadas</p>
        </div>
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-[220px] h-9 text-sm">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground mt-1">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{byStatus["confirmed"] || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Confirmados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{byStatus["pending"] || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Pendentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{byStatus["cancelled"] || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Cancelados</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Specialties */}
      {topSpecialties.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Especialidades</h3>
          <div className="flex flex-wrap gap-2">
            {topSpecialties.map(([spec, count]) => (
              <span key={spec} className="text-xs bg-secondary text-secondary-foreground rounded-lg px-3 py-1.5 font-medium">
                {spec} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Appointments Table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : appointments.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhum agendamento encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {appointments.map(a => {
            const st = statusLabel[a.status] || statusLabel.pending;
            return (
              <div key={a.id} className="flex items-center gap-4 p-3 bg-card border border-border rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{a.specialty}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.company_name} {a.doctor_name ? `· Dr(a). ${a.doctor_name}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.appointment_date).toLocaleDateString("pt-BR")}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${st.color}`}>
                  {st.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
