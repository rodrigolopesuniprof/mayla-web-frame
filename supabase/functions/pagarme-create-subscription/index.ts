// Cria customer + subscription no Pagar.me da empresa
// Suporta: cartão (recorrente automático) ou PIX (cobrança manual mensal — 1ª cobrança gerada agora)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  company_id: string;
  plan_id: string;
  payment_method: "credit_card" | "pix";
  customer: {
    name: string;
    email: string;
    document: string; // CPF
    phone?: string;
  };
  card_token?: string; // tokenizado no front com pagarme.js
  referral_code?: string;
  user_id?: string; // se já cadastrado, usar user_id; senão criar conta
  password?: string; // para criar conta nova
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body.company_id || !body.plan_id || !body.payment_method || !body.customer?.email) {
      return json({ error: "Missing fields" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Carrega plano + assignment (preço efetivo)
    const { data: plan } = await admin
      .from("subscription_plans").select("*").eq("id", body.plan_id).single();
    if (!plan) return json({ error: "Plan not found" }, 404);

    const { data: assignment } = await admin
      .from("company_plan_assignments").select("custom_price_cents, active")
      .eq("company_id", body.company_id).eq("plan_id", body.plan_id).maybeSingle();
    if (!assignment?.active) return json({ error: "Plan not assigned to company" }, 400);

    const priceCents = assignment.custom_price_cents ?? plan.price_cents;

    // Carrega credenciais da empresa
    const creds = await getCompanyCredentials(admin, body.company_id);

    // Resolve afiliado (split)
    let affiliate: { id: string; commission_percent: number; pagarme_recipient_id: string | null } | null = null;
    if (body.referral_code) {
      const { data: aff } = await admin
        .from("affiliates")
        .select("id, commission_percent, pagarme_recipient_id, active")
        .eq("referral_code", body.referral_code).maybeSingle();
      if (aff?.active) affiliate = aff as typeof affiliate;
    }

    // Cria customer no Pagar.me
    const customerRes = await pagarmeFetch(creds.apiKey, "/customers", {
      method: "POST",
      body: JSON.stringify({
        name: body.customer.name,
        email: body.customer.email,
        document: body.customer.document.replace(/\D/g, ""),
        document_type: "CPF",
        type: "individual",
        phones: body.customer.phone
          ? { mobile_phone: parsePhone(body.customer.phone) }
          : undefined,
      }),
    });
    const customer = await customerRes.json();
    if (!customerRes.ok) return json({ error: "pagarme customer", details: customer }, 502);

    // Resolve / cria usuário Supabase
    let userId = body.user_id ?? null;
    if (!userId) {
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing.users.find((u) => u.email?.toLowerCase() === body.customer.email.toLowerCase());
      if (found) {
        userId = found.id;
      } else {
        if (!body.password || body.password.length < 6) {
          return json({ error: "Password required for new account" }, 400);
        }
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: body.customer.email,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            full_name: body.customer.name,
            cpf: body.customer.document.replace(/\D/g, ""),
            company_id: body.company_id,
          },
        });
        if (createErr) return json({ error: createErr.message }, 400);
        userId = created.user!.id;
      }
    }

    // Build split rules (se houver afiliado)
    let splitRules: unknown[] | undefined;
    if (affiliate?.pagarme_recipient_id && creds.recipientId) {
      splitRules = [
        {
          recipient_id: affiliate.pagarme_recipient_id,
          amount: Math.round(Number(affiliate.commission_percent)),
          type: "percentage",
          options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
        },
        {
          recipient_id: creds.recipientId,
          amount: 100 - Math.round(Number(affiliate.commission_percent)),
          type: "percentage",
          options: { charge_processing_fee: true, charge_remainder_fee: true, liable: true },
        },
      ];
    }

    if (body.payment_method === "credit_card") {
      if (!body.card_token) return json({ error: "card_token required" }, 400);

      const subRes = await pagarmeFetch(creds.apiKey, "/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customer.id,
          payment_method: "credit_card",
          card_token: body.card_token,
          interval: plan.billing_interval === "yearly" ? "year" : "month",
          interval_count: 1,
          billing_type: "prepaid",
          minimum_price: priceCents,
          items: [
            { description: plan.name, quantity: 1, pricing_scheme: { price: priceCents, scheme_type: "unit" } },
          ],
          ...(splitRules ? { split: splitRules } : {}),
          metadata: {
            company_id: body.company_id, plan_id: plan.id, user_id: userId,
            affiliate_id: affiliate?.id ?? "",
          },
        }),
      });
      const sub = await subRes.json();
      if (!subRes.ok) return json({ error: "pagarme subscription", details: sub }, 502);

      const { data: insertedSub } = await admin
        .from("subscriptions").insert({
          user_id: userId,
          company_id: body.company_id,
          plan_id: plan.id,
          affiliate_id: affiliate?.id ?? null,
          pagarme_subscription_id: sub.id,
          pagarme_customer_id: customer.id,
          status: sub.status === "active" ? "active" : "pending",
          payment_method: "credit_card",
          current_period_start: sub.current_cycle?.start_at ?? null,
          current_period_end: sub.current_cycle?.end_at ?? null,
          card_brand: sub.card?.brand ?? null,
          card_last4: sub.card?.last_four_digits ?? null,
        }).select("id").single();

      return json({ ok: true, subscription_id: insertedSub?.id, pagarme_id: sub.id, status: sub.status });
    }

    // PIX: cria subscription manual + 1ª charge PIX
    const { data: insertedSub } = await admin
      .from("subscriptions").insert({
        user_id: userId,
        company_id: body.company_id,
        plan_id: plan.id,
        affiliate_id: affiliate?.id ?? null,
        pagarme_customer_id: customer.id,
        status: "pending",
        payment_method: "pix",
      }).select("id").single();

    const chargeRes = await pagarmeFetch(creds.apiKey, "/orders", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customer.id,
        items: [{ amount: priceCents, description: plan.name, quantity: 1 }],
        payments: [{
          payment_method: "pix",
          pix: { expires_in: 3600 },
          ...(splitRules ? { split: splitRules } : {}),
        }],
        metadata: {
          subscription_id: insertedSub?.id, company_id: body.company_id,
          plan_id: plan.id, user_id: userId, affiliate_id: affiliate?.id ?? "",
        },
      }),
    });
    const order = await chargeRes.json();
    if (!chargeRes.ok) return json({ error: "pagarme pix order", details: order }, 502);

    const charge = order.charges?.[0];
    const tx = charge?.last_transaction;
    await admin.from("subscription_invoices").insert({
      subscription_id: insertedSub?.id,
      pagarme_charge_id: charge?.id,
      amount_cents: priceCents,
      status: "pending",
      payment_method: "pix",
      pix_qr_code: tx?.qr_code,
      pix_qr_code_url: tx?.qr_code_url,
      pix_expires_at: tx?.expires_at,
      due_date: tx?.expires_at,
    });

    return json({
      ok: true, subscription_id: insertedSub?.id, charge_id: charge?.id,
      pix: { qr_code: tx?.qr_code, qr_code_url: tx?.qr_code_url, expires_at: tx?.expires_at },
    });
  } catch (e) {
    console.error("create-subscription error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function parsePhone(p: string) {
  const digits = p.replace(/\D/g, "");
  return {
    country_code: "55",
    area_code: digits.slice(-11, -9) || "11",
    number: digits.slice(-9),
  };
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
