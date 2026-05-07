// Retorna a public key Pagar.me da empresa para tokenização de cartão no front
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

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
    const creds = await getCompanyCredentials(admin, company_id);
    // Busca lista de chaves da conta — a primeira public key
    const res = await pagarmeFetch(creds.apiKey, "/keys", { method: "GET" });
    const out = await res.json();
    if (!res.ok) return j({ error: "pagarme keys", details: out }, 502);
    const pk = (out.data ?? []).find((k: any) => k.type === "public" || k.kind === "public")?.id
            ?? (out.data ?? [])[0]?.id;
    return j({ public_key: pk });
  } catch (e) { return j({ error: (e as Error).message }, 500); }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
