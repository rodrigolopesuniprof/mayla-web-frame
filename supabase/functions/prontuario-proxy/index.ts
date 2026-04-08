import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/** Strip /docs, /docs/, trailing slashes from a base URL */
function sanitizeBaseUrl(raw: string): string {
  return raw.replace(/\/docs\/?$/, "").replace(/\/+$/, "");
}

const DEFAULT_BASE = "http://meddit-api-clinic-nv.us-west-2.elasticbeanstalk.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Auth check ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const globalMedditApiKey = Deno.env.get("MEDDIT_API_KEY") || "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Read action early ───────────────────────────────────────
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── test_connection — admin-only, no CPF needed ─────────────
    if (action === "test_connection") {
      // Check admin role
      const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) {
        return json({ error: "Apenas administradores podem testar conexões" }, 403);
      }

      const targetCompanyId = url.searchParams.get("company_id");
      if (!targetCompanyId) {
        return json({ error: "company_id obrigatório para teste" }, 400);
      }

      // Read config for target company (regardless of enabled flag)
      let medditBase = "";
      let medditApiKey = globalMedditApiKey;

      const { data: feature } = await adminClient
        .from("company_features")
        .select("config")
        .eq("company_id", targetCompanyId)
        .eq("feature_key", "prontuario_conveniado")
        .maybeSingle();

      const cfg = (feature?.config as Record<string, any>) || {};
      if (cfg.base_url) medditBase = cfg.base_url;
      if (cfg.api_key) medditApiKey = cfg.api_key;

      medditBase = sanitizeBaseUrl(medditBase) || DEFAULT_BASE;

      const testHeaders: Record<string, string> = {
        Authorization: medditApiKey,
        "Content-Type": "application/json",
      };

      try {
        const testResp = await fetch(`${medditBase}/v1/clinics/specialities`, {
          method: "GET",
          headers: testHeaders,
        });
        const ok = testResp.ok;
        const bodyText = await testResp.text();
        return json({ ok, status: testResp.status, body: bodyText.substring(0, 500) }, ok ? 200 : 502);
      } catch (fetchErr: any) {
        console.error("test_connection fetch error:", fetchErr);
        return json({ ok: false, status: 0, error: fetchErr.message }, 502);
      }
    }

    // ── Regular flow — needs profile + CPF ──────────────────────
    const { data: profile } = await adminClient
      .from("profiles")
      .select("cpf, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.cpf) {
      return json({ error: "CPF não encontrado no perfil" }, 400);
    }

    // Feature flag + provider config
    let medditBase = "";
    let medditApiKey = globalMedditApiKey;

    if (profile.company_id) {
      const { data: feature } = await adminClient
        .from("company_features")
        .select("enabled, config")
        .eq("company_id", profile.company_id)
        .eq("feature_key", "prontuario_conveniado")
        .maybeSingle();

      if (!feature?.enabled) {
        return json({ error: "Feature não habilitada para esta empresa" }, 403);
      }

      const cfg = (feature.config as Record<string, any>) || {};
      if (cfg.base_url) medditBase = cfg.base_url;
      if (cfg.api_key) medditApiKey = cfg.api_key;
    }

    medditBase = sanitizeBaseUrl(medditBase) || DEFAULT_BASE;

    const cpf = profile.cpf.replace(/\D/g, "");

    const medditHeaders: Record<string, string> = {
      Authorization: medditApiKey,
      "Content-Type": "application/json",
    };

    let medditUrl: string;
    let medditMethod = "GET";
    let medditBody: string | undefined;

    switch (action) {
      case "specialities":
        medditUrl = `${medditBase}/v1/clinics/specialities`;
        break;

      case "professionals": {
        const specialityId = url.searchParams.get("specialityId") || "";
        const name = url.searchParams.get("name") || "";
        medditUrl = `${medditBase}/v1/clinics/professional/search?specialityId=${specialityId}&name=${encodeURIComponent(name)}`;
        break;
      }

      case "offices":
        medditUrl = `${medditBase}/v1/clinics/offices`;
        break;

      case "calendar": {
        const professionalId = url.searchParams.get("professionalId");
        const officeId = url.searchParams.get("officeId");
        if (!professionalId || !officeId) {
          return json({ error: "professionalId e officeId são obrigatórios" }, 400);
        }
        medditUrl = `${medditBase}/v1/professionals/${professionalId}/office/${officeId}/calendar`;
        break;
      }

      case "check": {
        const profId = url.searchParams.get("professionalId");
        const patientId = url.searchParams.get("patientId");
        const qtdDays = url.searchParams.get("qtdDays") || "30";
        if (!profId || !patientId) {
          return json({ error: "professionalId e patientId são obrigatórios" }, 400);
        }
        medditUrl = `${medditBase}/v1/appointments/${qtdDays}/professional/${profId}/patient/${patientId}/check`;
        break;
      }

      case "register": {
        if (req.method !== "POST") {
          return json({ error: "Use POST para register" }, 405);
        }
        medditUrl = `${medditBase}/v1/appointments/register`;
        medditMethod = "POST";
        medditBody = await req.text();
        break;
      }

      case "patient":
        medditUrl = `${medditBase}/v1/users/cpf/${cpf}`;
        break;

      case "clinics":
        medditUrl = `${medditBase}/v1/clinics/user/cpf/${cpf}`;
        break;

      // Save / remove favorite (prontuario_connections)
      case "favorite": {
        if (req.method !== "POST") {
          return json({ error: "Use POST" }, 405);
        }
        const body = await req.json();
        const { external_professional_id, external_professional_name, external_clinic_name, external_patient_id } = body;
        if (!external_professional_id) {
          return json({ error: "external_professional_id obrigatório" }, 400);
        }

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
          return json({ error: "Erro ao salvar favorito" }, 500);
        }

        return json({ success: true, connection: conn });
      }

      case "unfavorite": {
        if (req.method !== "POST") {
          return json({ error: "Use POST" }, 405);
        }
        const unfavBody = await req.json();
        const { external_professional_id: unfavProfId } = unfavBody;
        await adminClient.from("prontuario_connections")
          .update({ active: false })
          .eq("user_id", userId)
          .eq("external_system", "meddit")
          .eq("external_professional_id", String(unfavProfId));

        return json({ success: true });
      }

      case "my_connections": {
        const { data: conns } = await adminClient.from("prontuario_connections")
          .select("*")
          .eq("user_id", userId)
          .eq("external_system", "meddit")
          .eq("active", true);

        return json(conns || []);
      }

      default:
        return json({ error: `Ação desconhecida: ${action}` }, 400);
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
    return json({ error: "Erro interno" }, 500);
  }
});
