import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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

    // Check if there's a valid report_share for this user, or build URL with the permanent token
    const publicUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "");
    // The report URL uses the report_token directly
    const reportUrl = `${url.origin}/relatorio/medico/${connection.report_token}`;

    return new Response(JSON.stringify({
      authorized: true,
      professional_id: connection.external_professional_id,
      professional_name: connection.external_professional_name,
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
