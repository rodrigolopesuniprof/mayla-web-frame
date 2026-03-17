import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Alert {
  id: string;
  type: "waiting" | "on_demand" | "upcoming";
  title: string;
  subtitle: string;
  emoji: string;
  time: string;
}

interface Props {
  partnerId: string;
}

export function OperationalAlerts({ partnerId }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const fetchAlerts = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { data } = await supabase
      .from("consultations")
      .select("id, user_id, specialty, consultation_flow_type, status, scheduled_at, created_at")
      .eq("professional_id", partnerId)
      .in("status", ["confirmed", "waiting", "pending"] as any[])
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      setAlerts([]);
      return;
    }

    const userIds = [...new Set(data.map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Paciente"; });

    const newAlerts: Alert[] = [];

    for (const c of data as any[]) {
      const patientName = nameMap[c.user_id] || "Paciente";
      const waitDiff = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 60000);

      if (c.consultation_flow_type === "on_demand" && (c.status === "confirmed" || c.status === "waiting")) {
        newAlerts.push({
          id: c.id,
          type: "on_demand",
          title: `⚡ Atendimento imediato — ${patientName}`,
          subtitle: `${c.specialty || "Clínico Geral"} • Aguardando há ${waitDiff}min`,
          emoji: "🚨",
          time: `${waitDiff}min`,
        });
      } else if (c.status === "waiting") {
        newAlerts.push({
          id: c.id,
          type: "waiting",
          title: `Paciente aguardando — ${patientName}`,
          subtitle: `${c.specialty || "Consulta"} • Na fila há ${waitDiff}min`,
          emoji: "⏳",
          time: `${waitDiff}min`,
        });
      } else if (c.status === "confirmed" && c.scheduled_at) {
        const scheduledTime = new Date(c.scheduled_at);
        const minutesUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / 60000);
        if (minutesUntil <= 30 && minutesUntil >= -5) {
          newAlerts.push({
            id: c.id,
            type: "upcoming",
            title: `📅 Consulta em ${minutesUntil > 0 ? `${minutesUntil}min` : "agora"} — ${patientName}`,
            subtitle: `${c.specialty || "Consulta"} • ${scheduledTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
            emoji: "📅",
            time: minutesUntil > 0 ? `em ${minutesUntil}min` : "agora",
          });
        }
      }
    }

    // Play alert sound if new alerts appeared
    if (newAlerts.length > prevCountRef.current && prevCountRef.current >= 0) {
      try {
        // Use a simple beep via Web Audio API
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch {
        // Audio not available
      }
    }
    prevCountRef.current = newAlerts.length;

    setAlerts(newAlerts);
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000); // Refresh every 15s

    // Realtime
    const channel = supabase
      .channel(`alerts-${partnerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations", filter: `professional_id=eq.${partnerId}` },
        () => fetchAlerts()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [partnerId]);

  if (alerts.length === 0) return null;

  const alertColors: Record<string, string> = {
    on_demand: "border-destructive/50 bg-destructive/5",
    waiting: "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20",
    upcoming: "border-primary/30 bg-primary/5",
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-xl border-2 px-4 py-3 flex items-center gap-3 ${alertColors[alert.type] || "border-border bg-card"}`}
        >
          <span className="text-2xl shrink-0">{alert.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{alert.title}</p>
            <p className="text-xs text-muted-foreground">{alert.subtitle}</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground shrink-0">{alert.time}</span>
        </div>
      ))}
    </div>
  );
}
