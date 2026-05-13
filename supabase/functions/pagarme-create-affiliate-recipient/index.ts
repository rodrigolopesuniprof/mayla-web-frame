// Cria Recipient no Pagar.me usando a chave da empresa indicada.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BANK_CODE_BY_NAME: Record<string, string> = {
  itau: "341",
  bradesco: "237",
  santander: "033",
  bancodobrasil: "001",
  bb: "001",
  caixa: "104",
  nubank: "260",
  inter: "077",
  sicoob: "756",
  sicredi: "748",
  mercadopago: "323",
};

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeBankCode(value: unknown): string {
  const numeric = digits(value);
  if (numeric) return numeric.length <= 3 ? numeric.padStart(3, "0") : numeric;
  return BANK_CODE_BY_NAME[normalizeText(value)] ?? String(value ?? "").trim();
}

function normalizePhone(registerInfo: any, fallbackPhone: unknown) {
  const phone = registerInfo?.phone ?? {};
  let ddd = digits(phone.ddd ?? phone.area_code ?? phone.areaCode).slice(0, 2);
  let number = digits(phone.number ?? phone.phone);
  const fallback = digits(fallbackPhone);

  if ((!ddd || !number) && fallback.length >= 10) {
    ddd = fallback.slice(0, 2);
    number = fallback.slice(2);
  }

  if (!ddd || !number) return null;
  return { ddd, number: number.slice(-9), type: "mobile" };
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
    if (!aff.bank_account) return j({ error: "Bank account required" }, 400);

    const ri = aff.register_info || {};
    if (!ri.address) return j({ error: "Endereço obrigatório (preencha em editar)" }, 400);
    const phoneNumber = normalizePhone(ri, aff.phone);
    if (!phoneNumber) return j({ error: "Telefone com DDD obrigatório. Edite o afiliado e informe DDD + número." }, 400);

    const bankCode = normalizeBankCode(aff.bank_account.bank);
    if (!/^\d{3}$/.test(bankCode)) {
      return j({ error: "Código do banco inválido. Informe o código COMPE de 3 dígitos, ex.: Itaú 341, Bradesco 237." }, 400);
    }
    const default_bank_account = {
      ...aff.bank_account,
      holder_document: digits(aff.bank_account.holder_document),
      bank: bankCode,
      branch_number: digits(aff.bank_account.branch_number),
      account_number: digits(aff.bank_account.account_number),
      account_check_digit: digits(aff.bank_account.account_check_digit),
    };

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
      phone_numbers: [phoneNumber],
      managing_partners: [{
        email: aff.email, name: aff.name, mother_name: "N/I",
        type: "individual",
        birthdate: ri.birthdate || "1990-01-01",
        monthly_income: 10000, professional_occupation: "Empresário",
        self_declared_legal_representative: true,
        document: docDigits.slice(0, 11), // fallback
        address, phone_numbers: [phoneNumber],
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
      address: address,
      phone_numbers: [phoneNumber],
    };

    const body = {
      register_information,
      default_bank_account,
      transfer_settings: { transfer_enabled: true, transfer_interval: "Weekly", transfer_day: 5 },
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
