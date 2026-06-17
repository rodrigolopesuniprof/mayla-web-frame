import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVisibleIndicators, categoryLabel, flattenMeasurementPayload, type IndicatorMeta } from "@/hooks/useVisibleIndicators";

interface Measurement {
  id: string;
  measured_at: string;
  source: string | null;
  measurement_data: any;
}

interface Props {
  userId: string;
  userName?: string | null;
}

export function UserVitalsFullPanel({ userId, userName }: Props) {
  const { indicators } = useVisibleIndicators();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase
      .from("special_measurements")
      .select("id, measured_at, source, measurement_data")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMeasurements((data as Measurement[]) || []);
        if (data && data.length > 0) setExpandedId((data[0] as any).id);
        setLoading(false);
      });
  }, [userId]);

  const exportCsv = () => {
    if (!measurements.length) return;
    const keys = indicators.map((i) => i.key);
    const header = ["measured_at", "source", ...indicators.map((i) => i.label)];
    const rows = measurements.map((m) => {
      const flat = flattenMeasurementPayload(m.measurement_data);
      return [m.measured_at, m.source || "", ...keys.map((k) => (flat[k] ?? ""))];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vitals_${userName || userId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Carregando medições...</p>;
  if (!measurements.length) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma medição registrada.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {measurements.length} medições · admin vê <strong>todos</strong> os indicadores capturados
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv}>⬇ Exportar CSV</Button>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {measurements.map((m) => {
          const expanded = expandedId === m.id;
          const flat = flattenMeasurementPayload(m.measurement_data);
          const sourceLabel = m.source === "shenai" ? "Shen.ai" : m.source === "vitals_premium" ? "Binah" : (m.source || "—");
          const sourceColor = m.source === "shenai" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
          return (
            <Card key={m.id}>
              <CardHeader className="py-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : m.id)}>
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span>{new Date(m.measured_at).toLocaleString("pt-BR")}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sourceColor}`}>{sourceLabel}</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {Object.keys(flat).length} indicadores · {expanded ? "▲" : "▼"}
                  </span>
                </CardTitle>
              </CardHeader>
              {expanded && (
                <CardContent>
                  <IndicatorGrid indicators={indicators} flat={flat} />
                  <details className="mt-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver JSON bruto</summary>
                    <pre className="mt-2 text-[10px] bg-muted/40 rounded-lg p-3 overflow-auto max-h-64">
                      {JSON.stringify(m.measurement_data, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function IndicatorGrid({ indicators, flat }: { indicators: IndicatorMeta[]; flat: Record<string, number | string> }) {
  const grouped = useMemo(() => {
    const g: Record<string, IndicatorMeta[]> = {};
    for (const ind of indicators) {
      if (flat[ind.key] == null) continue;
      (g[ind.category] = g[ind.category] || []).push(ind);
    }
    return g;
  }, [indicators, flat]);

  // Also show any keys present in payload but not in catalog
  const unknownKeys = Object.keys(flat).filter((k) => !indicators.find((i) => i.key === k));

  if (Object.keys(grouped).length === 0 && unknownKeys.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum indicador reconhecido neste payload.</p>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{categoryLabel(cat)}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {list.map((ind) => (
              <div key={ind.key} className="bg-secondary/60 rounded-lg p-2">
                <div className="text-[11px] text-muted-foreground">{ind.label}</div>
                <div className="text-sm font-semibold text-foreground">
                  {formatValue(flat[ind.key])} {ind.unit ? <span className="text-xs text-muted-foreground font-normal">{ind.unit}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {unknownKeys.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Outros do provedor</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {unknownKeys.map((k) => (
              <div key={k} className="bg-secondary/40 rounded-lg p-2">
                <div className="text-[11px] text-muted-foreground font-mono">{k}</div>
                <div className="text-sm font-semibold text-foreground">{formatValue(flat[k])}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(v: number | string) {
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(2);
  }
  return String(v);
}
