import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401);

    const { subscription_id } = await req.json();
    if (!subscription_id) return j({ error: "subscription_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sub } = await admin.from("subscriptions")
      .select("id, user_id, company_id, pagarme_subscription_id").eq("id", subscription_id).single();
    if (!sub) return j({ error: "Not found" }, 404);

    // Permissão: dono ou admin
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (sub.user_id !== u.user.id && !role) return j({ error: "Forbidden" }, 403);

    if (sub.pagarme_subscription_id) {
      const creds = await getCompanyCredentials(admin, sub.company_id);
      await pagarmeFetch(creds.apiKey, `/subscriptions/${sub.pagarme_subscription_id}`, { method: "DELETE" });
    }
    await admin.from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", sub.id);
    return j({ ok: true });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
