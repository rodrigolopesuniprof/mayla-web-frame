// Webhook Pagar.me: identifica empresa pelo recipient_id e processa eventos.
// Eventos tratados: charge.paid, charge.payment_failed, subscription.canceled, invoice.paid, order.paid
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const eventId: string = payload.id;
    const eventType: string = payload.type;
    if (!eventId || !eventType) return new Response("bad", { status: 400 });

    // Identifica empresa pelo metadata.company_id no objeto envolvido
    const obj = payload.data ?? {};
    const companyId: string | null =
      obj.metadata?.company_id ??
      obj.subscription?.metadata?.company_id ??
      null;

    // Idempotência
    const { error: insertErr } = await admin.from("webhook_events").insert({
      pagarme_event_id: eventId, event_type: eventType,
      payload, company_id: companyId,
    });
    if (insertErr && !insertErr.message.includes("duplicate")) {
      console.error("event insert err", insertErr);
    }
    if (insertErr?.message.includes("duplicate")) {
      return new Response("ok", { status: 200 });
    }

    // Validação HMAC opcional (se webhook_secret configurado)
    if (companyId) {
      const { data: cred } = await admin
        .from("company_payment_credentials").select("webhook_secret").eq("company_id", companyId).maybeSingle();
      const sig = req.headers.get("x-hub-signature") || req.headers.get("X-Hub-Signature");
      if (cred?.webhook_secret && sig) {
        const valid = await verifyHmac(cred.webhook_secret, rawBody, sig);
        if (!valid) {
          await admin.from("webhook_events").update({ error: "invalid signature" }).eq("pagarme_event_id", eventId);
          return new Response("invalid signature", { status: 401 });
        }
      }
    }

    // Processa
    try {
      await handleEvent(admin, eventType, obj);
      await admin.from("webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("pagarme_event_id", eventId);
    } catch (e) {
      console.error("process error", e);
      await admin.from("webhook_events")
        .update({ error: (e as Error).message }).eq("pagarme_event_id", eventId);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("webhook fatal", e);
    return new Response("err", { status: 500 });
  }
});

async function handleEvent(admin: any, type: string, obj: any) {
  if (type === "charge.paid" || type === "order.paid") {
    const charge = obj.charges?.[0] ?? obj;
    if (!charge?.id) return;

    // 1) Pode ser uma cobrança PIX de cadastro pendente — criar conta agora
    const { data: pending } = await admin
      .from("pending_signups")
      .select("*")
      .eq("pagarme_charge_id", charge.id)
      .is("processed_at", null)
      .maybeSingle();

    if (pending) {
      // Cria auth.users
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: pending.email,
        password: pending.password,
        email_confirm: true,
        user_metadata: {
          full_name: pending.full_name,
          cpf: pending.cpf,
          company_id: pending.company_id,
        },
      });
      if (createErr || !created?.user) {
        console.error("pending_signup createUser failed", createErr);
        return;
      }
      const newUserId = created.user.id;

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data: insertedSub } = await admin
        .from("subscriptions").insert({
          user_id: newUserId,
          company_id: pending.company_id,
          plan_id: pending.plan_id,
          affiliate_id: pending.affiliate_id,
          pagarme_customer_id: pending.pagarme_customer_id,
          pagarme_subscription_id: pending.pagarme_subscription_id,
          status: "active",
          payment_method: pending.payment_method,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
        }).select("id").single();

      if (insertedSub) {
        await admin.from("subscription_invoices").insert({
          subscription_id: insertedSub.id,
          pagarme_charge_id: charge.id,
          amount_cents: pending.amount_cents,
          status: "paid",
          payment_method: pending.payment_method,
          paid_at: new Date().toISOString(),
        });
      }

      await admin.from("pending_signups")
        .update({ processed_at: new Date().toISOString(), user_id: newUserId })
        .eq("id", pending.id);
      return;
    }

    // 2) Fluxo normal: invoice já existe (usuário já tinha conta)
    const { data: invoice } = await admin
      .from("subscription_invoices").select("id, subscription_id, amount_cents")
      .eq("pagarme_charge_id", charge.id).maybeSingle();
    if (!invoice) return;
    await admin.from("subscription_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoice.id);
    // Ativa subscription
    const { data: sub } = await admin
      .from("subscriptions").select("id, plan_id, affiliate_id")
      .eq("id", invoice.subscription_id).single();
    if (sub) {
      const { data: plan } = await admin.from("subscription_plans").select("billing_interval").eq("id", sub.plan_id).single();
      const months = plan?.billing_interval === "yearly" ? 12 : 1;
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + months);
      await admin.from("subscriptions").update({
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      }).eq("id", sub.id);
      // Comissão
      if (sub.affiliate_id) {
        const { data: aff } = await admin.from("affiliates")
          .select("commission_percent").eq("id", sub.affiliate_id).single();
        if (aff) {
          const cents = Math.round((invoice.amount_cents * Number(aff.commission_percent)) / 100);
          await admin.from("affiliate_commissions").insert({
            affiliate_id: sub.affiliate_id,
            subscription_id: sub.id,
            invoice_id: invoice.id,
            amount_cents: cents,
            commission_percent: aff.commission_percent,
            status: "pending",
          });
        }
      }
    }
    return;
  }

  if (type === "charge.payment_failed" || type === "charge.refused") {
    const charge = obj.charges?.[0] ?? obj;
    const reason = charge.last_transaction?.acquirer_message
      ?? charge.last_transaction?.refuse_reason
      ?? null;

    // Atualiza invoice (se existir)
    await admin.from("subscription_invoices")
      .update({ status: "failed", failure_reason: reason })
      .eq("pagarme_charge_id", charge.id);

    // Atualiza subscription correspondente para past_due (bloqueia acesso)
    const { data: invoice } = await admin
      .from("subscription_invoices").select("subscription_id")
      .eq("pagarme_charge_id", charge.id).maybeSingle();
    if (invoice?.subscription_id) {
      await admin.from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", invoice.subscription_id);
    }
    return;
  }

  if (type === "subscription.canceled") {
    await admin.from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("pagarme_subscription_id", obj.id);
    return;
  }

  if (type === "recipient.updated" || type === "recipient.kyc_updated" || type === "recipient.created") {
    const recipientId = obj.id;
    if (!recipientId) return;
    const status = String(obj.status || "").toLowerCase();
    let kyc: "approved" | "rejected" | "pending" = "pending";
    if (status === "active" || status === "approved") kyc = "approved";
    else if (status === "refused" || status === "blocked" || status === "rejected") kyc = "rejected";
    await admin.from("affiliates")
      .update({ kyc_status: kyc })
      .eq("pagarme_recipient_id", recipientId);
    return;
  }
}

async function verifyHmac(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
    const hex = Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
    const provided = signature.replace(/^sha256=/, "");
    return hex === provided;
  } catch { return false; }
}
