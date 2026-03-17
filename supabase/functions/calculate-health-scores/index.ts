import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_id, days = 7 } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    const baselineStart = new Date(now);
    baselineStart.setDate(baselineStart.getDate() - 30);

    // Fetch measurements for the period
    const { data: measurements } = await supabase
      .from("health_measurements")
      .select("*")
      .eq("user_id", user_id)
      .gte("measured_at", start.toISOString())
      .lte("measured_at", now.toISOString());

    // Fetch baseline (30 days)
    const { data: baselineMeasurements } = await supabase
      .from("health_measurements")
      .select("*")
      .eq("user_id", user_id)
      .gte("measured_at", baselineStart.toISOString())
      .lte("measured_at", now.toISOString());

    const m = measurements || [];
    const bm = baselineMeasurements || [];

    // Helper: average of non-null values
    const avg = (arr: (number | null | undefined)[]) => {
      const valid = arr.filter((v): v is number => v != null);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };

    // Current period averages
    const hrAvg = avg(m.map((x: any) => x.heart_rate));
    const stressAvg = avg(m.map((x: any) => x.stress_level));
    const rrAvg = avg(m.map((x: any) => x.respiratory_rate));
    const spo2Avg = avg(m.map((x: any) => x.spo2));
    const bpSysAvg = avg(m.map((x: any) => x.blood_pressure_sys));
    const bpDiaAvg = avg(m.map((x: any) => x.blood_pressure_dia));
    const hrvAvg = avg(m.map((x: any) => x.hrv));
    const glucoseAvg = avg(m.map((x: any) => x.glucose_estimated));
    const fatigueAvg = avg(m.map((x: any) => x.fatigue_score));
    const sleepAvg = avg(m.map((x: any) => x.sleep_duration_min));
    const stepsAvg = avg(m.map((x: any) => x.steps));

    // Baseline averages
    const hrBaseline = avg(bm.map((x: any) => x.heart_rate));
    const stressBaseline = avg(bm.map((x: any) => x.stress_level));

    // Score calculation using clinical reference ranges
    function scoreMetric(val: number | null, optimalMin: number, optimalMax: number, critMin: number, critMax: number): number {
      if (val == null) return 75; // Default when no data
      if (val >= optimalMin && val <= optimalMax) return 95;
      if (val < critMin || val > critMax) return 20;
      // Linear interpolation
      if (val < optimalMin) return 20 + 75 * (val - critMin) / (optimalMin - critMin);
      return 20 + 75 * (critMax - val) / (critMax - optimalMax);
    }

    // Physiological score
    const hrScore = scoreMetric(hrAvg, 60, 80, 40, 120);
    const rrScore = scoreMetric(rrAvg, 12, 20, 8, 30);
    const spo2Score = spo2Avg != null ? (spo2Avg >= 95 ? 95 : spo2Avg >= 90 ? 60 : 25) : 75;
    const bpScore = bpSysAvg != null ? scoreMetric(bpSysAvg, 90, 130, 70, 180) : 75;
    const hrvScore = hrvAvg != null ? scoreMetric(hrvAvg, 30, 80, 10, 100) : 75;
    const glucoseScore = glucoseAvg != null ? scoreMetric(glucoseAvg, 70, 100, 40, 200) : 75;
    const fatigueScore = fatigueAvg != null ? Math.max(0, 100 - fatigueAvg) : 75;

    const scorePhysiological = Math.round((hrScore + rrScore + spo2Score + bpScore + hrvScore + glucoseScore + fatigueScore) / 7);

    // Emotional score
    const stressScore = stressAvg != null ? Math.max(0, 100 - stressAvg) : 75;
    const scoreEmotional = Math.round(stressScore);

    // Lifestyle score
    const sleepScore = sleepAvg != null ? scoreMetric(sleepAvg, 420, 540, 180, 720) : 75; // 7-9h optimal
    const stepsScore = stepsAvg != null ? Math.min(100, (stepsAvg / 8000) * 100) : 75;
    const scoreLifestyle = Math.round((sleepScore + stepsScore) / 2);

    // General score (weighted)
    const scoreGeneral = Math.round(scorePhysiological * 0.4 + scoreEmotional * 0.3 + scoreLifestyle * 0.3);

    // Recommendation level
    let recommendationLevel = 1;
    if (scoreGeneral < 40) recommendationLevel = 4;
    else if (scoreGeneral < 55) recommendationLevel = 3;
    else if (scoreGeneral < 70) recommendationLevel = 2;

    // Save score
    const periodStart = start.toISOString().split("T")[0];
    const periodEnd = now.toISOString().split("T")[0];

    await supabase.from("health_scores").insert({
      user_id,
      period_start: periodStart,
      period_end: periodEnd,
      score_general: scoreGeneral,
      score_physiological: scorePhysiological,
      score_emotional: scoreEmotional,
      score_lifestyle: scoreLifestyle,
      recommendation_level: recommendationLevel,
    });

    // Generate alerts
    const alerts: any[] = [];

    if (hrAvg != null && hrBaseline != null && hrAvg > hrBaseline * 1.15) {
      alerts.push({
        user_id,
        metric: "heart_rate",
        severity: "medium",
        description: "FC média acima do padrão habitual",
        detail: `Semana: ${Math.round(hrAvg)} bpm · Baseline: ${Math.round(hrBaseline)} bpm`,
        days_triggered: m.filter((x: any) => x.heart_rate != null && x.heart_rate > hrBaseline! * 1.15).length,
      });
    }

    if (stressAvg != null && stressAvg > 60) {
      alerts.push({
        user_id,
        metric: "stress",
        severity: stressAvg > 80 ? "critical" : "high",
        description: "Nível de estresse elevado de forma consistente",
        detail: `${m.filter((x: any) => x.stress_level != null && x.stress_level > 60).length} dos últimos ${days} dias acima do padrão`,
        days_triggered: m.filter((x: any) => x.stress_level != null && x.stress_level > 60).length,
      });
    }

    if (sleepAvg != null && sleepAvg < 360) { // < 6h
      alerts.push({
        user_id,
        metric: "sleep",
        severity: sleepAvg < 300 ? "critical" : "high",
        description: "Sono abaixo de 6h na média semanal",
        detail: `Média: ${Math.floor(sleepAvg / 60)}h${Math.round(sleepAvg % 60)}min`,
        days_triggered: m.filter((x: any) => x.sleep_duration_min != null && x.sleep_duration_min < 360).length,
      });
    }

    if (alerts.length > 0) {
      await supabase.from("health_alerts").insert(alerts);
    }

    return new Response(JSON.stringify({
      score_general: scoreGeneral,
      score_physiological: scorePhysiological,
      score_emotional: scoreEmotional,
      score_lifestyle: scoreLifestyle,
      recommendation_level: recommendationLevel,
      alerts_generated: alerts.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
