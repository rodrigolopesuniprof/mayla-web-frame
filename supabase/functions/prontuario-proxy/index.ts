import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const globalMedditApiKey = Deno.env.get("MEDDIT_API_KEY") || "";

    // Validate user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    // Get user CPF from profile using service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient.from("profiles").select("cpf, company_id").eq("user_id", userId).single();
    if (!profile?.cpf) {
      return new Response(JSON.stringify({ error: "CPF não encontrado no perfil" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check feature flag and get provider config
    let medditBase = "";
    let medditApiKey = globalMedditApiKey;

    if (profile.company_id) {
      const { data: feature } = await adminClient.from("company_features")
        .select("enabled, config")
        .eq("company_id", profile.company_id)
        .eq("feature_key", "prontuario_conveniado")
        .maybeSingle();
      if (!feature?.enabled) {
        return new Response(JSON.stringify({ error: "Feature não habilitada para esta empresa" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Read per-company provider credentials from config
      const cfg = (feature.config as Record<string, any>) || {};
      if (cfg.base_url) medditBase = cfg.base_url;
      if (cfg.api_key) medditApiKey = cfg.api_key;
    }

    // Fallback to hardcoded base URL if not set in company config
    if (!medditBase) {
      medditBase = "http://meddit-api-clinic-nv.us-west-2.elasticbeanstalk.com";
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const cpf = profile.cpf.replace(/\D/g, "");

    const medditHeaders: Record<string, string> = {
      "Authorization": medditApiKey,
      "Content-Type": "application/json",
    };

    let medditUrl: string;
    let medditMethod = "GET";
    let medditBody: string | undefined;

    switch (action) {
      case "specialities":
        medditUrl = `${MEDDIT_BASE}/v1/clinics/specialities`;
        break;

      case "professionals": {
        const specialityId = url.searchParams.get("specialityId") || "";
        const name = url.searchParams.get("name") || "";
        medditUrl = `${MEDDIT_BASE}/v1/clinics/professional/search?specialityId=${specialityId}&name=${encodeURIComponent(name)}`;
        break;
      }

      case "offices":
        medditUrl = `${MEDDIT_BASE}/v1/clinics/offices`;
        break;

      case "calendar": {
        const professionalId = url.searchParams.get("professionalId");
        const officeId = url.searchParams.get("officeId");
        if (!professionalId || !officeId) {
          return new Response(JSON.stringify({ error: "professionalId e officeId são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        medditUrl = `${MEDDIT_BASE}/v1/professionals/${professionalId}/office/${officeId}/calendar`;
        break;
      }

      case "check": {
        const profId = url.searchParams.get("professionalId");
        const patientId = url.searchParams.get("patientId");
        const qtdDays = url.searchParams.get("qtdDays") || "30";
        if (!profId || !patientId) {
          return new Response(JSON.stringify({ error: "professionalId e patientId são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        medditUrl = `${MEDDIT_BASE}/v1/appointments/${qtdDays}/professional/${profId}/patient/${patientId}/check`;
        break;
      }

      case "register": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "Use POST para register" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        medditUrl = `${MEDDIT_BASE}/v1/appointments/register`;
        medditMethod = "POST";
        medditBody = await req.text();
        break;
      }

      case "patient": {
        medditUrl = `${MEDDIT_BASE}/v1/users/cpf/${cpf}`;
        break;
      }

      case "clinics": {
        medditUrl = `${MEDDIT_BASE}/v1/clinics/user/cpf/${cpf}`;
        break;
      }

      // Save / remove favorite (prontuario_connections)
      case "favorite": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const body = await req.json();
        const { external_professional_id, external_professional_name, external_clinic_name, external_patient_id } = body;
        if (!external_professional_id) {
          return new Response(JSON.stringify({ error: "external_professional_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Upsert connection
        const { data: conn, error: connErr } = await adminClient.from("prontuario_connections").upsert({
          user_id: userId,
          company_id: profile.company_id,
          external_system: "meddit",
          external_professional_id: String(external_professional_id),
          external_professional_name: external_professional_name || null,
          external_clinic_name: external_clinic_name || null,
          external_patient_id: external_patient_id ? String(external_patient_id) : null,
          active: true,
        }, { onConflict: "user_id,external_system,external_professional_id" }).select().single();

        if (connErr) {
          console.error("Favorite upsert error:", connErr);
          return new Response(JSON.stringify({ error: "Erro ao salvar favorito" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ success: true, connection: conn }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "unfavorite": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const unfavBody = await req.json();
        const { external_professional_id: unfavProfId } = unfavBody;
        await adminClient.from("prontuario_connections")
          .update({ active: false })
          .eq("user_id", userId)
          .eq("external_system", "meddit")
          .eq("external_professional_id", String(unfavProfId));

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "my_connections": {
        const { data: conns } = await adminClient.from("prontuario_connections")
          .select("*")
          .eq("user_id", userId)
          .eq("external_system", "meddit")
          .eq("active", true);

        return new Response(JSON.stringify(conns || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Proxy to Meddit
    const medditResp = await fetch(medditUrl, {
      method: medditMethod,
      headers: medditHeaders,
      body: medditBody,
    });

    const responseText = await medditResp.text();
    return new Response(responseText, {
      status: medditResp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("prontuario-proxy error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
