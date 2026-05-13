// Consulta o status atual do Recipient no Pagar.me e atualiza o kyc_status do afiliado.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mapStatus(s: string): "approved" | "rejected" | "pending" {
  const v = (s || "").toLowerCase();
  if (v === "active" || v === "approved") return "approved";
  if (v === "refused" || v === "blocked" || v === "rejected") return "rejected";
  return "pending";
}

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401);
    const { data: r } = await sb.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!r) return j({ error: "Forbidden" }, 403);

    const { affiliate_id, company_id } = await req.json();
    if (!affiliate_id || !company_id) return j({ error: "affiliate_id and company_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: aff } = await admin.from("affiliates").select("*").eq("id", affiliate_id).single();
    if (!aff) return j({ error: "Affiliate not found" }, 404);
    if (!aff.pagarme_recipient_id) return j({ error: "Recipient ainda não criado" }, 400);

    const creds = await getCompanyCredentials(admin, company_id);
    const res = await pagarmeFetch(creds.apiKey, `/recipients/${aff.pagarme_recipient_id}`, { method: "GET" });
    const out = await res.json();
    if (!res.ok) {
      console.error("pagarme get recipient error", JSON.stringify(out));
      return j({ error: "pagarme get recipient", details: out }, 502);
    }

    const kyc = mapStatus(out.status);
    await admin.from("affiliates").update({ kyc_status: kyc }).eq("id", affiliate_id);

    return j({ ok: true, status: out.status, kyc_status: kyc });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});
