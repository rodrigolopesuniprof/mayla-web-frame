import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { token, access_code } = body;

    if (!token || !access_code) {
      return new Response(JSON.stringify({ error: "token and access_code are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate access_code: exists, not used, matches token, created < 5 min ago
    const { data: code, error: codeErr } = await supabase
      .from("report_access_codes")
      .select("*")
      .eq("access_code", access_code)
      .eq("report_token", token)
      .eq("used", false)
      .maybeSingle();

    if (codeErr || !code) {
      return new Response(JSON.stringify({ error: "Invalid or expired access code" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check 5-minute expiry
    const createdAt = new Date(code.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > 5 * 60 * 1000) {
      // Mark as used to prevent retry
      await supabase.from("report_access_codes").update({ used: true }).eq("id", code.id);
      return new Response(JSON.stringify({ error: "Access code expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as used (single-use)
    await supabase.from("report_access_codes").update({ used: true }).eq("id", code.id);

    // Look up the connection to get user_id
    const { data: conn } = await supabase
      .from("prontuario_connections")
      .select("user_id, external_professional_name")
      .eq("report_token", token)
      .eq("active", true)
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = conn.user_id;

    // Fetch all report data in parallel
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

    return new Response(JSON.stringify({
      authorized: true,
      professional_name: conn.external_professional_name,
      user_id: userId,
      profile: profileRes.data,
      scores: scoresRes.data?.[0] || null,
      alerts: alertsRes.data || [],
      measurements: measurementsRes.data || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("report-access error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
