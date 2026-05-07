// Cron diário: gera nova cobrança PIX para assinaturas PIX próximas do vencimento
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCompanyCredentials, pagarmeFetch } from "../_shared/pagarme.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Janela: vencendo nos próximos 3 dias e ainda não tem fatura PIX pendente futura
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 3);

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, company_id, plan_id, current_period_end, payment_method, status, plan:subscription_plans(price_cents, billing_interval), affiliate_id")
    .eq("payment_method", "pix")
    .in("status", ["active", "past_due", "trialing"])
    .lte("current_period_end", horizon.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const sub of subs ?? []) {
    try {
      // Já existe fatura PIX pendente para o próximo ciclo?
      const { data: existing } = await supabase
        .from("subscription_invoices")
        .select("id, status, due_date")
        .eq("subscription_id", sub.id)
        .eq("payment_method", "pix")
        .in("status", ["pending"])
        .gte("due_date", new Date().toISOString())
        .maybeSingle();
      if (existing) {
        results.push({ sub: sub.id, skipped: "already_pending" });
        continue;
      }

      const amount = sub.plan?.price_cents;
      if (!amount) {
        results.push({ sub: sub.id, skipped: "no_price" });
        continue;
      }

      const { apiKey } = await getCompanyCredentials(supabase, sub.company_id);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);

      const orderRes = await pagarmeFetch(apiKey, "/orders", {
        method: "POST",
        body: JSON.stringify({
          items: [{ amount, description: "Assinatura mensal", quantity: 1 }],
          customer_id: undefined,
          payments: [{
            payment_method: "pix",
            pix: { expires_in: 3 * 24 * 3600 },
          }],
          metadata: { subscription_id: sub.id, user_id: sub.user_id },
        }),
      });

      const order = await orderRes.json();
      if (!orderRes.ok) {
        results.push({ sub: sub.id, error: order });
        continue;
      }

      const charge = order.charges?.[0];
      const lastTx = charge?.last_transaction;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      await supabase.from("subscription_invoices").insert({
        subscription_id: sub.id,
        pagarme_charge_id: charge?.id,
        amount_cents: amount,
        status: "pending",
        payment_method: "pix",
        pix_qr_code: lastTx?.qr_code,
        pix_qr_code_url: lastTx?.qr_code_url,
        pix_expires_at: lastTx?.expires_at,
        due_date: dueDate.toISOString(),
      });

      // Notifica usuário
      await supabase.from("notifications").insert({
        title: "Renovação da assinatura 💳",
        body: "Geramos um novo PIX para renovar sua assinatura. Pague em até 3 dias para manter o acesso.",
        emoji: "💳",
        scope: "personal",
        target_user_id: sub.user_id,
        created_by: sub.user_id,
      });

      results.push({ sub: sub.id, charge_id: charge?.id, ok: true });
    } catch (e: any) {
      results.push({ sub: sub.id, error: e.message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
