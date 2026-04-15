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

    if (!token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Path 1: Authenticated Mayla professional (JWT) ───
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const professionalUserId = userData.user.id;

      // Get the partner linked to this user
      const { data: partnerData } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", professionalUserId)
        .eq("active", true)
        .eq("approval_status", "approved")
        .maybeSingle();

      if (!partnerData) {
        return new Response(JSON.stringify({ error: "Not a registered professional" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate that this professional is linked to the connection
      const { data: conn } = await supabase
        .from("prontuario_connections")
        .select("user_id, external_professional_name")
        .eq("report_token", token)
        .eq("active", true)
        .eq("internal_partner_id", partnerData.id)
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ error: "No active link to this patient" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return report data
      return await buildReportResponse(supabase, conn.user_id, conn.external_professional_name, corsHeaders);
    }

    // ─── Path 2: Legacy access_code flow (temporary 5-min codes) ───
    if (access_code) {
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

      const createdAt = new Date(code.created_at).getTime();
      if (Date.now() - createdAt > 5 * 60 * 1000) {
        await supabase.from("report_access_codes").update({ used: true }).eq("id", code.id);
        return new Response(JSON.stringify({ error: "Access code expired" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("report_access_codes").update({ used: true }).eq("id", code.id);

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

      return await buildReportResponse(supabase, conn.user_id, conn.external_professional_name, corsHeaders);
    }

    return new Response(JSON.stringify({ error: "Authorization or access_code required" }), {
      status: 401,
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

async function buildReportResponse(
  supabase: any,
  userId: string,
  professionalName: string | null,
  corsHeaders: Record<string, string>
) {
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
    professional_name: professionalName,
    user_id: userId,
    profile: profileRes.data,
    scores: scoresRes.data?.[0] || null,
    alerts: alertsRes.data || [],
    measurements: measurementsRes.data || [],
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
