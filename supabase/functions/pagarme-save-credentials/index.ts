// Salva credenciais Pagar.me de uma empresa (somente super admin)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encryptSecret } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { company_id, api_key, recipient_id, webhook_secret, environment, enabled, require_paid_subscription } = body;
    if (!company_id) return json({ error: "company_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const update: Record<string, unknown> = {
      company_id,
      environment: environment ?? "test",
      enabled: !!enabled,
      require_paid_subscription: !!require_paid_subscription,
    };
    if (typeof recipient_id === "string") update.pagarme_recipient_id = recipient_id || null;
    if (typeof webhook_secret === "string") update.webhook_secret = webhook_secret || null;
    if (typeof api_key === "string" && api_key.trim().length > 0) {
      update.pagarme_api_key_encrypted = await encryptSecret(api_key.trim());
    }

    const { error } = await admin
      .from("company_payment_credentials")
      .upsert(update, { onConflict: "company_id" });
    if (error) throw error;

    return json({ ok: true });
  } catch (e) {
    console.error("save-credentials error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
