import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { WellbeingCheckin } from "@/components/corporate/WellbeingCheckin";
import { RppgCapture } from "./RppgCapture";
import { BinahCapture } from "./BinahCapture";
import { TopBar } from "./TopBar";
import { useVitalsSources, type VitalsSource } from "@/hooks/useVitalsSources";
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

interface CheckinHistory {
  id: string;
  week_start: string;
  mood: number;
  stress_level: number;
  sleep_quality: number;
  workload: number;
}

interface Measurement {
  id: string;
  heart_rate: number | null;
  respiratory_rate: number | null;
  stress_level: number | null;
  spo2: number | null;
  measured_at: string;
  source: string | null;
}

const MOOD_EMOJI = ["", "😞", "😕", "😐", "🙂", "😊"];

export function WellbeingTab() {
  const { user } = useAuth();
  const { companyId, primaryColor, company } = useCompany();
  const { sources, reload: reloadSources } = useVitalsSources(companyId);
  const [history, setHistory] = useState<CheckinHistory[]>([]);
  const [activeSource, setActiveSource] = useState<VitalsSource | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(true);

  const loadHistory = () => {
    if (!user) return;
    supabase
      .from("wellbeing_checkins")
      .select("id, week_start, mood, stress_level, sleep_quality, workload")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(8)
      .then(({ data }) => setHistory((data as CheckinHistory[]) || []));
  };

  const fetchMeasurements = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("health_measurements")
      .select("id, heart_rate, respiratory_rate, stress_level, spo2, measured_at, source")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false })
      .limit(30);
    setMeasurements(data || []);
    setLoadingMeasurements(false);
  };

  useEffect(() => {
    loadHistory();
    fetchMeasurements();
  }, [user]);

  if (activeSource) {
    if (activeSource.id === "basic_rppg") {
      return (
        <RppgCapture
          onClose={() => setActiveSource(null)}
          onComplete={() => { fetchMeasurements(); reloadSources(); }}
        />
      );
    }
    const providerOverride = activeSource.id === "premium_shenai" ? "shenai" : "binah";
    const basicSource = sources.find((s) => s.id === "basic_rppg" && s.enabled);
    return (
      <BinahCapture
        onClose={() => setActiveSource(null)}
        onComplete={() => { fetchMeasurements(); reloadSources(); }}
        municipalityId={null}
        companyId={companyId ?? null}
        providerOverride={providerOverride}
        displayName={activeSource.displayName}
        sourceKey={activeSource.featureKey}
        onFallbackToBasic={basicSource ? () => setActiveSource(basicSource) : undefined}
      />
    );
  }


  const latest = measurements[0] || null;

  const chartData = measurements
    .slice(0, 14)
    .reverse()
    .filter((m) => m.heart_rate)
    .map((m) => ({
      date: format(new Date(m.measured_at), "dd/MM"),
      bpm: m.heart_rate,
    }));

  const stats = [
    { label: "Freq. Cardíaca", value: latest?.heart_rate, unit: "bpm", emoji: "❤️", color: "hsl(var(--mayla-rose))" },
    { label: "Respiração", value: latest?.respiratory_rate, unit: "rpm", emoji: "🫁", color: "hsl(var(--mayla-teal))" },
    { label: "Estresse", value: latest?.stress_level, unit: "%", emoji: "😰", color: "hsl(var(--mayla-amber))" },
    { label: "SpO2", value: latest?.spo2, unit: "%", emoji: "💧", color: "hsl(var(--mayla-pref))" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Bem-estar" />
      <div className="flex-1 overflow-y-auto px-[22px] py-5 space-y-6">

        {/* Vitals measurement CTAs (dynamic per enabled source) */}
        {sources.filter((s) => s.enabled).map((s) => {
          const limitReached = s.monthlyLimit != null && (s.usedThisMonth ?? 0) >= s.monthlyLimit;
          return (
            <div
              key={s.id}
              className="rounded-[18px] p-5 relative overflow-hidden cursor-pointer"
              style={{
                background: s.gradient,
                boxShadow: s.shadow,
                opacity: limitReached ? 0.5 : 1,
              }}
              onClick={() => { if (!limitReached) setActiveSource(s); }}
            >
              <div className="flex items-center gap-4">
                <div className="text-5xl">{s.emoji}</div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold" style={{ color: "#fff" }}>
                    {s.displayName}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,.8)" }}>
                    {s.description} · +{s.pointsReward} pts
                  </div>
                </div>
                {s.monthlyLimit != null && (
                  <div className="rounded-xl px-2.5 py-1 text-[10px] font-bold shrink-0" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>
                    {s.usedThisMonth ?? 0}/{s.monthlyLimit}
                  </div>
                )}
              </div>
              {limitReached && (
                <div className="mt-2 text-[11px] font-medium text-center" style={{ color: "rgba(255,255,255,.9)" }}>
                  Limite mensal atingido. Disponível no próximo mês.
                </div>
              )}
            </div>
          );
        })}



        {/* Latest vitals */}
        {latest && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-muted-foreground tracking-[.1em] uppercase">
                Última medição
              </p>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(latest.measured_at), "dd MMM · HH:mm", { locale: ptBR })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((item, i) => (
                <div key={i} className="bg-secondary rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{item.emoji}</span>
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold" style={{ color: item.color }}>
                      {item.value ?? "—"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BPM Chart */}
        {chartData.length >= 2 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground tracking-[.1em] uppercase mb-3">
              Tendência · Freq. Cardíaca
            </p>
            <div className="bg-secondary rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [`${v} bpm`, "BPM"]}
                  />
                  <Line type="monotone" dataKey="bpm" stroke="hsl(var(--mayla-rose))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--mayla-rose))" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Wellbeing Checkin */}
        {companyId && (
          <WellbeingCheckin
            companyId={companyId}
            primaryColor={primaryColor}
            onComplete={loadHistory}
          />
        )}

        {/* Checkin history */}
        {history.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">📅 Histórico de Check-in</h3>
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="bg-secondary rounded-2xl p-3 flex items-center gap-3">
                  <span className="text-2xl">{MOOD_EMOJI[h.mood] || "😐"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      Semana de {new Date(h.week_start).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Humor {h.mood}/5 · Estresse {h.stress_level}/5 · Sono {h.sleep_quality}/5
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Measurement history */}
        {measurements.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground tracking-[.1em] uppercase mb-3">
              Histórico de Medições
            </p>
            <div className="space-y-2">
              {measurements.slice(0, 10).map((m) => (
                <div key={m.id} className="bg-secondary rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">
                      {format(new Date(m.measured_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {m.source === "rppg_native" ? "📸 Medição por câmera" : "📱 App"}
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
        {!loadingMeasurements && measurements.length === 0 && history.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[13px] text-muted-foreground">
              Nenhuma medição ainda. Toque acima para fazer sua primeira medição!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
