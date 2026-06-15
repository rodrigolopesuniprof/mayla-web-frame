// Cria customer + subscription no Pagar.me da empresa
// Suporta: cartão (recorrente automático) ou PIX (cobrança manual mensal — 1ª cobrança gerada agora)
//
// SEGURANÇA — fluxo:
//  - Cartão: cria sub no Pagar.me e faz polling curto do status da 1ª charge.
//    SÓ cria a conta auth.users se a charge for "paid". Caso contrário, retorna erro e
//    nenhuma conta é criada / nenhuma subscription local é inserida.
//  - PIX: cria a ordem PIX e grava em `pending_signups` (NÃO cria auth.users).
//    A conta é criada pelo webhook `charge.paid` (`pagarme-webhook`).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BillingAddress {
  zip_code: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country?: string;
}

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
  billing_address?: BillingAddress;
  card_token?: string; // tokenizado no front com pagarme.js
  referral_code?: string;
  user_id?: string; // se já cadastrado, usar user_id; senão criar conta após confirmação
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
    if (!plan) {
      console.error("plan_not_found", body.plan_id);
      return json({ ok: false, error: "plan_not_found", message: "Plano não encontrado." });
    }

    const { data: assignment } = await admin
      .from("company_plan_assignments").select("custom_price_cents, active")
      .eq("company_id", body.company_id).eq("plan_id", body.plan_id).maybeSingle();
    if (!assignment?.active) {
      console.error("plan_not_assigned", body.company_id, body.plan_id);
      return json({ ok: false, error: "plan_not_assigned", message: "Plano não disponível para esta empresa." });
    }

    const priceCents = assignment.custom_price_cents ?? plan.price_cents;
    if (!priceCents || priceCents <= 0) {
      console.error("invalid_plan_price", priceCents);
      return json({ ok: false, error: "invalid_plan_price", message: "Preço do plano inválido." });
    }

    // Para cartão, billing_address e telefone são obrigatórios (anti-fraude)
    if (body.payment_method === "credit_card") {
      if (!body.customer?.phone) {
        return json({ ok: false, error: "missing_phone", message: "Telefone é obrigatório para pagamento com cartão." });
      }
      const ba = body.billing_address;
      if (!ba?.zip_code || !ba?.street || !ba?.number || !ba?.neighborhood || !ba?.city || !ba?.state) {
        return json({ ok: false, error: "missing_address", message: "Endereço de cobrança completo é obrigatório." });
      }
    }

    // Carrega credenciais da empresa
    let creds;
    try {
      creds = await getCompanyCredentials(admin, body.company_id);
    } catch (e) {
      console.error("credentials_error", (e as Error).message);
      return json({ ok: false, error: "credentials_error", message: (e as Error).message });
    }

    // Resolve afiliado (split)
    let affiliate: { id: string; commission_percent: number; pagarme_recipient_id: string | null } | null = null;
    if (body.referral_code) {
      const { data: aff } = await admin
        .from("affiliates")
        .select("id, commission_percent, pagarme_recipient_id, active")
        .eq("referral_code", body.referral_code).maybeSingle();
      if (aff?.active) affiliate = aff as typeof affiliate;
    }

    // Para usuário NOVO: validar senha antes de qualquer coisa, mas NÃO criar conta ainda
    const isNewAccount = !body.user_id;
    if (isNewAccount && (!body.password || body.password.length < 6)) {
      return json({ ok: false, error: "weak_password", message: "Senha deve ter ao menos 6 caracteres." });
    }

    // Se já existe usuário com o mesmo email, recupera o id para vincular a subscription
    let existingUserId: string | null = body.user_id ?? null;
    if (!existingUserId) {
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing.users.find(
        (u) => u.email?.toLowerCase() === body.customer.email.toLowerCase()
      );
      if (found) existingUserId = found.id;
    }

    // Monta endereço para Pagar.me (formato v5)
    const pagarmeAddress = body.billing_address ? {
      line_1: `${body.billing_address.number}, ${body.billing_address.street}, ${body.billing_address.neighborhood}`,
      line_2: body.billing_address.complement ?? "",
      zip_code: body.billing_address.zip_code.replace(/\D/g, ""),
      city: body.billing_address.city,
      state: body.billing_address.state,
      country: body.billing_address.country ?? "BR",
    } : undefined;

    // Cria customer no Pagar.me (com endereço + telefone — chave para anti-fraude)
    const customerRes = await pagarmeFetch(creds.apiKey, "/customers", {
      method: "POST",
      body: JSON.stringify({
        name: body.customer.name,
        email: body.customer.email,
        document: body.customer.document.replace(/\D/g, ""),
        document_type: "CPF",
        type: "individual",
        ...(pagarmeAddress ? { address: pagarmeAddress } : {}),
        phones: body.customer.phone
          ? { mobile_phone: parsePhone(body.customer.phone) }
          : undefined,
      }),
    });
    const customer = await customerRes.json();
    if (!customerRes.ok) {
      console.error("pagarme_customer_error", customer);
      return json({
        ok: false,
        error: "pagarme_customer",
        message: customer?.message ?? "Falha ao criar cliente no Pagar.me",
        details: customer,
      });
    }

    // Build split rules (se houver afiliado)
    let splitRules: unknown[] | undefined;
    if (affiliate?.pagarme_recipient_id && creds.recipientId) {
      const commission = Math.round(Number(affiliate.commission_percent));
      splitRules = [
        {
          recipient_id: affiliate.pagarme_recipient_id,
          amount: commission,
          type: "percentage",
          options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
        },
        {
          recipient_id: creds.recipientId,
          amount: 100 - commission,
          type: "percentage",
          options: { charge_processing_fee: true, charge_remainder_fee: true, liable: true },
        },
      ];
    }

    // ============================================================
    // CARTÃO DE CRÉDITO — cria sub, faz polling, só cria user se charge "paid"
    // ============================================================
    if (body.payment_method === "credit_card") {
      if (!body.card_token) return json({ error: "card_token required" }, 400);

      // Payload corrigido: SEM minimum_price (gerava "billing value required" no ciclo).
      // pricing_scheme.price já define o valor unitário fixo do item.
      const subPayload: Record<string, unknown> = {
        customer_id: customer.id,
        payment_method: "credit_card",
        card_token: body.card_token,
        interval: plan.billing_interval === "yearly" ? "year" : "month",
        interval_count: 1,
        billing_type: "prepaid",
        installments: 1,
        items: [
          {
            description: plan.name,
            quantity: 1,
            pricing_scheme: { price: priceCents, scheme_type: "unit" },
          },
        ],
        metadata: {
          company_id: body.company_id,
          plan_id: plan.id,
          affiliate_id: affiliate?.id ?? "",
          ...(existingUserId ? { user_id: existingUserId } : {}),
        },
      };
      if (splitRules) subPayload.split = splitRules;

      const subRes = await pagarmeFetch(creds.apiKey, "/subscriptions", {
        method: "POST",
        body: JSON.stringify(subPayload),
      });
      const sub = await subRes.json();
      if (!subRes.ok) return json({ error: "pagarme subscription", details: sub }, 502);

      // POLLING da 1ª charge — até 4 tentativas de 1.5s
      let firstCharge: any = null;
      let chargeStatus = "pending";
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        const cycleRes = await pagarmeFetch(
          creds.apiKey,
          `/subscriptions/${sub.id}/charges?size=1&page=1`,
          { method: "GET" }
        );
        if (cycleRes.ok) {
          const cycleData = await cycleRes.json();
          firstCharge = cycleData?.data?.[0] ?? null;
          chargeStatus = String(firstCharge?.status ?? "pending");
          if (["paid", "failed", "refused", "canceled", "chargedback"].includes(chargeStatus)) break;
        } else {
          await cycleRes.text();
        }
      }

      // Se a charge falhou ou foi recusada → cancela a sub e retorna erro SEM criar conta
      if (chargeStatus !== "paid") {
        try {
          await pagarmeFetch(creds.apiKey, `/subscriptions/${sub.id}`, { method: "DELETE" });
        } catch (_) { /* best-effort */ }
        const failureReason =
          firstCharge?.last_transaction?.acquirer_message ??
          firstCharge?.last_transaction?.gateway_response?.errors?.[0]?.message ??
          firstCharge?.last_transaction?.refuse_reason ??
          "Pagamento não autorizado pela operadora";
        return json({
          error: "payment_failed",
          message: failureReason,
          charge_status: chargeStatus,
          pagarme_charge_id: firstCharge?.id ?? null,
        }, 402);
      }

      // Charge paga: criar usuário (se for novo) e gravar subscription local
      let userId = existingUserId;
      if (!userId) {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: body.customer.email,
          password: body.password!,
          email_confirm: true,
          user_metadata: {
            full_name: body.customer.name,
            cpf: body.customer.document.replace(/\D/g, ""),
            company_id: body.company_id,
          },
        });
        if (createErr || !created.user) {
          // Conta não criada mas pagamento OK: registrar para investigação manual
          console.error("createUser failed after paid charge", createErr);
          return json({ error: "account_creation_failed", details: createErr?.message }, 500);
        }
        userId = created.user.id;
      }

      const { data: insertedSub } = await admin
        .from("subscriptions").insert({
          user_id: userId,
          company_id: body.company_id,
          plan_id: plan.id,
          affiliate_id: affiliate?.id ?? null,
          pagarme_subscription_id: sub.id,
          pagarme_customer_id: customer.id,
          status: "active",
          payment_method: "credit_card",
          current_period_start: sub.current_cycle?.start_at ?? new Date().toISOString(),
          current_period_end: sub.current_cycle?.end_at ?? null,
          card_brand: sub.card?.brand ?? null,
          card_last4: sub.card?.last_four_digits ?? null,
        }).select("id").single();

      if (insertedSub && firstCharge?.id) {
        await admin.from("subscription_invoices").insert({
          subscription_id: insertedSub.id,
          pagarme_charge_id: firstCharge.id,
          amount_cents: priceCents,
          status: "paid",
          payment_method: "credit_card",
          paid_at: new Date().toISOString(),
        });
      }

      return json({
        ok: true,
        subscription_id: insertedSub?.id,
        pagarme_id: sub.id,
        status: "active",
        charge_id: firstCharge?.id,
      });
    }

    // ============================================================
    // PIX — cria ordem, grava em pending_signups. Webhook cria a conta após charge.paid.
    // ============================================================
    const pixOrderPayload: Record<string, unknown> = {
      customer_id: customer.id,
      items: [{ amount: priceCents, description: plan.name, quantity: 1 }],
      payments: [{
        payment_method: "pix",
        pix: { expires_in: 3600 },
        ...(splitRules ? { split: splitRules } : {}),
      }],
      metadata: {
        company_id: body.company_id,
        plan_id: plan.id,
        affiliate_id: affiliate?.id ?? "",
        flow: "pending_signup",
        ...(existingUserId ? { user_id: existingUserId } : {}),
      },
    };

    const chargeRes = await pagarmeFetch(creds.apiKey, "/orders", {
      method: "POST",
      body: JSON.stringify(pixOrderPayload),
    });
    const order = await chargeRes.json();
    if (!chargeRes.ok) return json({ error: "pagarme pix order", details: order }, 502);

    const charge = order.charges?.[0];
    const tx = charge?.last_transaction;
    if (!charge?.id) return json({ error: "no_charge_returned", details: order }, 502);

    if (existingUserId) {
      // Usuário já existe: insere subscription local em pending; webhook ativa.
      const { data: insertedSub } = await admin
        .from("subscriptions").insert({
          user_id: existingUserId,
          company_id: body.company_id,
          plan_id: plan.id,
          affiliate_id: affiliate?.id ?? null,
          pagarme_customer_id: customer.id,
          status: "pending",
          payment_method: "pix",
        }).select("id").single();

      await admin.from("subscription_invoices").insert({
        subscription_id: insertedSub?.id,
        pagarme_charge_id: charge.id,
        amount_cents: priceCents,
        status: "pending",
        payment_method: "pix",
        pix_qr_code: tx?.qr_code,
        pix_qr_code_url: tx?.qr_code_url,
        pix_expires_at: tx?.expires_at,
        due_date: tx?.expires_at,
      });

      return json({
        ok: true,
        subscription_id: insertedSub?.id,
        charge_id: charge.id,
        pix: { qr_code: tx?.qr_code, qr_code_url: tx?.qr_code_url, expires_at: tx?.expires_at },
      });
    }

    // Usuário novo: NÃO cria auth.users agora — guarda em pending_signups
    await admin.from("pending_signups").insert({
      pagarme_charge_id: charge.id,
      pagarme_customer_id: customer.id,
      email: body.customer.email,
      password: body.password!,
      full_name: body.customer.name,
      cpf: body.customer.document.replace(/\D/g, ""),
      company_id: body.company_id,
      plan_id: plan.id,
      affiliate_id: affiliate?.id ?? null,
      payment_method: "pix",
      amount_cents: priceCents,
    });

    return json({
      ok: true,
      pending: true,
      charge_id: charge.id,
      pix: { qr_code: tx?.qr_code, qr_code_url: tx?.qr_code_url, expires_at: tx?.expires_at },
      message: "Aguardando confirmação do pagamento PIX. Sua conta será criada automaticamente após a confirmação.",
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
