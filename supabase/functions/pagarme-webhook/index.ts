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

  if (type === "charge.payment_failed") {
    const charge = obj.charges?.[0] ?? obj;
    await admin.from("subscription_invoices")
      .update({ status: "failed", failure_reason: charge.last_transaction?.acquirer_message ?? null })
      .eq("pagarme_charge_id", charge.id);
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
