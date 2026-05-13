// Retorna a public key Pagar.me da empresa para tokenização de cartão no front
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { company_id } = await req.json();
    if (!company_id) return j({ error: "company_id required" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin
      .from("company_payment_credentials")
      .select("pagarme_public_key, enabled")
      .eq("company_id", company_id)
      .maybeSingle();
    if (error) return j({ error: error.message }, 500);
    if (!data?.enabled) return j({ error: "Integração Pagar.me inativa para esta empresa" }, 400);
    if (!data?.pagarme_public_key) return j({ error: "Public key não configurada para esta empresa" }, 400);
    return j({ public_key: data.pagarme_public_key });
  } catch (e) { return j({ error: (e as Error).message }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
