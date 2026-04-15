import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const professionalId = url.searchParams.get("professional_id");

    // Validate API key from Meddit
    const apiKey = req.headers.get("Authorization") || req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("MEDDIT_API_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ authorized: false, error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ authorized: false, error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up connection by report_token
    let query = supabase
      .from("prontuario_connections")
      .select("id, user_id, external_professional_id, external_professional_name, report_token, active")
      .eq("report_token", token)
      .eq("active", true);

    if (professionalId) {
      query = query.eq("external_professional_id", professionalId);
    }

    const { data: connection, error } = await query.maybeSingle();

    if (error || !connection) {
      return new Response(JSON.stringify({ authorized: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = connection.user_id;

    // Fetch all report data in parallel — permanent access while connection is active
    const [profileRes, scoresRes, alertsRes, measurementsRes] = await Promise.all([
      supabase.from("profiles")
        .select("full_name, birth_date, has_hypertension, has_diabetes, biological_sex")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("health_scores")
        .select("*")
        .eq("user_id", userId)
        .order("generated_at", { ascending: false })
        .limit(1),
      supabase.from("health_alerts")
        .select("*")
        .eq("user_id", userId)
        .is("dismissed_at", null)
        .order("generated_at", { ascending: false })
        .limit(5),
      supabase.from("health_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(20),
    ]);

    // Build embed report URL for iframe usage
    const reportUrl = `${url.origin}/relatorio/medico/${connection.report_token}?view=embed`;

    return new Response(JSON.stringify({
      authorized: true,
      professional_id: connection.external_professional_id,
      professional_name: connection.external_professional_name,
      report_url: reportUrl,
      user_id: userId,
      profile: profileRes.data,
      scores: scoresRes.data?.[0] || null,
      alerts: alertsRes.data || [],
      measurements: measurementsRes.data || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("prontuario-verify error:", err);
    return new Response(JSON.stringify({ authorized: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
