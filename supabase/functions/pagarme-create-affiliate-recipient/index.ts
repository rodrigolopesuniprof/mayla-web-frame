// Cria Recipient no Pagar.me global (super admin). A chave usada é a primeira empresa com integração ativa.
// Para arquitetura multi-conta, cada split pode usar recipient_id criado em qualquer conta-mãe Pagar.me.
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
    if (!aff.bank_account) return j({ error: "Bank account required" }, 400);

    const creds = await getCompanyCredentials(admin, company_id);

    const isCnpj = aff.cpf_cnpj.replace(/\D/g, "").length === 14;
    const body = {
      name: aff.name,
      email: aff.email,
      description: `Afiliado ${aff.name}`,
      document: aff.cpf_cnpj.replace(/\D/g, ""),
      type: isCnpj ? "corporation" : "individual",
      default_bank_account: aff.bank_account,
      transfer_settings: { transfer_enabled: true, transfer_interval: "weekly", transfer_day: 5 },
    };
    const res = await pagarmeFetch(creds.apiKey, "/recipients", { method: "POST", body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok) return j({ error: "pagarme recipient", details: out }, 502);

    await admin.from("affiliates").update({
      pagarme_recipient_id: out.id,
      kyc_status: out.status === "active" ? "approved" : "pending",
    }).eq("id", affiliate_id);

    return j({ ok: true, recipient_id: out.id });
  } catch (e) { return j({ error: (e as Error).message }, 500); }
});

function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
