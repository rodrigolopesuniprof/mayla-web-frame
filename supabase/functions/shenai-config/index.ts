// Returns the global Shen.ai API key only when the caller is authenticated
// AND their company has Vitals enabled with provider="shenai".
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("SHENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "shenai_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Get user's company and check feature/provider
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await admin
      .from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();

    const companyId = profile?.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ ok: false, error: "no_company" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: feature } = await admin
      .from("company_features")
      .select("enabled, config")
      .eq("company_id", companyId)
      .eq("feature_key", "binah_special_measurement")
      .maybeSingle();

    const cfg = (feature?.config || {}) as Record<string, any>;
    if (!feature?.enabled || cfg.provider !== "shenai") {
      return new Response(JSON.stringify({ ok: false, error: "shenai_not_enabled_for_company" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, api_key: apiKey, user_id: user.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
