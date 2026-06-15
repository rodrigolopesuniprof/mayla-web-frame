// Webhook Pagar.me: identifica empresa pelo metadata e processa eventos.
// Eventos: charge.paid, charge.payment_failed, charge.refunded,
// invoice.created, invoice.paid, invoice.payment_failed,
// subscription.canceled, recipient.*
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

    // HMAC opcional
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
  // ===== Pagamento confirmado =====
  if (type === "charge.paid" || type === "order.paid" || type === "invoice.paid") {
    const charge = obj.charges?.[0] ?? obj.last_transaction ?? obj;
    const chargeId = obj.last_transaction?.id ?? charge?.id ?? obj.id;
    const pagarmeSubId: string | null = obj.subscription_id ?? obj.subscription?.id ?? null;
    if (!chargeId && !pagarmeSubId) return;

    // 1) Pode ser cobrança PIX de cadastro pendente
    if (chargeId) {
      const { data: pending } = await admin
        .from("pending_signups")
        .select("*")
        .eq("pagarme_charge_id", chargeId)
        .is("processed_at", null)
        .maybeSingle();

      if (pending) {
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
        if (createErr || !created?.user) { console.error("pending_signup createUser failed", createErr); return; }
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
            pagarme_charge_id: chargeId,
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
    }

    // 2) Procura invoice por charge_id; se não houver, casa pela subscription
    let invoice: any = null;
    if (chargeId) {
      const r = await admin.from("subscription_invoices")
        .select("id, subscription_id, amount_cents")
        .eq("pagarme_charge_id", chargeId).maybeSingle();
      invoice = r.data;
    }

    let subscriptionId: string | null = invoice?.subscription_id ?? null;

    if (!subscriptionId && pagarmeSubId) {
      const r = await admin.from("subscriptions").select("id")
        .eq("pagarme_subscription_id", pagarmeSubId).maybeSingle();
      subscriptionId = r.data?.id ?? null;
    }

    if (invoice) {
      await admin.from("subscription_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", invoice.id);
    } else if (subscriptionId && chargeId) {
      // Renovação: invoice ainda não foi criada localmente, registra agora
      const amount = obj.amount ?? charge?.amount ?? 0;
      const { data: ins } = await admin.from("subscription_invoices").insert({
        subscription_id: subscriptionId,
        pagarme_charge_id: chargeId,
        amount_cents: amount,
        status: "paid",
        payment_method: obj.payment_method ?? "credit_card",
        paid_at: new Date().toISOString(),
      }).select("id, amount_cents").single();
      invoice = ins;
    }

    // Ativa / reativa subscription
    if (subscriptionId) {
      const { data: sub } = await admin.from("subscriptions")
        .select("id, plan_id, affiliate_id, status").eq("id", subscriptionId).single();
      if (sub) {
        const { data: plan } = await admin.from("subscription_plans")
          .select("billing_interval").eq("id", sub.plan_id).single();
        const months = plan?.billing_interval === "yearly" ? 12 : 1;
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + months);
        await admin.from("subscriptions").update({
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
        }).eq("id", sub.id);

        if (sub.affiliate_id && invoice) {
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
    }
    return;
  }

  // ===== Invoice criada (renovação iniciada) =====
  if (type === "invoice.created") {
    const pagarmeSubId: string | null = obj.subscription_id ?? obj.subscription?.id ?? null;
    if (!pagarmeSubId) return;
    const chargeId = obj.charge?.id ?? obj.charges?.[0]?.id ?? null;
    if (!chargeId) return;
    const { data: sub } = await admin.from("subscriptions")
      .select("id, payment_method").eq("pagarme_subscription_id", pagarmeSubId).maybeSingle();
    if (!sub) return;
    // Idempotente: só insere se não existir
    const { data: existing } = await admin.from("subscription_invoices")
      .select("id").eq("pagarme_charge_id", chargeId).maybeSingle();
    if (existing) return;
    await admin.from("subscription_invoices").insert({
      subscription_id: sub.id,
      pagarme_charge_id: chargeId,
      amount_cents: obj.amount ?? 0,
      status: "pending",
      payment_method: sub.payment_method,
      due_date: obj.due_at ?? null,
    });
    return;
  }

  // ===== Cobrança falhou =====
  if (type === "charge.payment_failed" || type === "charge.refused" || type === "invoice.payment_failed") {
    const charge = obj.charges?.[0] ?? obj;
    const chargeId = charge?.id ?? obj.charge?.id ?? null;
    const pagarmeSubId: string | null = obj.subscription_id ?? obj.subscription?.id ?? charge?.subscription_id ?? null;
    const reason = charge?.last_transaction?.acquirer_message
      ?? charge?.last_transaction?.refuse_reason
      ?? obj.last_transaction?.acquirer_message
      ?? null;

    if (chargeId) {
      await admin.from("subscription_invoices")
        .update({ status: "failed", failure_reason: reason })
        .eq("pagarme_charge_id", chargeId);
    }

    let subscriptionId: string | null = null;
    if (chargeId) {
      const r = await admin.from("subscription_invoices").select("subscription_id, user_id:subscription_id")
        .eq("pagarme_charge_id", chargeId).maybeSingle();
      subscriptionId = r.data?.subscription_id ?? null;
    }
    if (!subscriptionId && pagarmeSubId) {
      const r = await admin.from("subscriptions").select("id")
        .eq("pagarme_subscription_id", pagarmeSubId).maybeSingle();
      subscriptionId = r.data?.id ?? null;
    }
    if (!subscriptionId) return;

    await admin.from("subscriptions")
      .update({ status: "past_due" }).eq("id", subscriptionId);

    // E-mail "pagamento recusado"
    const { data: sub } = await admin.from("subscriptions").select("user_id").eq("id", subscriptionId).single();
    if (sub?.user_id) {
      const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id);
      const recipient = authUser?.user?.email;
      if (recipient) {
        const { data: profile } = await admin.from("profiles").select("full_name").eq("user_id", sub.user_id).maybeSingle();
        const name = (profile?.full_name ?? "").split(" ")[0] || "Olá";
        await admin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: recipient,
            subject: "Pagamento recusado — atualize seus dados",
            html: renderFailedEmail(name, reason),
            message_id: `sub-failed-${subscriptionId}-${chargeId ?? Date.now()}`,
            template_name: "subscription_payment_failed",
          },
        }).catch((e: any) => console.log("enqueue_email skipped:", e?.message));
      }
    }
    return;
  }

  // ===== Reembolso =====
  if (type === "charge.refunded") {
    const charge = obj.charges?.[0] ?? obj;
    const chargeId = charge?.id ?? obj.id;
    if (!chargeId) return;
    await admin.from("subscription_invoices")
      .update({ status: "refunded" }).eq("pagarme_charge_id", chargeId);
    const { data: invoice } = await admin.from("subscription_invoices")
      .select("subscription_id").eq("pagarme_charge_id", chargeId).maybeSingle();
    if (invoice?.subscription_id) {
      await admin.from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("id", invoice.subscription_id);
    }
    return;
  }

  // ===== Cancelamento confirmado =====
  if (type === "subscription.canceled") {
    const { data: sub } = await admin.from("subscriptions")
      .select("id, user_id").eq("pagarme_subscription_id", obj.id).maybeSingle();
    if (!sub) return;
    await admin.from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", sub.id);

    // E-mail apenas se for cancelamento iniciado fora do nosso fluxo (sem cancel_at_period_end)
    const { data: full } = await admin.from("subscriptions")
      .select("cancel_at_period_end").eq("id", sub.id).single();
    if (!full?.cancel_at_period_end) {
      const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id);
      const recipient = authUser?.user?.email;
      if (recipient) {
        const { data: profile } = await admin.from("profiles").select("full_name").eq("user_id", sub.user_id).maybeSingle();
        const name = (profile?.full_name ?? "").split(" ")[0] || "Olá";
        await admin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: recipient,
            subject: "Assinatura cancelada",
            html: renderCanceledEmail(name),
            message_id: `sub-canceled-${sub.id}-${Date.now()}`,
            template_name: "subscription_canceled",
          },
        }).catch((e: any) => console.log("enqueue_email skipped:", e?.message));
      }
    }
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

function renderFailedEmail(name: string, reason: string | null): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f5f0;">
    <div style="background:#fff;border-radius:16px;padding:32px;">
      <h1 style="color:#c0392b;font-size:20px;">Pagamento recusado</h1>
      <p>Olá, ${name}.</p>
      <p>Não conseguimos processar a cobrança da sua assinatura${reason ? ` (<em>${reason}</em>)` : ""}.</p>
      <p>Seu acesso aos serviços premium foi suspenso temporariamente. Para regularizar, acesse o app e atualize seu cartão.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="https://saude.saudecomvc.com.br/minha-assinatura" style="background:#2a6496;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Atualizar pagamento</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:12px;color:#aaa;text-align:center;">E-mail automático — não responda.</p>
    </div></body></html>`;
}

function renderCanceledEmail(name: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f5f0;">
    <div style="background:#fff;border-radius:16px;padding:32px;">
      <h1 style="color:#2a6496;font-size:20px;">Assinatura cancelada</h1>
      <p>Olá, ${name}.</p>
      <p>Confirmamos o cancelamento da sua assinatura. Seu acesso aos serviços premium foi encerrado.</p>
      <p>Se quiser voltar, é só assinar novamente dentro do app a qualquer momento.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:12px;color:#aaa;text-align:center;">E-mail automático — não responda.</p>
    </div></body></html>`;
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
