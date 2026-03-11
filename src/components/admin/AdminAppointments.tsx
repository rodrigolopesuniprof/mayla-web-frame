import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  specialty: string;
  appointment_date: string;
  status: string;
  created_at: string;
  user_id: string;
  municipality_id: string | null;
  profile_name?: string;
  profile_cpf?: string;
}

interface Municipality {
  id: string;
  name: string;
}

export function AdminAppointments() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMuni, setSelectedMuni] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("pending");

  useEffect(() => {
    supabase.from("municipalities").select("id, name").order("name").then(({ data }) => {
      if (data) {
        setMunicipalities(data);
        if (data.length > 0 && !selectedMuni) setSelectedMuni(data[0].id);
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedMuni) return;
    setLoading(true);

    let query = supabase
      .from("appointments")
      .select("*")
      .eq("municipality_id", selectedMuni)
      .order("appointment_date", { ascending: true });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;

    if (data) {
      // Fetch profile names for these appointments
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, cpf")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setAppointments(data.map(a => ({
        ...a,
        profile_name: profileMap.get(a.user_id)?.full_name || "—",
        profile_cpf: profileMap.get(a.user_id)?.cpf || "—",
      })));
    }

    setLoading(false);
  }, [selectedMuni, filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: `Status atualizado para "${status}"` }); load(); }
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    pending: { text: "Pendente", color: "bg-amber-100 text-amber-800" },
    confirmed: { text: "Confirmado", color: "bg-green-100 text-green-800" },
    scheduled: { text: "Agendado", color: "bg-blue-100 text-blue-800" },
    cancelled: { text: "Cancelado", color: "bg-red-100 text-red-800" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-foreground">Agendamentos</h2>
      </div>

      <div className="flex items-end gap-4 mb-4">
        <div>
          <Label className="text-sm">Município</Label>
          <select
            value={selectedMuni}
            onChange={e => setSelectedMuni(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
          >
            {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "confirmed", "cancelled"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs rounded-lg border-none cursor-pointer font-medium transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todos" : statusLabel[f]?.text || f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : appointments.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhum agendamento encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {appointments.map(a => {
            const st = statusLabel[a.status] || statusLabel.pending;
            return (
              <div key={a.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{a.profile_name}</div>
                  <div className="text-xs text-muted-foreground">
                    CPF: {a.profile_cpf} · {a.specialty}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    📅 {new Date(a.appointment_date).toLocaleString("pt-BR")}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${st.color}`}>
                  {st.text}
                </span>
                {a.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(a.id, "confirmed")}>
                      ✅ Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => updateStatus(a.id, "cancelled")}>
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
