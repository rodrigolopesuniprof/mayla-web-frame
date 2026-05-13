// Cria Recipient no Pagar.me usando a chave da empresa indicada.
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

    const ri = aff.register_info || {};
    if (!ri.address) return j({ error: "Endereço obrigatório (preencha em editar)" }, 400);
    if (!ri.phone) return j({ error: "Telefone com DDD obrigatório" }, 400);

    const creds = await getCompanyCredentials(admin, company_id);

    const docDigits = aff.cpf_cnpj.replace(/\D/g, "");
    const isCnpj = docDigits.length === 14;

    const address = {
      street: ri.address.street, complementary: ri.address.complement || "N/A",
      street_number: ri.address.street_number, neighborhood: ri.address.neighborhood,
      city: ri.address.city, state: ri.address.state,
      zip_code: (ri.address.zip_code || "").replace(/\D/g, ""),
      reference_point: "N/A",
    };
    const phones = {
      mobile_phone: {
        country_code: ri.phone.country_code || "55",
        area_code: ri.phone.area_code, number: ri.phone.number,
      },
    };

    const register_information = isCnpj ? {
      email: aff.email,
      document: docDigits,
      type: "corporation",
      company_name: aff.name,
      trading_name: aff.name,
      annual_revenue: 120000,
      corporation_type: "ltda",
      founding_date: ri.birthdate || "2020-01-01",
      main_address: address,
      phone_numbers: [phones.mobile_phone],
      managing_partners: [{
        email: aff.email, name: aff.name, mother_name: "N/I",
        birthdate: ri.birthdate || "1990-01-01",
        monthly_income: 10000, professional_occupation: "Empresário",
        self_declared_legal_representative: true,
        document: docDigits.slice(0, 11), // fallback
        address, phone_numbers: [phones.mobile_phone],
      }],
    } : {
      email: aff.email,
      document: docDigits,
      type: "individual",
      name: aff.name,
      mother_name: ri.mother_name || "Não informado",
      birthdate: ri.birthdate,
      monthly_income: 10000,
      professional_occupation: "Autônomo",
      main_address: address,
      phone_numbers: [phones.mobile_phone],
    };

    const body = {
      register_information,
      default_bank_account: aff.bank_account,
      transfer_settings: { transfer_enabled: true, transfer_interval: "weekly", transfer_day: 5 },
      automatic_anticipation_settings: { enabled: false },
    };

    const res = await pagarmeFetch(creds.apiKey, "/recipients", { method: "POST", body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok) {
      console.error("pagarme recipient error", JSON.stringify(out));
      return j({ error: "pagarme recipient", details: out }, 502);
    }

    await admin.from("affiliates").update({
      pagarme_recipient_id: out.id,
      kyc_status: out.status === "active" ? "approved" : "pending",
    }).eq("id", affiliate_id);

    return j({ ok: true, recipient_id: out.id, status: out.status });
  } catch (e) { return j({ error: (e as Error).message }, 500); }
});

function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
