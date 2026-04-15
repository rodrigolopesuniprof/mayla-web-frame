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

    // Generate a single-use access_code (valid 5 min)
    const accessCode = crypto.randomUUID();
    const { error: insertErr } = await supabase.from("report_access_codes").insert({
      report_token: connection.report_token,
      access_code: accessCode,
      professional_id: connection.external_professional_id,
    });

    if (insertErr) {
      console.error("Failed to create access_code:", insertErr);
      return new Response(JSON.stringify({ authorized: false, error: "Failed to generate access code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build report URL with temporary code (no pid exposed)
    const reportUrl = `${url.origin}/relatorio/medico/${connection.report_token}?code=${accessCode}`;

    return new Response(JSON.stringify({
      authorized: true,
      professional_id: connection.external_professional_id,
      professional_name: connection.external_professional_name,
      access_code: accessCode,
      report_url: reportUrl,
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
