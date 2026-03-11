import { useState, useEffect } from "react";
import { TopBar } from "./TopBar";
import { RppgCapture } from "./RppgCapture";
import { BinahCapture } from "./BinahCapture";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Measurement {
  id: string;
  heart_rate: number | null;
  respiratory_rate: number | null;
  stress_level: number | null;
  spo2: number | null;
  measured_at: string;
  source: string | null;
}

export function HealthTab() {
  const { user } = useAuth();
  const { company, companyId } = useCompany();
  const [showRppg, setShowRppg] = useState(false);
  const [showBinah, setShowBinah] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [binahEnabled, setBinahEnabled] = useState(false);
  const [binahLimit, setBinahLimit] = useState(3);
  const [binahUsedThisMonth, setBinahUsedThisMonth] = useState(0);

  const fetchMeasurements = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("health_measurements")
      .select("id, heart_rate, respiratory_rate, stress_level, spo2, measured_at, source")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false })
      .limit(30);
    setMeasurements(data || []);
    setLoading(false);
  };

  // Check if Binah is enabled for this municipality
  const fetchBinahStatus = async () => {
    if (!companyId || !user) return;
    const { data: feat } = await supabase
      .from("company_features")
      .select("enabled, config")
      .eq("company_id", companyId)
      .eq("feature_key", "binah_special_measurement")
      .maybeSingle();

    if (feat?.enabled) {
      setBinahEnabled(true);
      setBinahLimit((feat.config as any)?.monthly_limit ?? 3);

      // Count this month's usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("special_measurements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("measured_at", monthStart);
      setBinahUsedThisMonth(count ?? 0);
    }
  };

  useEffect(() => {
    fetchMeasurements();
    fetchBinahStatus();
  }, [user, municipality]);

  if (showBinah) {
    return (
      <BinahCapture
        onClose={() => setShowBinah(false)}
        onComplete={() => { fetchBinahStatus(); fetchMeasurements(); }}
        municipalityId={municipality?.id ?? null}
      />
    );
  }

  if (showRppg) {
    return (
      <RppgCapture
        onClose={() => setShowRppg(false)}
        onComplete={fetchMeasurements}
      />
    );
  }

  const latest = measurements[0] || null;

  // Chart data (last 14 measurements, ascending order)
  const chartData = measurements
    .slice(0, 14)
    .reverse()
    .filter((m) => m.heart_rate)
    .map((m) => ({
      date: format(new Date(m.measured_at), "dd/MM"),
      bpm: m.heart_rate,
    }));

  const stats = [
    {
      label: "Freq. Cardíaca",
      value: latest?.heart_rate,
      unit: "bpm",
      emoji: "❤️",
      color: "hsl(var(--mayla-rose))",
    },
    {
      label: "Respiração",
      value: latest?.respiratory_rate,
      unit: "rpm",
      emoji: "🫁",
      color: "hsl(var(--mayla-teal))",
    },
    {
      label: "Estresse",
      value: latest?.stress_level,
      unit: "%",
      emoji: "😰",
      color: "hsl(var(--mayla-amber))",
    },
    {
      label: "SpO2",
      value: latest?.spo2,
      unit: "%",
      emoji: "💧",
      color: "hsl(var(--mayla-pref))",
    },
  ];

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto pb-4">
      <TopBar />

      <div className="px-[22px] pt-5 pb-4">
        <h2 className="font-display text-2xl font-medium text-foreground mb-1">
          Sua Saúde
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Acompanhe seus sinais vitais e histórico
        </p>
      </div>

      {/* rPPG CTA */}
      <div
        className="mx-[22px] mb-5 rounded-[18px] p-5 relative overflow-hidden cursor-pointer"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
          boxShadow: "0 12px 36px rgba(232,87,74,.3)",
        }}
        onClick={() => setShowRppg(true)}
      >
        <div className="flex items-center gap-4">
          <div className="text-5xl animate-heartbeat">❤️</div>
          <div>
            <div className="text-lg font-semibold" style={{ color: "#fff" }}>
              Medir sinais vitais
            </div>
            <div
              className="text-[13px] mt-1"
              style={{ color: "rgba(255,255,255,.8)" }}
            >
              Câmera rPPG · {latest ? "Nova medição" : "30 segundos"} · +50 pts
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          {["❤️ Freq. Cardíaca", "🫁 Respiração", "😰 Estresse"].map(
            (item, i) => (
              <div
                key={i}
                className="rounded-xl px-2.5 py-1.5 text-[10px] font-medium"
                style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}
              >
                {item}
              </div>
            )
          )}
        </div>
      </div>

      {/* Binah Special Measurement CTA */}
      {binahEnabled && (
        <div
          className="mx-[22px] mb-5 rounded-[18px] p-5 relative overflow-hidden cursor-pointer"
          style={{
            background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-teal)))",
            boxShadow: "0 12px 36px rgba(26,92,138,.3)",
            opacity: binahUsedThisMonth >= binahLimit ? 0.5 : 1,
          }}
          onClick={() => {
            if (binahUsedThisMonth >= binahLimit) {
              return;
            }
            setShowBinah(true);
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-5xl">🔬</div>
            <div>
              <div className="text-lg font-semibold" style={{ color: "#fff" }}>
                Medição Especial
              </div>
              <div className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,.8)" }}>
                Análise completa · PA, hemoglobina, HRV · +100 pts
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2">
              {["🩺 PA", "💧 SpO2", "✨ Bem-estar"].map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl px-2.5 py-1.5 text-[10px] font-medium"
                  style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}
                >
                  {item}
                </div>
              ))}
            </div>
            <div
              className="rounded-xl px-3 py-1.5 text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}
            >
              {binahUsedThisMonth}/{binahLimit} este mês
            </div>
          </div>
          {binahUsedThisMonth >= binahLimit && (
            <div className="mt-2 text-[11px] font-medium" style={{ color: "rgba(255,255,255,.9)" }}>
              Limite mensal atingido. Disponível no próximo mês.
            </div>
          )}
        </div>
      )}


      <div className="px-[22px]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium text-muted-foreground tracking-[.1em] uppercase">
            {latest ? "Última medição" : "Sinais vitais"}
          </p>
          {latest && (
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(latest.measured_at), "dd MMM · HH:mm", {
                locale: ptBR,
              })}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((item, i) => (
            <div key={i} className="bg-secondary rounded-2xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{item.emoji}</span>
                <span className="text-[11px] text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className="font-display text-2xl font-bold"
                  style={{ color: item.color }}
                >
                  {item.value ?? "—"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {item.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BPM Chart */}
      {chartData.length >= 2 && (
        <div className="px-[22px] mt-6">
          <p className="text-[11px] font-medium text-muted-foreground tracking-[.1em] uppercase mb-3">
            Tendência · Freq. Cardíaca
          </p>
          <div className="bg-secondary rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} bpm`, "BPM"]}
                />
                <Line
                  type="monotone"
                  dataKey="bpm"
                  stroke="hsl(var(--mayla-rose))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(var(--mayla-rose))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Timeline */}
      {measurements.length > 0 && (
        <div className="px-[22px] mt-6">
          <p className="text-[11px] font-medium text-muted-foreground tracking-[.1em] uppercase mb-3">
            Histórico de Medições
          </p>
          <div className="space-y-2">
            {measurements.slice(0, 10).map((m) => (
              <div
                key={m.id}
                className="bg-secondary rounded-2xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-[13px] font-medium text-foreground">
                    {format(new Date(m.measured_at), "dd MMM yyyy · HH:mm", {
                      locale: ptBR,
                    })}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {m.source === "rppg_native" ? "📸 Câmera rPPG" : "📱 App"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.heart_rate && (
                    <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--mayla-rose))" }}>
                      ❤️ {m.heart_rate}
                    </span>
                  )}
                  {m.spo2 && (
                    <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--mayla-pref))" }}>
                      💧 {m.spo2}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && measurements.length === 0 && (
        <div className="px-[22px] mt-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-[13px] text-muted-foreground">
            Nenhuma medição ainda. Toque acima para fazer sua primeira medição!
          </p>
        </div>
      )}
    </div>
  );
}
